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

/* Transition de warp : fondu, rechargement complet de la scène cible
   écran éteint (transferts sûrs), fondu entrant. Les vars VM sont remises
   à zéro (spec §2), les gvars persistent. */
static void do_warp(u8 dest_scene, u8 dest_x, u8 dest_y)
{
  u16 auto_ofs;

  setFadeEffect(FADE_OUT);
  setScreenOff();

  scene_load(dest_scene);
  textbox_load_pal(); /* scene_load écrase la CGRAM 16-19 (fonte, spec §4) */
  vm_scene_reset();
  player_init();
  player_set_pos(dest_x, dest_y);
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
  vm_init();
  sysmenu_init();
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

      player_update(); /* inputs + mouvement + collision + interaction */
      if (player_take_warp(&wd, &wx, &wy))
        do_warp(wd, wx, wy);
      else if (padsDown(0) & KEY_START)
        sysmenu_open();
    }

    if (!sysmenu_active())
      actors_update(); /* routes (même pendant un script — cinématiques) +
                          errance des PNJ (gelée pendant les scripts) */

    camera_update();
    map_update();  /* prépare le streaming de la fenêtre tilemap */
    player_draw(); /* shadow OAM — transféré par le NMI au VBlank */
    actors_draw();

    audio_process(); /* flux musique -> SPC */

    WaitForVBlank();

    /* Transferts VRAM + registres de scroll : pendant le VBlank uniquement */
    map_vblank();
    textbox_vblank();
    bgSetScroll(0, camera.x, camera.y);
    bgSetScroll(1, camera.x, camera.y);
  }
  return 0;
}
