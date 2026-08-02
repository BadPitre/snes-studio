/*
 * timer.h — the displayable game timer: a countdown in seconds driven
 * by the TIMER opcode, shown as "M:SS" on BG3, top-right.
 */
#ifndef TIMER_H
#define TIMER_H

#include <snes.h>

/* Explicit init (tcc statics) — call at boot. */
void timer_init(void);

/* One argument per function: a (u8, u16) pair is corrupted by tcc-816
   (docs/ENGINE_CONSTRAINTS.md §1.6). */
void timer_set(u16 secs); /* sets and starts the countdown */
void timer_stop(void);
void timer_display(u8 on);

/* Seconds left (the VAROP "timer" source). */
u16 timer_secs(void);

/* One tick per frame, from the main loop, outside the System menu. The
   display is composed into ui_map; ui_screen_vblank does the transfer. */
void timer_tick(void);

/* Unconditional redraw when shown — after the dialogue band is cleared
   by tb_clear_band. */
void timer_refresh(void);

#endif /* TIMER_H */
