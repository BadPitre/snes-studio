/*
 * main.c — point d'entrée du moteur SNES Studio (Phase 1, semaine 1).
 *
 * Boucle cible du POC (kit §2) — les étapes commentées arrivent dans les
 * semaines suivantes :
 *   lireInputs / VM / updateJoueur / testerInteractions / updateCamera /
 *   preparerOAM / WaitForVBlank
 */
#include <snes.h>
#include "scene.h"

int main(void)
{
  /* consoleInit() est déjà appelé par le crt0 PVSnesLib avant main(). */

  /* Scène de boot : id 0 (multi-scènes en semaine 5, warp en Phase 4). */
  scene_load(0);

  /* Mode 1, BG1 16 couleurs seul actif (BG3 réservé à la textbox, semaine 4) */
  setMode(BG_MODE1, 0);
  bgSetDisable(1);
  bgSetDisable(2);

  setScreenOn();

  while (1)
  {
    /* Semaine 2 : inputs + joueur + caméra. Semaine 4 : vmStep(). */
    WaitForVBlank();
  }
  return 0;
}
