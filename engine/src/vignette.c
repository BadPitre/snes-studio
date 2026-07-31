/*
 * vignette.c — vignettes animées (B5). Voir vignette.h.
 *
 * Plan chars OBJ : le slot v occupe le bloc 32x32 aux chars
 * 384 + v*4 (rangées 24-27 de la grille de names — un OBJ 32x32
 * adresse les chars c, c+1..c+3 / c+16.. / c+32.. / c+48..). Les
 * frames sont émises par datagen en 4 rangées de 4 chars : un
 * changement de frame = 4 DMA de 128 octets (au VBlank, un slot par
 * frame au plus — budget du panneau S6).
 *
 * OAM : entrées 96-97 (le joueur occupe 0-1, les acteurs 2-49, la
 * météo 100-123). Écriture DIRECTE du shadow (oamMemory) chaque
 * frame + oamSetEx (taille LARGE 32x32 + visibilité) — réaffirmé
 * chaque frame : l'ouverture d'un écran composé cache tout l'OAM.
 */
#include <snes.h>
#include "vignette.h"
#include "player.h"
#include "actors.h"
#include "camera.h"
#include "vram.h"

/* registre généré (data_vignettes.c — toujours émis) */
extern const u8 vig_count;
extern const u8 vig_frames[];
extern const u8 *const vig_chars[];
extern const u16 *const vig_pals[];

#define VIG_OAM(s) ((u16)(96 + (s)) << 2)
#define VIG_CHAR(s) (384 + (s) * 4) /* bloc 32x32 du slot */

static u8 v_id[VIG_SLOTS]; /* 0xFF = slot vide */
static u8 v_frame[VIG_SLOTS];
static u8 v_mode[VIG_SLOTS]; /* 0 stop, 1 une fois puis cache, 2 boucle */
static u8 v_speed[VIG_SLOTS];
static u8 v_timer[VIG_SLOTS];
static u8 v_x[VIG_SLOTS];
static u8 v_y[VIG_SLOTS];
static u8 v_anc[VIG_SLOTS];   /* VIG_ANC_* (offsets signés si suivi) */
static u8 v_act[VIG_SLOTS];   /* acteur suivi (VIG_ANC_ACTOR) */
static u8 v_own[VIG_SLOTS];   /* 1 = piloté par le lecteur d'animations */
static u8 v_dirty = 0;        /* bitmask : frame à transférer */
static u8 v_pal = 0;          /* bitmask : palette à transférer */
static u8 v_init = 0;         /* statics posés (init explicite tcc) */

static void vig_init_once(void)
{
  u8 i;

  if (v_init)
    return;
  v_init = 1;
  for (i = 0; i < VIG_SLOTS; i++)
  {
    v_id[i] = 0xFF;
    v_own[i] = 0;
    v_anc[i] = VIG_ANC_SCREEN;
    v_act[i] = 0xFF;
  }
  v_dirty = 0;
  v_pal = 0;
}

void vig_show(u8 slot, u8 vig_id, u8 x, u8 y)
{
  vig_init_once();
  if (slot >= VIG_SLOTS || vig_id >= vig_count)
    return;
  v_id[slot] = vig_id;
  v_frame[slot] = 0;
  v_mode[slot] = 0;
  v_own[slot] = 0; /* préemption : un vig_show scripté reprend le slot
                      au lecteur d'animations, qui le verra à sa frame
                      suivante et arrêtera l'animation sans rien cacher */
  v_x[slot] = x;
  v_y[slot] = y;
  v_dirty |= (u8)(1 << slot);
  v_pal |= (u8)(1 << slot);
}

void vig_anchor(u8 slot, u8 anchor)
{
  if (slot < VIG_SLOTS)
    v_anc[slot] = anchor;
}

void vig_anchor_actor(u8 slot, u8 index)
{
  if (slot >= VIG_SLOTS)
    return;
  v_anc[slot] = VIG_ANC_ACTOR;
  v_act[slot] = index;
}

void vig_set_frame(u8 slot, u8 frame)
{
  if (slot >= VIG_SLOTS || v_id[slot] == 0xFF)
    return;
  if (frame >= vig_frames[v_id[slot]] || frame == v_frame[slot])
    return; /* même cellule : pas de DMA (une frame de vignette = 512 o) */
  v_frame[slot] = frame;
  v_dirty |= (u8)(1 << slot);
}

void vig_move(u8 slot, u8 x, u8 y)
{
  if (slot >= VIG_SLOTS)
    return;
  v_x[slot] = x;
  v_y[slot] = y;
}

u8 vig_free_slot(void)
{
  u8 s;

  vig_init_once();
  s = VIG_SLOTS;
  while (s--)
    if (v_id[s] == 0xFF)
      return s;
  return 0xFF;
}

