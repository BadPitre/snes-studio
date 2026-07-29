/*
 * picture.c — pictures plein écran (S3, façon RM2003).
 *
 * Une picture est compilée par datagen (data_pic{i}.c) : chars 4bpp
 * dédupliqués (≤ 512), tilemap 32x28 (palette 0) et palette 16 couleurs.
 *
 * Plan VRAM SANS reconstruction : l'image emprunte la RÉGION OBJ
 * ($4000-$6000 words, 512 chars — les sprites sont masqués pendant
 * l'affichage) et sa carte va dans la région LIBRE $7000. Les chars du
 * tileset, la map BG1/BG2 et les grilles WRAM ne sont JAMAIS touchés :
 * fermer l'image = rebasculer les registres BG1, recharger les chars
 * sprites (un DMA) et les palettes BG — positions et états des events
 * intacts, aucune refenêtre de map (map_init au retour s'est montré
 * fragile hors du chemin de warp — voir l'historique S3).
 *
 * Pendant l'image : BG2 et OBJ retirés (REG_TM 0x05), BG1 pointe sur
 * les chars/carte de l'image, BG3 reste au-dessus — les dialogues et
 * widgets se jouent SUR l'image. Transitions à la recette do_warp
 * (fondu sortant, écran éteint, fondu entrant), exécutées depuis la
 * BOUCLE PRINCIPALE via picture_apply (jamais depuis vm_update).
 */
#include <snes.h>
#include "picture.h"
#include "scene.h"
#include "camera.h"
#include "textbox.h"
#include "screenfx.h"
#include "vram.h"

/* Registre généré par datagen (data_pictures.c — toujours émis) */
extern const u8 pic_count;
extern const u8 *const pic_chars[];
extern const u16 *const pic_chars_sizes[];
extern const u16 *const pic_maps[];
extern const u16 *const pic_pals[];
extern const u8 pic_flags[]; /* bit 0 = transparence (S4) */

/* Palettes BG des scènes + chars sprites (data_assets.c) — restauration */
extern const u16 *const gfx_pals[];
extern const u8 *const sprite_chars[];
extern const u16 *const sprite_chars_sizes[];

extern u8 videoMode; /* miroir PVSnesLib de REG_TM ($212C) */

/* Couches du mode jeu (main.c : setMode BG_MODE1) — BG1|BG2|BG3|OBJ.
   Constante du MOTEUR, réaffirmée plutôt que lue (fiable). */
#define PIC_TM_GAME 0x17
#define PIC_TM_PIC 0x05 /* BG1 (image) + BG3 (dialogues par-dessus) */
#define PIC_TM_TRANS 0x07 /* + BG2 : le DÉCOR se voit par les pixels
    transparents (S4) — pas les sprites, leur VRAM porte l'image */

static u8 pic_on = 0;
/* Requête différée (SHOWPIC/HIDEPIC) : la transition s'exécute depuis
   la BOUCLE PRINCIPALE — même position que do_warp — jamais depuis
   vm_update. 0 = rien, 1 = show, 2 = hide. */
static u8 pic_req = 0;
static u8 pic_req_id = 0;

u8 picture_active(void)
{
  return pic_on;
}

void picture_request(u8 show, u8 id)
{
  pic_req = show ? 1 : 2;
  pic_req_id = id;
}

void picture_apply(void)
{
  u8 r = pic_req;

  pic_req = 0;
  if (r == 1)
    picture_show(pic_req_id);
  else if (r == 2)
    picture_hide();
}

void picture_show(u8 id)
{
  if (id >= pic_count)
    return;
  setFadeEffect(FADE_OUT);
  setScreenOff();
  pic_on = 1;
  /* image à transparence (S4) : la couche décor (BG2, couche inf.)
     reste visible derrière les pixels percés */
  videoMode = (pic_flags[id] & 1) ? PIC_TM_TRANS : PIC_TM_PIC;
  REG_TM = videoMode;
  /* BG1 rebasé sur la région OBJ (chars) + carte 32x32 en zone libre —
     le tileset et les maps de la scène restent intacts en VRAM */
  bgSetGfxPtr(0, VRAM_OBJ_GFX);
  bgSetMapPtr(0, VRAM_PIC_MAP, SC_32x32);
  dmaCopyVram((u8 *)pic_chars[id], VRAM_OBJ_GFX, *pic_chars_sizes[id]);
  dmaCopyVram((u8 *)pic_maps[id], VRAM_PIC_MAP, 32 * 28 * 2);
  if (pic_flags[id] & 1)
  {
    /* transparence : l'image vit sur la PALETTE BG 7 (réservée, entrées
       de carte marquées par datagen) — les palettes 0-6 du décor et la
       couleur de fond restent celles de la scène */
    dmaCopyCGram((u8 *)pic_pals[id] + 2, 113, 30);
  }
  else
    dmaCopyCGram((u8 *)pic_pals[id], 0, 32); /* couleurs 0-15 */
  bgSetScroll(0, 0, 0);
  screenfx_warp_reset(); /* fondu scripté resynchronisé (recette warp) */
  setScreenOn();
  setFadeEffect(FADE_IN);
}

void picture_hide(void)
{
  if (!pic_on)
    return;
  setFadeEffect(FADE_OUT);
  setScreenOff();
  /* Registres BG1 de la scène (chars + map jamais écrasés) */
  bgSetGfxPtr(0, VRAM_BG1_GFX);
  bgSetMapPtr(0, VRAM_BG1_MAP, SC_64x64);
  /* Chars sprites (la région OBJ portait l'image) + palettes BG de la
     scène (l'image a écrasé CGRAM 0-15) */
  dmaCopyVram((u8 *)sprite_chars[scene_ctx.sprite_set_id], VRAM_OBJ_GFX,
              *sprite_chars_sizes[scene_ctx.sprite_set_id]);
  dmaCopyCGram((u8 *)gfx_pals[scene_ctx.tileset_id], 0, 128 * 2);
  textbox_load_pal(); /* CGRAM 16-19 (fonte) écrasée par les palettes BG */
  bgSetScroll(0, camera.x, camera.y);
  bgSetScroll(1, camera.x, camera.y);
  videoMode = PIC_TM_GAME;
  REG_TM = PIC_TM_GAME;
  pic_on = 0;
  screenfx_warp_reset();
  setScreenOn();
  setFadeEffect(FADE_IN);
}

void picture_reset(void)
{
  if (!pic_on)
    return;
  videoMode = PIC_TM_GAME;
  REG_TM = PIC_TM_GAME;
  pic_on = 0; /* scene_load (warp) recharge tileset, sprites et scrolls */
}
