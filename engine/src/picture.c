/*
 * picture.c — pictures plein écran (S3, façon RM2003).
 *
 * Une picture est compilée par datagen (data_pic{i}.c) : chars 4bpp
 * dédupliqués (≤ 512), tilemap 32x32 complète (image calée en haut-
 * gauche, padding transparent — wrap sûr au scroll) et palette 16
 * couleurs.
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
 *
 * S7 : durée de fondu par commande (frames, 0 = instantané — fondu
 * MAISON sur $2100, une seule division par transition), position
 * clampée aux dims réelles (pic_wt/pic_ht, centrage moteur possible),
 * et MOVEPIC : glissement NON-bloquant vers une cible en N frames
 * (pas 8.8 fixé à la commande, avancé chaque frame par picture_apply
 * — le scroll part au VBlank via picture_vblank, rien d'autre à
 * synchroniser).
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
extern const u8 pic_wt[];    /* largeur en tiles (S7 — clamp/centrage) */
extern const u8 pic_ht[];    /* hauteur en tiles */

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
static u8 pic_cur = 0; /* id affiché (clamp du MOVEPIC) */
/* Requête différée (SHOWPIC/HIDEPIC) : la transition s'exécute depuis
   la BOUCLE PRINCIPALE — même position que do_warp — jamais depuis
   vm_update. 0 = rien, 1 = show, 2 = hide. */
static u8 pic_req = 0;
static u8 pic_req_id = 0;
static u8 pic_req_x = 0;
static u8 pic_req_y = 0;
static u8 pic_req_fl = 0;
static u8 pic_req_dur = 0;
/* position courante de l'image en 8.8 (glissement S7) + scroll BG1 */
static u16 pic_px8 = 0;
static u16 pic_py8 = 0;
static u16 pic_hx = 0;
static u16 pic_vy = 0;
/* glissement MOVEPIC : pas 8.8 par axe (magnitude + sens), cible */
static u8 mv_frames = 0;
static u16 mv_sx = 0;
static u16 mv_sy = 0;
static u8 mv_xneg = 0;
static u8 mv_yneg = 0;
static u8 mv_tx = 0;
static u8 mv_ty = 0;

u8 picture_active(void)
{
  return pic_on;
}

void picture_request(u8 show, u8 id, u8 x, u8 y, u8 flags, u8 dur)
{
  pic_req = show ? 1 : 2;
  pic_req_id = id;
  pic_req_x = x;
  pic_req_y = y;
  pic_req_fl = flags;
  pic_req_dur = dur;
}

/* position demandée -> position affichable : centrage (flags bit 2) et
   clamp aux dims réelles — indispensable quand x/y sortent de VARIABLES
   (datagen ne peut pas les vérifier à la compilation) */
static u8 pic_fit(u8 want, u8 center, u16 size, u16 max)
{
  u16 lim = max - size;

  if (center)
    return (u8)(lim >> 1);
  if ((u16)want > lim)
    return (u8)lim;
  return want;
}

static void pic_place(u8 x, u8 y)
{
  pic_px8 = (u16)x << 8;
  pic_py8 = (u16)y << 8;
  pic_hx = (u16)(0x100 - x) & 0xFF;
  pic_vy = (u16)(0x100 - y) & 0xFF;
}

/* Fondus MAISON sur $2100 (S7) : durée en frames — bloquants, comme la
   recette do_warp (setFadeEffect = 16 frames figées ; ici l'auteur
   choisit). UNE division par transition, puis un pas 8.8 par frame. */
static void pic_fade_out(u8 dur)
{
  u16 step, lvl;
  u8 f;

  if (!dur)
    return;
  step = 0x0F00 / dur;
  lvl = 0x0F00;
  for (f = 0; f < dur; f++)
  {
    lvl = lvl > step ? lvl - step : 0;
    WaitForVBlank();
    REG_INIDISP = (u8)(lvl >> 8);
  }
}

static void pic_fade_in(u8 dur)
{
  u16 step, lvl;
  u8 f;

  if (!dur)
    return;
  step = 0x0F00 / dur;
  lvl = 0;
  REG_INIDISP = 0; /* pas de flash plein écran avant le premier pas */
  for (f = 0; f < dur; f++)
  {
    lvl += step;
    if (lvl > 0x0F00)
      lvl = 0x0F00;
    WaitForVBlank();
    REG_INIDISP = (u8)(lvl >> 8);
  }
  REG_INIDISP = 0x0F; /* luminosité pleine réaffirmée (arrondi du pas) */
}

