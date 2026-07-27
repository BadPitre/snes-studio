// Fenêtre « Commande d'événement » — boîte Event Command de RM2003, les
// commandes classées PAR CATÉGORIE (demande utilisateur) : Messages,
// Logique, Déplacements, Temps, Caméra. Les commandes annoncées mais pas
// encore compilables restent grisées (jamais de bouton qui ment).
//
// Elle s'ouvre depuis l'Event Editor : bouton « Ajouter… », double-clic
// sur une ligne vide, ou clic droit → Insérer…

import type { Command } from "../types";

interface Cat {
  title: string;
  items: { c: Command["c"]; label: string }[];
  soon?: string[];
}

const CATEGORIES: Cat[] = [
  {
    title: "Messages",
    items: [
      { c: "msg", label: "Afficher un message" },
      { c: "choice", label: "Afficher un choix" },
    ],
  },
  {
    title: "Logique",
    items: [
      { c: "switch", label: "Modifier un switch" },
      { c: "var", label: "Modifier une variable" },
      { c: "if_sw", label: "Condition : switch" },
      { c: "if_var", label: "Condition : variable" },
    ],
  },
  {
    title: "Déplacements",
    items: [
      { c: "route", label: "Déplacer un event…" },
      { c: "wait_route", label: "Attendre la fin des déplacements" },
      { c: "face", label: "Tourner un event" },
      { c: "warp", label: "Téléporter le héros" },
    ],
  },
  {
    title: "Temps",
    items: [
      { c: "wait", label: "Attendre" },
      { c: "timer", label: "Timer (régler / afficher)" },
    ],
  },
  {
    title: "Caméra",
    items: [
      { c: "campan", label: "Déplacer la caméra" },
      { c: "cam_return", label: "Caméra : retour au héros" },
      { c: "wait_cam", label: "Attendre la caméra" },
    ],
    soon: ["Jouer un son", "Appeler un event"],
  },
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
        <div className="cmdpick-cats">
          {CATEGORIES.map((cat) => (
            <div key={cat.title} className="cmdpick-cat">
              <div className="cmdpick-cat-title">{cat.title}</div>
              {cat.items.map((t) => (
                <button key={t.c} onClick={() => props.onPick(t.c)}>
                  {t.label}
                </button>
              ))}
              {(cat.soon ?? []).map((l) => (
                <button key={l} disabled title="À venir">
                  {l}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="row">
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
