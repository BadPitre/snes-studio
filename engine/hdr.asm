;==LoRom==

.MEMORYMAP                      ; Begin describing the system architecture.
  SLOTSIZE $8000                ; The slot is $8000 bytes in size.
  DEFAULTSLOT 0
  SLOT 0 $8000                  ; Defines Slot 0's starting address.
  SLOT 1 $0 $2000
  ; SLOT 2 = .bss de tcc-816 en bank $7E. ATTENTION : PVSnesLib place SES
  ; variables (oamMemory…) à partir de $7E:8000 via un AUTRE slot, et WLA
  ; alloue les slots indépendamment — un .bss qui dépasse $7E:8000 recouvre
  ; l'OAM shadow SANS erreur de link (sprites fantômes, PNJ coupés en haut
  ; d'écran). La taille du slot ne peut pas être réduite ici (les libs
  ; PVSnesLib sont pré-compilées avec cette carte mémoire) : le Makefile
  ; vérifie la borne après le link, et les gros tampons vont en bank $7F
  ; (wram7f.asm).
  SLOT 2 $2000 $E000
  SLOT 3 $0 $10000
.ENDME

.ROMBANKSIZE $8000              ; Every ROM bank is 32 KBytes in size
.ROMBANKS 8                     ; 2 Mbits - 8 ROM banks (voir kit §3)

.SNESHEADER
  ID "SNES"

  NAME "SNES STUDIO POC      "  ; Program Title - can't be over 21 bytes,
  ;    "123456789012345678901"  ; use spaces for unused bytes of the name.

  SLOWROM
  LOROM

  CARTRIDGETYPE $02             ; $02=ROM+RAM+batterie (sauvegardes SRAM)
  ROMSIZE $08                   ; $08=2 Megabits
  SRAMSIZE $03                  ; 64 Kbit (8 Ko) : 4 slots de 2 Ko (v2 —
                                ; gvars + 512 switches + 256 vars 16-bit)
  COUNTRY $01                   ; $01=USA (NTSC 60 Hz — le moteur suppose
                                ; NTSC ; $02=Europe ferait tourner les
                                ; émulateurs fidèles en PAL 50 Hz)
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
