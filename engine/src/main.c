/*
 * main.c — engine entry point and main loop.
 *
 * When the VM is active (a script or a dialogue is running) it has
 * control and the player is frozen; otherwise the top-down module does.
 */
#include <snes.h>
#include "scene.h"
#include "tileanim.h"
#include "player.h"
#include "camera.h"
#include "map.h"
#include "actors.h"
#include "textbox.h"
#include "vm.h"
#include "save.h"
#include "audio.h"
#include "timer.h"
#include "screenfx.h"
#include "ui_overlay.h"
#include "ui_screen.h"
#include "vram.h"
#include "picture.h"
#include "debug.h"
#include "effectlayer.h"
#include "weather.h"
#include "hdmafx.h"
#include "stage.h"
#include "btlprim.h"
#include "m7.h"
#include "vignette.h"
#include "vblnmi.h"
#include "anim.h"
#include "vbudget.h"



/* Closing/opening the screen around a warp (S18): 0 fade (the historic
   setFadeEffect recipe, 16 frames), 1 instant, 2 mosaic ($2106 on BG1-3
   coupled to brightness — it pixelates as it darkens). */
/* one step of the ramp: brightness b (0-15), complementary mosaic */
static void warp_trans_regs(u8 b)
{
  u8 m = 15 - b;

  m = (m << 4) | 0x07;
  REG_MOSAIC = m;
  REG_INIDISP = b;
}

static void warp_close(u8 trans)
{
  u8 f;
  u8 b;
  u16 l;

  if (trans == 1)
    return; /* instant: setScreenOff is enough */
  if (trans == 2)
  {
    b = 15;
    for (f = 0; f < 16; f++)
    {
      WaitForVBlank();
      warp_trans_regs(b);
      b--;
    }
    return;
  }
  if (trans >= 3)
  {
    /* wipe (S18b): black HDMA curtain — 16 steps of 14 lines */
    l = 0;
    for (f = 0; f < 16; f++)
    {
      l += 14;
      WaitForVBlank();
      screenfx_wipe_step(trans, l);
    }
    WaitForVBlank();
    screenfx_wipe_off();
    REG_INIDISP = 0; /* stays black until setScreenOff */
    return;
  }
  setFadeEffect(FADE_OUT);
}

static void warp_open(u8 trans)
{
  u8 f;
  u8 b;
  u16 l;

  if (trans == 1)
  {
    setScreenOn();
    return;
  }
  if (trans == 2)
  {
    b = 0;
    for (f = 0; f < 16; f++)
    {
      WaitForVBlank();
      warp_trans_regs(b); /* screen back on from the first write */
      b++;
    }
    WaitForVBlank();
    REG_MOSAIC = 0; /* effect done (size 1, no BG) */
    return;
  }
  if (trans >= 3)
  {
    /* wipe: the full curtain is armed BEFORE turning the screen back on
       (no flash — base brightness 0, the HDMA writes $2100 line by line) */
    REG_INIDISP = 0;
    screenfx_wipe_step(trans, 224);
    l = 224;
    for (f = 0; f < 16; f++)
    {
      l -= 14;
      WaitForVBlank();
      screenfx_wipe_step(trans, l);
    }
    WaitForVBlank();
    screenfx_wipe_off();
    REG_INIDISP = 0x0F; /* the last HDMA value may be a band 0 */
    return;
  }
  setScreenOn();
  setFadeEffect(FADE_IN);
}

/* Warp transition: close (tr_out), full reload of the target scene with
   the screen off (safe transfers), open (tr_in). The VM vars are cleared,
   the gvars persist. */
