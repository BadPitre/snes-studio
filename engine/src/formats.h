/*
 * formats.h — the C representation of the data formats.
 * Reference: docs/SPEC_FORMATS.md.
 *
 * These structs are the C-side view (32-bit far pointers resolved at
 * link time). The byte-exact binary format — 24-bit far pointers, a
 * Scene Table at a fixed address — is emitted by tools/datagen.
 */
#ifndef FORMATS_H
#define FORMATS_H

#include <snes.h>

/* scene_type — the only value so far, but the field exists everywhere */
#define SCENE_TYPE_TOP_DOWN 0x01

/* actor_type (spec §1.3): RM2003-style triggers */
#define ACTOR_TYPE_NPC_STATIC 0x01 /* visible NPC, talks with A */
#define ACTOR_TYPE_TRIGGER 0x02    /* invisible: script on contact (walking onto it) */
#define ACTOR_TYPE_AUTO 0x03       /* invisible: script when the scene loads */

/* script_offset of an actor with no script */
#define SCRIPT_NONE 0xFFFF

/* 16x24 OBJ sheet (RM2003 charset model): a frame is 2 stacked 16x16
   OBJs, and a group of 8 frames is 4 rows of 16 chars — rows 0-1 the
   top halves, 2-3 the bottom halves, the last 8 lines left empty.
   Tile of frame f's top OBJ; the bottom one is +32. */
#define OBJ_TOP_TILE(f) ((u16)(((f) & 0xF8) << 3) | (u16)(((f) & 7) << 1))
#define OBJ_BOTTOM_TILE(f) (OBJ_TOP_TILE(f) + 32)

/* RM2003 character block: 12 frames = 4 directions x 3 steps (idle,
   step A, step B). An actor's sprite_id is a block SLOT in the scene's
   sprite set, remapped by datagen; slot s uses OBJ palette s and the
   player is always slot 0. Idle frame: slot*12 + dir*3. */
#define CHAR_BLOCK_FRAMES 12

/* The 16x24 metasprite is anchored on its tile: the top OBJ overhangs
   by 8 px, so the head overlaps the tile above, as in RM2003. */
#define SPRITE_Y_OVERLAP 8

/* Collision layer — spec §1.4 */
#define COL_FREE 0x00
#define COL_SOLID 0x01
#define COL_WARP 0x02
/* The collision byte carries the TYPE in its low nibble (COL_*) and the
   CLOSED SIDES in its high nibble — bit 4 + DIR_*: the tile's boundary
   in that direction cannot be crossed, going out or coming in. That is
   RM2003's directional passage: counters, ledges. The opposite
   direction is DIR ^ 1 (down 0 / up 1, left 2 / right 3). */
#define COL_TYPE(c) ((u8)((c) & 0x0F))
#define COL_SIDES(c) ((u8)((c) >> 4))

/* Directions (actors and player) */
#define DIR_DOWN  0
#define DIR_UP    1
#define DIR_LEFT  2
#define DIR_RIGHT 3

/* VM opcodes — spec §2, a contractual table: add nothing without an
   explicit request */
#define VM_OP_END     0x00
#define VM_OP_MSG     0x01 /* text_id (u16) — blocking */
#define VM_OP_SETVAR  0x02 /* var (u8), val (u8) */
#define VM_OP_ADDVAR  0x03 /* var (u8), val (u8) */
#define VM_OP_JMP     0x04 /* offset (u16) */
#define VM_OP_JEQ     0x05 /* var, val, offset */
#define VM_OP_JNE     0x06 /* var, val, offset */
#define VM_OP_SETGVAR 0x07 /* var (u8), val (u8) */
#define VM_OP_JGEQ    0x08 /* var, val, offset */
#define VM_OP_CHOICE  0x09 /* var, count (2-4), count x text_id (u16) —
                              blocking: cursor up/down plus A, index -> var */
#define VM_OP_WARP    0x0A /* scene (u8), x (u8), y (u8), trans (u8) —
                              teleports the hero and ENDS the script — the
                              script block belongs to the scene. trans:
                              0 fade, 1 instant, 2 mosaic. */
