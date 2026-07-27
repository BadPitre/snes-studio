// Onglet Événements : liste des events de la scène (la création se fait au
// clic droit sur la couche Événements de la map), ouverture de l'Event
// Editor, import de charsets RM2003, budget de charsets de la scène.

import type { Scene } from "../types";
import { SCENE_SPRITE_BLOCKS_MAX, sceneSpriteBlocks } from "../types";

interface Props {
  scene: Scene;
  selected: number | null;
  canImport: boolean;
  blockNames: string[];
  onSelect: (i: number | null) => void;
  onOpen: (i: number) => void;
  onRemove: (i: number) => void;
  onImportCharset: () => void;
}

const TRIG_LABEL = { action: "Action", touch: "Contact", auto: "Auto" } as const;

export default function EventsPanel(props: Props) {
  const { scene, selected } = props;
  const used = sceneSpriteBlocks(scene).length;
  const over = used > SCENE_SPRITE_BLOCKS_MAX;

  return (
    <div className="panel">
      <div className="panel-title">Événements ({scene.events.length})</div>
      <button
        onClick={props.onImportCharset}
        disabled={!props.canImport}
        title="Importer un charset RPG Maker 2003 (PNG 288x256 ou 72x128) dans un bloc de la feuille de sprites"
        style={{ marginBottom: 6 }}
      >
        Charset RM2003…
      </button>
      <div
        className="hint"
        style={{ marginBottom: 10, color: over ? "#ff7070" : undefined }}
        title="Chaque scène peut afficher 5 charsets différents max (limite VRAM SNES), héros inclus"
      >
        Charsets de la scène : {used}/{SCENE_SPRITE_BLOCKS_MAX}
        {over ? " — trop pour la SNES !" : ""}
      </div>
      <p className="hint">
        Créer un event : couche Événements → clic droit sur une tile.
        Double-clic sur un event = Event Editor.
      </p>
      <ul className="actor-list">
        {scene.events.map((ev, i) => (
          <li
            key={i}
            className={i === selected ? "active" : ""}
            onClick={() => props.onSelect(i)}
            onDoubleClick={() => props.onOpen(i)}
          >
            {ev.name} — ({ev.x},{ev.y}) {TRIG_LABEL[ev.trigger]}
            {ev.commands.length ? ` · ${ev.commands.length} cmd` : ev.entry ? ` → ${ev.entry}` : " (vide)"}
          </li>
        ))}
      </ul>
      {selected !== null && scene.events[selected] && (
        <div className="row">
          <button onClick={() => props.onOpen(selected)}>Éditer…</button>
          <button className="danger" onClick={() => props.onRemove(selected)}>
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
