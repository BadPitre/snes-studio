/*
 * harness.c — runs a SNES ROM in the snes9x libretro core for N frames,
 * dumps the framebuffer as PPM plus brightness statistics.
 * Usage: harness <core.so> <rom.sfc> <frames> <out.ppm> [pad_script]
 *   pad_script: "frame:button,frame:button,..." (button: A,B,U,D,L,R,S)
 */
#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"

static uint16_t fb[1024 * 512];
static unsigned fb_w, fb_h;
static int pixfmt = RETRO_PIXEL_FORMAT_0RGB1555;

/* pad 1 state (a bitmask of RETRO_DEVICE_ID_JOYPAD_*) */
static uint32_t pad_state = 0;

static void video_cb(const void *data, unsigned width, unsigned height, size_t pitch)
{
    if (!data) return;
    fb_w = width; fb_h = height;
    for (unsigned y = 0; y < height && y < 512; y++)
        memcpy(&fb[y * 1024], (const uint8_t *)data + y * pitch,
               width * 2 > 2048 ? 2048 : width * 2);
}
static long long audio_abs = 0;
static long audio_n = 0;
/* AUDIO_DUMP=<file>: raw interleaved s16 stereo at the core's rate —
   lets a test measure the ROM's PITCH, not just its level. */
static FILE *audio_dump = NULL;
static void audio_cb(int16_t l, int16_t r)
{
    audio_abs += (l < 0 ? -l : l) + (r < 0 ? -r : r);
    audio_n += 2;
    if (audio_dump) { fwrite(&l, 2, 1, audio_dump); fwrite(&r, 2, 1, audio_dump); }
}
static size_t audio_batch_cb(const int16_t *d, size_t frames)
{
    for (size_t i = 0; i < frames * 2; i++)
        audio_abs += d[i] < 0 ? -d[i] : d[i];
    audio_n += frames * 2;
    if (audio_dump) fwrite(d, 4, frames, audio_dump);
    return frames;
}
static void input_poll_cb(void) {}
static int16_t input_state_cb(unsigned port, unsigned device, unsigned index, unsigned id)
{
    (void)index;
    if (port == 0 && device == RETRO_DEVICE_JOYPAD)
        return (pad_state >> id) & 1;
    return 0;
}
static bool env_cb(unsigned cmd, void *data)
{
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
        pixfmt = *(const enum retro_pixel_format *)data;
        return true;
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
    case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
        *(const char **)data = ".";
        return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE:
        *(bool *)data = true;
        return true;
    default:
        return false;
    }
}

static void rgb(uint16_t px, int *r, int *g, int *b)
{
    if (pixfmt == RETRO_PIXEL_FORMAT_RGB565) {
        *r = (px >> 11) & 31; *g = (px >> 5) & 63; *b = px & 31;
        *r = (*r << 3) | (*r >> 2); *g = (*g << 2) | (*g >> 4); *b = (*b << 3) | (*b >> 2);
    } else {
        *r = (px >> 10) & 31; *g = (px >> 5) & 31; *b = px & 31;
        *r = (*r << 3) | (*r >> 2); *g = (*g << 3) | (*g >> 2); *b = (*b << 3) | (*b >> 2);
    }
}