#define VM_OP_FACE    0x0B /* actor (u8), dir (u8) — turns the actor */

/* Switches and 16-bit variables, RM2003 style */
#define VM_OP_SW      0x0C /* idx (u16), val (u8 0/1) — switch OFF/ON */
#define VM_OP_JSW     0x0D /* idx (u16), expected (u8), offset (u16) —
                              jump if switch == expected */
#define VM_OP_SET16   0x0E /* var (u8), val (u16) — 16-bit variable */
#define VM_OP_ADD16   0x0F /* var (u8), val (u16, addition with wrap —
                              a negative value is two's complement) */
#define VM_OP_JCMP16  0x10 /* srcA (u8, VARSRC_*), a (u16), op (u8: 0 ==,
                              1 !=, 2 >=), srcB (u8), b (u16), offset (u16).
                              BOTH sides are general sources, like VAROP's.
                              The comparison used to be frozen as "variable
                              against constant", which made it impossible
                              to test a function PARAMETER without copying
                              it into a global first. */

/* Move Route: NPC routes plus blocking waits */
#define VM_OP_ROUTE     0x11 /* actor (u8, 0xFF = the script's event), flags
                                (u8: bit0 repeat, bit1 skip when blocked),
                                len (u8), then len INLINE STEPS — the route
                                lives in the script block and the actor
                                points at it. Non-blocking (cutscenes). */
#define VM_OP_WAITROUTE 0x12 /* blocking: waits for every non-repeating
                                non-repeating routes */
#define VM_OP_WAIT      0x13 /* frames (u8) — blocking pause */

/* Route steps (spec §2, the full Move Route dialogue). One byte per
   step, except 0x50-0x52 which carry a parameter. */
#define ROUTE_STEP_MOVE   0x00 /* 0x00-0x03: walk down/up/left/right */
#define ROUTE_STEP_MRAND  0x04 /* walk in a random direction */
#define ROUTE_STEP_MHERO  0x05 /* walk towards the hero */
#define ROUTE_STEP_MFLEE  0x06 /* flee the hero */
#define ROUTE_STEP_FWD    0x07 /* one step in the current direction */
#define ROUTE_STEP_TURN   0x10 /* 0x10-0x13: turn (without moving) */
#define ROUTE_STEP_T90R   0x14 /* turn 90 degrees right */
#define ROUTE_STEP_T90L   0x15 /* turn 90 degrees left */
#define ROUTE_STEP_T180   0x16 /* turn around */
#define ROUTE_STEP_T90X   0x17 /* 90 degrees left OR right (random) */
#define ROUTE_STEP_TRAND  0x18 /* random direction */
#define ROUTE_STEP_FACEP  0x19 /* turn towards the hero */
#define ROUTE_STEP_TFLEE  0x1A /* turn away from the hero */
#define ROUTE_STEP_SPDUP  0x20 /* speed + (1-4) */
#define ROUTE_STEP_SPDDN  0x21 /* speed - */
#define ROUTE_STEP_FRQUP  0x22 /* frequency + (1-8) */
#define ROUTE_STEP_FRQDN  0x23 /* frequency - */
#define ROUTE_STEP_FIXON  0x28 /* direction fix ON (freezes the facing) */
#define ROUTE_STEP_FIXOFF 0x29
#define ROUTE_STEP_THRUON 0x2A /* through ON (walks through anything) */
#define ROUTE_STEP_THRUOFF 0x2B
#define ROUTE_STEP_WAITN  0x40 /* 0x40|n: wait n*8 frames (n 1-15) */
#define ROUTE_STEP_SWON   0x50 /* + u16: switch ON */
#define ROUTE_STEP_SWOFF  0x51 /* + u16: switch OFF */
#define ROUTE_STEP_GFX    0x52 /* + u8: change the graphic (local slot) */
#define ROUTE_FLAG_REPEAT 0x01
#define ROUTE_FLAG_SKIP   0x02