static void do_warp(u8 dest_scene, u8 dest_x, u8 dest_y, u8 tr_out,
                    u8 tr_in)
{
  u16 auto_ofs;
  u8 wdir;
  u8 pdir = player.dir; /* "keep" (v0.16): the direction survives the
                           reload (player_init would put it back to down) */

  warp_close(tr_out);
  setScreenOff();

  picture_reset(); /* warp during an image: scene_load reloads everything */
  /* Warp OUT of a Mode 7 screen — a world map's warp tile, or a scripted
     one. Without this the plane never stands down: BGMODE stays 7, TM
     stays BG1+OBJ, the perspective HDMA keeps firing, and BG1 reads as a
     Mode 7 plane the VRAM scene_load is about to refill with ordinary
     tilemaps. The result is a black screen with the sprites floating on
     it, which is exactly what it looked like. m7_reset was written for
     this case and simply never called from here. */
  m7_reset();
  scene_load(dest_scene);
  /* BG3 back where an ordinary scene expects it, font included. A Mode 7
     screen wiped the low half of VRAM where the font lives and moved the
     UI layer above the OBJ region; nothing else puts it back. */
  textbox_gfx_at(VRAM_BG3_GFX, VRAM_BG3_MAP);
  ui_screen_rebase(VRAM_BG3_MAP);
  textbox_load_pal(); /* scene_load overwrites CGRAM 16-19 (the font) */
  vm_scene_reset();
  camera_init(); /* a scripted pan does not survive a scene change */
  anim_stop(); /* same: an animation pinned to an event of the old
                  scene has no target any more */
  player_init();
  player_set_pos(dest_x, dest_y);
  wdir = player_take_warp_dir(); /* arrival direction (v0.16) */
  player.dir = wdir ? wdir - 1 : pdir;
  actors_init();
  /* The scene's AUTORUN trigger: its script takes over on the very first
     frame after the fade. */
  auto_ofs = actors_autorun();
  if (auto_ofs != SCRIPT_NONE)
    vm_start(auto_ofs);
  camera_update();
  map_init();
  /* Scroll written HERE (screen off): the main loop will not update it
     until after the fade — without this the new map shows with the OLD
     scene's scroll for the whole fade-in and the player appears in the
     wrong place before "jumping" to the right one. */
  bgSetScroll(0, camera.x, camera.y);
  bgSetScroll(1, camera.x, camera.y);
  player_draw();
  actors_draw();

  audio_play_music(scene_ctx.music_id);

  screenfx_warp_reset(); /* fade resynced, tint reasserted */
  /* Warping INTO a world map: the plane replaces the scene the lines
     above have just built, before the screen comes back on, so the
     ordinary map is never seen for a frame. */
  if (m7_world_open(scene_ctx.scene_id, 0))
    return;
  warp_open(tr_in);
}

