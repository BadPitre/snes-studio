/*
 * textbox.c — fenêtre de dialogue sur BG3.
 *
 * BG3 reste toujours actif : sa map est remplie de char 0 (transparent)
 * quand la boîte est fermée — pas de bascule d'activation de layer.
 * Les glyphes ont un fond opaque (couleur 1), donc la boîte est le simple
 * rectangle des chars écrits. Depuis M1 (Phase 12), le module compose
 * dans le tampon d'écran partagé ui_map (ui_screen.c) — le transfert
 * VRAM est centralisé au VBlank par ui_screen_vblank.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "textbox.h"
#include "rom_layout.h"
#include "vram.h"
#include "vm.h" /* \v[n] : vars16 inserees au decodage (v0.17) */
#include "ui_screen.h" /* tampon BG3 partagé (Phase 12 M1) */
#include "ui_overlay.h" /* refresh des widgets après effacement (W1) */
#include "timer.h"
#include "data/ui_cfg.h" /* theme UI v1 : windowskin + text_speed (Ph. 11) */

/* Styles de dialogue (S1, tables ui_styles.c générées) : fenêtre,
   windowskin (base char, 0 = boîte pleine) et fonte (base char du
   glyphe ' ') PAR STYLE — style 0 = défaut, changé par DLGSTYLE. */
extern const u8 ui_st_mx[];
extern const u8 ui_st_my[];
extern const u8 ui_st_mw[];
extern const u8 ui_st_mh[];
extern const u8 ui_st_cx[];
extern const u8 ui_st_cy[];
extern const u8 ui_st_cw[];
extern const u8 ui_st_ch[];
extern const u8 ui_st_font[];
extern const u8 ui_st_skin[];

/* style courant, copié des tables par textbox_set_style */
static u8 tb_mx, tb_my, tb_mw, tb_mh; /* fenêtre message */
static u8 tb_cx2, tb_cy2, tb_cw2, tb_ch2; /* fenêtre choix */
static u8 tb_font; /* base char de la fonte (glyphe ' ') */
static u8 tb_skin; /* base char du 9-slice (0 = boîte pleine) */

/* Fonte + palette (data_font.c) */
extern const u8 font_gfx[];
extern const u16 font_gfx_size;
extern const u16 textbox_pal[];

/* Textes : en-tête en bank $86 (spec §2, multi-bank M1) — [u16 count]
   [entrées 3 o : ofs lo, ofs hi, bank CPU][table de paires DTE 256 o] ;
   les chaînes vivent dans la bank de leur entrée ($86 ou une bank
   supplémentaire allouée par datagen). Les codes 0x80-0xFF désignent une
   paire de caractères de la table : on décode dans un buffer WRAM avant
   le rendu (le wrap par mot lit en avant). */
/* Tampon du formatage décimal de \v[n] (statique : prudence tcc) */
static char tb_num[5];

static void text_decode(u16 text_id, char *dst, u8 max)
{
  const u8 *tbl = make_far(BANK_TEXTS, BANK_BASE_ADDR);
  u16 count = (u16)tbl[0] | ((u16)tbl[1] << 8);
  const u8 *pairs;
  const u8 *s;
  const u8 *e;
  u16 ofs, k, v;
  u8 n = 0, c, d;

  dst[0] = 0;
  if (text_id >= count)
    return;
  /* entrées 3 octets (multi-bank M1) : les paires suivent la table */
  pairs = tbl + 2 + count + (count << 1);
  e = tbl + 2 + text_id + ((u16)text_id << 1);
  ofs = (u16)e[0] | ((u16)e[1] << 8);
  s = make_far(e[2], BANK_BASE_ADDR + ofs);
  while (*s && n < (u8)(max - 2))
  {
    c = *s++;
    if (c == 0x01)
    {
      /* \v[n] (v0.17, spec §2) : [0x01][n+1] — insère vars16[n] en
         décimal (1 à 5 chiffres) AVANT le wrap, qui reste naturel */
      v = vm.vars16[(u8)(*s++ - 1)];
      d = 0;
      do
      {
        tb_num[d++] = '0' + (v % 10);
        v /= 10;
      } while (v && d < 5);
      while (d && n < (u8)(max - 2))
        dst[n++] = tb_num[--d];
    }
    else if (c == 0x02)
    {
      /* \s[n] (T2) : recopié avec son paramètre — interprété par la
         machine à écrire, invisible pour le wrap */
      dst[n++] = c;
      dst[n++] = *s++;
    }
    else if (c < 0x20)
      dst[n++] = c; /* codes 1 octet (T2) : pause, attente, instantané */
    else if (c & 0x80)
    {
      k = (u16)(c & 0x7F) << 1;
      dst[n++] = pairs[k];
      dst[n++] = pairs[k + 1];
    }
    else
      dst[n++] = c;
  }
  dst[n] = 0;
}

