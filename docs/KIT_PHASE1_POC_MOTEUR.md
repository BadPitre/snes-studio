# KIT PHASE 1 — POC Moteur Data-Driven

**Projet :** SNES Studio (nom de travail)
**Phase :** 1 — Preuve de concept du moteur
**Durée cible :** 5 semaines (side project)
**Prérequis :** Phase 0 validée (toolchain PVSnesLib fonctionnelle, repo créé)
**Emplacement suggéré :** `docs/KIT_PHASE1_POC_MOTEUR.md`

---

## 1. Objectif & kill switch

### Objectif

Prouver que l'architecture « moteur fixe + données générées » fonctionne sur SNES :
un ROM dont le comportement (map, personnage, PNJ, dialogue) est entièrement défini
par des **données** stockées dans des banks ROM séparées du code. Changer les données
change le jeu **sans recompiler le moteur**.

### Livrables

1. Un ROM `.sfc` : map scrollante + perso jouable + 1 PNJ interactif avec dialogue.
2. La spec écrite des formats (ce document, sections 4-6, mise à jour au fil du réel).
3. Les données du POC en C arrays commentés (elles seront générées par les outils Rust en Phase 2).

### Kill switch (fin de semaine 5)

Le POC est validé si TOUS ces critères sont vrais :

- [ ] Le ROM tourne sans glitch dans **bsnes mode accuracy** (pas seulement Mesen2).
- [ ] Modifier les C arrays de données (map, position PNJ, texte) et rebuilder change le jeu — **zéro modification du code moteur**.
- [ ] Le scrolling est fluide à 60 FPS (pas de tearing, pas de ralentissement).
- [ ] Le dialogue s'affiche, se ferme, et le script VM s'exécute correctement (test : un PNJ qui compte le nombre de fois où on lui a parlé, via une variable).
- [ ] Tu as encore envie de continuer le projet.

Si un critère technique échoue après effort raisonnable → diagnostic ensemble avant d'abandonner.
Si le critère 5 échoue → le projet s'arrête proprement, avec un vrai apprentissage SNES en poche.

---

## 2. Architecture générale

```
┌────────────────────────── ROM (.sfc) ──────────────────────────┐
│                                                                │
│  CODE (fixe, écrit une fois)          DONNÉES (générées)       │
│  ┌──────────────────────────┐         ┌─────────────────────┐  │
│  │ Boot / init              │         │ Scene Table         │  │
│  │ Boucle principale        │  ──────▶│ Scene 0 (header +   │  │
│  │ Module top-down          │  lit    │   map + acteurs +   │  │
│  │ Moteur dialogue          │         │   scripts)          │  │
│  │ VM bytecode              │         │ Scene 1, 2, ...     │  │
│  │ Rendu (BG, sprites, DMA) │         │ Assets (tiles, pal) │  │
│  └──────────────────────────┘         └─────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Principe cardinal :** le code ne contient AUCUNE donnée de jeu en dur.
Position du joueur au départ, dimensions de map, textes, tout vient des données.
C'est la discipline qui rend l'éditeur possible en Phase 3.

### Boucle principale (pseudo-code)

```c
main:
  consoleInit()
  chargerScene(0)                 // lit la Scene Table, initialise tout
  boucle:
    lireInputs()
    si (VM active)                // un script tourne (dialogue...)
      vmStep()                    // exécute jusqu'à opcode bloquant
    sinon
      updateJoueur()              // module top-down : mouvement + collision
      testerInteractions()        // bouton A face à un acteur → lancer son script
    updateCamera()
    preparerOAM()                 // metasprites → shadow OAM
    WaitForVBlank()               // les transferts DMA partent ici
