// Fenêtre « Commande d'événement » — boîte Event Command de RM2003, les
// commandes classées par ONGLETS (demande utilisateur : beaucoup de
// commandes à venir, les colonnes ne tiennent plus). Les commandes
// annoncées mais pas encore compilables restent grisées (jamais de
// bouton qui ment).
//
// Elle s'ouvre depuis l'Event Editor : double-clic sur une ligne vide,
// ou clic droit → Insérer…

import { useState } from "react";
import type { Command } from "../types";

interface Tab {
  title: string;
  items: { c: Command["c"]; label: string }[];
  soon?: string[];
}

const TABS: Tab[] = [
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
      { c: "loop", label: "Boucle" },
      { c: "break", label: "Sortir de la boucle" },
      { c: "rem", label: "Commentaire" },
    ],
  },
  {
    title: "Déplacements",
    items: [
      { c: "route", label: "Déplacer un event…" },
      { c: "wait_route", label: "Attendre la fin des déplacements" },
      { c: "face", label: "Tourner un event" },
      { c: "warp", label: "Téléporter le héros" },
      { c: "hero_loc", label: "Mémoriser la position du héros" },
      { c: "warp_var", label: "Téléporter aux variables" },
      { c: "setpos", label: "Placer un event" },
      { c: "swappos", label: "Échanger deux events" },
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
    title: "Écran",
    items: [],
    soon: ["Cacher l'écran", "Montrer l'écran", "Teinter l'écran", "Flash", "Secousse"],
  },
  {
    title: "Caméra",
    items: [
      { c: "campan", label: "Déplacer la caméra" },
      { c: "cam_return", label: "Caméra : retour au héros" },
      { c: "wait_cam", label: "Attendre la caméra" },
    ],
  },
  {
    title: "Autres",
    items: [],
    soon: ["Jouer un son", "Appeler un event"],
  },
];

interface Props {
  onPick: (c: Command["c"]) => void;
  onClose: () => void;
}

export default function EventCommandPicker(props: Props) {
  const [tab, setTab] = useState(0);
  const cur = TABS[tab];
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal cmdpick" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Commande d'événement</div>
        <div className="cmdpick-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.title}
              className={i === tab ? "active" : ""}
              onClick={() => setTab(i)}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className="cmdpick-grid">
          {cur.items.map((t) => (
            <button key={t.c} onClick={() => props.onPick(t.c)}>
              {t.label}
            </button>
          ))}
          {(cur.soon ?? []).map((l) => (
            <button key={l} disabled title="À venir">
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