/* Buffers de décodage (WRAM) : un message plein écran, 4 options */
static char tb_text[176];
static char tb_opts[4][28];

/* Géométrie : fenêtres MESSAGE et CHOIX du STYLE COURANT (S1 — tables
   ui_styles.c, style 0 = défaut du layout). Adressage ABSOLU dans
   ui_map (M1) ; UI_SHADOW_* borne la bande à effacer (union de toutes
   les fenêtres de tous les styles, calculée par uigen). */
#define TB_TEXT_COLS ((u8)(tb_mw - 4)) /* cadre : 2 tiles de marge par côté */
#define TB_TEXT_ROWS ((u8)(tb_mh - 2)) /* cadre : 1 rangée haut et bas */
#define TB_CHC_COLS ((u8)(tb_cw2 - 4))
#define TB_CHC_ROWS ((u8)(tb_ch2 - 2))
/* cellule ui_map (ligne de texte l, colonne c) de chaque fenêtre */
#define TB_MSG_CELL(l, c) \
  ((u16)(tb_my + 1 + (l)) * 32 + tb_mx + 2 + (c))
#define TB_CHC_CELL(l, c) \
  ((u16)(tb_cy2 + 1 + (l)) * 32 + tb_cx2 + 2 + (c))

/* Entrée BG3 : char 2bpp + palette 4 (CGRAM 16) + priorité (au-dessus de
   tout avec le bit BG3-prio du mode 1) */
#define TB_ENTRY(c) ((u16)(c) | 0x3000)
/* glyphe du STYLE courant : tb_font pointe le char de ' ' (fonte 0 :
   base 1 -> 1 + ascii - 32 = ascii - 31, comme avant S1) */
#define TB_CHAR(ascii) ((u16)tb_font + (ascii) - 32)
/* Tuile de fond de la fenêtre courante (effacement du curseur de choix) */
#define TB_BG_CHAR (tb_skin ? (u16)(tb_skin + 4) : TB_CHAR(' '))

/* Efface la BANDE du dialogue (union des rangées message/choix) dans le
   tampon partagé, puis redessine ce qui peut partager ces rangées :
   les widgets du HUD (placement libre depuis W1 — jamais SOUS les
   fenêtres du dialogue, uigen le garantit, mais possiblement à côté)
   et le timer. */
static void tb_clear_band(void)
{
  u16 i;

  for (i = (u16)UI_SHADOW_ROW * 32; i < (u16)(UI_SHADOW_ROW + UI_SHADOW_H) * 32; i++)
    ui_map[i] = 0;
  ui_mark(UI_SHADOW_ROW, UI_SHADOW_H);
  overlay_refresh();
  timer_refresh();
}

/* Dessine la FENÊTRE (col,row,w,h en tiles absolus) dans ui_map :
   cadre 9-slice du windowskin s'il existe, sinon boîte pleine — le
   reste de la bande du dialogue redevient transparent. */