```

---

## 3. Layout des banks ROM (LoROM)

Mode : **LoROM** (32 Ko utiles par bank, $8000-$FFFF). FastROM activable plus tard
sans changer l'organisation.

| Bank | Contenu | Notes |
|------|---------|-------|
| $80 (0) | Code moteur + vecteurs + header ROM | Géré par PVSnesLib (crt0, snes_rules) |
| $81 (1) | Code moteur (suite) + lib | |
| $82 (2) | **SCENE TABLE + données de scènes** | Le cœur du data-driven |
| $83 (3) | Données de scènes (suite) | Réserve d'extension |
| $84 (4) | Assets graphiques : tiles BG + sprites | Chargés en VRAM par DMA |
| $85 (5) | Palettes + tilemaps compilées | |
| $86 (6) | Textes / dialogues | Séparés pour faciliter la localisation future |
| $87 (7) | Soundbank (musiques IT) | smconv, épinglé par le Makefile |
| $88+ (8-31) | **Pool multi-bank (M1)** | Scènes puis textes débordent ici ; le reste sert aux sections SUPERFREE (gfx). ROM 1 Mo (ROMBANKS 32). |

**Mise en pratique PVSnesLib :** les données vont dans des fichiers `.c` séparés
avec directive de section pour forcer la bank (voir `snes_rules` et les exemples
utilisant `.section` / attributs de bank). Pour le POC, un fichier `data_scenes.c`,
un `data_assets.c`, un `data_texts.c` — chacun mappé sur sa bank dans le makefile.

**Règle d'accès :** le code lit les données via des pointeurs far (24-bit).
PVSnesLib gère ça, mais garde en tête qu'un pointeur 16-bit ne sort pas de sa bank.

---

## 4. Format binaire de scène (v0)

Toutes les valeurs multi-octets sont **little-endian** (natif 65816).

### 4.1 Scene Table

À une adresse fixe connue du moteur (début bank $82) :

```
Offset  Taille  Champ
0       2       scene_count (u16)
2       4×N     entrées : { bank (u8), addr (u16), reserved (u8) } par scène
```

### 4.2 Scene Header

```
Offset  Taille  Champ
0       1       scene_type      (u8)  — 0x01 = TOP_DOWN. Seule valeur en v0,
                                        MAIS LE CHAMP EXISTE DÈS MAINTENANT.
1       1       flags           (u8)  — réservé (0)
2       1       map_width       (u8)  — en tiles 16x16 (max 255)
3       1       map_height      (u8)
4       3       ptr_tilemap     (far) — bank + addr des indices de tiles
7       3       ptr_collision   (far) — 1 octet par tile 16x16 (v0 : 0=libre, 1=solide)
10      3       ptr_actors      (far) — table des acteurs
13      3       ptr_scripts     (far) — bloc bytecode de la scène
16      1       actor_count     (u8)
17      1       player_start_x  (u8)  — en tiles
18      1       player_start_y  (u8)
19      1       reserved        (u8)
```

### 4.3 Entrée acteur (8 octets par acteur)

```
Offset  Taille  Champ
0       1       actor_type    (u8)  — 0x01 = PNJ statique (seul type en v0)
1       1       x             (u8)  — en tiles
2       1       y             (u8)
3       1       sprite_id     (u8)  — index dans la table de metasprites
4       2       script_offset (u16) — offset dans le bloc scripts (0xFFFF = aucun)
6       1       direction     (u8)  — 0=bas 1=haut 2=gauche 3=droite
7       1       reserved      (u8)
```

### 4.4 Collision (v0 volontairement simpliste)

1 octet par tile 16x16 : `0x00` = traversable, `0x01` = solide.
Les types étendus (eau, one-way, déclencheurs de warp) viendront en v1 —
ne pas sur-designer maintenant.

---

## 5. Spec VM v0 — le bytecode

### Philosophie

- La VM v0 fait UNE chose : les interactions PNJ/dialogue. Rien d'autre.
- Chaque opcode : 1 octet d'opcode + opérandes de taille fixe. Décodage trivial.
- Deux catégories : opcodes **immédiats** (exécutés en chaîne dans la frame)
  et opcodes **bloquants** (rendent la main à la boucle principale jusqu'à
  un événement — input, fin de frame).
- Budget : ne jamais exécuter plus de ~32 opcodes immédiats par frame (garde-fou
  anti-boucle infinie : compteur + arrêt d'urgence en debug).

### État de la VM (en WRAM)

```c
struct VmState {
  u8  active;          // 0 = inactive
  u8  bank;            // bank du bytecode courant
  u16 pc;              // program counter (offset dans la bank)
  u8  wait_mode;       // 0=non, 1=attend touche A, 2=attend fermeture textbox
  u8  vars[64];        // variables de scène (réinitialisées au chargement de scène)
  u8  gvars[64];       // variables globales (persistent entre scènes)
};
```

### Table des opcodes v0

| Op | Nom | Opérandes | Effet |
|----|-----|-----------|-------|
| 0x00 | END | — | Termine le script, VM inactive, rend le contrôle au joueur |
| 0x01 | MSG | text_id (u16) | **Bloquant.** Ouvre la textbox, affiche le texte `text_id`, attend A pour fermer |
| 0x02 | SETVAR | var (u8), val (u8) | vars[var] = val |
| 0x03 | ADDVAR | var (u8), val (u8) | vars[var] += val (wrap 8-bit assumé) |
| 0x04 | JMP | offset (u16) | pc = offset (absolu dans le bloc scripts) |
| 0x05 | JEQ | var (u8), val (u8), offset (u16) | si vars[var] == val → saut |
| 0x06 | JNE | var (u8), val (u8), offset (u16) | si vars[var] != val → saut |
| 0x07 | SETGVAR | var (u8), val (u8) | gvars[var] = val |
| 0x08 | JGEQ | var (u8), val (u8), offset (u16) | si vars[var] >= val → saut (utile compteurs) |

8 opcodes. C'est tout. La tentation d'en ajouter est le premier piège de la phase —
chaque opcode supplémentaire attendra d'avoir prouvé son besoin.

**Textes :** table d'offsets en bank $86. `text_id` indexe la table ; chaque texte
est une chaîne terminée par `0x00`. Encodage v0 : ASCII simple (accents en v1
avec la fonte définitive).

### Script de test canonique (le PNJ compteur)

Le script qui valide toute la chaîne — un PNJ dont le dialogue change selon
le nombre d'interactions :

```
; var 0 = compteur de conversations
start:
  JGEQ 0, 2, deja_vu      ; 3e fois ou plus → autre texte
  MSG  txt_bonjour         ; "Bonjour ! Je suis le premier PNJ de ce moteur."
  ADDVAR 0, 1
  END
