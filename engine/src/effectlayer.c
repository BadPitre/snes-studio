/*
 * effectlayer.c — couche d'effet par scène (S9, « nuages sur le
 * village ») : un motif — une image à TRANSPARENCE du registre
 * pictures — dérive au-dessus du jeu pendant qu'il se joue (NPC
 * visibles, tout fonctionne). Façon Zelda 3 (brouillard des Bois
 * Perdus) : le plan BG1 change de métier dans ces scènes.
 *
 * Une scène à effet PERD sa couche sup (la console n'a que deux plans
 * de décor + le plan texte) : l'éditeur la désactive, datagen avertit
 * si elle n'est pas vide.
 *
 * Plan VRAM : la région de l'ancienne carte BG1 ($0000-$1000 words)
 * est REPURPOSÉE — chars du motif à $0000 (≤ 256, validé datagen) ;
 * la carte 32x32 vit dans le creux libre $1C00 (après la map BG3).
 * Tileset ($2000), sprites ($4000), carte BG2 ($6000) intacts ;
 * map.c ne streame plus BG1 dans ces scènes.
 *
 * Les entrées de carte reçoivent le bit de PRIORITÉ (0x2000) : le
 * motif passe DEVANT les sprites (nuages au-dessus des personnages) ;
 * en mélange, décor ET personnages restent visibles à travers (sub
 * screen BG2+OBJ — contrairement aux pictures, les chars OBJ sont
 * valides ici). Teinte/flash suspendus tant qu'un mélange est actif
 * (même circuit — screenfx_cm_hold).
 *
 * Une picture par-dessus une scène à effet est sûre : ses chars vont
 * en région OBJ et sa carte à $7000 — picture_hide appelle
 * effect_restore (registres + palette 7 ; la VRAM du motif n'a pas
 * bougé).
 */
#include <snes.h>
#include "effectlayer.h"
#include "screenfx.h"
#include "vram.h"

/* data_effects.c (toujours émis par datagen) — indexé par scene_id */
extern const u8 eff_pic[];   /* index picture, 0xFF = pas d'effet */
extern const u8 eff_blend[]; /* 0 opaque, 1 semi, 2 additif, 3 soustractif */
extern const u16 eff_dx[];   /* dérive 8.8 par frame (complément à 2) */
extern const u16 eff_dy[];

/* registre pictures (data_pictures.c) : le motif EST une picture */
extern const u8 pic_count;
extern const u8 *const pic_chars[];
extern const u16 *const pic_chars_sizes[];
extern const u16 *const pic_maps[];
extern const u16 *const pic_pals[];

static u8 eff_on = 0;
static u8 eff_cur = 0;  /* id picture du motif (posé par effect_load) */
static u8 eff_bl = 0;   /* mode de mélange de la scène courante */
static u16 eff_vx = 0;  /* dérive par frame (8.8) */
static u16 eff_vy = 0;
static u16 eff_x8 = 0;  /* position accumulée (8.8) — wrap 256 px */
static u16 eff_y8 = 0;
/* carte du motif avec bit de priorité — composée au chargement */
static u16 eff_buf[1024];

u8 effect_active(void)
{
  return eff_on;
}

/* Registres BG1 + color math + palette 7 — partagés load/restore */
static void eff_regs(void)
{
  bgSetGfxPtr(0, VRAM_EFF_GFX);
  bgSetMapPtr(0, VRAM_EFF_MAP, SC_32x32);
  dmaCopyCGram((u8 *)pic_pals[eff_cur] + 2, 113, 30);
  if (eff_bl)
  {
    REG_TS = 0x12; /* BG2 + OBJ en sub : décor ET personnages visibles */
    REG_CGWSEL = 0x02;
    REG_CGADSUB = eff_bl == 1 ? 0x41 /* semi-transparent */
                              : (eff_bl == 2 ? 0x01 /* additif */
                                             : 0x81 /* soustractif */);
    screenfx_cm_hold(1);
  }
  else
  {
    REG_TS = 0;
    screenfx_cm_hold(0);
  }
}

void effect_load(u8 scene_id)
{
  u16 i;
  u8 p = eff_pic[scene_id];

  eff_x8 = 0;
  eff_y8 = 0;
  if (p == 0xFF || p >= pic_count)
  {
    eff_on = 0;
    eff_bl = 0;
    REG_TS = 0; /* scène sans effet : sub screen et color math rendus */
    screenfx_cm_hold(0);
    return;
  }
  eff_on = 1;
  eff_cur = p;
  eff_bl = eff_blend[scene_id];
  eff_vx = eff_dx[scene_id];
  eff_vy = eff_dy[scene_id];
  dmaCopyVram((u8 *)pic_chars[p], VRAM_EFF_GFX, *pic_chars_sizes[p]);
  for (i = 0; i < 1024; i++)
    eff_buf[i] = pic_maps[p][i] | 0x2000; /* priorité : devant les sprites */
  dmaCopyVram((u8 *)eff_buf, VRAM_EFF_MAP, 1024 * 2);
  eff_regs();
}

void effect_restore(void)
{
  if (!eff_on)
    return;
  eff_regs(); /* la picture a écrasé CGRAM 113-127 et les registres —
                 les chars/carte du motif, eux, n'ont pas bougé */
}

void effect_update(void)
{
  if (!eff_on)
    return;
  eff_x8 += eff_vx;
  eff_y8 += eff_vy;
}

void effect_vblank(void)
{
  bgSetScroll(0, eff_x8 >> 8, eff_y8 >> 8);
}
