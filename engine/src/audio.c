/*
 * audio.c — musique par scène + sons scriptés via snesmod (PVSnesLib).
 *
 * Le soundbank est généré par smconv depuis les .it copiés par datagen
 * (src/data/music/, ordre = music_id) et épinglé en bank $87 (kit §3).
 * AUDIO_ENABLED vient de datagen : un projet sans musique compile sans
 * soundbank ni référence au symbole SOUNDBANK__.
 *
 * Sons (B1) : échantillons BRR 8 kHz de data_sfx.c (module sfx de
 * datagen, toujours émis). La région d'effets du SPC est dimensionnée
 * sur le PLUS GROS son (SFX_REGION pages de 256 octets) : chaque
 * spcPlaySound y recharge le sien (modèle PVSnesLib, exemple tada).
 * spcAllocateSoundRegion COUPE le module en cours — appelé au BOOT
 * uniquement, avant la première musique.
 */
#include <snes.h>
#include "formats.h"
#include "audio.h"
#include "data/audio_cfg.h"

#if AUDIO_ENABLED
extern char SOUNDBANK__;
#endif

#if SFX_COUNT
extern const u8 *const sfx_ptr[];
extern const u16 sfx_len[];
static brrsamples sfx_tab[SFX_COUNT];
#endif

static u8 current_music;

void audio_init(void)
{
#if SFX_COUNT
  u8 i;
#endif

  current_music = MUSIC_NONE;
#if AUDIO_ENABLED || SFX_COUNT
  spcBoot(); /* les sons BRR ont besoin du SPC même sans musique */
#endif
#if AUDIO_ENABLED
  spcSetBank(&SOUNDBANK__);
#endif
#if SFX_COUNT
  spcAllocateSoundRegion(SFX_REGION);
  for (i = 0; i < SFX_COUNT; i++)
    spcSetSoundEntry(15, 8, 4, sfx_len[i], (u8 *)sfx_ptr[i], &sfx_tab[i]);
#endif
}

void audio_play_sfx(u8 sfx_id)
{
#if SFX_COUNT
  /* spcPlaySound indexe À REBOURS (0 = dernier chargé) — remis à
     l'endroit ici pour que sfx_id suive l'ordre du projet */
  if (sfx_id < SFX_COUNT)
    spcPlaySound((u8)(SFX_COUNT - 1 - sfx_id));
#else
  (void)sfx_id;
#endif
}

void audio_play_music(u8 music_id)
{
  if (music_id == current_music)
    return;
#if AUDIO_ENABLED
  if (current_music != MUSIC_NONE)
    spcStop();
  if (music_id != MUSIC_NONE)
  {
    spcLoad(music_id);
    spcPlay(0);
  }
#endif
  current_music = music_id;
}

void audio_process(void)
{
#if AUDIO_ENABLED
  spcProcess();
#endif
}
