// Fenêtre « Commande d'événement » — calquée sur la boîte Event Command de
// RPG Maker 2003 : des onglets de pages (1 à 4) et une grille de boutons,
// un par commande. Seule la page 1 est peuplée pour l'instant ; les pages
// 2 à 4 accueilleront les commandes P4 (switches, mouvements, son…).
//
// Elle s'ouvre depuis l'Event Editor : bouton « Ajouter… », double-clic sur
// une ligne vide, ou clic droit → Insérer…

import type { Command } from "../types";

// Les commandes réellement compilées vers la VM (docs/TOOLS.md)
const PAGE1: { c: Command["c"]; label: string }[] = [
  { c: "msg", label: "Afficher un message" },
  { c: "choice", label: "Afficher un choix" },
  { c: "set", label: "Modifier une variable (=)" },
  { c: "add", label: "Modifier une variable (+)" },
  { c: "if", label: "Condition" },
  { c: "warp", label: "Téléporter le héros" },
  { c: "face", label: "Tourner un event" },
];

// Cases annoncées mais pas encore compilables — affichées grisées pour que
// la fenêtre dise la vérité sur ce qui existe (jamais de bouton qui ment).
const PAGE1_SOON = [
  "Modifier un switch",
  "Attendre",
  "Jouer un son",
  "Déplacer un event",
  "Changer l'apparence",
  "Appeler un event",
];

interface Props {
  onPick: (c: Command["c"]) => void;
  onClose: () => void;
}

export default function EventCommandPicker(props: Props) {
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal cmdpick" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Commande d'événement</div>
        <div className="cmdpick-tabs">
          <button className="active">1</button>
          {[2, 3, 4].map((n) => (
            <button key={n} disabled title="Commandes supplémentaires : à venir (P4)">
              {n}
            </button>
          ))}
        </div>
        <div className="cmdpick-grid">
          {PAGE1.map((t) => (
            <button key={t.c} onClick={() => props.onPick(t.c)}>
              {t.label}
            </button>
          ))}
          {PAGE1_SOON.map((l) => (
            <button key={l} disabled title="À venir (P4)">
              {l}
            </button>
          ))}
        </div>
        <div className="row">
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