int main(void)
{
  u16 auto_ofs;
  u8 vm_was_active = 0;

  /* consoleInit() is already called by the PVSnesLib crt0 before main(). */

  audio_init(); /* boot the SPC700 first (it takes time) */

  /* The boot scene comes from the data */
  scene_load(scene_boot_id());
  audio_play_music(scene_ctx.music_id);
  textbox_init();
  ui_screen_init(); /* shared BG3 buffer (M1): map cleared with the screen off */
  vm_init();
  timer_init();
  screenfx_init();
  overlay_init(); /* permanent HUD from the uigen layout */
  camera_init();
  player_init();
  actors_init();
  auto_ofs = actors_autorun(); /* AUTORUN trigger of the boot scene */
  if (auto_ofs != SCRIPT_NONE)
    vm_start(auto_ofs);
  camera_update();
  map_init(); /* initial tilemap window, screen off */

  /* Mode 1 with BG3 at high priority (bit 3 of $2105): the textbox goes
     above everything. BG1 = upper layer (star = priority, in front of the
     hero), BG2 = lower layer, BG3 = textbox. */
  setMode(BG_MODE1, 0x08);
  bgSetScroll(2, 0, 0); /* BG3 fixed (the registers are not reliable at boot) */
  if (effect_active())
    effect_restore(); /* setMode rewrote TS and the color math — the boot
                         scene's effect layer puts them back (S9) */

  setScreenOn();

  /* Booting INTO a world map: the same call do_warp makes, so a project
     whose START scene is a world map comes up on the plane instead of on
     the mode-1 scene the lines above have just built. Returns 0 and
     changes nothing for every ordinary scene. */
  m7_world_open(scene_ctx.scene_id, 0);

  /* Published transfer descriptors fire from the VBlank ISR: at
     interrupt time the beam is at the top of the window no matter how
     late this loop runs its tail — the only spot a loaded battle
     frame cannot starve (vblnmi.c). vbl_fire_ok below marks the
     DMA-free stretches where the ISR may take the channel. */
  nmiSet(vbl_nmi);

  while (1)
  {
    if (vm_active())
    {
      vm_update(); /* script running: inputs routed to the textbox */
      vm_was_active = 1;
    }
    else if (vm_was_active)
    {
      /* The script has just ended: switches and variables may have
         changed — recompute the events' active pages. */
      vm_was_active = 0;
      actors_resolve_pages();
    }
    else if (save_take_load())
    {
      /* the SRAM load command (M2): the script read the slot and died
         with the request — the restore is an ordinary warp */
      do_warp(save_info.scene, save_info.x, save_info.y, 0, 0);
      player.dir = save_info.dir; /* saved direction */
    }
    else
    {
      u8 wd, wx, wy;
      u16 ce;

      /* AUTO common events (v0.16): as soon as the VM is free, the first
         one whose switch is ON takes over — and starts again while the
         switch stays ON (RM2003 model: the script turns it off). */
      ce = vm_common_auto();
      if (ce != SCRIPT_NONE)
      {
        vm_start(ce);
        vm_was_active = 1;
      }
      else
      {
        player_update(); /* inputs + movement + collision + interaction */
        if (player_take_warp(&wd, &wx, &wy))
        {
          u8 tr = player_take_warp_trans(); /* warp transition (S18) */

          do_warp(wd, wx, wy, tr, tr);
        }
        /* Phase 12: no more hard-wired START mapping — the System menu
           opens through the SYSMENU event command (the author picks the
           key with KEYIN) */
      }
    }

    picture_apply(); /* deferred SHOWPIC/HIDEPIC (S3) — screen
                            transition from the loop, like do_warp */
    stage_apply();   /* opening/closing the composed screen (B3) */
    if (stage_take_close())
    {
      /* closing the composed screen = an INTERNAL WARP to the current
         scene, on the hero's tile: scenery, sprites, palettes, ambience
         and music all come back in one go (a proven recipe). The visual
         close has already happened (stage_apply) — only the map's
         REAPPEARANCE follows the requested transition (S18). */
      stage_reset();
      do_warp(scene_ctx.scene_id, (u8)((player.x + 8) >> 4),
              (u8)((player.y + 8) >> 4), 0, stage_close_trans());
    }
    m7_apply(); /* opening/closing the Mode 7 screen (M7-A) */
    if (m7_take_close())
    {
      /* Same recipe as the composed screen: closing is an INTERNAL WARP
         to the current scene. Mode 7 took the whole low half of VRAM, so
         there is nothing to salvage — scene_load rebuilds it all. */
      m7_reset();
      /* tr_out = 1 (INSTANT): m7_apply has already faded to black and
         forced blank. A fading tr_out would make warp_close call
         setFadeEffect, which turns the screen back ON to fade it out —
         one frame of the Mode 7 VRAM read as mode-1 tilemaps, i.e.
         garbage, seen on the emulator. The composed screen never hits
         this because it never leaves mode 1. */
      do_warp(scene_ctx.scene_id, (u8)((player.x + 8) >> 4),
              (u8)((player.y + 8) >> 4), 1, 0);
    }

    /* From here to WaitForVBlank the frame touches no DMA channel
       (transfers are all deferred to the tail; the apply/warp/load
       block above is over): the dispatcher's ISR lane may fire. */
    vbl_fire_ok = 1;

    actors_update(); /* routes (even during a script — cutscenes) +
                        NPC wandering (frozen during scripts) */
    timer_tick();    /* the timer runs during dialogues too */
    vm_parallel_update(); /* "parallel" common events (v0.16) */

    screenfx_update(); /* scripted fade/flash/shake (v0.15) */
    effect_update();   /* drift of the effect layer (S9) */
    hdmafx_update();   /* ripple: HDMA tables (S14) */
    overlay_update();  /* HUD: redraw if a variable changed */
    debug_update();    /* Start+Select+R panel (S6) — inert without
                          datagen's --debug flag; AFTER overlay */
    stage_update();    /* composed screen: map rows still to lay down (B3) */
    btlprim_update();  /* battle primitives (V1): clock + stage OAM */
    m7_update();       /* Mode 7: one step of the zoom ramp (M7-A) */
    camera_update();
    if (!picture_active() && !stage_active() && !m7_active())
    {
      map_update(); /* prepares the tilemap window streaming */
      tileanim_update(); /* animated tiles (T1) — no scenery on a stage */
    }
    if (!stage_active() && !m7_active())
    {
      /* the scene's sprites are frozen during the composed screen (B3)
         and the Mode 7 screen (M7-A) — hidden on opening, the vignettes
         (B5) will take their entries */
      player_draw(); /* OAM shadow — transferred by the NMI at VBlank */
      actors_draw();
      weather_draw(); /* weather: simulation + sprites in one pass (S13) */
    }
    else if (m7_world_active())
    {
      /* A world map is a SCENE, not a cutscene: the hero stays. The
         camera is placed under him first, so player_draw needs no case
         of its own (M7-B). The NPCs DO need one: on a pitched plane
         their screen position is the inverse of the PPU's transform, not
         a subtraction — actors_draw_m7 pays for that a few slots per
         frame. */
      m7_world_track();
      player_draw();
      actors_draw_m7();
    }
    anim_update(); /* frame-by-frame animations (A1) — BEFORE vig_update:
                      the player sets cell and position, the vignette
                      writes the OAM shadow */
    vig_update(); /* vignettes (B5) — on the map AND the composed screen */

    audio_process(); /* music stream -> SPC */

    WaitForVBlank();
    vbl_fire_ok = 0; /* the tail's own DMAs begin */

    /* VRAM transfers + scroll registers: during the VBlank only. Picture
       showing (S3): BG1 carries the image, a 32x32 map scrolled to 0 —
       no streaming and no camera scroll while it is up. */
    if (picture_active())
    {
      screenfx_vblank();
      picture_vblank(); /* BG1 scroll = the image's position (S5) */
      hdmafx_suspend(); /* no ripple over a full-screen image */
      vbl_open();
      ui_screen_vblank();
    }
    else if (m7_active())
    {
      /* Mode 7 (M7-A): one layer, no streaming, no camera. The matrix is
         eight register writes — the cheapest branch of the three. */
      screenfx_vblank();
      /* hdmafx FIRST: it owns $420C and stands down here, and a world
         map's perspective then arms its own two channels. The other
         order let hdmafx_suspend wipe the mask m7_vblank had just
         written. */
      hdmafx_suspend(); /* wave/gradient/spotlight are map ambience */
      m7_vblank();
      vbl_open();
      /* The UI layer, on a WORLD MAP only. An image screen has no BG3
         anywhere — its map still points inside the plane, and writing
         there would corrupt the picture. */
      if (m7_world_active())
        ui_screen_vblank();
      vig_vblank();     /* vignette palettes (OBJ untouched by the plane) */
      vbl_nmi_tail();   /* rows the ISR's cap left over */
    }
    else if (stage_active())
    {
      screenfx_vblank(); /* tint/flash active on the composed screen */
      stage_vblank();    /* fixed scrolls + spread-out laying transfers */
      hdmafx_suspend();  /* wave/gradient/spotlight: map ambience */
      vbl_open();        /* stage_vblank is not counted either */
      /* PALETTES first: 2-line atoms that GATE display (bp_have,
         dig_up, vig's v_pal). Served last, the digit palette starved
         behind the UI's message frames for entire popup lifetimes —
         and before the probe's wrap clamp it "landed" on a wrapped
         beam and the damage numbers wore the charset's black. The
         cells' fast lane is the ISR since V-NMI (the H-bugfix
         vig-before-ui lesson now lives at line ~229); the UI keeps
         first claim on the bulk budget and still splits itself; the
         tail's leftover rows close the frame. */
      vig_vblank();      /* vignette palettes (B5) */
      btlprim_vblank();  /* battler + digit palettes (V-NMI V2) */
      ui_screen_vblank();
      vbl_nmi_tail();    /* leftover cell rows, table order */
    }
    else
    {
      /* P5 — the order is no longer arbitrary. The REGISTERS first: they
         cost almost nothing and they are not negotiable (a scroll left
         unwritten is the screen jumping by a tile). The TRANSFERS next,
         each asking the budget for its slot; whatever does not get
         through stays dirty and comes back on the following frame. */
      screenfx_vblank(); /* $2100 (fade) + $2130-$2132 (tint/flash) */
      if (effect_active())
        effect_vblank(); /* BG1 = pattern drift (S9), not the camera */
      else
        bgSetScroll(0, camera.x + screenfx_shake_x(), camera.y);
      bgSetScroll(1, camera.x + screenfx_shake_x(), camera.y);
      hdmafx_vblank(); /* ripple (S14) — overwrites HOFS line by line */

      vbl_open();   /* the registers are not counted: the budget
                       starts counting once they are written */
      /* Every transfer is a descriptor since V3, and the SCENE order
         holds through the two lanes: the map bursts walk FIRST in the
         dispatcher's table and fit the ISR's cap, so a screen edge
         still outranks everything (it fires at ~line 227); the UI
         keeps its historical seat right after — first claim on the
         tail's remainder, or the typewriter's bottom rows starve
         behind the leftovers (seen on d340 the one build this order
         was wrong); the tail drains what the cap left over LAST,
         which keeps the animated-tile step the first sacrifice under
         a short window (the vbl_turn rotation retired with it). */
      ui_screen_vblank(); /* UI layer (dialogue + HUD + timer, M1) —
                             splits into rows if the window is short */
      vig_vblank();   /* vignette palettes (B5) */
      vbl_nmi_tail(); /* map/cell/tile leftovers, table order */
    }
  }
  return 0;
}