int main(int argc, char **argv)
{
    if (argc < 5) { fprintf(stderr, "usage: %s core rom frames out.ppm [pad]\n", argv[0]); return 2; }
    void *h = dlopen(argv[1], RTLD_NOW);
    if (!h) { fprintf(stderr, "dlopen: %s\n", dlerror()); return 2; }

    void (*set_environment)(retro_environment_t) = dlsym(h, "retro_set_environment");
    void (*set_video)(retro_video_refresh_t) = dlsym(h, "retro_set_video_refresh");
    void (*set_audio)(retro_audio_sample_t) = dlsym(h, "retro_set_audio_sample");
    void (*set_audio_batch)(retro_audio_sample_batch_t) = dlsym(h, "retro_set_audio_sample_batch");
    void (*set_input_poll)(retro_input_poll_t) = dlsym(h, "retro_set_input_poll");
    void (*set_input_state)(retro_input_state_t) = dlsym(h, "retro_set_input_state");
    void (*init)(void) = dlsym(h, "retro_init");
    bool (*load_game)(const struct retro_game_info *) = dlsym(h, "retro_load_game");
    void (*run)(void) = dlsym(h, "retro_run");

    const char *ad = getenv("AUDIO_DUMP");
    if (ad) audio_dump = fopen(ad, "wb");

    set_environment(env_cb);
    set_video(video_cb);
    set_audio(audio_cb);
    set_audio_batch(audio_batch_cb);
    set_input_poll(input_poll_cb);
    set_input_state(input_state_cb);
    init();

    FILE *f = fopen(argv[2], "rb");
    if (!f) { perror("rom"); return 2; }
    fseek(f, 0, SEEK_END); long sz = ftell(f); fseek(f, 0, SEEK_SET);
    void *rom = malloc(sz);
    if (fread(rom, 1, sz, f) != (size_t)sz) { perror("read"); return 2; }
    fclose(f);

    struct retro_game_info gi = { argv[2], rom, (size_t)sz, NULL };
    if (!load_game(&gi)) { fprintf(stderr, "load_game failed\n"); return 2; }

    int frames = atoi(argv[3]);
    const char *pad = argc > 5 ? argv[5] : "";

    for (int i = 0; i < frames; i++) {
        /* pad script: hold for 5 frames from the given frame onwards */
        pad_state = 0;
        const char *p = pad;
        while (*p) {
            int fr, fe; char btn;
            if (sscanf(p, "%d-%d:%c", &fr, &fe, &btn) != 3) {
                if (sscanf(p, "%d:%c", &fr, &btn) == 2) fe = fr + 4; else { p = strchr(p, ','); if (!p) break; p++; continue; }
            }
            if (i >= fr && i <= fe) {
                switch (btn) {
                case 'A': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_A; break;
                case 'B': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_B; break;
                case 'U': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_UP; break;
                case 'D': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_DOWN; break;
                case 'L': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_LEFT; break;
                case 'R': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_RIGHT; break;
                case 'S': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_START; break;
                case 'E': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_SELECT; break;
                case 'W': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_R; break;
                case 'Q': pad_state |= 1 << RETRO_DEVICE_ID_JOYPAD_L; break;
                }
            }
            p = strchr(p, ',');
            if (!p) break;
            p++;
        }
        run();
        if ((i + 1) % 100 == 0) {
            printf("audio frames %d-%d : niveau moyen %lld\n", i - 99, i,
                   audio_n ? audio_abs / audio_n : 0);
            audio_abs = 0; audio_n = 0;
        }
    }

    const char *wd = getenv("WRAM_DUMP");
    if (wd) {
        void *(*gm)(unsigned) = dlsym(h, "retro_get_memory_data");
        size_t (*gs)(unsigned) = dlsym(h, "retro_get_memory_size");
        void *wram = gm(RETRO_MEMORY_SYSTEM_RAM);
        size_t wsz = gs(RETRO_MEMORY_SYSTEM_RAM);
        if (wram && wsz) { FILE *wf = fopen(wd, "wb"); fwrite(wram, 1, wsz, wf); fclose(wf); printf("wram dump: %zu\n", wsz); }
    }

    /* dump VRAM si demande (variable d'env VRAM_DUMP) */
    const char *vd = getenv("VRAM_DUMP");
    if (vd) {
        void *(*get_mem)(unsigned) = dlsym(h, "retro_get_memory_data");
        size_t (*get_size)(unsigned) = dlsym(h, "retro_get_memory_size");
        if (get_mem && get_size) {
            void *vram = get_mem(RETRO_MEMORY_VIDEO_RAM);
            size_t vsz = get_size(RETRO_MEMORY_VIDEO_RAM);
            if (vram && vsz) {
                FILE *vf = fopen(vd, "wb");
                fwrite(vram, 1, vsz, vf);
                fclose(vf);
                printf("vram dump: %zu octets -> %s\n", vsz, vd);
            } else printf("vram non exposee\n");
        }
    }

    /* stats + dump PPM */
    long lum = 0; int nonblack = 0;
    FILE *o = fopen(argv[4], "wb");
    fprintf(o, "P6\n%u %u\n255\n", fb_w, fb_h);
    for (unsigned y = 0; y < fb_h; y++)
        for (unsigned x = 0; x < fb_w; x++) {
            int r, g, b;
            rgb(fb[y * 1024 + x], &r, &g, &b);
            fputc(r, o); fputc(g, o); fputc(b, o);
            lum += r + g + b;
            if (r + g + b > 24) nonblack++;
        }
    fclose(o);
    if (audio_dump) fclose(audio_dump);
    printf("frames=%d taille=%ux%u lum_moy=%.1f pixels_non_noirs=%d (%.1f%%)\n",
           frames, fb_w, fb_h,
           fb_w * fb_h ? (double)lum / (fb_w * fb_h) : 0,
           nonblack, fb_w * fb_h ? 100.0 * nonblack / (fb_w * fb_h) : 0);
    return 0;
}
