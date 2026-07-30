# SNES STUDIO — Système de Database (schémas + dbgen)

**Objectif :** des données de jeu structurées (stats, objets, monstres…)
définies par des **schémas**, saisies en **TOML texte**, compilées en
**tables C byte-packed** dans la ROM. Le pendant « Database » de RPG
Maker 2003, mais extensible : ajouter une table = ajouter un schéma.

Document compagnon : `INTEGRATION_DATABASE_EDITEUR.md` (l'UI générique
de l'éditeur). Contractuel au même titre que `SPEC_FORMATS.md` : tout
écart du code doit mettre ce document à jour dans le même commit.

---

## 1. Arborescence d'un projet

```
monprojet/
  project.json
  scenes/…
  schemas/            # UN fichier TOML par table (source de vérité des types)
    stats.toml
    items.toml
  data/               # les instances, saisies par l'éditeur (ou à la main)
    stats.toml
    items.toml
```

Un projet SANS dossier `schemas/` n'a pas de database : dbgen n'émet
rien, rien ne change (compatibilité totale avec les projets existants).

## 2. Format d'un schéma (`schemas/<table>.toml`)

```toml
name  = "stats"        # snake_case — nom des constantes C (STATS_*)
title = "Stats"        # titre affiché dans l'éditeur
max   = 255            # nombre d'entrées max (1-255, défaut 255)

[[fields]]
name    = "max_hp"     # snake_case
type    = "u16"
default = 10           # @default — valeur pré-remplie à la création

[[fields]]
name = "attack"
type = "u8"

[[fields]]
name  = "elem_resist"
type  = "flags8"       # 8 cases à cocher nommées
flags = ["feu", "glace", "foudre", "eau", "terre", "vent", "lumiere", "ombre"]

[[fields]]
name = "drop_item"
type = "ref:items"     # menu déroulant peuplé par la table items — stocke
                       # l'index u8 (0xFF = aucun si optional = true)
optional = true

[[fields]]
name = "hp"
type = "u16"
runtime_copy = true    # @runtime_copy — valeur de base copiée en WRAM à
                       # l'instanciation (info UI, même encodage ROM)
```

### Types de champs (v1)

| Type | Taille ROM | Bornes | Widget éditeur |
|------|-----------|--------|----------------|
| `u8`  | 1 octet | 0..255 | numérique |
| `u16` | 2 octets (little-endian) | 0..65535 | numérique |
| `s8`  | 1 octet (complément à 2) | −128..127 | numérique |
| `s16` | 2 octets (complément à 2) | −32768..32767 | numérique |
| `flags8` | 1 octet (bit i = flags[i]) | 8 noms max | 8 cases à cocher |
| `ref:<table>` | 1 octet (index dans la table cible) | table ≤ 255 entrées ; `optional = true` → 0xFF = aucun | menu déroulant |
| `text_id` | 2 octets (id dans la banque de textes, little-endian) | nom d'un texte de texts.json ; `optional = true` → 0xFFFF = aucun | sélecteur de texte |
| `picture` / `sound` / `music` | 1 octet (index dans la liste projet — le même que SHOWPIC/PLAYSFX/PLAYBGM) | nom (stem) d'une ressource de project.json ; `optional = true` → 0xFF = aucune ; nom inconnu = erreur de build (B7) | menu déroulant par nom + ▶ play/pause (son/musique) |

Attributs de champ : `default` (valeur à la création — pour `ref:` le
nom symbolique cible, pour `flags8` une liste de noms), `optional`
(refs/text_id/ressources seulement), `runtime_copy` (documentaire),
`min`/`max` (resserrer les bornes d'un type numérique — validées par
dbgen ET par l'éditeur).

**Dégradation élégante** : un type inconnu (version future) est affiché
en lecture seule par l'éditeur avec un avertissement ; dbgen, lui,
refuse de builder (le build ne devine jamais).

## 3. Format des instances (`data/<table>.toml`)

```toml
[[entry]]
id     = "slime"       # snake_case UNIQUE dans la table → STATS_SLIME
name   = "Slime"       # libellé humain (éditeur seulement, pas en ROM)
max_hp = 20
attack = 5
elem_resist = ["feu"]  # flags8 : liste de noms cochés
drop_item = "potion"   # ref: par id symbolique, jamais par index
```

- L'ORDRE des entrées du fichier est l'ordre des index ROM (réordonner
  dans l'éditeur = réécrire le fichier). Les refs étant symboliques,
  réordonner ne casse rien.
- Champ absent = `default` du schéma (ou 0 ; ref/text_id `optional`
  absent = aucun ; sinon erreur).
- L'éditeur écrit les clés dans l'ordre du schéma, une entrée par bloc
  `[[entry]]` — diffs Git stables.

## 4. dbgen — le traducteur unique

Implémentation : **module `db.rs` de datagen** (un seul binaire, un seul
chemin de build — `make data` reste l'unique commande ; l'esprit
« dbgen » du planning est un module, pas un exécutable séparé).

Entrées : `schemas/*.toml` + `data/*.toml` + texts.json (pour les
`text_id`). Sorties, dans `engine/src/data/` :

- `db_<table>.c` — la table byte-packed :
  `const u8 db_<table>[N * TAILLE_ENTREE] = {…};` (une section ROM par
  table, même règle 32 Ko que les assets).
- `db_tables.h` — pour TOUTES les tables : `#define <TABLE>_<ID> <index>`
  (constantes symboliques), `#define DB_<TABLE>_COUNT N`,
  `#define DB_<TABLE>_SIZE <taille d'entrée>`, offsets de champs
  `#define DB_<TABLE>_<CHAMP> <offset>`, et les `extern const u8 …`.

Validations (mêmes règles que l'éditeur) : ids snake_case uniques,
bornes de type et min/max, refs existantes, flags connus, table pleine
(> max), champ inconnu dans une entrée, type de schéma inconnu.
Messages d'erreur nommés (« stats.toml : entree "slime", champ
"attack" : 300 hors bornes u8 »).

Le moteur lit ces tables comme n'importe quelles données (`db_stats[
STATS_SLIME * DB_STATS_SIZE + DB_STATS_ATTACK]`) — AUCUNE donnée en dur
dans le moteur, comme toujours. Les opcodes VM qui liront la database
(« donner l'objet X », « lire la stat Y ») arrivent dans une phase
ultérieure, sur demande explicite (règle d'extension des opcodes).

## 5. Règles de conception (rappel)

1. Le schéma est l'unique source de vérité — rien en dur côté éditeur.
2. Les fichiers `data/` restent lisibles et diffables (ordre stable).
3. Un seul chemin de génération : éditeur → data/*.toml → dbgen → C.
4. Dégradation élégante sur type inconnu (lecture seule, pas de crash).
5. Moddabilité : les utilisateurs avancés peuvent définir leurs propres
   tables custom — l'UI générique les affiche sans code nouveau.

## 6. Phasage

| Phase | Livrable |
|-------|----------|
| **P10-a** | dbgen (module datagen) + schémas `stats`/`items` du démo + tables en ROM |
| **P10-b** | Onglet/fenêtre Database générique dans l'éditeur (3 panneaux, widgets par type, validation live, jauge d'octets) |
| **v2** | Tables RM2003 complètes (Monstres, Compétences, États…), widgets spécialisés (courbes), opcodes VM de lecture/écriture, recherche globale des refs |

---

*Document rédigé le 28 juillet 2026 (Phase 10) — dérivé de
`INTEGRATION_DATABASE_EDITEUR.md`.*