static void tb_box_at(u8 col, u8 row, u8 w, u8 h)
{
  u8 x, y, sy;
  u16 base, mid, fill;

  tb_clear_band();
  if (tb_skin) /* 9-slice du style courant — test HORS des boucles :
                  l'ouverture d'un message tient dans sa frame (le moteur
                  a déjà frôlé la frame de lag ici, prudence) */
  {
    for (y = 0; y < h; y++)
    {
      base = (u16)(row + y) * 32 + col;
      sy = y == 0 ? 0 : (y == (u8)(h - 1) ? 2 : 1);
      mid = TB_ENTRY(tb_skin + sy * 3 + 1);
      ui_map[base] = TB_ENTRY(tb_skin + sy * 3);
      for (x = 1; x < (u8)(w - 1); x++)
        ui_map[base + x] = mid;
      ui_map[base + w - 1] = TB_ENTRY(tb_skin + sy * 3 + 2);
    }
  }
  else
  {
    fill = TB_ENTRY(TB_CHAR(' '));
    for (y = 0; y < h; y++)
    {
      base = (u16)(row + y) * 32 + col;
      for (x = 0; x < w; x++)
        ui_map[base + x] = fill;
    }
  }
}

/* Machine à écrire (UI_TEXT_SPEED frames par caractère, 0 = instantané).
   État de la révélation en cours — init EXPLICITE (statics tcc).
   Codes spéciaux (T2) : vitesse \s[n], pauses \. \|, attente \!,
   fermeture auto \^, bloc instantané \> \< — octets de contrôle
   < 0x20 laissés dans le buffer décodé par text_decode. */
static u8 tw_active;
static u8 tw_timer;
static const char *tw_s;
static u8 tw_row, tw_col;
static u8 tw_speed;    /* frames/caractère courant (\s[n], défaut thème) */
static u8 tw_pause;    /* frames de pause restantes (\. \|) */
static u8 tw_waitkey;  /* point d'attente \! : A pour reprendre */
static u8 tw_instant;  /* bloc \> ... \< : révélation sans délai */
static u8 tb_autoclose; /* \^ : la VM ferme sans attendre d'appui */

/* Longueur AFFICHÉE du mot qui suit s[0] (wrap par mot) : les octets de
   contrôle ne comptent pas, 0x01/0x02 portent un paramètre. */
static u16 tw_word_len(const char *s)
{
  u16 wl = 0, j = 1;

  while (s[j] && s[j] != ' ')
  {
    if ((u8)s[j] >= 0x20)
    {
      wl++;
      j++;
    }
    else
      j += ((u8)s[j] <= 0x02) ? 2 : 1;
  }
  return wl;
}

/* Révèle UN caractère — même logique de wrap par mot que le rendu
   instantané de textbox_open_raw. Consomme d'abord les codes de contrôle
   (dans la même frame : un code ne coûte jamais un tick, sauf ceux qui
   suspendent la révélation — pause, attente). */
static void tw_step(void)
{
  char c;
  u16 wl;

  for (;;)
  {
    c = *tw_s;
    if (c == 0x02) /* \s[n] : n frames/caractère, 0 = instantané */
    {
      u8 n = (u8)(tw_s[1] - 1);

      tw_s += 2;
      if (n)
      {
        tw_speed = n;
        tw_instant = 0;
      }
      else
        tw_instant = 1;
      continue;
    }
    if (c == 0x03 || c == 0x04) /* \. pause courte, \| pause longue */
    {
      tw_s++;
      tw_pause = (c == 0x03) ? 15 : 60;
      return;
    }
    if (c == 0x05) /* \! : attendre A (repris par textbox_resume) */
    {
      tw_s++;
      tw_waitkey = 1;
      return;
    }
    if (c == 0x06) /* \^ : flag lu par la VM à la fin du message */
    {
      tw_s++;
      tb_autoclose = 1;
      continue;
    }
    if (c == 0x07) /* \> : début de bloc instantané */
    {
      tw_s++;
      tw_instant = 1;
      continue;
    }
    if (c == 0x08) /* \< : fin de bloc instantané */
    {
      tw_s++;
      tw_instant = 0;
      return; /* coupe la rafale en cours dans textbox_tick */
    }
    break;
  }
  if (!c || tw_row >= TB_TEXT_ROWS)
  {
    tw_active = 0;
    return;
  }
  if (c == ' ')
  {
    wl = tw_word_len(tw_s);
    if ((u16)tw_col + 1 + wl > TB_TEXT_COLS)
    {
      tw_row++;
      tw_col = 0;
      tw_s++;
      return;
    }
  }
  if (tw_col >= TB_TEXT_COLS)
  {
    tw_row++;
    tw_col = 0;
    if (tw_row >= TB_TEXT_ROWS)
    {
      tw_active = 0;
      return;
    }
  }
  ui_map[TB_MSG_CELL(tw_row, tw_col)] = TB_ENTRY(TB_CHAR(c));
  ui_mark((u8)(tb_my + 1 + tw_row), 1);
  tw_col++;
  tw_s++;
}