/* Advanced operations, timer, scripted camera */
#define VM_OP_VAROP   0x14 /* dst (u8), op (u8), src_type (u8), src (u16) —
                              vars16[dst] = vars16[dst] OP value(src).
                              op: 0 =, 1 +, 2 -, 3 *, 4 /, 5 mod,
                              6 random 0..value (inclusive).
                              src_type: 0 constant, 1 variable[src],
                              2 hero X (tiles), 3 hero Y (tiles),
                              4 timer (seconds left).
                              division and mod by zero give 0. */
#define VM_OP_TIMER   0x15 /* op (u8): 0 set and start (val = seconds),
                              1 stop, 2 show, 3 hide; val (u16) */
#define VM_OP_CAMPAN  0x16 /* tx (u8), ty (u8), speed (u8 px/frame) —
                              pans the camera to the tile (centred),
                              NON-blocking */
#define VM_OP_CAMRET  0x17 /* speed (u8) — pan back to the hero
                              then resumes following */
#define VM_OP_WAITCAM 0x18 /* blocking: waits for the pan to end */

/* Scripted positions (RM2003's memorise/recall) */
#define VM_OP_WARPV   0x19 /* vs (u8), vx (u8), vy (u8), trans (u8) —
                              teleports the hero to scene vars16[vs],
                              tile (vars16[vx], vars16[vy]), and ENDS the
                              script like WARP. Recalls a position saved
                              by VAROP scene/hx/hy. trans: 0 fade,
                              1 instant, 2 mosaic. */
#define VM_OP_SETPOS  0x1A /* actor (u8, 0xFF = the script's event),
                              src (u8: 0 constants, 1 variables),
                              x (u8), y (u8) — places the event on tile
                              (x,y), or (vars16[x], vars16[y]) if src=1 */
#define VM_OP_SWAPPOS 0x1B /* a (u8), b (u8, 0xFF = the script's event) —
                              swaps the positions of two events */

/* Screen effects (the screenfx module) */
#define VM_OP_SCRHIDE 0x1C /* duration (u8 1-255 frames, an 8.8 ramp),
                              fx (u8: 0 fade, 1 instant, 2 mosaic,
                              3-5 wipe down/up/centre) — hides the
                              screen, BLOCKING */
#define VM_OP_SCRSHOW 0x1D /* duration (u8), fx (u8) — shows the screen,
                              BLOCKING */
#define VM_OP_TINT    0x1E /* mode (u8: 0 normal, 1 lighten, 2
                              darken), r, g, b (u8 0-31) — tints the scenery
                              (fixed-colour math; BG3 and OBJ palettes 0-3
                              excluded), persists across scenes */
#define VM_OP_FLASH   0x1F /* r, g, b (u8 0-31), frames (u8) — a flash
                              a decaying addition, NON-blocking */
#define VM_OP_SHAKE   0x20 /* power (u8 0-8 px, 0 = stop), speed (u8
                              1-8, frames per alternation), frames (u8) —
                              horizontal shake, NON-blocking */

/* Common events: callable global scripts, RM2003 model */
#define VM_OP_CALL    0x21 /* offset (u16) — calls a sub-script (the body
                              of a common event); an 8-level return stack,
                              debug halt when full */
#define VM_OP_RET     0x22 /* return from a CALL — on an empty stack it acts
                              END (the body was started directly) */

/* Call stack depth (nested and recursive CALLs) */
#define VM_CALL_DEPTH 8

/* Functions — a global script that declares PARAMETERS and returns a
   VALUE. Arguments live in a stack of frames, not in global variables:
   without that, a function calling another (or itself) would overwrite
   its own inputs, and the author would have to reserve variables by
   hand — exactly the chore the feature exists to remove. */
#define VM_FRAME_SLOTS 32 /* frames stacked, all calls together */
#define VM_PARAMS_MAX 8   /* parameters of ONE function (datagen checks) */
#define VM_LOCALS_MAX 8   /* local variables of ONE function (likewise) */

/* Database reads (docs/PLANNING_SYSTEME_DATABASE.md) */
#define VM_OP_DBREAD  0x23 /* table (u8, index into the db_tables[] registry),
                              entry src (u8: 0 constant, 1 variable),
                              entry (u8), field offset (u8), size
                              (u8: 1 or 2), dst var (u8) —
                              vars16[dst] = the field; out of range (an
                              invalid dynamic entry) gives 0 */