deja_vu:
  MSG  txt_encore          ; "Encore toi ? On s'est déjà parlé plusieurs fois !"
  END
```

Si ce script fonctionne, la VM, les variables, les branchements, la textbox
et le pipeline de données sont tous validés d'un coup.

---

## 6. Structures WRAM du moteur

```c
// Joueur
struct Player {
  u16 x, y;            // position en pixels (subpixels en v1 si besoin)
  u8  dir;             // 0=bas 1=haut 2=gauche 3=droite
  u8  moving;
  u8  anim_frame;
  u8  anim_timer;
};

// Caméra
struct Camera {
  u16 x, y;            // coin haut-gauche en pixels, clampée aux bords de map
};

// Scène courante (copie WRAM du header + pointeurs résolus)
struct SceneCtx {
  u8  scene_type;
  u8  map_w, map_h;
  u8  actor_count;
  // pointeurs far résolus vers tilemap, collision, actors, scripts
};
```

**Budget VBlank (à respecter dès le POC) :** le scrolling d'une map plus grande
que l'écran exige de streamer les colonnes/lignes de tiles qui entrent à l'écran.
Par frame : max 1 colonne + 1 ligne de tilemap (≈ 64 + 64 octets) + shadow OAM
(544 octets) — très confortable dans le budget DMA (~4,5 Ko), mais l'habitude
de compter se prend maintenant.

---

## 7. Planning semaine par semaine

### Semaine 1 — Fondation & affichage de map
- Squelette `engine/` dans le repo : makefile PVSnesLib, `main.c`, init console.
- Fichier `docs/SPEC_FORMATS.md` : copie des sections 4-6 de ce kit (la spec vit dans le repo et évolue avec le réel).
- Données de test : une map 32x32 tiles en C array (tileset simple 8-16 tiles : herbe, mur, chemin), bank $82/$84/$85.
- Le moteur lit la Scene Table, charge tileset + palette en VRAM, affiche la map (BG1, mode 1).
- **Jalon : la map s'affiche depuis les données. Modifier un tile dans le C array le change à l'écran après rebuild.**

### Semaine 2 — Joueur & scrolling
- Metasprite joueur 16x16 (ton perso de la Phase 0 fait l'affaire), lu depuis les données (sprite_id, position de départ du header).
- Déplacement 4 directions au pad, vitesse constante (1 px/frame pour commencer).
- Caméra centrée sur le joueur, clampée aux bords de map.
- Streaming du tilemap pendant le scroll (LE morceau technique de la phase — prévois d'y passer du temps, aide-toi de la page wiki « Map and Object Engines »).
- **Jalon : le perso se balade sur une map 512x512 px, scrolling fluide, validé bsnes accuracy.**

### Semaine 3 — Collision & acteurs
- Collision AABB contre la couche collision (16x16). Le perso glisse le long des murs (pas de blocage en coin).
- Chargement de la table d'acteurs : le PNJ s'affiche à sa position, avec sa direction.
- Détection d'interaction : bouton A + joueur adjacent au PNJ + face à lui.
- **Jalon : on ne traverse plus les murs, et appuyer sur A face au PNJ déclenche (pour l'instant) un simple changement de couleur de fond — la preuve du hook.**

### Semaine 4 — Textbox & VM
- Textbox : fenêtre en bas d'écran (BG3 en mode 1, textes sur fond sombre), fonte 8x8 incluse dans les assets, apparition/disparition.
- VM : boucle de décodage, les 8 opcodes, l'état VmState, le mécanisme bloquant (MSG rend la main, la boucle principale route les inputs vers la textbox).
- Câblage : interaction PNJ → vmStart(script_offset).
- **Jalon : le script canonique du PNJ compteur fonctionne intégralement.**

### Semaine 5 — Consolidation & verdict
- Passe de validation bsnes accuracy complète (+ Mesen2 en mode « accurate » aussi).
- Nettoyage : le code moteur ne contient plus aucune constante de jeu (audit rapide : chercher les nombres magiques).
- Deuxième scène ajoutée dans la Scene Table (même moteur, autre map, autre PNJ) pour prouver le multi-scènes — même si on ne peut pas encore passer de l'une à l'autre en jeu (le warp viendra en Phase 4, changer scene_id au boot suffit).
- Mise à jour de la spec avec tout ce qui a changé en cours de route.
- GIF de démo + premier post public (SNESdev forum / Discord homebrew).
- **Jalon : kill switch évalué, décision GO/NO-GO Phase 2.**

---

## 8. Pièges connus & parades

| Piège | Parade |
|-------|--------|
| Écriture VRAM hors VBlank (marche dans Mesen2 laxiste, casse sur hardware) | TOUT transfert via les fonctions DMA PVSnesLib après WaitForVBlank ; valider chaque étape dans bsnes accuracy, pas seulement à la fin |
| Pointeur 16-bit qui déborde de sa bank | Données volumineuses alignées par bank ; accès far systématique pour les données |
| Boucle infinie dans la VM | Compteur d'opcodes par frame + halt debug |
| Scrolling qui glitche aux bords de map | Clamp caméra AVANT le calcul des colonnes à streamer ; tester les 4 bords systématiquement |
| Make qui ne reconvertit pas les assets modifiés | `make clean` dans le doute ; en Phase 2 les outils Rust géreront les dépendances proprement |
| Sur-design des formats (« et si un jour on veut... ») | La v0 de chaque format couvre le POC, rien de plus. Le champ scene_type est la SEULE concession au futur |

---

## 9. Definition of Done — Phase 1

- [ ] Les 5 critères du kill switch (section 1) sont verts.
- [ ] `docs/SPEC_FORMATS.md` est à jour et fidèle au code.
- [ ] Le repo compile en une commande depuis un clone frais (toolchain installée à part).
- [ ] Un GIF de démo existe.
- [ ] Toi : GO ou NO-GO explicite pour la Phase 2.

---

*Kit généré le 26 juillet 2026 — à faire évoluer librement, c'est TON document de travail.*