void textbox_tick(void)
{
  if (!tw_active || tw_waitkey)
    return; /* \! : la reprise vient de la VM (textbox_resume) */
  if (tw_pause)
  {
    tw_pause--;
    return;
  }
  if (tw_instant)
  {
    /* bloc \> ... \< (ou \s[0]) : tout ce qui suit part d'un coup,
       jusqu'à la fin du bloc, une pause ou un point d'attente */
    while (tw_active && tw_instant && !tw_pause && !tw_waitkey)
      tw_step();
    return;
  }
  tw_timer++;
  if (tw_timer < tw_speed)
    return;
  tw_timer = 0;
  tw_step();
}

u8 textbox_busy(void)
{
  return tw_active;
}

void textbox_finish(void)
{
  /* tout révéler d'un coup — sauf au-delà d'un point d'attente \! :
     l'auteur l'a mis là exprès, l'appui suivant le franchira */
  while (tw_active && !tw_waitkey)
  {
    tw_pause = 0;
    tw_step();
  }
  tw_pause = 0;
}

u8 textbox_waiting_key(void)
{
  return (u8)(tw_active && tw_waitkey);
}

void textbox_resume(void)
{
  tw_waitkey = 0;
}

u8 textbox_autoclose(void)
{
  return tb_autoclose;
}

/* Palette de la fonte : CGRAM 16-19 (palette BG 2bpp n°4). Ces slots sont
   RÉSERVÉS (spec §4) : datagen n'y place aucune couleur de tileset, et le
   chargement de scène (CGRAM BG complète) les écrase — à rappeler après
   CHAQUE scene_load, pas seulement au boot. */
void textbox_load_pal(void)
{
  dmaCopyCGram((u8 *)textbox_pal, 16, 4 * 2);
}

void textbox_set_style(u8 n)
{
  if (n >= UI_STYLE_COUNT)
    n = 0;
  tb_mx = ui_st_mx[n];
  tb_my = ui_st_my[n];
  tb_mw = ui_st_mw[n];
  tb_mh = ui_st_mh[n];
  tb_cx2 = ui_st_cx[n];
  tb_cy2 = ui_st_cy[n];
  tb_cw2 = ui_st_cw[n];
  tb_ch2 = ui_st_ch[n];
  tb_font = ui_st_font[n];
  tb_skin = ui_st_skin[n];
}

void textbox_init(void)
{
  /* Fonte 2bpp + palette — écran éteint, transferts sûrs. Le nettoyage
     de la map BG3 est fait par ui_screen_init (tampon partagé, M1). */
  bgInitTileSetData(2, (u8 *)font_gfx, font_gfx_size, VRAM_BG3_GFX);
  textbox_load_pal();
  bgSetMapPtr(2, VRAM_BG3_MAP, SC_32x32);

  textbox_set_style(0); /* style par défaut — init EXPLICITE (tcc) */

  /* état machine à écrire — init EXPLICITE (statics tcc) */
  tw_active = 0;
  tw_timer = 0;
  tw_s = 0;
  tw_row = 0;
  tw_col = 0;
  tw_speed = UI_TEXT_SPEED ? UI_TEXT_SPEED : 1;
  tw_pause = 0;
  tw_waitkey = 0;
  tw_instant = 0;
  tb_autoclose = 0;
}

void textbox_open(u16 text_id)
{
  text_decode(text_id, tb_text, sizeof(tb_text));
#if UI_TEXT_SPEED
  /* machine à écrire : boîte vide, le texte se révèle via textbox_tick */
  tb_box_at(tb_mx, tb_my, tb_mw, tb_mh);
  tw_active = 1;
  tw_timer = 0;
  tw_s = tb_text;
  tw_row = 0;
  tw_col = 0;
  tw_speed = UI_TEXT_SPEED; /* \s[n] du message précédent oublié */
  tw_pause = 0;
  tw_waitkey = 0;
  tw_instant = 0;
  tb_autoclose = 0; /* (re)posé par tw_step s'il croise \^ */
#else
  textbox_open_raw(tb_text);
#endif
}

