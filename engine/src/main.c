/*
 * main.c — point d'entrée du moteur SNES Studio (Phase 1, semaine 4).
 *
 * Boucle du POC (kit §2) : quand la VM est active (script/dialogue), elle a
 * le contrôle et le joueur est gelé ; sinon, module top-down.
 */
#include <snes.h>
#include "scene.h"
#include "player.h"
#include "camera.h"
#include "map.h"
#include "actors.h"
#include "textbox.h"
#include "vm.h"
#include "save.h"
#include "sysmenu.h"
#include "audio.h"
#include "timer.h"
#include "screenfx.h"
#include "ui_overlay.h"
#include "ui_screen.h"
#include "picture.h"

/* Transition de warp : fondu, rechargement complet de la scène cible
   écran éteint (transferts sûrs), fondu entrant. Les vars VM sont remises
   à zéro (spec §2), les gvars persistent. */
static void do_warp(u8 dest_scene, u8 dest_x, u8 dest_y)
{
  u16 auto_ofs;
  u8 wdir;
  u8 pdir = player.dir; /* « conserver » (v0.16) : la direction survit au
                           rechargement (player_init la remettrait à bas) */

  setFadeEffect(FADE_OUT);
  setScreenOff();

  picture_reset(); /* warp pendant une image : scene_load recharge tout */
  scene_load(dest_scene);
  textbox_load_pal(); /* scene_load écrase la CGRAM 16-19 (fonte, spec §4) */
  vm_scene_reset();
  camera_init(); /* un pan scripté ne survit pas au changement de scène */
  player_init();
  player_set_pos(dest_x, dest_y);
  wdir = player_take_warp_dir(); /* direction d'arrivée (v0.16) */
  player.dir = wdir ? wdir - 1 : pdir;
  actors_init();
  /* Déclencheur AUTO de la scène (spec §1.3 v0.6) : son script prend la
     main dès la première frame après le fondu */
  auto_ofs = actors_autorun();
  if (auto_ofs != SCRIPT_NONE)
    vm_start(auto_ofs);
  camera_update();
  map_init();
  /* Scroll écrit ICI (écran éteint) : la boucle principale ne le remettra
     à jour qu'après le fondu — sans ça, la nouvelle map s'affiche avec le
     scroll de l'ancienne scène pendant tout le fondu entrant et le joueur
     paraît au mauvais endroit avant de « sauter » au bon. */
  bgSetScroll(0, camera.x, camera.y);
  bgSetScroll(1, camera.x, camera.y);
  player_draw();
  actors_draw();

  audio_play_music(scene_ctx.music_id);

  screenfx_warp_reset(); /* fondu resynchronisé, teinte réaffirmée */
  setScreenOn();
  setFadeEffect(FADE_IN);
}

int main(void)
{
  u16 auto_ofs;
  u8 vm_was_active = 0;

  /* consoleInit() est déjà appelé par le crt0 PVSnesLib avant main(). */

  audio_init(); /* boot du SPC700 en premier (prend du temps) */

  /* La scène de boot vient des données */
  scene_load(scene_boot_id());
  audio_play_music(scene_ctx.music_id);
  textbox_init();
  ui_screen_init(); /* tampon BG3 partagé (M1) : map nettoyée écran éteint */
  vm_init();
  sysmenu_init();
  timer_init();
  screenfx_init();
  overlay_init(); /* HUD permanent du layout uigen (Phase 11) */
  camera_init();
  player_init();
  actors_init();
  auto_ofs = actors_autorun(); /* déclencheur AUTO de la scène de boot */
  if (auto_ofs != SCRIPT_NONE)
    vm_start(auto_ofs);
  camera_update();
  map_init(); /* fenêtre tilemap initiale, écran éteint */

  /* Mode 1 avec BG3 en priorité haute (bit 3 de $2105) : la textbox passe
     au-dessus de tout. BG1 = couche sup (☆ = prio, devant le héros),
     BG2 = couche inf, BG3 = textbox. */
  setMode(BG_MODE1, 0x08);
  bgSetScroll(2, 0, 0); /* BG3 fixe (les registres ne sont pas fiables au boot) */

  setScreenOn();

  while (1)
  {
    if (vm_active())
    {
      vm_update(); /* script en cours : inputs routés vers la textbox */
      vm_was_active = 1;
    }
    else if (vm_was_active)
    {
      /* Le script vient de se terminer : les switches/variables ont pu
         changer — recalcule les pages actives des events (v0.10). */
      vm_was_active = 0;
      actors_resolve_pages();
    }
    else if (sysmenu_active())
    {
      sysmenu_update(); /* menu Système (START) : sauvegarder / charger */
      if (sysmenu_take_load())
      {
        do_warp(save_info.scene, save_info.x, save_info.y);
        player.dir = save_info.dir; /* direction sauvegardée */
      }
    }
    else
    {
      u8 wd, wx, wy;
      u16 ce;

      /* Common events AUTO (v0.16) : dès que la VM est libre, le premier
         dont le switch est ON prend la main — et relance tant que le
         switch reste ON (modèle RM2003 : c'est au script de l'éteindre). */
      ce = vm_common_auto();
      if (ce != SCRIPT_NONE)
      {
        vm_start(ce);
        vm_was_active = 1;
      }
      else
      {
        player_update(); /* inputs + mouvement + collision + interaction */
        if (player_take_warp(&wd, &wx, &wy))
          do_warp(wd, wx, wy);
        /* Phase 12 : plus de mapping START en dur — le menu Système
           s'ouvre par la commande d'event SYSMENU (l'auteur choisit sa
           touche via KEYIN) */
      }
    }

    picture_apply(); /* SHOWPIC/HIDEPIC différés (S3) — transition
                            écran depuis la boucle, comme do_warp */

    if (!sysmenu_active())
    {
      actors_update(); /* routes (même pendant un script — cinématiques) +
                          errance des PNJ (gelée pendant les scripts) */
      timer_tick();    /* le timer court aussi pendant les dialogues */
      vm_parallel_update(); /* common events « parallel » (v0.16) */
    }

    screenfx_update(); /* fondu/flash/secousse scriptés (v0.15) */
    overlay_update();  /* HUD : redessin si une variable a changé */
    camera_update();
    if (!picture_active())
      map_update(); /* prépare le streaming de la fenêtre tilemap */
    player_draw();  /* shadow OAM — transféré par le NMI au VBlank */
    actors_draw();

    audio_process(); /* flux musique -> SPC */

    WaitForVBlank();

    /* Transferts VRAM + registres de scroll : pendant le VBlank uniquement.
       Picture affichée (S3) : BG1 porte l'image, carte 32x32 scrollée à
       0 — pas de streaming ni de scroll caméra tant qu'elle est là. */
    if (picture_active())
    {
      ui_screen_vblank();
      screenfx_vblank();
      bgSetScroll(0, 0, 0);
    }
    else
    {
      map_vblank();
      ui_screen_vblank(); /* couche UI entière (dialogue + HUD + timer, M1) */
      screenfx_vblank(); /* $2100 (fondu) + $2130-$2132 (teinte/flash) */
      bgSetScroll(0, camera.x + screenfx_shake_x(), camera.y);
      bgSetScroll(1, camera.x + screenfx_shake_x(), camera.y);
    }
  }
  return 0;
}