void picture_apply(void)
{
  u8 r = pic_req;

  pic_req = 0;
  if (r == 1)
    picture_show(pic_req_id);
  else if (r == 2)
    picture_hide();
  /* glissement MOVEPIC (S7) : un pas par frame, snap sur la cible à la
     dernière — le scroll part au prochain VBlank (picture_vblank) */
  if (pic_on && mv_frames)
  {
    mv_frames--;
    if (!mv_frames)
    {
      pic_px8 = (u16)mv_tx << 8;
      pic_py8 = (u16)mv_ty << 8;
    }
    else
    {
      pic_px8 = mv_xneg ? pic_px8 - mv_sx : pic_px8 + mv_sx;
      pic_py8 = mv_yneg ? pic_py8 - mv_sy : pic_py8 + mv_sy;
    }
    pic_hx = (u16)(0x100 - (pic_px8 >> 8)) & 0xFF;
    pic_vy = (u16)(0x100 - (pic_py8 >> 8)) & 0xFF;
  }
}

void picture_move(u8 x, u8 y, u8 flags, u8 dur)
{
  u16 t8;

  if (!pic_on)
    return;
  x = pic_fit(x, flags & 4, (u16)pic_wt[pic_cur] << 3, 256);
  y = pic_fit(y, flags & 4, (u16)pic_ht[pic_cur] << 3, 224);
  if (!dur)
  {
    mv_frames = 0;
    pic_place(x, y);
    return;
  }
  mv_tx = x;
  mv_ty = y;
  t8 = (u16)x << 8;
  if (t8 >= pic_px8)
  {
    mv_xneg = 0;
    mv_sx = (t8 - pic_px8) / dur;
  }
  else
  {
    mv_xneg = 1;
    mv_sx = (pic_px8 - t8) / dur;
  }
  t8 = (u16)y << 8;
  if (t8 >= pic_py8)
  {
    mv_yneg = 0;
    mv_sy = (t8 - pic_py8) / dur;
  }
  else
  {
    mv_yneg = 1;
    mv_sy = (pic_py8 - t8) / dur;
  }
  mv_frames = dur;
}

void picture_show(u8 id)
{
  u8 x, y;

  if (id >= pic_count)
    return;
  pic_fade_out(pic_req_dur);
  setScreenOff();
  pic_on = 1;
  pic_cur = id;
  mv_frames = 0;
  /* image à transparence (S4) : la couche décor (BG2, couche inf.)
     reste visible derrière les pixels percés */
  videoMode = (pic_flags[id] & 1) ? PIC_TM_TRANS : PIC_TM_PIC;
  REG_TM = videoMode;
  /* BG1 rebasé sur la région OBJ (chars) + carte 32x32 en zone libre —
     le tileset et les maps de la scène restent intacts en VRAM */
  bgSetGfxPtr(0, VRAM_OBJ_GFX);
  bgSetMapPtr(0, VRAM_PIC_MAP, SC_32x32);
  dmaCopyVram((u8 *)pic_chars[id], VRAM_OBJ_GFX, *pic_chars_sizes[id]);
  dmaCopyVram((u8 *)pic_maps[id], VRAM_PIC_MAP, 32 * 32 * 2);
  if (pic_flags[id] & 1)
  {
    /* transparence : l'image vit sur la PALETTE BG 7 (réservée, entrées
       de carte marquées par datagen) — les palettes 0-6 du décor et la
       couleur de fond restent celles de la scène */
    dmaCopyCGram((u8 *)pic_pals[id] + 2, 113, 30);
  }
  else
    dmaCopyCGram((u8 *)pic_pals[id], 0, 32); /* couleurs 0-15 */
  /* position écran (S5/S7) : centrage/clamp aux dims réelles — les
     coordonnées peuvent sortir de variables, jamais de confiance */
  x = pic_fit(pic_req_x, pic_req_fl & 4, (u16)pic_wt[id] << 3, 256);
  y = pic_fit(pic_req_y, pic_req_fl & 4, (u16)pic_ht[id] << 3, 224);
  pic_place(x, y);
  bgSetScroll(0, pic_hx, pic_vy);
  screenfx_warp_reset(); /* fondu scripté resynchronisé (recette warp) */
  setScreenOn();
  pic_fade_in(pic_req_dur);
}

void picture_hide(void)
{
  if (!pic_on)
    return;
  pic_fade_out(pic_req_dur);
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
  mv_frames = 0;
  screenfx_warp_reset();
  setScreenOn();
  pic_fade_in(pic_req_dur);
}

void picture_vblank(void)
{
  bgSetScroll(0, pic_hx, pic_vy);
}

void picture_reset(void)
{
  if (!pic_on)
    return;
  videoMode = PIC_TM_GAME;
  REG_TM = PIC_TM_GAME;
  pic_on = 0; /* scene_load (warp) recharge tileset, sprites et scrolls */
  mv_frames = 0;
}
