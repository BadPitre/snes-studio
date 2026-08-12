// "Commande d'événement" window — RM2003's Event Command box, with the
// commands filed by TABS: many more commands are coming and the columns
// no longer fit. Commands that are announced but not yet compilable stay
// greyed out — never a button that lies about what it will do at build
// time.
//
// It opens from the Event Editor: double-click on an empty row, or right
// click > Insérer…

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
      { c: "key_input", label: "Touche pressée (Key Input)" },
      { c: "switch", label: "Modifier un switch" },
      { c: "var", label: "Modifier une variable" },
      { c: "if_sw", label: "Condition : switch" },
      { c: "if_var", label: "Condition : variable" },
      { c: "loop", label: "Boucle" },
      { c: "break", label: "Sortir de la boucle" },
      { c: "rem", label: "Commentaire" },
      { c: "db_read", label: "Lire la database" },
      { c: "db_entry", label: "Numéro d'une fiche (database)" },
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
    items: [
      { c: "scr_hide", label: "Cacher l'écran" },
      { c: "scr_show", label: "Montrer l'écran" },
      { c: "tint", label: "Teinter l'écran" },
      { c: "weather", label: "Météo (pluie / neige)" },
      { c: "wave", label: "Ondulation de l'écran" },
      { c: "skygrad", label: "Dégradé d'écran (ciel)" },
      { c: "spotlight", label: "Spotlight (cercle de lumière)" },
      { c: "flash", label: "Flash d'écran" },
      { c: "shake", label: "Secouer l'écran" },
    ],
  },
  {
    title: "Image",
    items: [
      { c: "pic_show", label: "Afficher une image" },
      { c: "pic_move", label: "Déplacer l'image" },
      { c: "pic_hide", label: "Effacer l'image" },
    ],
  },
  {
    title: "UI",
    items: [
      { c: "ui_show", label: "Afficher/cacher un widget UI" },
      { c: "list_select", label: "Choix dans une liste (menu à curseur)" },
    ],
  },
  {
    title: "Audio",
    items: [
      { c: "sfx", label: "Jouer un son" },
      { c: "bgm", label: "Changer la musique" },
    ],
  },
  {
    title: "Écran composé",
    items: [
      { c: "screen", label: "Aller à l'écran (composé)" },
      { c: "screen_call", label: "Appeler un script de l'écran" },
      { c: "stage_open", label: "Ouvrir un écran composé" },
      { c: "stage_pose", label: "Poser une image (slot)" },
      { c: "stage_clear", label: "Retirer une image (slot)" },
      { c: "slot_fx", label: "Effet sur une image (slot)" },
      { c: "vig_show", label: "Afficher un sprite animé" },
      { c: "vig_play", label: "Animer le sprite animé" },
      { c: "vig_hide", label: "Cacher le sprite animé" },
      { c: "stage_close", label: "Fermer l'écran composé" },
      { c: "m7", label: "Zoom cinématique" },
      { c: "m7_view", label: "Angle de caméra (Mode 7)" },
      { c: "m7_rot", label: "Orienter la vue (Mode 7)" },
      { c: "m7_turn", label: "Tourner la vue (Mode 7)" },
    ],
  },
  {
    title: "Combat",
    items: [
      { c: "btl_pose", label: "Poser un combattant (équipe)" },
      { c: "popup", label: "Nombre qui saute (popup)" },
      { c: "clock", label: "Horloge de jauges (ATB)" },
      { c: "target_sel", label: "Curseur de cible" },
    ],
  },
  {
    title: "Animations",
    items: [
      { c: "anim_play", label: "Jouer une animation" },
      { c: "anim_stop", label: "Arrêter les animations" },
    ],
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
    items: [
      { c: "save_slot", label: "Sauvegarder la partie (slot)" },
      { c: "load_slot", label: "Charger la partie (slot)" },
      { c: "slot_info", label: "Slot de sauvegarde occupé ?" },
      { c: "call", label: "Appeler un common event" },
      { c: "call_fn", label: "Appeler une fonction (avec paramètres)" },
      { c: "ret_fn", label: "Retourner un résultat (dans une fonction)" }],
    soon: ["Jouer un son"],
  },
];

// Inside a FUNCTION body the list shrinks: a function is a
// COMPUTATION, not staging. Offering "Afficher un message" or "Secouer
// l'écran" there invites writing functions that DO things instead of
// returning them — and that is precisely what we do not want to
// encourage. What is left: logic, variables, the database, and the
// calls between functions.
//
// "Appeler un common event" is not there either: a common event can
// contain anything, so allowing it would let back in through the window
// what we shut out through the door. To compose, a function calls
// ANOTHER FUNCTION.
const FN_TABS: Tab[] = [
  {
    title: "Logique et calcul",
    items: [
      { c: "var", label: "Modifier une variable" },
      { c: "switch", label: "Modifier un switch" },
      { c: "if_var", label: "Condition : variable" },
      { c: "if_sw", label: "Condition : switch" },
      { c: "loop", label: "Boucle" },
      { c: "break", label: "Sortir de la boucle" },
      { c: "db_read", label: "Lire la database" },
      { c: "db_entry", label: "Numéro d'une fiche (database)" },
      { c: "rem", label: "Commentaire" },
    ],
  },
  {
    title: "Fonctions",
    items: [
      { c: "ret_fn", label: "Retourner un résultat" },
      { c: "call_fn", label: "Appeler une fonction (avec paramètres)" },
    ],
  },
];

interface Props {
  onPick: (c: Command["c"]) => void;
  onClose: () => void;
  /** a function body: a restricted list (see FN_TABS) */
  inFunction?: boolean;
}

export default function EventCommandPicker(props: Props) {
  const [tab, setTab] = useState(0);
  const tabs = props.inFunction ? FN_TABS : TABS;
  const cur = tabs[tab] ?? tabs[0];
  return (
    <div className="modal-backdrop">
      <div className="modal cmdpick" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Commande d'événement<button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        <div className="cmdpick-tabs">
          {tabs.map((t, i) => (
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
