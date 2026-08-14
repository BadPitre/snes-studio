/*
 * vblnmi.h — the unified VBlank transfer dispatcher (V-NMI, V1).
 *
 * One NMI slot exists (nmiSet); this module owns it. Consumers stop
 * owning callbacks: they PUBLISH transfer descriptors — data, not
 * function pointers, an indirect tcc-816 call being the ~1.5 lines
 * per call the P6 campaign spent removing — and the dispatcher fires
 * them twice per frame:
 *
 *  - vbl_nmi (the ISR): at ~line 227, before the tail, up to ~23
 *    lines earlier than vbl_open anchors on a loaded frame. No
 *    budget, no probe — a hard CAP of declared lines instead, so the
 *    ISR cost is deterministic and vbl_open, reading the counter
 *    after it, charges the ledger naturally.
 *  - vbl_nmi_tail (the VBlank tail): the fallback lane, draining the
 *    SAME descriptors under vbl_take + vbl_probe. Whatever the cap
 *    left over lands here or on a later frame.
 *
 * A descriptor is its own resume state: `count` sub-transfers of
 * `len` bytes, `src` advancing by len and `dst` by `stride` words
 * per step (a vignette cell = rows of a 16-char name grid). Firing
 * advances the descriptor in place; the token clears only when the
 * count reaches zero, so an interrupted cell continues next frame
 * from where it stopped, on either lane.
 *
 * The three integrity rules, inherited verbatim from the vignette
 * pipeline that proved them (H-bugfix):
 *  - vbl_fire_ok gates the ISR: 1 only through the frame's DMA-free
 *    stretch (owned by main.c — a DMA started from the ISR in the
 *    middle of another dmaCopy's channel-0 setup corrupts both);
 *  - vn_token is the publication gate, written LAST by vn_publish;
 *  - each slot has a live SEQ counter the producer bumps on any
 *    mutation of the underlying state (vn_bump); a descriptor whose
 *    snapshot no longer matches is dropped, both lanes.
 *
 * Two descriptor KINDS since V3:
 *  - linear (vn_publish): count sub-transfers of len bytes, INC1 —
 *    the vignette/battler cell shape;
 *  - burst (vn_publish_burst): a vramjob queue slice fired whole by
 *    vram_burst, with its own $2115 mode — the map column/row and
 *    animated-tile shape. The vj_* globals became the dispatcher's
 *    scratch: it is the only writer left.
 */
#ifndef VBLNMI_H
#define VBLNMI_H

#include <snes.h>

/* Fixed slots, one per producer — table order is PRIORITY. Map bursts
   lead: a screen edge coming into view is the one transfer whose
   lateness shows as garbage tiles; sprite cells recover invisibly
   (a frame late is a frame late) and the animated-tile step is the
   historical first sacrifice, so it walks last. */
#define VN_MAPC 0 /* map column burst (map.c, V3) */
#define VN_MAPR 1 /* map row burst */
#define VN_VIG 2  /* vignette cell rows (vignette.c, V1) */
#define VN_BP 3   /* battler cells + digit sheet (btlprim.c, V2) */
#define VN_TA 4   /* animated-tile step (tileanim.c, V3) */
#define VN_SLOTS 5

/* Declared-line cap per NMI: 4 vignette rows of a 32x32 cell (the
   H-bugfix bound, cost 4 each) fit exactly; a 64x64 cell (rows of
   cost 6) spreads over more VBlanks — latency traded for a
   deterministic ISR, invisible at animation speeds. */
#define VN_ISR_CAP 16

/* Publishes slot i: count sub-transfers of len bytes, src advancing
   by len and dst by stride WORDS per step; cost = declared lines per
   sub-transfer (vbudget scale). Writes the token last. The published
   descriptor snapshots the slot's current seq. */
void vn_publish(u8 i, const u8 *src, u16 dst, u16 len, u8 count,
                u16 stride, u8 cost);

/* Publishes a vramjob BURST on slot i (V3): the descriptor carries
   the queue slice (vj_first = first, vj_n = n) and the $2115 mode;
   the fire sets the vj_* globals — the dispatcher's scratch since V3
   — and calls vram_burst. Fired WHOLE under one cost, never split:
   the batch shape is the whole point of the burst (vramjob.h). */
void vn_publish_burst(u8 i, u16 first, u16 n, u16 vmain, u8 cost);

/* Producer-side observation and control. */
u8 vn_busy(u8 i);   /* 1 while the descriptor is in flight */
u8 vn_seq(u8 i);    /* the slot's live seq counter */
void vn_bump(u8 i); /* mutation notice: in-flight descriptor is stale */
void vn_cancel(u8 i);

/* Cancels the SCENE lanes (map bursts, tileanim) in one call — for
   every display takeover that does not reload the scene: a composed
   screen opening, a full-screen picture, a world map. A stale map row
   firing into a freshly-laid stage (or a picture's borrowed BG1 map)
   is exactly the corruption the per-branch tail calls used to make
   impossible by never running. */
void vn_cancel_scene(void);

/* The two lanes (main.c installs vbl_nmi with nmiSet; the tail call
   sites follow each branch's register writes). */
void vbl_nmi(void);
void vbl_nmi_tail(void);

/* Owned by the MAIN LOOP: 1 only through the frame's DMA-free
   stretch (logic + parked in WaitForVBlank) — see main.c's two write
   sites, which do not move. */
extern u8 vbl_fire_ok;

/* Measurement hooks (V-counter sessions, read via the .sym): the
   beam at the ISR's entry when it fired (vn_v_in — answers "when
   does the ISR really start" on loaded frames, the §8 open
   question), after its last fire, and the highest ever. Fires on
   forced-blank frames legitimately exceed VBL_LAST — see vblnmi.c. */
extern u16 vn_v_in;
extern u16 vn_v_last;
extern u16 vn_v_max;

#endif /* VBLNMI_H */