#define VM_OP_SHOWUI  0x24 /* widget (u8, root index in the layout),
                              on (u8: 1 show, 0 hide) — visibility of a
                              UI widget (hidden by default) */
#define VM_OP_KEYIN   0x25 /* wait (u8), mask lo (u8), mask hi (u8), var
                              dst (u8) — Key Input Processing (RM2003):
                              vars16[dst] = the key code (1 down, 2 left,
                              3 right, 4 up, 5 A, 6 B, 7 Y, 8 X, 9 L,
                              10 R, 11 Select, 12 Start; 0 = none).
                              wait = 1 blocks until a FRESH press of a
                              key in the mask */
#define VM_OP_SYSMENU 0x26 /* opens the System menu (saving) — the
                              menu takes over when the script ends. The
                              hardcoded START mapping is gone: the author
                              maps their own key with KEYIN plus this
                              command */
#define VM_OP_DLGSTYLE 0x27 /* style (u8, 0 = default) — dialogue box
                               of the next MSG/CHOICE: window, windowskin
                               and font per style (the ui_styles.c
                               tables). datagen emits it before EVERY
                               msg/choice carrying a "style" field. */
#define VM_OP_SHOWPIC 0x28 /* pic_id, x, y, flags, dur (u8 x5) — a
                              BG2 and OBJ hidden, BG3 kept so dialogues
                              play ON the image. x/y is a screen position
                              in pixels (the BG1 scroll). flags: bit 0 =
                              pic_id is a VARIABLE INDEX, bit 1 = x/y are
                              variable indices, bit 2 = centre it (engine
                              side); bits 3-4 = colour-math blending with
                              the scenery (0 opaque, 1 semi-transparent,
                              2 additive, 3 subtractive — tint and flash
                              suspended while the image is up). dur =
                              frames of EACH fade (0 instant). The
                              position is clamped to the real dimensions;
                              an out-of-range id is ignored. */
#define VM_OP_HIDEPIC 0x29 /* dur (u8, fade frames, 0 = instant) —
                              closes the picture: the scene's tileset and
                              palettes are reloaded, events untouched */
#define VM_OP_MOVEPIC 0x2A /* x, y, flags, dur (u8 x4) — SLIDES the
                              image towards (x,y) over dur frames (0
                              jumps), NON-blocking — the script carries
                              on, like RM2003's Move Picture. flags bits
                              1-2 as in SHOWPIC. Ignored with no image. */
#define VM_OP_WEATHER 0x2C /* type, pow (u8 x2) — particle weather:
                              0 none, 1 rain, 2 snow; pow 1-3 gives
                              8/16/24 sprites (OAM 100-123, OBJ chars
                              484+, OBJ palette 7). GLOBAL state,
                              persisting across scenes. */
#define VM_OP_WAVE 0x2D /* power, speed (u8 x2) — screen RIPPLE
                            (HDMA): BG1/BG2 scrolls made sinusoidal in
                            16-line bands. power 0-7 px (0 stops), speed
                            1-8. NON-blocking, persists across scenes,
                            suspended during a picture. */
#define VM_OP_SKYGRAD 0x2E /* mode, r0, g0, b0, r1, g1, b1 (u8 x7) —
                              sky GRADIENT (HDMA): a VERTICAL tint from
                              the top (r0g0b0) to the bottom (r1g1b1),
                              0-31 per channel. mode 0 off, 1 lighten,
                              2 darken. REPLACES the flat tint, and
                              TINT/TINTG cancels it — same colour-math
                              circuit. NON-blocking, persists across
                              scenes; cut under blending, flash or
                              picture. */
#define VM_OP_PLAYSFX 0x30 /* id (u8) — plays a SOUND: an
                              8 kHz BRR from data_sfx.c through the SPC
                              effect region (spcPlaySound). NON-blocking,
                              plays over the music. An out-of-range id is
                              ignored. */
