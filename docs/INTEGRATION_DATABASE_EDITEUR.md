# SNES STUDIO — Intégration du système de Database dans l'éditeur

**Objectif :** Offrir dans l'éditeur (Tauri + React) l'expérience « Database » de RPG Maker —
des onglets Stats, Items, Monstres... où l'utilisateur crée des fiches sans coder —
en s'appuyant intégralement sur le système de schémas + dbgen défini dans
`docs/PLANNING_SYSTEME_DATABASE.md`.
**Idée maîtresse : UNE SEULE UI générique pilotée par les schémas.** On ne code pas un
écran par type de données ; on code un moteur de formulaires qui lit les schémas TOML
et se dessine tout seul. Ajouter un onglet « Compétences » en v2 = ajouter un schéma,
zéro code React.

---

## 1. Architecture éditeur ↔ database

```
schemas/*.toml  ──lecture──▶  ÉDITEUR (React)
                              │  UI générique de formulaires
                              │  (un onglet par schéma)
data/*.toml     ◀──écriture── │
                              ▼
                        Bouton Build/Run
                              │
                        dbgen (backend Rust Tauri)
                              │
                 engine/generated/*.h/.c ─▶ make ─▶ ROM
```

- L'éditeur **lit les schémas** (source de vérité des types, jamais dupliquée côté TS).
- L'éditeur **lit/écrit les fichiers d'instances** (`data/*.toml`) — format texte,
  diffable dans Git, compatible avec une édition manuelle par les power users.
- `dbgen` reste l'unique traducteur vers le C/binaire. L'éditeur ne génère JAMAIS
  de C lui-même : il appelle dbgen via le backend Tauri. Un seul chemin de build.

---

## 2. L'UI Database (l'onglet à la RPG Maker)

### Disposition
- **Panneau latéral gauche :** liste des tables (une entrée par schéma trouvé :
  Stats, Actors, Items...). Badge avec le compteur d'entrées (ex. « Stats 12/255 »).
- **Colonne centrale :** liste des instances de la table sélectionnée
  (nom symbolique + aperçu), boutons Nouveau / Dupliquer / Supprimer / Réordonner.
- **Panneau droit :** le formulaire de l'instance sélectionnée, généré depuis le schéma.

### Mapping type de champ → widget (le cœur du générique)
| Type schéma | Widget React |
|-------------|--------------|
| `u8` / `u16` / `s8` / `s16` | Champ numérique avec min/max du type affichés et validés |
| `flags8` | 8 cases à cocher nommées (noms des flags dans le schéma) |
| `ref:<table>` | Menu déroulant peuplé par les entrées de la table cible (affiche les noms, stocke l'ID) |
| `text_id` | Sélecteur/éditeur de texte relié à la banque de textes |
| `@default(n)` | Valeur pré-remplie à la création |
| `@runtime_copy` | Simple icône/tooltip « valeur de base, copiée à l'instanciation » (info, pas un widget) |

### Comportements clés
- **Noms symboliques gérés par l'éditeur** : l'utilisateur nomme « Slime » ; l'éditeur
  garantit l'unicité et la validité (snake_case → constante C `STATS_SLIME`).
  Renommer une entrée met à jour toutes les refs (refactoring automatique).
- **Validation en direct** : dépassement de type, ref cassée, table pleine (255) —
  soulignés dans l'UI AVANT le build, avec les mêmes règles que dbgen
  (idéalement : exposer la validation de dbgen via Tauri pour ne pas la dupliquer).
- **Suppression protégée** : impossible de supprimer une entrée référencée ailleurs
  sans confirmation listant les usages (« Slime est utilisé par 3 acteurs sur Map_Village »).

---

## 3. Connexions avec le reste de l'éditeur

- **Éditeur de maps :** placer un acteur ouvre un mini-formulaire dont le champ
  `stats_id` est le même widget `ref:stats` que dans la database. Cohérence totale.
- **Éditeur d'events :** les commandes qui manipulent des données (« donner objet X »,
  « lire stat Y ») utilisent les mêmes menus déroulants peuplés par les tables.
- **Recherche globale (v2) :** « où est utilisé ITEM_POTION ? » — trivial à implémenter
  puisque toutes les refs sont des IDs symboliques traçables dans les fichiers data/.
- **Jauges de budget :** l'éditeur affiche l'occupation ROM des tables (octets par table,
  bank $83) dans le panneau de build — l'utilisateur voit ses limites avant d'y cogner.

---

## 4. Phasage (aligné sur le planning global)

| Phase | Livrable database dans l'éditeur |
|-------|----------------------------------|
| **P3 (MVP)** | Pas d'UI database dédiée — mais l'éditeur lit déjà les schémas pour le formulaire de placement d'acteurs (le widget générique naît ici, en miniature) |
| **P4** | Premier onglet Database avec 2 tables : Actors, Items. L'UI générique complète (les 3 panneaux) est construite ICI — c'est l'investissement |
| **v2** | Extension à la database RM2003 complète (Monstres, Compétences, États, Groupes...) = ajouter des schémas + quelques widgets spécialisés (courbes de stats, timeline d'animations). L'infrastructure ne change pas |

**Effort estimé pour l'UI générique (P4) :** ~2-3 semaines. Rentabilisé dès la v2 :
chaque nouvel onglet coûte alors des heures, pas des semaines.

---

## 5. Règles de conception à respecter

1. **Le schéma est l'unique source de vérité.** Aucun type, aucune limite, aucun nom de
   champ codé en dur dans le TypeScript de l'éditeur.
2. **Les fichiers data/ restent lisibles et diffables.** L'éditeur les formate proprement
   (ordre stable des clés) pour des diffs Git propres — essentiel pour les projets
   utilisateurs versionnés.
3. **Un seul chemin de génération** : éditeur → data/*.toml → dbgen → C. Jamais de
   raccourci où l'éditeur écrirait du binaire ou du C directement.
4. **Dégradation élégante** : un schéma avec un type inconnu (ajouté par une version
   future) s'affiche en lecture seule avec un avertissement, il ne fait pas planter l'UI.
5. **Penser moddabilité** : puisque tout est schémas + TOML, un utilisateur avancé peut
   définir SES propres tables custom et les lire depuis ses scripts d'events (v2+) —
   c'est un différenciateur énorme vs RPG Maker, quasi gratuit avec cette architecture.

---

*Document généré le 28 juillet 2026 — à ranger dans `docs/`, à relire au démarrage de la Phase 3.*
