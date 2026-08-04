// "Équipe" (C5) — the party window of the design doc §8: the active
// heroes, their order (= the battle screen's column order), their
// stats, the command menu widget and the MEANING of its entries.
// Edits data/heroes.toml — the same file datagen's battle module reads.

import { useState } from "react";
import type { BattleHero, HeroesFile, SkillDef } from "../battle";

interface Props {
  heroes: HeroesFile;
  charsetNames: string[];
  listWidgets: string[]; // cursor-list widgets of the UI layout
  skills: SkillDef[]; // data/skills.toml — the skill:<id> actions
  items: { id: string; name: string }[]; // db items usable in battle (C6)
  onOk: (h: HeroesFile) => void;
  onClose: () => void;
}

const MAX_HEROES = 4;

const STATS: { key: keyof BattleHero; label: string; max: number; tip: string }[] = [
  { key: "max_hp", label: "PV max", max: 9999, tip: "Points de vie — variables réservées 240-247 (fenêtres PV)" },
  { key: "max_mp", label: "PM max", max: 999, tip: "Points de magie — dépensés par les compétences (244-247)" },
  { key: "speed", label: "Vitesse", max: 255, tip: "Remplit la jauge ATB de vitesse/4 par frame" },
  { key: "attack", label: "Attaque", max: 255, tip: "Formule intégrée : attaque×2 − défense du monstre (min 1)" },
  { key: "defense", label: "Défense", max: 255, tip: "Encaisse les attaques physiques des monstres" },
  { key: "magic", label: "Magie", max: 255, tip: "Formule magique : puissance + magie×2 − déf. magique ; soin : puissance + magie" },
  { key: "magic_def", label: "Déf. magique", max: 255, tip: "Encaisse les sorts des monstres (C4)" },
];

export default function PartyModal(props: Props) {
  const [file, setFile] = useState<HeroesFile>(() => structuredClone(props.heroes));
  const [sel, setSel] = useState(0);

  const cur = file.heroes[sel] as BattleHero | undefined;
  const patch = (p: Partial<BattleHero>) =>
    setFile({
      ...file,
      heroes: file.heroes.map((h, i) => (i === sel ? { ...h, ...p } : h)),
    });

  const move = (d: number) => {
    const j = sel + d;
    if (j < 0 || j >= file.heroes.length) return;
    const list = [...file.heroes];
    [list[sel], list[j]] = [list[j], list[sel]];
    setFile({ ...file, heroes: list });
    setSel(j);
  };


  return (
    <div className="modal-backdrop">
      <div className="modal cevents" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          Équipe
          <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button>
        </div>
        <div className="cevents-body">
          <div className="cevents-list">
            <div className="cevents-items">
              {file.heroes.map((h, i) => (
                <div
                  key={i}
                  className={"cevents-item" + (i === sel ? " selected" : "")}
                  onClick={() => setSel(i)}
                >
                  🛡 {h.name || h.id}
                </div>
              ))}
            </div>
            <div className="row">
              <button
                title="Ajouter un héros (4 au plus)"
                disabled={file.heroes.length >= MAX_HEROES}
                onClick={() => {
                  let id = "heros";
                  let k = 2;
                  while (file.heroes.some((h) => h.id === id)) id = `heros_${k++}`;
                  setFile({
                    ...file,
                    heroes: [
                      ...file.heroes,
                      {
                        id,
                        name: "Héros",
                        charset: props.charsetNames[0] ?? "",
                        max_hp: 100,
                        max_mp: 20,
                        speed: 50,
                        attack: 8,
                        defense: 2,
                        magic: 5,
                        magic_def: 2,
                      },
                    ],
                  });
                  setSel(file.heroes.length);
                }}
              >
                ＋
              </button>
              <button
                className="danger"
                disabled={!cur || file.heroes.length <= 1}
                title="Retirer ce héros (l'équipe garde au moins un membre)"
                onClick={() => {
                  setFile({ ...file, heroes: file.heroes.filter((_, i) => i !== sel) });
                  setSel(Math.max(0, sel - 1));
                }}
              >
                🗑
              </button>
              <button onClick={() => move(-1)} disabled={sel === 0} title="Monter (ordre d'écran)">▲</button>
              <button onClick={() => move(1)} disabled={sel >= file.heroes.length - 1} title="Descendre">▼</button>
            </div>
            <span className="hint">L'ordre = la colonne de droite de l'écran de combat.</span>
          </div>
          <div className="cevents-form" style={{ overflow: "auto" }}>
            {cur && (
              <>
                <div className="row">
                  <label>
                    Nom
                    <input
                      value={cur.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label title="Le battler = la frame de repos gauche du charset, centrée en 32×32">
                    Apparence (charset)
                    <select
                      value={cur.charset}
                      onChange={(e) => patch({ charset: e.target.value })}
                    >
                      {props.charsetNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {STATS.map((s) => (
                    <label key={s.key} title={s.tip}>
                      {s.label}
                      <input
                        type="number"
                        min={s.key === "max_hp" ? 1 : 0}
                        max={s.max}
                        style={{ width: 70 }}
                        value={Number(cur[s.key])}
                        onChange={(e) => patch({ [s.key]: Number(e.target.value) } as Partial<BattleHero>)}
                      />
                    </label>
                  ))}
                </div>
                <span className="hint" style={{ marginTop: 8 }}>
                  Le menu de combat et le sens de ses lignes vivent dans la
                  BIBLIOTHEQUE d'events depuis V2 : ouvre combat_tour_heros
                  (Tools → Common events) — chaque entree du widget
                  menu_combat y est une branche du script, a toi.
                </span>
              </>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="primary" onClick={() => props.onOk(file)}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
