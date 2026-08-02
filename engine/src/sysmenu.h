/*
 * sysmenu.h — the System menu (START): save and load, RM2003 style.
 * Reuses the textbox for its cursor-driven choices.
 */
#ifndef SYSMENU_H
#define SYSMENU_H

#include <snes.h>

/* Explicit init at boot — never rely on statics being zeroed with this
   toolchain (docs/ENGINE_CONSTRAINTS.md §1.2). */
void sysmenu_init(void);

/* 1 while the menu is open (the player is frozen). */
u8 sysmenu_active(void);

/* Opens the main menu (Save / Load / Close). */
void sysmenu_open(void);

/* Call every frame while the menu is active: navigation and actions. */
void sysmenu_update(void);

/* Has a load been confirmed? Returns 1 once. The destination is in
   save_info (save.h) and the gvars are already applied; the main loop
   does the warp and then sets the facing. No pointer parameters —
   tcc-816 is fragile on that pattern (§1.7). */
u8 sysmenu_take_load(void);

#endif /* SYSMENU_H */