#define VM_OP_PLAYBGM 0x31 /* id (u8) — changes the MUSIC: a
                              soundbank index (the project's music_id);
                              0xFF is silence. NON-blocking, no effect if
                              it is already playing. The SCENE's music
                              resumes at the next warp — RM2003's model,
                              where the map reasserts its music. */
#define VM_OP_STAGEOPEN 0x32 /* pic u8 (0xFF = black), dur u8, trans u8 —
                                opens the COMPOSED SCREEN: a full-screen
                                background (an OPAQUE picture) on BG2,
                                the scene's sprites hidden, dialogues and
                                HUD still live. Transition (dur frames
                                each way, 0 instant) per trans: 0 fade,
                                1 instant, 2 mosaic ($2106 coupled to the
                                fade). The do_warp recipe; the VM marks
                                one frame of pause. */
#define VM_OP_STAGEPOSE 0x33 /* slot u8 (0-4), pic u8, tx u8, ty u8 —
                                POSES an image on the composed screen,
                                position in TILES (x8 px), on the
                                dedicated BG palette 2+slot. Transfer
                                is SPREAD OUT with the screen on (1 KB of
                                chars per VBlank, then 2 map rows per
                                frame) — BLOCKING (VM_WAIT_STAGE).
                                Re-posing the same image is a move (map
                                only). Budget: 511 chars; a pose beyond
                                that is ignored, reopening frees them. */
#define VM_OP_STAGECLEAR 0x34 /* slot u8 — removes the slot's image
                                 (its map region is cleared, the chars
                                 stay allocated). BLOCKING, briefly. */
#define VM_OP_STAGECLOSE 0x35 /* dur u8, trans u8 — closes the
                                 composed screen: an INTERNAL WARP to the
                                 current scene, restoring everything —
                                 scenery, sprites, ambience, the scene's
                                 music. Moved NPCs return to their pages,
                                 as after a warp. trans: 0 fade,
                                 1 instant, 2 mosaic — applied to the
                                 close AND to the map coming back. */
#define VM_OP_SLOTFX 0x36 /* slot u8 (0-4), fx u8, dur u8 — a
                             PALETTE effect on a posed image: 0 restore,
                             1 white flash (dur frames), 2 fade to black
                             (death — BGR555 half tints, 5 steps),
                             3 darken one notch, persistent.
                             NON-blocking, and only THAT slot is touched
                             (one palette per slot). Outside a composed
                             screen, or on an empty slot: ignored. */
#define VM_OP_VIGSHOW 0x37 /* slot u8 (0-1), vig u8, x u8, y u8,
                              anchor u8 — shows a VIGNETTE: a 32x32
                              sprite (OBJ_LARGE, OAM 96-97, chars
                              384-447, OBJ palettes 5-6), frame 0.
                              anchor 0 is a screen position, 1 sticks it
                              to the hero (x/y are SIGNED offsets).
                              Persists across scenes; suspended during a
                              picture, which borrows the OBJ region, and
                              reloaded when it closes. */
#define VM_OP_VIGPLAY 0x38 /* slot u8, mode u8, speed u8 — animates the
                              vignette: mode 0 stop (freeze), 1 once AND
                              THEN HIDE (a sword swing), 2 loop; speed is
                              frames per image of the sheet.
                              NON-blocking. */
#define VM_OP_VIGHIDE 0x39 /* slot u8 — hides the slot's vignette. */
#define VM_OP_ANIMPLAY 0x3B /* anim u8, anchor u8, target u8, flags u8 —
                               frame-by-frame ANIMATION: plays on a
                               vignette slot, since its cell sheet IS a
                               vignette. anchor: 0 screen (offsets around
                               its CENTRE), 1 hero, 2 event (target is an
                               actor index; 0xFF means "this event",
                               resolved at run time). flags bit 0 = WAIT
                               for the end (VM_WAIT_ANIM); a LOOPING
                               animation never blocks, or the wait would
                               never finish. */
#define VM_OP_ANIMSTOP 0x3C /* stops every running animation and
                               puts their sprites away (leaving a loop
                               started without a wait). */

/* FUNCTION calls — a global script with parameters. */
#define VM_OP_CALLF 0x3D /* offset (u16), argc (u8), nslots (u8), then argc x
                            [source type (u8)][value (u16)] — the same
                            sources as VAROP, so an argument may be a
                            constant, a variable, the hero's position…
                            or a PARAMETER of the calling function
                            (recursion and composition).
                            Arguments are evaluated in the CALLER's frame
                            and then become the callee's. nslots =
                            parameters plus the callee's LOCAL VARIABLES:
                            the slots past the arguments are ZEROED, so a
                            local always starts at 0. A full stack or
                            saturated frames: debug halt, a data bug. */
#define VM_OP_SETLOC 0x3F /* slot (u8), op (u8, VAROP_*), source type
                             (u8), value (u16) — the same arithmetic as
                             VAROP, but the destination is a LOCAL
                             VARIABLE, that is a slot of the current
                             frame. Locals follow the parameters in the
                             frame: datagen resolves a local's name to a
                             slot, and READING goes through VARSRC_PARAM
                             with that same index — a parameter and a
                             local differ only by the right to write. */
#define VM_OP_RETF 0x3E  /* source type (u8), value (u16) — sets the
                            returned value (readable afterwards through
                            the VARSRC_RET source) then returns like RET.
                            A function with no return value ends on a
                            plain RET: both pop the frame. */
#define VM_OP_M7OPEN 0x40 /* img (u8), dur (u8) — opens the MODE 7 SCREEN
                             (M7-A): the plane replaces the whole view,
                             one layer, no BG3 and therefore no dialogue.
                             Applied from the main loop under force blank
                             (32 KB of upload), 1 frame of VM pause. An
                             image out of range is ignored and the scene
                             is left alone. */
#define VM_OP_M7ZOOM 0x41 /* ramp (u8, 0xFF stops), flags (u8) — plays a
                             ramp compiled by datagen, one 8.8 scale per
                             frame. bit 0 loops, bit 1 waits for the end.
                             A LOOPING ramp never blocks, as with
                             animations. Stopping HOLDS the current
                             scale, which is what lets a script zoom,
                             hold, then close. */
#define VM_OP_M7CLOSE 0x42 /* dur (u8) — closes the Mode 7 screen: an
                              INTERNAL WARP to the current scene, the
                              stage_close recipe. */
#define VM_OP_LISTSEL 0x3A /* widget, var, flags (u8 x3) — a cursor
                              BLOCKING cursor on a "list" widget of the UI
                              layout. Shows the widget with the cursor at
                              the top; up/down navigate and wrap, A confirms
                              (var = index 0..n-1), B cancels (var = 255)
                              when flags bit 0 is set. flags bit 1: the
                              widget STAYS shown on close (multi-panel,
                              without a cursor); bit 2: Left/Right also exit
                              (var = 254 left, 253 right — the script moves
                              on to the neighbouring list). Otherwise the
                              widget is hidden again. A widget with no list:
                              the command is ignored, var untouched. */
#define VM_OP_SPOTLIGHT 0x2F /* radius, dark (u8 x2) — SPOTLIGHT (an
                                HDMA): a circle of light, radius 16-96 px
                                (0 off), that FOLLOWS the hero, with the
                                scenery darkened (a dark 1-31 subtraction)
                                outside colour window W1. REPLACES tint and
                                gradient, sharing the circuit. NON-blocking,
                                persists across scenes; sprites and text
                                stay visible everywhere (hardware). */
