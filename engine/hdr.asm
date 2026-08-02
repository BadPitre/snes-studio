;==LoRom==

.MEMORYMAP                      ; Begin describing the system architecture.
  SLOTSIZE $8000                ; The slot is $8000 bytes in size.
  DEFAULTSLOT 0
  SLOT 0 $8000                  ; Defines Slot 0's starting address.
  SLOT 1 $0 $2000
  ; SLOT 2 = tcc-816's .bss in bank $7E. CAREFUL: PVSnesLib puts ITS OWN
  ; variables (oamMemory…) from $7E:8000 up through ANOTHER slot, and WLA
  ; allocates the slots independently — a .bss running past $7E:8000
  ; overwrites the OAM shadow with NO link error (ghost sprites, NPCs cut
  ; off at the top of the screen). The slot size cannot be reduced here
  ; (the PVSnesLib libraries are pre-compiled with this memory map): the
  ; Makefile checks the bound after the link, and large buffers go into
  ; bank $7F (wram7f.asm).
  SLOT 2 $2000 $E000
  SLOT 3 $0 $10000
.ENDME

.ROMBANKSIZE $8000              ; Every ROM bank is 32 KBytes in size
.ROMBANKS 32                    ; 8 Mbits - 32 banks (multi-bank M1: keep
                                ; in step with WLA_BANK_COUNT in
                                ; tools/datagen binbank.rs)

.SNESHEADER
  ID "SNES"

  NAME "SNES STUDIO POC      "  ; Program Title - can't be over 21 bytes,
  ;    "123456789012345678901"  ; use spaces for unused bytes of the name.

  SLOWROM
  LOROM

  CARTRIDGETYPE $02             ; $02=ROM+RAM+battery (SRAM saves)
  ROMSIZE $0A                   ; $0A=8 Megabits (1 MB, multi-bank M1)
  SRAMSIZE $03                  ; 64 Kbit (8 KB): 4 slots of 2 KB (v2 —
                                ; gvars + 512 switches + 256 16-bit vars)
  COUNTRY $01                   ; $01=USA (NTSC 60 Hz — the engine assumes
                                ; NTSC; $02=Europe would run accurate
                                ; emulators at PAL 50 Hz)
  LICENSEECODE $00
  VERSION $00                   ; $00 = 1.00
.ENDSNES

.SNESNATIVEVECTOR               ; Define Native Mode interrupt vector table
  COP EmptyHandler
  BRK EmptyHandler
  ABORT EmptyHandler
  NMI VBlank
  IRQ EmptyHandler
.ENDNATIVEVECTOR

.SNESEMUVECTOR                  ; Define Emulation Mode interrupt vector table
  COP EmptyHandler
  ABORT EmptyHandler
  NMI EmptyHandler
  RESET tcc__start              ; where execution starts
  IRQBRK EmptyHandler
.ENDEMUVECTOR
