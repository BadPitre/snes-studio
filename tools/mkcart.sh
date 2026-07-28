#!/usr/bin/env bash
# mkcart.sh — build « cartouche » : transforme le .sfc du build en .smc
# prêt pour flashcart (validé sur Super UFO Pro 8).
#
# POURQUOI : le ROM du moteur sort à 256 Ko (2 Mbit), une taille que
# beaucoup de flashcarts refusent (« File type error » sur la UFO). Les
# cartouches commerciales font 512 Ko et plus. On MIROITE donc le
# contenu jusqu'à 512 Ko minimum — exactement ce que fait le décodage
# d'adresses d'une vraie cartouche avec les lignes non câblées — puis on
# répare l'en-tête interne SNES : octet de taille ($7FD7, LoROM) et
# checksum ($7FDC-$7FDF).
#
# Usage : mkcart.sh <entree.sfc> <sortie.smc>
# Outils : bash + coreutils (cat/wc/dd/od/awk) — présents sous MSYS2.
set -e

in="$1"
out="$2"
if [ -z "$in" ] || [ -z "$out" ]; then
  echo "usage: mkcart.sh <entree.sfc> <sortie.smc>" >&2
  exit 1
fi

cp "$in" "$out"

# Miroir jusqu'à 512 Ko minimum (la taille du .sfc est déjà une
# puissance de 2 — vérifié par la toolchain)
while [ "$(wc -c < "$out")" -lt 524288 ]; do
  cat "$out" "$out" > "$out.tmp"
  mv "$out.tmp" "$out"
done

# Octet de taille : 2^n Ko -> n (512 Ko = 0x09, 1 Mo = 0x0A, ...)
kb=$(( $(wc -c < "$out") / 1024 ))
n=0
v=$kb
while [ "$v" -gt 1 ]; do
  v=$((v / 2))
  n=$((n + 1))
done
printf "$(printf '\\x%02x' "$n")" |
  dd of="$out" bs=1 seek=$((0x7FD7)) conv=notrunc 2>/dev/null

# Checksum : somme des octets mod 65536, calculée avec complément=FFFF
# et checksum=0000 (convention SNES), puis écrite avec son complément
printf '\xff\xff\x00\x00' |
  dd of="$out" bs=1 seek=$((0x7FDC)) conv=notrunc 2>/dev/null
sum=$(od -An -v -tu1 "$out" | awk '{ for (i = 1; i <= NF; i++) s += $i } END { print s % 65536 }')
comp=$((sum ^ 65535))
printf "$(printf '\\x%02x\\x%02x\\x%02x\\x%02x' \
  $((comp % 256)) $((comp / 256)) $((sum % 256)) $((sum / 256)))" |
  dd of="$out" bs=1 seek=$((0x7FDC)) conv=notrunc 2>/dev/null

echo "cartouche : $out ($kb Ko, checksum $(printf '0x%04x' "$sum"))"
