// Savestate assertions (T-CI) — reads a snesphoto photo.state and
// checks SEMANTIC facts, not golden bytes: "the posed battlers are
// visible, their chars carry pixels, their palettes carry colours".
// Golden hashes of VRAM would break on every legitimate art change —
// the same trap gate-datagen.sh refuses; these assertions survive art
// and only fail when the MACHINERY fails, which is what they are for:
// every one of them encodes a bug this project actually shipped and
// then chased with a savestate (H-bugfix: battlers invisible until the
// first ATB fill, cut in half by dropped DMA rows, wearing another
// sheet's palette).
//
//   node check.mjs boot   <photo_dir>
//   node check.mjs battle <photo_dir> <screen.json>
//
// Self-contained on purpose (node builtins only): the gate must run on
// a fresh clone with no npm install. The savestate layout mirrors
// editor/src/s9xstate.ts (the reference reader) — if a snes9x update
// moves a PPU field, fix BOTH.

import { readFileSync } from "node:fs";

// ---- snes9x savestate reader (see s9xstate.ts for the full story) ---

function parseState(buf) {
  const txt = (o, n) =>
    Array.from(buf.subarray(o, o + n)).map((c) => String.fromCharCode(c)).join("");
  let o = buf.indexOf(10) + 1; // after "#!s9xsnp:VVVV\n"
  const map = new Map();
  while (o + 11 <= buf.length) {
    const name = txt(o, 3);
    if (!/^[A-Z]{3}$/.test(name)) break;
    const len = parseInt(txt(o + 4, 6), 10);
    if (!Number.isFinite(len) || len < 0) break;
    map.set(name, { off: o + 11, len });
    o += 11 + len;
  }
  const vra = map.get("VRA");
  const ppu = map.get("PPU");
  if (!vra || !ppu) throw new Error("blocs VRA/PPU absents — pas une savestate snes9x ?");
  // PPU offsets keyed on the BLOCK LENGTH (2652 = v11+, 2649 = older):
  // CGDATA after 63(+1) bytes, then the OBJ array, then OAMData.
  if (ppu.len !== 2652 && ppu.len !== 2649)
    throw new Error(`bloc PPU de ${ppu.len} octets : disposition inconnue (snes9x a bougé)`);
  const cgdata = ppu.off + 63 + (ppu.len === 2652 ? 1 : 0);
  const objNameBase = cgdata + 512 + 128 * 11 + 3;
  const oamData = objNameBase + 2 + 2 + 1 + 11;
  return {
    vram: buf.subarray(vra.off, vra.off + vra.len),
    cgram: buf.subarray(cgdata, cgdata + 512), // 256 x u16le
    oam: buf.subarray(oamData, oamData + 544),
  };
}

const st = (() => {
  const [, , kase, dir] = process.argv;
  if (!kase || !dir) {
    console.error("usage: node check.mjs <boot|battle> <photo_dir> [screen.json]");
    process.exit(2);
  }
  return { kase, dir, screen: process.argv[4] };
})();

const photo = parseState(new Uint8Array(readFileSync(st.dir + "/photo.state")));

const oamEntry = (n) => {
  const o = n * 4;
  const hi = (photo.oam[512 + (n >> 2)] >> ((n & 3) * 2)) & 3;
  return {
    x: photo.oam[o] + ((hi & 1) ? 256 : 0),
    y: photo.oam[o + 1],
    char: photo.oam[o + 2] + ((photo.oam[o + 3] & 1) << 8),
    pal: (photo.oam[o + 3] >> 1) & 7,
    large: (hi >> 1) === 1,
  };
};
// OBJ chars live at word $4000 (vram.h) -> byte 0x8000, 32 bytes each.
// A 32x32 CELL spans 4 chars on each of 4 name-grid rows (16 chars
// wide) — and its corners are often legitimately empty (a 16x24
// charset frame is centred in the cell), so blankness is judged on
// the WHOLE cell, never on one char.
const cellBlank = (c) => {
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const o = 0x8000 + (c + row * 16 + col) * 32;
      for (let i = 0; i < 32; i++) if (photo.vram[o + i] !== 0) return false;
    }
  return true;
};
// OBJ palette p: CGRAM entries 128 + p*16 (+1: entry 0 is transparent).
const palBlank = (p) => {
  const o = (128 + p * 16 + 1) * 2;
  for (let i = 0; i < 30; i++) if (photo.cgram[o + i] !== 0) return false;
  return true;
};

let failed = 0;
const check = (ok, label) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
};

if (st.kase === "boot") {
  // The demo's plain boot: the player metasprite (OAM objects 0 and 1,
  // player.c) is on screen with real pixels and real colours.
  const top = oamEntry(0);
  const bot = oamEntry(1);
  check(top.y < 224 && bot.y < 224, `joueur à l'écran (y=${top.y}/${bot.y})`);
  // the player is a 16x16 OBJ: its char plus the one beside it
  const pBlank = (c) => {
    for (const cc of [c, c + 1, c + 16, c + 17]) {
      const o = 0x8000 + cc * 32;
      for (let i = 0; i < 32; i++) if (photo.vram[o + i] !== 0) return false;
    }
    return true;
  };
  check(!pBlank(top.char), `chars du joueur non vides (char ${top.char})`);
  check(!palBlank(top.pal), `palette du joueur chargée (palette ${top.pal})`);
} else if (st.kase === "battle") {
  // The posed battlers of a composed screen: for every vignette the
  // screen declares, the OAM entry the engine owns for that slot shows
  // it at the authored position, with pixels in its chars and colours
  // in its palette. Positions and slots come from the SCREEN JSON, so
  // moving the art in the editor never breaks the gate — only the
  // engine breaking does. Slot maps: the canonical vidmap layout.
  const OAMS = [96, 97, 98, 99, 50, 51, 52, 53];
  const CHARS = [384, 388, 392, 396, 448, 452, 456, 460];
  const def = JSON.parse(readFileSync(st.screen, "utf8"));
  const vigs = (def.vignettes ?? []).filter((v) => v.vig);
  if (!vigs.length) {
    console.error(`écran sans sprites animés posés : ${st.screen}`);
    process.exit(2);
  }
  for (const v of vigs) {
    const s = v.slot - 1; // user slots are 1-8
    const e = oamEntry(OAMS[s]);
    check(
      e.x === v.x && e.y === v.y,
      `battler '${v.name || v.vig}' posé en (${v.x},${v.y}) — OAM ${OAMS[s]} dit (${e.x},${e.y})`
    );
    check(e.large, `battler '${v.name || v.vig}' en OBJ 32x32`);
    check(e.char === CHARS[s], `char ${CHARS[s]} attendu — OAM dit ${e.char}`);
    check(!cellBlank(CHARS[s]), `cellule du battler non vide (le fire NMI a livré)`);
    check(!palBlank(e.pal), `palette ${e.pal} chargée (les couleurs ont précédé l'affichage)`);
  }
} else {
  console.error(`cas inconnu : ${st.kase}`);
  process.exit(2);
}

if (failed) {
  console.error(`${failed} assertion(s) en échec — photo dans ${st.dir}`);
  process.exit(1);
}
console.log("  savestate: OK");
