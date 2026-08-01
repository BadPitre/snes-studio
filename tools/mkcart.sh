#!/usr/bin/env bash
# mkcart.sh — the "cartridge" build: turns the build's .sfc into a .smc
# ready for a flashcart (validated on a Super UFO Pro 8).
#
# WHY: the engine's ROM comes out at 256 KB (2 Mbit), a size many
# flashcarts refuse ("File type error" on the UFO). Commercial
# cartridges are 512 KB and up. So we MIRROR the content up to 512 KB
# minimum — exactly what a real cartridge's address decoding does with
# the unwired lines — then repair the internal SNES header: the size
# byte ($7FD7, LoROM) and the checksum ($7FDC-$7FDF).
#
# Usage: mkcart.sh <input.sfc> <output.smc>
# Tools: bash + coreutils (cat/wc/dd/od/awk) — present under MSYS2.
set -e

in="$1"
out="$2"
if [ -z "$in" ] || [ -z "$out" ]; then
  echo "usage: mkcart.sh <input.sfc> <output.smc>" >&2
  exit 1
fi

cp "$in" "$out"

# Mirror up to 512 KB minimum (the .sfc size is already a power of two
# — checked by the toolchain)
while [ "$(wc -c < "$out")" -lt 524288 ]; do
  cat "$out" "$out" > "$out.tmp"
  mv "$out.tmp" "$out"
done

# Size byte: 2^n KB -> n (512 KB = 0x09, 1 MB = 0x0A, ...)
kb=$(( $(wc -c < "$out") / 1024 ))
n=0
v=$kb
while [ "$v" -gt 1 ]; do
  v=$((v / 2))
  n=$((n + 1))
done
printf "$(printf '\\x%02x' "$n")" |
  dd of="$out" bs=1 seek=$((0x7FD7)) conv=notrunc 2>/dev/null

# Checksum: the sum of the bytes mod 65536, computed with complement=FFFF
# and checksum=0000 (the SNES convention), then written with its complement
printf '\xff\xff\x00\x00' |
  dd of="$out" bs=1 seek=$((0x7FDC)) conv=notrunc 2>/dev/null
sum=$(od -An -v -tu1 "$out" | awk '{ for (i = 1; i <= NF; i++) s += $i } END { print s % 65536 }')
comp=$((sum ^ 65535))
printf "$(printf '\\x%02x\\x%02x\\x%02x\\x%02x' \
  $((comp % 256)) $((comp / 256)) $((sum % 256)) $((sum / 256)))" |
  dd of="$out" bs=1 seek=$((0x7FDC)) conv=notrunc 2>/dev/null

echo "cartridge: $out ($kb KB, checksum $(printf '0x%04x' "$sum"))"
