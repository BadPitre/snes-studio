# CLAUDE.md — snes-studio

## Projet

Outil de création de jeux SNES no-code (mix GB Studio / RPG Maker). L'utilisateur crée son jeu visuellement, exporte un ROM `.sfc` autonome jouable sur émulateur et vraie console. Architecture : **moteur SNES fixe + VM bytecode — les jeux sont des DONNÉES, pas du code**.

**Sources de vérité (à lire avant toute tâche) :**
- `docs/PLANNING_PHASES_DEV.md` — planning global, phase courante, jalons
- `docs/KIT_PHASE1_POC_MOTEUR.md` — spec des formats binaires, VM v0, layout des banks, architecture moteur

**Phase courante : Phase 1 — POC moteur data-driven.** Ne pas implémenter de features des phases ultérieures (outils Rust, éditeur Tauri, audio, warps...) sauf demande explicite.

## Structure du repo

```
engine/   # Moteur SNES en C (PVSnesLib) + ASM 65816 — Phase 1
tools/    # Pipeline d'assets en Rust — Phase 2 (vide pour l'instant)
editor/   # Éditeur Tauri + React + TS — Phase 3 (vide pour l'instant)
demo/     # Jeu de test permanent / régression
docs/     # Specs et planning — LES TENIR À JOUR
```

## Règles non négociables

1. **Zéro donnée de jeu en dur dans le code moteur.** Positions, dimensions, textes, IDs : tout vient des banks de données via la Scene Table. Si une valeur de gameplay apparaît dans le code moteur, c'est un bug d'architecture.
2. **La spec est contractuelle.** Les formats binaires (Scene Table, Scene Header, acteurs, opcodes VM) sont définis dans `docs/KIT_PHASE1_POC_MOTEUR.md` sections 4-6. Si le code doit s'en écarter, mettre à jour la spec DANS LE MÊME commit et le signaler explicitement.
3. **Le champ `scene_type` existe partout** dans les formats et le code de chargement, même si seul TOP_DOWN (0x01) est implémenté. C'est la seule concession au futur autorisée.
4. **VM limitée aux 8 opcodes de la spec.** Ne pas en ajouter sans demande explicite de Bertrand.
5. **C pour le moteur, pas de C++** (le compilateur 816-tcc est C uniquement). ASM 65816 acceptable pour les hot paths, avec commentaires détaillés.
6. **Ne pas sur-designer.** Chaque structure/format couvre le besoin du POC, rien de plus.

## Contraintes hardware SNES (critiques)

- **VRAM/CGRAM/OAM : écritures UNIQUEMENT pendant le VBlank**, via les fonctions DMA de PVSnesLib, après `WaitForVBlank()`. Une écriture hors VBlank marche dans certains émulateurs et échoue silencieusement sur console réelle.
- **Budget DMA par frame : ~4,5 Ko.** Comptabiliser les transferts (streaming tilemap + shadow OAM).
- **Pointeurs 16-bit ne sortent pas de leur bank.** Accès aux données des banks $82+ via pointeurs far (24-bit) systématiquement.
- **LoROM** : 32 Ko utiles par bank ($8000-$FFFF). Layout des banks défini dans le kit section 3.
- **Garde-fou VM : max 32 opcodes immédiats par frame** (compteur + halt en debug).
- WRAM : 128 Ko total. Rester économe, pas d'allocations dynamiques (tout en statique).
- **Plafond `.bss` à `$7E:8000` (spec §3.1).** Le `.bss` de tcc-816 et les variables de PVSnesLib (dont `oamMemory`) partagent la bank `$7E` via deux slots WLA alloués **indépendamment** : au-delà de `$7E:8000` le `.bss` écrase l'OAM shadow **sans erreur de link**, et les entrées OAM remises à zéro deviennent des sprites fantômes empilés en `(0,0)` qui saturent la limite de 32 sprites/ligne — héros et PNJ disparaissent en haut d'écran. Tout tampon de plus de ~1 Ko va en bank `$7F` (`engine/wram7f.asm`) ; `make` refuse de produire le ROM si un symbole `.bss` dépasse la borne.
- **Max 32 sprites (et 34 tiles 8x8) par ligne.** Un sprite « caché » doit être garé hors écran, pas laissé à `(0,0)`.

## Environnement de build

- **Toolchain :** PVSnesLib, `PVSNESLIB_HOME=/c/Users/Bertrand/Documents/snesdev/pvsneslib` (format Unix obligatoire)
- **Build :** `make` dans un shell MSYS2 UCRT64 (pas PowerShell, pas cmd). `make clean && make` en cas de doute sur les assets.
- **Compilateur :** 816-tcc (C, dialecte limité — pas de C99 avancé, tester les constructions inhabituelles), assembleur WLA-DX, linker wlalink.
- **Makefiles :** basés sur `snes_rules` de PVSnesLib. S'inspirer des exemples dans `$PVSNESLIB_HOME/snes-examples/`.
- La doc PVSnesLib (wiki GitHub alekmaul/pvsneslib) et les exemples fournis sont les références API.

## Validation — point critique

**Claude Code ne peut PAS lancer les émulateurs ni voir le rendu.** Le cycle de travail est :

1. Claude Code écrit/modifie le code et vérifie que `make` passe si possible
2. Bertrand builde, lance dans **Mesen2** (debug quotidien) et **bsnes mode accuracy** (juge de paix)
3. Bertrand décrit le résultat ou fournit des captures d'écran
4. Claude Code corrige en fonction

**Ne JAMAIS affirmer qu'un rendu ou comportement visuel « fonctionne »** — dire ce que le code est censé produire et demander la validation visuelle. En cas de glitch décrit par Bertrand, penser d'abord : timing VBlank, palette/format des tiles, débordement de bank, OAM mal initialisé.

## Conventions de code

- Indentation 2 espaces, snake_case pour fonctions et variables, UPPER_CASE pour constantes/opcodes.
- Types PVSnesLib : `u8`, `u16`, `s8`, `s16`.
- Commentaires en français acceptés, noms de symboles en anglais.
- Chaque fichier de données (`data_*.c`) commence par un commentaire indiquant sa bank cible et le format qu'il contient (référence à la section de spec).
- Commits : messages courts en anglais, un sujet par commit. Ne jamais commiter les artefacts de build (`.sfc`, `.ps`, `.obj`, `.sym` — voir `.gitignore`).

## Style d'interaction

- Bertrand est développeur professionnel (C++/UE5) : pas de vulgarisation des concepts de programmation généraux ; expliquer en revanche les spécificités SNES/65816 quand elles motivent un choix.
- Proposer les décisions d'architecture importantes plutôt que de les prendre unilatéralement.
- Signaler explicitement tout écart à la spec ou toute dette technique introduite.
