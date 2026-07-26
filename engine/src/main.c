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

int main(void)
{
  /* consoleInit() est déjà appelé par le crt0 PVSnesLib avant main(). */

  /* Scène de boot : id 0 (multi-scènes en semaine 5, warp en Phase 4). */
  scene_load(0);
  textbox_init();
  vm_init();
  player_init();
  actors_init();
  camera_update();
  map_init(); /* fenêtre tilemap initiale, écran éteint */

  /* Mode 1 avec BG3 en priorité haute (bit 3 de $2105) : la textbox passe
     au-dessus de tout. BG1 = map, BG3 = textbox, BG2 inutilisé. */
  setMode(BG_MODE1, 0x08);
  bgSetDisable(1);
  bgSetScroll(2, 0, 0); /* BG3 fixe (les registres ne sont pas fiables au boot) */

  setScreenOn();

  while (1)
  {
    if (vm_active())
      vm_update(); /* script en cours : inputs routés vers la textbox */
    else
      player_update(); /* inputs + mouvement + collision + interaction */

    camera_update();
    map_update();  /* prépare le streaming de la fenêtre tilemap */
    player_draw(); /* shadow OAM — transféré par le NMI au VBlank */
    actors_draw();

    WaitForVBlank();

    /* Transferts VRAM + registres de scroll : pendant le VBlank uniquement */
    map_vblank();
    textbox_vblank();
    bgSetScroll(0, camera.x, camera.y);
  }
  return 0;
}