#define VM_OP_TINTG 0x2B /* mode, r, g, b, dur (u8 x5) — a GRADUAL tint
                            (day/night): interpolates the current tint
                            towards the target over dur frames.
                            NON-blocking, persists across scenes. dur 0
                            is an immediate TINT; add<->sub goes through
                            zero in two phases. Suspended on screen
                            during a blend (effect layer or picture —
                            cm_hold), but the interpolation carries on. */

#define VAROP_SET 0
#define VAROP_ADD 1
#define VAROP_SUB 2
#define VAROP_MUL 3
#define VAROP_DIV 4
#define VAROP_MOD 5
#define VAROP_RAND 6
#define VARSRC_CONST 0
#define VARSRC_VAR 1
#define VARSRC_HERO_X 2
#define VARSRC_HERO_Y 3
#define VARSRC_TIMER 4
#define VARSRC_SCENE 5 /* index of the current scene */
#define VARSRC_PARAM 6 /* parameter n of the FUNCTION in progress */
#define VARSRC_RET 7   /* value returned by the last CALLF */

/* Budgets: 512 switches (64 bytes of bits), 256 16-bit variables. Both
   persist across scenes and are saved to SRAM (spec §4bis). */
#define VM_SWITCH_COUNT 512
#define VM_VAR16_COUNT  256