/* Boîte de dialogue depuis une chaîne C (textes du jeu résolus, ou
   vocabulaire moteur du menu Système — spec §5) */
void textbox_open_raw(const char *s)
{
  u16 wl;
  u8 row, col;
  char c;

  tw_active = 0; /* un rendu instantané annule toute révélation en cours */
  tb_autoclose = 0;
  tb_box_at(tb_mx, tb_my, tb_mw, tb_mh);

  if (s)
  {
    row = 0; /* ligne de texte, relative à la fenêtre */
    col = 0;
    while (*s && row < TB_TEXT_ROWS)
    {
      c = *s;
      if ((u8)c < 0x20)
      {
        /* rendu instantané : les codes de rythme n'ont pas de sens —
           seul \^ garde son effet (fermeture sans appui) */
        if (c == 0x06)
          tb_autoclose = 1;
        s += ((u8)c <= 0x02) ? 2 : 1;
        continue;
      }
      if (c == ' ')
      {
        /* wrap par mot : longueur affichée du mot qui suit l'espace */
        wl = tw_word_len(s);
        if ((u16)col + 1 + wl > TB_TEXT_COLS)
        {
          row++;
          col = 0;
          s++;
          continue;
        }
      }
      if (col >= TB_TEXT_COLS)
      {
        row++;
        col = 0;
        if (row >= TB_TEXT_ROWS)
          break;
      }
      ui_map[TB_MSG_CELL(row, col)] = TB_ENTRY(TB_CHAR(c));
      col++;
      s++;
    }
  }
}

/* CHOICE (spec §2 v0.6) : 2-4 options, une par ligne, curseur '>' devant
   l'option sélectionnée. Textes sur une seule ligne (pas de wrap). */
void textbox_open_choices(const u16 *text_ids, u8 count, u8 sel)
{
  const char *opts[4];
  u8 i;

  for (i = 0; i < count; i++)
  {
    text_decode(text_ids[i], tb_opts[i & 3], sizeof(tb_opts[0]));
    opts[i & 3] = tb_opts[i & 3];
  }
  textbox_choices_raw(opts, count, sel);
}

/* Choix depuis des chaînes C (menu Système : vocabulaire moteur) */
void textbox_choices_raw(const char *const *options, u8 count, u8 sel)
{
  const char *s;
  u8 i, col;

  tw_active = 0;
  tb_box_at(tb_cx2, tb_cy2, tb_cw2, tb_ch2);
  for (i = 0; i < count && i < TB_CHC_ROWS; i++)
  {
    s = options[i];
    col = 0;
    while (s && *s && col < TB_CHC_COLS - 2)
    {
      if ((u8)*s < 0x20)
      {
        /* codes de rythme sans objet sur une ligne d'option */
        s += ((u8)*s <= 0x02) ? 2 : 1;
        continue;
      }
      ui_map[TB_CHC_CELL(i, 2 + col)] = TB_ENTRY(TB_CHAR(*s));
      col++;
      s++;
    }
  }
  ui_map[TB_CHC_CELL(sel, 0)] = TB_ENTRY(TB_CHAR('>'));
}

/* Déplace le curseur du CHOICE (redessine la colonne des '>') */
void textbox_choice_cursor(u8 sel)
{
  u8 i;

  for (i = 0; i < TB_CHC_ROWS; i++)
    ui_map[TB_CHC_CELL(i, 0)] = TB_ENTRY(TB_BG_CHAR);
  ui_map[TB_CHC_CELL(sel, 0)] = TB_ENTRY(TB_CHAR('>'));
  ui_mark((u8)(tb_cy2 + 1), TB_CHC_ROWS);
}

void textbox_close(void)
{
  tw_active = 0;
  tw_waitkey = 0;
  tw_pause = 0;
  tb_autoclose = 0;
  tb_clear_band();
}
