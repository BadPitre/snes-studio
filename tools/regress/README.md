# Régression pixel

Le seul garde-fou automatique du moteur. Il construit le ROM de la
demo, le fait tourner un nombre de frames **fixe** avec une séquence de
touches **fixe**, et compare l'image obtenue **octet à octet** à une
référence versionnée.

```bash
./tools/regress.sh            # vérifie
./tools/regress.sh --build    # régénère les données + recompile d'abord
./tools/regress.sh --bless    # remplace les références (changement voulu)
```

## Pourquoi ça vaut le coup

Cette comparaison a attrapé des bugs qu'aucune relecture n'aurait vus :

- **tcc-816** : déclarer une variable dans un bloc `case` corrompait la
  rangée de cœurs du HUD — code parfaitement légal en C, sortie fausse.
- **Fantômes de build** : des widgets dessinés depuis la table d'un
  projet précédent, à cause d'intermédiaires `.asm` périmés.

Les deux se présentaient comme « quelques pixels de différence ». Sans
comparaison automatique, ils passent.

## Ce qui n'est PAS dans le dépôt

Le core libretro snes9x (2,4 Mo de binaire). À poser dans ce dossier
sous le nom `snes9x_libretro.so` (`.dll` sous Windows), ou à désigner
par `SNES9X_CORE=/chemin/vers/le/core`. Le script cherche aussi dans les
emplacements RetroArch habituels.

On peut le récupérer via RetroArch (gestionnaire de cores) ou le
compiler depuis <https://github.com/libretro/snes9x>.

## Les cas

Dans `cases.txt` : nom, nombre de frames, séquence de touches. Une
**règle à ne pas casser** — la route ne doit traverser aucun warp. Une
capture qui dépend d'un chargement de scène devient sensible au timing,
et la comparaison octet à octet perd son sens.

Les références décrivent un état **sain du projet `demo/`**. Toucher à
`demo/` change légitimement les images : relire les `.ppm` produits dans
`out/`, puis `--bless`. Ne jamais blesser sans regarder — c'est
exactement le geste qui transforme un garde-fou en tampon.

Une référence pèse 172 Ko brute mais **moins de 2 Ko** une fois
compressée par git (de l'art pixel, ça se compresse énormément). D'où le
choix du PPM brut plutôt que du PNG : la comparaison reste un `cmp`,
sans dépendance à Python ou ImageMagick.

## Le harness

`harness.c` charge le core libretro, exécute N frames en injectant les
touches, et écrit le framebuffer en PPM.

```
harness <core> <rom.sfc> <frames> <sortie.ppm> ["entrées"]
```

Touches : `A B U D L R`, `S`=Start, `E`=Select, `W`=R. Format d'une
entrée : `premiere-derniere:TOUCHE`, séparées par des virgules.

Deux variables d'environnement, précieuses pour le diagnostic — c'est
avec elles qu'on a identifié les deux bugs ci-dessus :

- `WRAM_DUMP=fichier` — vide la WRAM à la dernière frame. Croisée avec
  `engine/snesstudio.sym`, elle donne l'état de n'importe quelle
  variable du moteur à l'instant du bug.
- `VRAM_DUMP=fichier` — idem pour la VRAM (a servi à prouver que des
  transferts de cellules tombaient hors fenêtre VBlank).

`libretro.h` est vendorisé (API libretro, RetroArch team — voir
`LICENSE-libretro`) pour que le harness compile sans copie locale de
RetroArch.