/* Variable byte of the 8-bit opcodes: bit 7 marks a GLOBAL variable
   (a gvar, persisting across scenes), bits 0-5 the number (spec §2) */
#define VM_VAR_GLOBAL 0x80

/* Actor entry — spec §1.3. The C layout IS the binary layout (8 bytes;
   tcc-816 does not pad), so the engine casts the actor block directly. */
typedef struct
{
  u8 actor_type;    /* ACTOR_TYPE_* */
  u8 x;             /* in 16x16 tiles */
  u8 y;
  u8 sprite_id;     /* character block slot; 0xFF = invisible */
  u16 script_offset; /* offset in the script block, SCRIPT_NONE = none */
  u8 direction;     /* DIR_* */
  u8 flags;         /* bit 7 = CONTINUATION (a page of the same event as
                       the previous entry), bits 0-2 = condition type,
                       bits 3-5 = movement type */
  u16 cond_idx;     /* switch (0-511) or 16-bit variable (0-255) */
  u16 cond_val;     /* compared value (var >= val) */
  u8 prio_speed;    /* bits 0-1 = priority (0 below the hero,
                       1 same as the hero, 2 above), bits 4-7 =
                       speed 1-4 (0 means the default, 1) */
  u8 reserved;
  u16 route_ofs;    /* custom route — offset of the blob
                       [flags][freq][len][steps...] in the script block;
                       0xFFFF means none */
} ActorDef;

/* Conditional event pages (RM2003 model): one event is a run of
   consecutive actor entries (the CONTINUATION flag on pages 2+); the
   LAST page whose condition passes is active, the others inert. */
#define ACTOR_FLAG_CONT 0x80
#define ACTOR_COND_MASK 0x07
/* Flags bits 3-4: the NPC's movement type (RM2003) */
#define ACTOR_MOVE_SHIFT 3
#define ACTOR_MOVE_MASK 0x38 /* 3 bits (custom route) */
#define ACTOR_MOVE_STATIC 0
#define ACTOR_MOVE_RANDOM 1
#define ACTOR_MOVE_VERT 2   /* back and forth, up and down */
#define ACTOR_MOVE_HORIZ 3  /* back and forth, left and right */
#define ACTOR_MOVE_CUSTOM 4 /* custom route (the route_ofs blob) */

/* Event priority (byte prio_speed, bits 0-1) — RM2003 model */
#define ACTOR_PRIO_BELOW 0 /* below the hero: walkable, interaction while
                              standing on it (a chest on the ground) */
#define ACTOR_PRIO_SAME 1  /* same as the hero: blocks and talks face to face */
#define ACTOR_PRIO_ABOVE 2 /* above: walkable, drawn on top */
#define ACTOR_COND_NONE 0x00
#define ACTOR_COND_SW_ON 0x01  /* switch cond_idx == ON */
#define ACTOR_COND_SW_OFF 0x02 /* switch cond_idx == OFF */
#define ACTOR_COND_VAR_GEQ 0x03 /* vars16[cond_idx] >= cond_val */

/* Warp entry — spec §1.5. The C layout IS the binary layout (8 bytes). */
typedef struct
{
  u8 x; /* triggering tile */
  u8 y;
  u8 dest_scene; /* index in the Scene Table */
  u8 dest_x;     /* player arrival, in tiles */
  u8 dest_y;
  u8 flags;
  u8 trans; /* transition: 0 fade, 1 instant, 2 mosaic */
  u8 reserved1;
} WarpDef;

/* The Scene Header (spec §1.2) is read field by field from the binary —
   24-bit far pointers have no C equivalent. See scene.c. */

#endif /* FORMATS_H */