void vig_own_anim(u8 slot)
{
  if (slot < VIG_SLOTS)
    v_own[slot] = 1;
}

u8 vig_is_anim(u8 slot)
{
  return (slot < VIG_SLOTS) ? v_own[slot] : 0;
}

void vig_play(u8 slot, u8 mode, u8 speed)
{
  if (slot >= VIG_SLOTS || v_id[slot] == 0xFF)
    return;
  v_mode[slot] = mode > 2 ? 2 : mode;
  v_speed[slot] = speed ? speed : 8;
  v_timer[slot] = v_speed[slot];
}

void vig_hide(u8 slot)
{
  if (slot >= VIG_SLOTS)
    return;
  v_id[slot] = 0xFF;
  v_own[slot] = 0;
  oamSetVisible(VIG_OAM(slot), OBJ_HIDE);
}

void vig_reload(void)
{
  u8 s;

  if (!v_init)
    return;
  for (s = 0; s < VIG_SLOTS; s++)
    if (v_id[s] != 0xFF)
    {
      v_dirty |= (u8)(1 << s);
      v_pal |= (u8)(1 << s);
    }
}

void vig_update(void)
{
  u8 s, sx, sy;
  u16 wx, wy;
  u8 *om;

  if (!v_init)
    return;
  for (s = 0; s < VIG_SLOTS; s++)
  {
    if (v_id[s] == 0xFF)
      continue;
    /* animation : un pas toutes les speed frames */
    if (v_mode[s] && --v_timer[s] == 0)
    {
      v_timer[s] = v_speed[s];
      v_frame[s]++;
      if (v_frame[s] >= vig_frames[v_id[s]])
      {
        if (v_mode[s] == 1)
        {
          vig_hide(s); /* « une fois » : l'animation se range seule */
          continue;
        }
        v_frame[s] = 0;
      }
      v_dirty |= (u8)(1 << s);
    }
    /* position : écran, ou accrochée au héros / à un acteur (offsets
       signés — le (0,0) ancre le coin de la vignette sur le coin du
       metasprite suivi) */
    if (v_anc[s] == VIG_ANC_ACTOR)
    {
      wx = actor_pos_x(v_act[s]) - camera.x + (s8)v_x[s];
      wy = actor_pos_y(v_act[s]) - camera.y + (s8)v_y[s];
      sx = (u8)wx;
      sy = (u8)wy;
    }
    else if (v_anc[s])
    {
      wx = player.x - camera.x + (s8)v_x[s];
      wy = player.y - camera.y + (s8)v_y[s];
      sx = (u8)wx;
      sy = (u8)wy;
    }
    else
    {
      sx = v_x[s];
      sy = v_y[s];
    }
    om = oamMemory + VIG_OAM(s);
    om[0] = sx;
    om[1] = sy;
    om[2] = (u8)(VIG_CHAR(s) - 256); /* chars 384+ : 9e bit dans attr */
    om[3] = 0x30 | ((u8)(5 + s) << 1) | 1; /* prio 3, palette 5/6 */
    oamSetEx(VIG_OAM(s), OBJ_LARGE, OBJ_SHOW); /* 32x32 + visible —
        réaffirmé chaque frame (l'écran composé cache tout l'OAM) */
  }
}

void vig_vblank(void)
{
  u8 s, r;
  const u8 *src;
  u16 base;

  if (!v_dirty && !v_pal)
    return;
  for (s = 0; s < VIG_SLOTS; s++)
  {
    if (v_id[s] == 0xFF) /* caché entre-temps : bits sales oubliés */
    {
      v_pal &= (u8)~(1 << s);
      v_dirty &= (u8)~(1 << s);
      continue;
    }
    if (v_pal & (1 << s))
    {
      /* palette OBJ 5+s (CGRAM 128 + (5+s)*16), couleurs 1-15 */
      dmaCopyCGram((u8 *)vig_pals[v_id[s]] + 2,
                   (u16)(128 + ((u16)(5 + s) << 4) + 1), 30);
      v_pal &= (u8)~(1 << s);
      return; /* un transfert par VBlank */
    }
    if (v_dirty & (1 << s))
    {
      /* frame courante : 4 rangées de 4 chars (512 octets) */
      src = vig_chars[v_id[s]] + ((u16)v_frame[s] << 9);
      for (r = 0; r < 4; r++)
      {
        base = VRAM_OBJ_GFX + (((u16)VIG_CHAR(s) + ((u16)r << 4)) << 4);
        dmaCopyVram((u8 *)src + ((u16)r << 7), base, 128);
      }
      v_dirty &= (u8)~(1 << s);
      return;
    }
  }
}
