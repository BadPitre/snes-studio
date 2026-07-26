/*
 * main.c — point d'entrée du moteur SNES Studio (Phase 1, semaine 2).
 *
 * Boucle cible du POC (kit §2) — les étapes commentées arrivent dans les
 * semaines suivantes : VM (S4), testerInteractions (S3).
 */
#include <snes.h>
#include "scene.h"
#include "player.h"
#include "camera.h"
#include "map.h"
#include "actors.h"

int main(void)
{
  /* consoleInit() est déjà appelé par le crt0 PVSnesLib avant main(). */

  /* Scène de boot : id 0 (multi-scènes en semaine 5, warp en Phase 4). */
  scene_load(0);
  player_init();
  actors_init();
  camera_update();
  map_init(); /* fenêtre tilemap initiale, écran éteint */

  /* Mode 1, BG1 16 couleurs seul actif (BG3 réservé à la textbox, semaine 4) */
  setMode(BG_MODE1, 0);
  bgSetDisable(1);
  bgSetDisable(2);

  setScreenOn();

  while (1)
  {
    player_update(); /* inputs + mouvement + collision + interaction (VM S4) */
    camera_update();
    map_update();    /* prépare le streaming de la fenêtre tilemap */
    player_draw();   /* shadow OAM — transféré par le NMI au VBlank */
    actors_draw();

    WaitForVBlank();

    /* Transferts VRAM/CGRAM + registres de scroll : VBlank uniquement */
    map_vblank();
    actors_vblank();
    bgSetScroll(0, camera.x, camera.y);
  }
  return 0;
}
