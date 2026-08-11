# Getting a SONG out of a SNES game (X5)

*Design doc, C0-style. The author asked three times, in substance: "les
musiques, c'est pas possible ?" The first two answers were "not
generically". They were right about the ROM and wrong to stop there.*

## 1. Why the ROM route is closed, and why that does not close the subject

**A SNES song is not data, it is a program plus data.** Nintendo's N-SPC,
Rare's driver, Konami's, Square's Akao, HAL's — each studio wrote its own
SPC700 sound driver and invented its own sequence format. There is no
generic "song" lying in a cart to be found, and building a parser per
driver family is twenty years of work (VGMTrans is the proof, in both
directions: it can be done, and it took that long).

That argument is about **reading the sequence**. It says nothing about a
second route, which the earlier answers missed:

> Whatever format a driver reads, it ends up **writing the same eight
> voices of the same DSP**. Emulate the SPC700, let the game's own driver
> run, and watch the registers. What comes out is what the chip actually
> played — and it does not matter whose driver played it.

| DSP register | What watching it yields |
|---|---|
| `KON` `$4C` | which voices key on, and when → note-on events |
| `VxSRCN` `$x4` | the directory entry → the instrument |
| `VxPITCH` `$x2/$x3` | playback rate → the note (and its detune) |
| `VxVOL L/R` `$x0/$x1` | per-voice volume → the volume column |
| `KOFF` `$5C`, `ENDX` `$7C` | note-off and sample-end → durations |

The prize is that this is **driver-independent**: one implementation
works on any game, instead of a list of supported titles that never ends.

## 2. What this gives, and what it does not

It gives a **transcription of a performance**, not a score.

- **Yes**: the notes actually played, on which instrument, at what volume,
  in time. Eight voices, which is exactly what the SNES has and exactly
  what snesmod gives us back.
- **No**: the composer's pattern structure. A driver's `[intro][A][A][B]`
  becomes one long flat sequence of events.
- **No**: clean loop points. They can be guessed by looking for a
  repeating stretch of events, and guessed wrong.
- **Approximate**: the tempo grid. Events land on emulated cycles; turning
  those into IT rows and ticks means choosing a resolution and quantising,
  and a driver whose tempo does not divide evenly will smear.

Which means the honest output is **an `.it` to finish in OpenMPT**, not a
finished song. That is still worth a great deal: the notes and the
instruments are the part that cannot be recovered by ear in an evening.

## 3. The two ceilings, measured rather than guessed

Both were read off the tools that will do the judging, not estimated.

**ARAM.** snesmod loads one module at a time. The vendored `smconv`
reports, for the demo's own modules, `649 bytes used / 57308 free` and
`44137 used / 13820 free` — the same total each time: **57957 bytes** left
for one module after the driver. Into that must fit the samples, the
pattern data, *and* the echo region — and echo is not small: the demo's
`pollen8` spends **28672 bytes** on it alone. A ripped song will need echo
off, and may still not fit.

**Voices.** The SNES has 8, snesmod exposes 8, and our sound effects take
from the same pool (`audio.c`, `spcAllocateSoundRegion`). A song that
uses all eight leaves nothing for "Jouer un son".

**This is why X5-a comes first.** Totalling a `.spc` directory's BRR and
comparing it to 57957 costs twenty lines and answers "could this song ever
be a module in my game?" *before* anyone writes an emulator. If the
author's chosen songs blow the budget every time, X5-b and X5-c are
pointless and we will have learned it cheaply. **X5-a is shipped.**

## 4. The stages

| Stage | What it is | Size |
|---|---|---|
| **X5-a — le verdict** | Sum the SPC directory's BRR, compare to the 57957-byte module budget, say plainly whether it fits and what echo will cost. **Done.** | ~20 lines |
| **X5-b — this document** | The decision the author is making, priced. **Done.** | — |
| **X5-c — the emulator** | An SPC700 core (256 opcodes, a small documented 8-bit CPU), its three timers (drivers clock their tempo off them), and enough DSP state that the driver believes playback happens — chiefly `ENDX`, which drivers poll. Runs the snapshot for N seconds and logs the register writes above. | ~1200-1800 lines |
| **X5-d — the transcription** | Event log → `.it`: voices to channels, `VxPITCH` to note + finetune against the sample's assumed rate, volume to the volume column, cycles quantised to rows. Samples come from X3, already extracted. | medium |

X5-c is large but **bounded**, which is the whole difference with a
per-driver parser: it is one finite piece of work whose scope is a
published hardware spec, not an open-ended archaeology of other people's
formats.

## 5. What stays refused

- **ROM → `.it` statically and generically.** Unchanged, and §1 says why.
- **Shipping an SPC as-is.** Playing an `.spc` means running *that game's*
  driver over the whole of ARAM. It would evict snesmod, and with it every
  sound effect and every other track. Not a resource our engine can hold.
- **A pattern-accurate transcription.** §2. What comes out is a
  performance; pretending otherwise would set the author up for
  disappointment at the exact moment they open the file.

## 6. The path that needs no code from me

Available today, and worth saying out loud before committing to X5-c:
X3 already extracts the instruments; **VGMTrans** does static per-driver
parsing for a great many games and emits MIDI plus a soundfont; OpenMPT
assembles the two into an `.it` our build accepts. For a song from a
supported game, that route is better than anything X5-c would produce,
because it recovers the *score*. X5-c earns its keep on the games
VGMTrans does not know.
