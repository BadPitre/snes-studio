// Per-command option forms — one function per event command.
//
// This is the editor-side twin of compile_list in tools/datagen: the same
// command list, seen from the other end. It used to be one 2 300-line
// switch inside CommandForm; the dispatch table stayed there and each
// branch moved here, so a command can now be read, changed or added
// without scrolling past the fifty others.
//
// Each function takes its NARROWED command plus the shared context and
// returns the fields to show and whether OK may be pressed.

import type { Command, Direction, M7Curve, ValueSrc, VarOp } from "../types";
import { DIRECTIONS } from "../types";
import MoveRouteModal from "./MoveRouteModal";
import {
  type FormCtx,
  type FormBody,
  TransSelect,
  ValueSourceFields,
} from "./EventEditorModal";

export function formMsg(cmd: Extract<Command, { c: "msg" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const fromCat = cmd.text_ref !== undefined;
  const catEntry = fromCat
    ? x.p.texts.find((t) => t.name === cmd.text_ref)
    : undefined;
  valid = fromCat ? !!catEntry : cmd.text.trim().length > 0;
  body = (
    <>
      <label className="check">
        <input
          type="checkbox"
          checked={fromCat}
          onChange={(e) => {
            if (e.target.checked)
              onChange({ ...cmd, text_ref: x.p.texts[0]?.name ?? "" });
            else {
              const { text_ref: _drop, ...rest } = cmd;
              onChange(rest);
            }
          }}
        />
        Texte du catalogue (Tools → Textes) — modifiable au catalogue
        sans retoucher l'event
      </label>
      {fromCat ? (
        <>
          <label>
            Texte
            <select
              value={cmd.text_ref ?? ""}
              onChange={(e) => onChange({ ...cmd, text_ref: e.target.value })}
            >
              {x.p.texts.length === 0 && (
                <option value="">(catalogue vide)</option>
              )}
              {x.p.texts.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                  {t.cat ? ` — ${t.cat}` : ""}
                </option>
              ))}
              {cmd.text_ref && !catEntry && (
                <option value={cmd.text_ref}>{cmd.text_ref} (?)</option>
              )}
            </select>
          </label>
          {catEntry ? (
            <span className="hint">« {catEntry.text} »</span>
          ) : cmd.text_ref ? (
            <span className="hint">
              ⚠ texte « {cmd.text_ref} » introuvable au catalogue
            </span>
          ) : null}
        </>
      ) : (
        <label>
          Texte du message
          <textarea
            rows={3}
            value={cmd.text}
            autoFocus
            onChange={(e) => onChange({ ...cmd, text: e.target.value })}
          />
        </label>
      )}
      <span className="hint">
        {"Codes : \\v[n] variable · \\s[n] vitesse (frames/caractère, 0 = instantané) · \\. pause courte · \\| pause longue · \\! attendre A · \\^ ferme sans appui · \\>…\\< bloc instantané · \\\\ backslash"}
      </span>
      {x.styleField(cmd, (s) => onChange({ ...cmd, style: s }))}
    </>
  );
  return { body, valid };
}

export function formChoice(cmd: Extract<Command, { c: "choice" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.options.length >= 2 && cmd.options.every((o) => o.text.trim());
  body = (
    <>
      {cmd.options.map((o, i) => (
        <div className="row" key={i}>
          <label style={{ flex: 1 }}>
            Choix {i + 1}
            <input
              value={o.text}
              onChange={(e) => {
                const options = cmd.options.map((x, j) =>
                  j === i ? { ...x, text: e.target.value } : x
                );
                onChange({ ...cmd, options });
              }}
            />
          </label>
          <button
            className="browse danger"
            disabled={cmd.options.length <= 2}
            title="Retirer ce choix (et ses commandes)"
            onClick={() => onChange({ ...cmd, options: cmd.options.filter((_, j) => j !== i) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        disabled={cmd.options.length >= 4}
        onClick={() => onChange({ ...cmd, options: [...cmd.options, { text: "", do: [] }] })}
      >
        + Ajouter un choix
      </button>
      <p className="hint">Les commandes de chaque branche s'ajoutent ensuite sous « : Quand […] ».</p>
      {x.styleField(cmd, (s) => onChange({ ...cmd, style: s }))}
    </>
  );
  return { body, valid };
}

export function formSetAdd(cmd: Extract<Command, { c: "set" }> | Extract<Command, { c: "add" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = x.varOk(cmd.var);
  body = (
    <div className="row">
      {x.varField(cmd.var, (v) => onChange({ ...cmd, var: v }))}
      <label>
        {cmd.c === "set" ? "Valeur (=)" : "Ajouter (+)"}
        <input
          type="number"
          min={0}
          max={255}
          value={cmd.value}
          onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
        />
      </label>
    </div>
  );
  return { body, valid };
}

export function formIf(cmd: Extract<Command, { c: "if" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = x.varOk(cmd.var);
  body = (
    <div className="row">
      {x.varField(cmd.var, (v) => onChange({ ...cmd, var: v }))}
      <label>
        Opérateur
        <select
          value={cmd.op}
          onChange={(e) => onChange({ ...cmd, op: e.target.value as "==" | "!=" | ">=" })}
        >
          <option value="==">=</option>
          <option value="!=">≠</option>
          <option value=">=">≥</option>
        </select>
      </label>
      <label>
        Valeur
        <input
          type="number"
          min={0}
          max={255}
          value={cmd.value}
          onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
        />
      </label>
    </div>
  );
  return { body, valid };
}

export function formSwitch(cmd: Extract<Command, { c: "switch" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.n >= 0 && cmd.n < 512;
  body = (
    <div className="row">
      <label>
        Switch (0-511)
        <span className="row" style={{ gap: 4 }}>
          <input
            type="number" min={0} max={511} value={cmd.n} autoFocus
            onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
          />
          <button className="browse" title="Choisir dans la liste"
            onClick={() => x.p.onPickVar("switch", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
        </span>
        <span className="hint">{x.p.switchNames[cmd.n] || ""}</span>
      </label>
      <label>
        État
        <select
          value={cmd.on ? "on" : "off"}
          onChange={(e) => onChange({ ...cmd, on: e.target.value === "on" })}
        >
          <option value="on">ON</option>
          <option value="off">OFF</option>
        </select>
      </label>
    </div>
  );
  return { body, valid };
}

export function formVar(cmd: Extract<Command, { c: "var" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.n >= 0 && cmd.n < 256 && cmd.value >= -32768 && cmd.value <= 65535;
  body = (
    // alignItems flex-start: without it, a label that wraps onto two
    // lines pushes its field down and the row goes stair-stepped —
    // which is what happened to "N° de variable source"
    <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
      {/* F2b — the destination can be a LOCAL variable of the
          current function. Offered only when there are some:
          elsewhere it would name a frame that does not exist. */}
      {(x.p.fnLocals?.length ?? 0) > 0 && (
        <label style={{ flex: "0 0 auto" }}>
          Destination
          <select
            value={cmd.dst ?? "global"}
            onChange={(e) =>
              onChange({
                ...cmd,
                dst: e.target.value === "local" ? "local" : undefined,
                n: 0,
              })
            }
          >
            <option value="global">Variable du projet</option>
            <option value="local">Variable locale</option>
          </select>
        </label>
      )}
      {cmd.dst === "local" ? (
        <label>
          Variable locale
          <select
            value={cmd.n}
            onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
          >
            {(x.p.fnLocals ?? []).map((lname, k) => (
              <option key={k} value={k}>
                {k + 1}. {lname || "sans nom"}
              </option>
            ))}
          </select>
        </label>
      ) : (
      <label>
        Variable
        <span className="row" style={{ gap: 4 }}>
          <input
            type="number" min={0} max={255} value={cmd.n} autoFocus
            onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
          />
          <button className="browse" title="Choisir dans la liste"
            onClick={() => x.p.onPickVar("var", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
        </span>
        <span className="hint">{x.p.varNames[cmd.n] || ""}</span>
      </label>
      )}
      <label>
        Opération
        <select
          value={cmd.op}
          onChange={(e) => onChange({ ...cmd, op: e.target.value as VarOp })}
        >
          <option value="=">= (affecter)</option>
          <option value="+">+ (ajouter)</option>
          <option value="-">− (soustraire)</option>
          <option value="*">× (multiplier)</option>
          <option value="/">÷ (diviser)</option>
          <option value="%">mod (reste)</option>
          <option value="rand">hasard 0..N</option>
        </select>
      </label>
      {/* The SHARED "source + value" block, not a local copy.
          The copy that used to live here changed `from` without
          resetting `value`: going from "variable n° 1" to "un
          paramètre" left the value at 1, so the command asked for
          the 2nd parameter of a function that has only one. The
          build failed, and the form showed nothing
          unusual. One implementation, one behaviour. */}
      <ValueSourceFields
        v={{ from: cmd.from, value: cmd.value }}
        fnParams={x.p.fnParams}
        fnLocals={x.p.fnLocals}
        varNames={x.p.varNames}
        onPickVar={x.p.onPickVar}
        onChange={(v) => onChange({ ...cmd, from: v.from, value: v.value })}
      />
    </div>
  );
  return { body, valid };
}

export function formIfSw(cmd: Extract<Command, { c: "if_sw" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.n >= 0 && cmd.n < 512;
  body = (
    <div className="row">
      <label>
        Switch (0-511)
        <span className="row" style={{ gap: 4 }}>
          <input
            type="number" min={0} max={511} value={cmd.n} autoFocus
            onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
          />
          <button className="browse" title="Choisir dans la liste"
            onClick={() => x.p.onPickVar("switch", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
        </span>
        <span className="hint">{x.p.switchNames[cmd.n] || ""}</span>
      </label>
      <label>
        Est
        <select
          value={cmd.on ? "on" : "off"}
          onChange={(e) => onChange({ ...cmd, on: e.target.value === "on" })}
        >
          <option value="on">ON</option>
          <option value="off">OFF</option>
        </select>
      </label>
    </div>
  );
  return { body, valid };
}

export function formIfVar(cmd: Extract<Command, { c: "if_var" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  // Both sides go through the same "source + value" block as
  // everywhere else: comparing a parameter with a constant, or two
  // variables with each other, no longer requires copying anything
  // into a global variable first.
  const left = cmd.left ?? { from: "var" as const, value: cmd.n };
  const right = cmd.right ?? { value: cmd.value };
  valid =
    (left.from !== "var" || (left.value >= 0 && left.value < 256)) &&
    (right.from !== "var" || (right.value >= 0 && right.value < 256));
  body = (
    <>
      <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <span style={{ alignSelf: "center", flex: "0 0 auto" }}>Si</span>
        <ValueSourceFields
          v={left}
          fnParams={x.p.fnParams}
          fnLocals={x.p.fnLocals}
          varNames={x.p.varNames}
          onPickVar={x.p.onPickVar}
          onChange={(v) => onChange({ ...cmd, left: v })}
        />
        <label style={{ flex: "0 0 auto" }}>
          Opérateur
          <select
            value={cmd.op}
            onChange={(e) =>
              onChange({ ...cmd, op: e.target.value as "==" | "!=" | ">=" })
            }
          >
            <option value="==">=</option>
            <option value="!=">≠</option>
            <option value=">=">≥</option>
          </select>
        </label>
      </div>
      <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <span style={{ alignSelf: "center", flex: "0 0 auto" }}>à</span>
        <ValueSourceFields
          v={right}
          fnParams={x.p.fnParams}
          fnLocals={x.p.fnLocals}
          varNames={x.p.varNames}
          onPickVar={x.p.onPickVar}
          onChange={(v) => onChange({ ...cmd, right: v })}
        />
      </div>
    </>
  );
  return { body, valid };
}

export function formRoute(cmd: Extract<Command, { c: "route" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.steps.length > 0;
  body = (
    <>
      <span className="hint">
        {cmd.event < 0 ? "Cet event" : x.p.entryNames[cmd.event] ?? `event ${cmd.event}`} —{" "}
        {cmd.steps.length} pas{cmd.repeat ? ", répété" : ""}
        {cmd.skip ? ", ignore si bloqué" : ""}. L'itinéraire part en
        tâche de fond : le séquencer avec « Attendre la fin des
        déplacements ».
      </span>
      <button onClick={() => x.setRouteOpen(true)}>Modifier l'itinéraire…</button>
      {x.routeOpen && (
        <MoveRouteModal
          cmd={cmd}
          eventNames={x.p.entryNames}
          switchNames={x.p.switchNames}
          charsetNames={x.p.charsetNames}
          onClose={() => x.setRouteOpen(false)}
          onOk={(c) => {
            onChange(c);
            x.setRouteOpen(false);
          }}
        />
      )}
    </>
  );
  return { body, valid };
}

export function formWaitRoute(_cmd: Extract<Command, { c: "wait_route" }>, _x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  body = (
    <span className="hint">
      Bloque le script jusqu'à la fin de tous les itinéraires (les
      itinéraires « répétés » ne sont pas attendus).
    </span>
  );
  return { body, valid };
}

export function formWait(cmd: Extract<Command, { c: "wait" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.frames >= 1 && cmd.frames <= 255;
  body = (
    <label>
      Durée (frames, 60 = 1 seconde)
      <input
        type="number" min={1} max={255} value={cmd.frames} autoFocus
        onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
      />
    </label>
  );
  return { body, valid };
}

export function formTimer(cmd: Extract<Command, { c: "timer" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.op !== "start" || ((cmd.secs ?? 0) >= 1 && (cmd.secs ?? 0) <= 5999);
  body = (
    <div className="row">
      <label>
        Action
        <select
          value={cmd.op}
          onChange={(e) => onChange({ ...cmd, op: e.target.value as "start" | "stop" | "show" | "hide" })}
        >
          <option value="start">Régler et démarrer</option>
          <option value="stop">Arrêter</option>
          <option value="show">Afficher (coin haut-droit)</option>
          <option value="hide">Cacher</option>
        </select>
      </label>
      {cmd.op === "start" && (
        <label>
          Secondes (1-5999)
          <input
            type="number" min={1} max={5999} value={cmd.secs ?? 60}
            onChange={(e) => onChange({ ...cmd, secs: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
  return { body, valid };
}

export function formCampan(cmd: Extract<Command, { c: "campan" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <div className="row">
      <label>
        Tile x
        <input type="number" min={0} max={254} value={cmd.x}
          onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
      </label>
      <label>
        Tile y
        <input type="number" min={0} max={254} value={cmd.y}
          onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
      </label>
      <label>
        Vitesse (px/frame)
        <input type="number" min={1} max={8} value={cmd.speed}
          onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })} />
      </label>
      <span className="hint">Non bloquant — enchaîner avec « Attendre la caméra ».</span>
    </div>
  );
  return { body, valid };
}

export function formCamReturn(cmd: Extract<Command, { c: "cam_return" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <label>
      Vitesse (px/frame)
      <input type="number" min={1} max={8} value={cmd.speed}
        onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })} />
    </label>
  );
  return { body, valid };
}

export function formWaitCam(_cmd: Extract<Command, { c: "wait_cam" }>, _x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  body = <span className="hint">Bloque le script jusqu'à la fin du pan caméra.</span>;
  return { body, valid };
}

export function formLoop(_cmd: Extract<Command, { c: "loop" }>, _x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  body = (
    <span className="hint">
      Les commandes ajoutées entre « Boucle » et « : Fin de boucle »
      se répètent pour toujours — en sortir avec « Sortir de la
      boucle » (ou Téléporter le héros).
    </span>
  );
  return { body, valid };
}

export function formBreak(_cmd: Extract<Command, { c: "break" }>, _x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  body = (
    <span className="hint">
      Saute à la fin de la boucle la plus proche. Hors d'une boucle,
      datagen refusera la scène.
    </span>
  );
  return { body, valid };
}

export function formRem(cmd: Extract<Command, { c: "rem" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <label>
      Commentaire (jamais affiché en jeu)
      <textarea
        rows={3}
        value={cmd.text}
        autoFocus
        onChange={(e) => onChange({ ...cmd, text: e.target.value })}
      />
    </label>
  );
  return { body, valid };
}

export function formHeroLocWarpVar(cmd: Extract<Command, { c: "hero_loc" }> | Extract<Command, { c: "warp_var" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const triple: { key: "vs" | "vx" | "vy"; label: string }[] = [
    { key: "vs", label: "Variable scène" },
    { key: "vx", label: "Variable X (tiles)" },
    { key: "vy", label: "Variable Y (tiles)" },
  ];
  valid = triple.every((t) => cmd[t.key] >= 0 && cmd[t.key] < 256);
  body = (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {triple.map((t) => (
          <label key={t.key}>
            {t.label}
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={255} value={cmd[t.key]}
                onChange={(e) => onChange({ ...cmd, [t.key]: Number(e.target.value) })}
              />
              <button className="browse" title="Choisir dans la liste"
                onClick={() => x.p.onPickVar("var", cmd[t.key], (n) => onChange({ ...cmd, [t.key]: n }))}>…</button>
            </span>
            <span className="hint">{x.p.varNames[cmd[t.key]] || ""}</span>
          </label>
        ))}
        {cmd.c === "warp_var" && (
          <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
        )}
      </div>
      <span className="hint">
        {cmd.c === "hero_loc"
          ? "Écrit la scène courante et la tile du héros dans ces trois variables (à rappeler avec « Téléporter aux variables »)."
          : "Téléporte le héros à la scène et la tile lues dans ces trois variables — termine le script, comme un warp."}
      </span>
    </>
  );
  return { body, valid };
}

export function formSetpos(cmd: Extract<Command, { c: "setpos" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.x >= 0 && cmd.x <= 254 && cmd.y >= 0 && cmd.y <= 254;
  body = (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <label style={{ flex: 2 }}>
        Event
        <select
          value={cmd.event}
          onChange={(e) => onChange({ ...cmd, event: Number(e.target.value) })}
        >
          <option value={-1}>Cet event</option>
          {x.p.entryNames.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Coordonnées
        <select
          value={cmd.from}
          onChange={(e) => onChange({ ...cmd, from: e.target.value as "const" | "vars" })}
        >
          <option value="const">Constantes (tiles)</option>
          <option value="vars">Dans des variables</option>
        </select>
      </label>
      <label>
        {cmd.from === "vars" ? "Variable X" : "x"}
        <span className="row" style={{ gap: 4 }}>
          <input
            type="number" min={0} max={cmd.from === "vars" ? 255 : 254} value={cmd.x}
            onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })}
          />
          {cmd.from === "vars" && (
            <button className="browse" title="Choisir dans la liste"
              onClick={() => x.p.onPickVar("var", cmd.x, (n) => onChange({ ...cmd, x: n }))}>…</button>
          )}
        </span>
      </label>
      <label>
        {cmd.from === "vars" ? "Variable Y" : "y"}
        <span className="row" style={{ gap: 4 }}>
          <input
            type="number" min={0} max={cmd.from === "vars" ? 255 : 254} value={cmd.y}
            onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })}
          />
          {cmd.from === "vars" && (
            <button className="browse" title="Choisir dans la liste"
              onClick={() => x.p.onPickVar("var", cmd.y, (n) => onChange({ ...cmd, y: n }))}>…</button>
          )}
        </span>
      </label>
    </div>
  );
  return { body, valid };
}

export function formSwappos(cmd: Extract<Command, { c: "swappos" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.a !== cmd.b;
  body = (
    <div className="row">
      {(["a", "b"] as const).map((k) => (
        <label key={k} style={{ flex: 1 }}>
          {k === "a" ? "Event A" : "Event B"}
          <select
            value={cmd[k]}
            onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
          >
            <option value={-1}>Cet event</option>
            {x.p.entryNames.map((n, i) => (
              <option key={i} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
  return { body, valid };
}

export function formKeyInput(cmd: Extract<Command, { c: "key_input" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.keys.length > 0;
  const KEY_NAMES: [number, string][] = [
    [1, "Bas (1)"], [2, "Gauche (2)"], [3, "Droite (3)"], [4, "Haut (4)"],
    [5, "A — valider (5)"], [6, "B — annuler (6)"], [7, "Y (7)"], [8, "X (8)"],
    [9, "L (9)"], [10, "R (10)"], [11, "Select (11)"], [12, "Start (12)"],
  ];
  body = (
    <>
      <label>
        Variable destination (reçoit le code, 0 = aucune touche)
        <div className="row" style={{ gap: 4 }}>
          <input type="number" min={0} max={255} value={cmd.var} autoFocus
            onChange={(e) => onChange({ ...cmd, var: Number(e.target.value) })} />
          <button className="browse"
            onClick={() => x.p.onPickVar("var", cmd.var, (n) => onChange({ ...cmd, var: n }))}>
            …
          </button>
        </div>
        <span className="hint">{x.p.varNames[cmd.var] || ""}</span>
      </label>
      <label className="checkline">
        <input type="checkbox" checked={cmd.wait}
          onChange={(e) => onChange({ ...cmd, wait: e.target.checked })} />
        Attendre l'appui d'une touche (sinon : lecture immédiate)
      </label>
      <fieldset className="evedit-box">
        <legend>Touches autorisées</legend>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {KEY_NAMES.map(([code, name]) => (
            <label className="checkline" key={code}>
              <input type="checkbox" checked={cmd.keys.includes(code)}
                onChange={(e) =>
                  onChange({
                    ...cmd,
                    keys: e.target.checked
                      ? [...cmd.keys, code].sort((a, b) => a - b)
                      : cmd.keys.filter((k) => k !== code),
                  })
                } />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <span className="hint">
        Façon RM2003 : le code de la touche est écrit dans la variable.
        En « attendre », le script bloque jusqu'à un appui NEUF d'une
        touche cochée.
      </span>
    </>
  );
  return { body, valid };
}

export function formSysmenu(_cmd: Extract<Command, { c: "sysmenu" }>, _x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  body = (
    <span className="hint">
      Ouvre le menu Système (sauvegarder/charger) quand le script se
      termine. Le mapping START en dur a été retiré : mappe ta touche
      avec « Touche pressée » + une condition, ou appelle cette
      commande où tu veux.
    </span>
  );
  return { body, valid };
}

export function formPicShow(cmd: Extract<Command, { c: "pic_show" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.pic_var !== undefined || cmd.pic !== "";
  const posMode =
    cmd.x_var !== undefined
      ? "vars"
      : cmd.x !== undefined || cmd.y !== undefined
        ? "xy"
        : "center";
  const cut = (cmd.fade === false && cmd.dur === undefined) || cmd.dur === 0;
  body = (
    <>
      <label>
        Image (Gestionnaire de ressources → Picture)
        <select
          value={cmd.pic} autoFocus
          onChange={(e) => onChange({ ...cmd, pic: e.target.value })}
        >
          <option value="">(choisir)</option>
          {x.p.pictures.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
          {cmd.pic && !x.p.pictures.includes(cmd.pic) && (
            <option value={cmd.pic}>{cmd.pic} (?)</option>
          )}
        </select>
      </label>
      <label>
        Position à l'écran
        <select
          value={posMode}
          onChange={(e) => {
            const m = e.target.value;
            if (m === "center")
              onChange({ ...cmd, x: undefined, y: undefined, x_var: undefined, y_var: undefined });
            else if (m === "xy")
              onChange({ ...cmd, x: cmd.x ?? 0, y: cmd.y ?? 0, x_var: undefined, y_var: undefined });
            else
              onChange({ ...cmd, x: undefined, y: undefined, x_var: cmd.x_var ?? 0, y_var: cmd.y_var ?? 1 });
          }}
        >
          <option value="center">Centrée</option>
          <option value="xy">Position X/Y (pixels)</option>
          <option value="vars">Position lue dans des variables</option>
        </select>
      </label>
      {posMode === "xy" && (
        <div className="row">
          <label>
            X (0-255)
            <input type="number" min={0} max={255} value={cmd.x ?? 0}
              onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
          </label>
          <label>
            Y (0-216)
            <input type="number" min={0} max={216} value={cmd.y ?? 0}
              onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
          </label>
        </div>
      )}
      {posMode === "vars" && (
        <div className="row">
          <label>
            Variable X (0-255)
            <input type="number" min={0} max={255} value={cmd.x_var ?? 0}
              onChange={(e) => onChange({ ...cmd, x_var: Number(e.target.value) })} />
          </label>
          <label>
            Variable Y (0-255)
            <input type="number" min={0} max={255} value={cmd.y_var ?? 1}
              onChange={(e) => onChange({ ...cmd, y_var: Number(e.target.value) })} />
          </label>
        </div>
      )}
      <label>
        Transition
        <select
          value={cut ? "cut" : "fade"}
          onChange={(e) =>
            onChange({ ...cmd, fade: undefined, dur: e.target.value === "cut" ? 0 : 16 })
          }
        >
          <option value="fade">Fondu</option>
          <option value="cut">Instantanée</option>
        </select>
      </label>
      {!cut && (
        <label>
          Durée du fondu (frames — 60 = 1 seconde)
          <input type="number" min={1} max={255} value={cmd.dur ?? 16}
            onChange={(e) =>
              onChange({ ...cmd, fade: undefined, dur: Number(e.target.value) })
            } />
        </label>
      )}
      <label>
        Mélange avec le décor
        <select
          value={cmd.blend ?? "none"}
          onChange={(e) =>
            onChange({
              ...cmd,
              blend:
                e.target.value === "none"
                  ? undefined
                  : (e.target.value as "half" | "add" | "sub"),
            })
          }
        >
          <option value="none">Normal (opaque)</option>
          <option value="half">Semi-transparent (50 %)</option>
          <option value="add">Additif (lueur)</option>
          <option value="sub">Soustractif (ombre)</option>
        </select>
      </label>
      <span className="hint">
        Les messages et choix se jouent PAR-DESSUS l'image et restent
        nets même en mélange. Le mélange fond l'image avec le décor
        (circuit couleur de la console) et suspend la teinte d'écran
        le temps de l'image. Refermer avec « Effacer l'image » dans le
        même script.
      </span>
    </>
  );
  return { body, valid };
}

export function formPicMove(cmd: Extract<Command, { c: "pic_move" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const posMode = cmd.x_var !== undefined ? "vars" : "xy";
  body = (
    <>
      <label>
        Nouvelle position
        <select
          value={posMode}
          onChange={(e) =>
            onChange(
              e.target.value === "vars"
                ? { ...cmd, x: undefined, y: undefined, x_var: cmd.x_var ?? 0, y_var: cmd.y_var ?? 1 }
                : { ...cmd, x: cmd.x ?? 0, y: cmd.y ?? 0, x_var: undefined, y_var: undefined }
            )
          }
        >
          <option value="xy">Position X/Y (pixels)</option>
          <option value="vars">Position lue dans des variables</option>
        </select>
      </label>
      {posMode === "xy" ? (
        <div className="row">
          <label>
            X (0-255)
            <input type="number" min={0} max={255} value={cmd.x ?? 0} autoFocus
              onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
          </label>
          <label>
            Y (0-216)
            <input type="number" min={0} max={216} value={cmd.y ?? 0}
              onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
          </label>
        </div>
      ) : (
        <div className="row">
          <label>
            Variable X (0-255)
            <input type="number" min={0} max={255} value={cmd.x_var ?? 0}
              onChange={(e) => onChange({ ...cmd, x_var: Number(e.target.value) })} />
          </label>
          <label>
            Variable Y (0-255)
            <input type="number" min={0} max={255} value={cmd.y_var ?? 1}
              onChange={(e) => onChange({ ...cmd, y_var: Number(e.target.value) })} />
          </label>
        </div>
      )}
      <label>
        Durée du déplacement (frames — 0 = immédiat, 60 = 1 seconde)
        <input type="number" min={0} max={255} value={cmd.dur ?? 30}
          onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })} />
      </label>
      <span className="hint">
        Glisse l'image affichée vers la cible SANS bloquer le script
        (façon Move Picture RM2003) — enchaîne avec « Attendre » si tu
        veux attendre la fin. Sans image affichée : ignoré.
      </span>
    </>
  );
  return { body, valid };
}

export function formPicHide(cmd: Extract<Command, { c: "pic_hide" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const cut = (cmd.fade === false && cmd.dur === undefined) || cmd.dur === 0;
  body = (
    <>
      <label>
        Transition
        <select
          value={cut ? "cut" : "fade"}
          onChange={(e) =>
            onChange({ ...cmd, fade: undefined, dur: e.target.value === "cut" ? 0 : 16 })
          }
        >
          <option value="fade">Fondu</option>
          <option value="cut">Instantanée</option>
        </select>
      </label>
      {!cut && (
        <label>
          Durée du fondu (frames — 60 = 1 seconde)
          <input type="number" min={1} max={255} value={cmd.dur ?? 16}
            onChange={(e) =>
              onChange({ ...cmd, fade: undefined, dur: Number(e.target.value) })
            } />
        </label>
      )}
      <span className="hint">
        Referme l'image et rend l'écran au jeu — carte, personnages et
        états inchangés. Sans image affichée : ignoré.
      </span>
    </>
  );
  return { body, valid };
}

export function formUiShow(cmd: Extract<Command, { c: "ui_show" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.widget !== "";
  body = (
    <>
      <label>
        Widget (racines de ui/layout.toml — fenêtre UI)
        <select
          value={cmd.widget} autoFocus
          onChange={(e) => onChange({ ...cmd, widget: e.target.value })}
        >
          <option value="">(choisir)</option>
          {x.p.uiWidgets.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>
      <label>
        Action
        <select
          value={cmd.on ? "on" : "off"}
          onChange={(e) => onChange({ ...cmd, on: e.target.value === "on" })}
        >
          <option value="on">Afficher</option>
          <option value="off">Cacher</option>
        </select>
      </label>
      <span className="hint">
        Les widgets sont CACHÉS au démarrage (sauf « Visible au démarrage »
        dans la fenêtre UI) — cette commande les affiche ou les cache.
      </span>
    </>
  );
  return { body, valid };
}

export function formListSelect(cmd: Extract<Command, { c: "list_select" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.widget !== "";
  body = (
    <>
      <label>
        Widget liste (fenêtre UI — type « Liste (curseur) »)
        <select
          value={cmd.widget} autoFocus
          onChange={(e) => onChange({ ...cmd, widget: e.target.value })}
        >
          <option value="">(choisir)</option>
          {x.p.uiWidgets.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>
      <label>
        Variable destination (index choisi, 0 = premier item)
        <div className="row" style={{ gap: 4 }}>
          <input type="number" min={0} max={255} value={cmd.var}
            onChange={(e) => onChange({ ...cmd, var: Number(e.target.value) })} />
          <button className="browse"
            onClick={() => x.p.onPickVar("var", cmd.var, (n) => onChange({ ...cmd, var: n }))}>
            …
          </button>
        </div>
        <span className="hint">{x.p.varNames[cmd.var] || ""}</span>
      </label>
      <label className="checkline">
        <input type="checkbox" checked={cmd.cancel}
          onChange={(e) => onChange({ ...cmd, cancel: e.target.checked })} />
        B annule (la variable reçoit 255)
      </label>
      <label className="checkline">
        <input type="checkbox" checked={cmd.keep ?? false}
          onChange={(e) => onChange({ ...cmd, keep: e.target.checked || undefined })} />
        Laisser le widget affiché à la fermeture (multi-panneaux)
      </label>
      <label className="checkline">
        <input type="checkbox" checked={cmd.lr ?? false}
          onChange={(e) => onChange({ ...cmd, lr: e.target.checked || undefined })} />
        Gauche/Droite quittent la liste (254 = gauche, 253 = droite)
      </label>
      <span className="hint">
        BLOQUANT : le menu s'ouvre (le widget est affiché), haut/bas
        naviguent avec bouclage, A valide (index : 0 = premier item).
        Multi-panneaux : cocher les deux cases, tester 253/254 dans une
        condition et enchaîner sur la liste voisine — le widget resté
        affiché n'a plus de curseur, cacher avec « Afficher/cacher un
        widget UI » quand le menu se ferme pour de bon.
      </span>
    </>
  );
  return { body, valid };
}

export function formScrHideScrShow(cmd: Extract<Command, { c: "scr_hide" }> | Extract<Command, { c: "scr_show" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const fr = cmd.frames ?? Math.ceil(15 / (cmd.speed || 15));
  valid = fr >= 1 && fr <= 255;
  body = (
    <>
      <div className="row">
        <label>
          Durée (frames, 60 = 1 seconde)
          <input
            type="number" min={1} max={255} value={fr} autoFocus
            onChange={(e) =>
              onChange({ ...cmd, frames: Number(e.target.value), speed: undefined })
            }
          />
        </label>
        <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
      </div>
      <span className="hint">
        {cmd.c === "scr_hide"
          ? "Cache l'écran — bloque le script jusqu'au noir complet. L'écran reste caché jusqu'à « Montrer l'écran » (un téléport le rallume)."
          : "Montre l'écran — bloque le script jusqu'à la pleine luminosité."}
      </span>
    </>
  );
  return { body, valid };
}

export function formTint(cmd: Extract<Command, { c: "tint" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = [cmd.r, cmd.g, cmd.b].every((v) => v >= 0 && v <= 31);
  body = (
    <>
      <label>
        Preset (remplit les champs)
        <select
          value=""
          onChange={(e) => {
            const std: Record<string, { mode: "off" | "add" | "sub"; r: number; g: number; b: number }> = {
              "*jour": { mode: "off", r: 0, g: 0, b: 0 },
              "*matin": { mode: "sub", r: 6, g: 3, b: 0 },
              "*soir": { mode: "sub", r: 0, g: 6, b: 14 },
              "*nuit": { mode: "sub", r: 16, g: 12, b: 4 },
            };
            const v = e.target.value;
            if (std[v]) {
              onChange({ ...cmd, ...std[v] });
              return;
            }
            const p = x.p.tintPresets.find((t) => t.name === v);
            if (p) onChange({ ...cmd, mode: p.mode, r: p.r, g: p.g, b: p.b });
          }}
        >
          <option value="">(choisir un preset…)</option>
          <optgroup label="Standards">
            <option value="*matin">Matin (bleuté pâle)</option>
            <option value="*jour">Jour (normale)</option>
            <option value="*soir">Soir (orangé)</option>
            <option value="*nuit">Nuit (bleu sombre)</option>
          </optgroup>
          {x.p.tintPresets.length > 0 && (
            <optgroup label="Du projet">
              {x.p.tintPresets.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="row">
        <label>
          Enregistrer les valeurs comme preset
          <input
            value={x.presetName}
            onChange={(e) => x.setPresetName(e.target.value)}
            placeholder="ex. Crépuscule violet"
            maxLength={24}
          />
        </label>
        <button
          disabled={x.presetName.trim() === ""}
          title="Enregistre mode + RGB actuels sous ce nom (écrase un preset du même nom) — stocké dans le projet"
          onClick={() => {
            const name = x.presetName.trim();
            x.p.onTintPresets([
              ...x.p.tintPresets.filter((t) => t.name !== name),
              { name, mode: cmd.mode, r: cmd.r, g: cmd.g, b: cmd.b },
            ]);
            x.setPresetName("");
          }}
        >
          💾 Enregistrer
        </button>
      </div>
      {x.p.tintPresets.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
          {x.p.tintPresets.map((p) => (
            <button
              key={p.name}
              title={`Supprimer le preset « ${p.name} » du projet`}
              onClick={() =>
                x.p.onTintPresets(x.p.tintPresets.filter((t) => t.name !== p.name))
              }
            >
              🗑 {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ flexWrap: "wrap" }}>
        <label>
          Mode
          <select
            value={cmd.mode}
            onChange={(e) => onChange({ ...cmd, mode: e.target.value as "off" | "add" | "sub" })}
          >
            <option value="off">Normale (retirer la teinte)</option>
            <option value="add">Éclaircir (+)</option>
            <option value="sub">Assombrir (−)</option>
          </select>
        </label>
        {cmd.mode !== "off" &&
          (["r", "g", "b"] as const).map((k) => (
            <label key={k}>
              {k.toUpperCase()} (0-31)
              <input
                type="number" min={0} max={31} value={cmd[k]}
                onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
      </div>
      <label>
        Transition (frames — 0 = immédiate, 180 = 3 secondes)
        <input
          type="number" min={0} max={255} value={cmd.dur ?? 0}
          onChange={(e) =>
            onChange({ ...cmd, dur: Number(e.target.value) || undefined })
          }
        />
      </label>
      <span className="hint">
        Persiste entre les scènes ; la transition graduelle (S12) est
        NON bloquante — enchaîner avec « Attendre » pour la laisser
        finir. Teinte le décor, pas les personnages ni le texte
        (limite hardware). Suspendue à l'écran pendant un mélange de
        couche d'effet ou d'image.
      </span>
    </>
  );
  return { body, valid };
}

export function formWave(cmd: Extract<Command, { c: "wave" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Amplitude (px — 0 = arrêter)
          <select
            value={cmd.power}
            onChange={(e) => onChange({ ...cmd, power: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
              <option key={v} value={v}>{v === 0 ? "0 (stop)" : v}</option>
            ))}
          </select>
        </label>
        {cmd.power > 0 && (
          <label>
            Vitesse de la houle (1-8)
            <input
              type="number" min={1} max={8} value={cmd.speed ?? 2}
              onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <span className="hint">
        L'écran ondule ligne par ligne (chaleur du désert, sous l'eau,
        rêve) — non bloquant, persiste entre les scènes jusqu'à
        « 0 (stop) ». Le DÉCOR ondule ; les personnages, le texte
        et le HUD restent droits (les sprites ne passent pas par les
        scrolls — matériel). Suspendue pendant une image plein
        écran.
      </span>
    </>
  );
  return { body, valid };
}

export function formSkygrad(cmd: Extract<Command, { c: "skygrad" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Mode
        <select
          value={cmd.mode}
          onChange={(e) => onChange({ ...cmd, mode: e.target.value as "off" | "add" | "sub" })}
        >
          <option value="off">Retirer le dégradé</option>
          <option value="add">Éclaircir (+)</option>
          <option value="sub">Assombrir (−)</option>
        </select>
      </label>
      {cmd.mode !== "off" && (
        <>
          <div className="row">
            <span style={{ alignSelf: "center", minWidth: 110 }}>Haut de l'écran</span>
            {(["r", "g", "b"] as const).map((k) => (
              <label key={k}>
                {k.toUpperCase()} (0-31)
                <input
                  type="number" min={0} max={31} value={cmd[k]}
                  onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <div className="row">
            <span style={{ alignSelf: "center", minWidth: 110 }}>Bas de l'écran</span>
            {(["r2", "g2", "b2"] as const).map((k) => (
              <label key={k}>
                {k[0].toUpperCase()} (0-31)
                <input
                  type="number" min={0} max={31} value={cmd[k]}
                  onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </>
      )}
      <span className="hint">
        Teinte VERTICALE (coucher de soleil, aube, profondeur) : la
        couleur évolue du haut vers le bas de l'écran, ligne par
        ligne. Remplace la teinte plate — et « Teinter l'écran »
        retire le dégradé (même circuit console). Le décor est
        teinté, pas les personnages ni le texte. Persiste entre les
        scènes ; en pause pendant un mélange (couche d'effet /
        image) ou un flash. Immédiat, non bloquant, aucun coût en
        jeu (table calculée à la commande).
      </span>
    </>
  );
  return { body, valid };
}

export function formSpotlight(cmd: Extract<Command, { c: "spotlight" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Rayon du cercle (px — 0 = arrêter)
          <select
            value={cmd.radius}
            onChange={(e) => onChange({ ...cmd, radius: Number(e.target.value) })}
          >
            <option value={0}>0 (arrêter)</option>
            {[24, 32, 40, 48, 64, 80, 96].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        {cmd.radius > 0 && (
          <label>
            Obscurité (1-31 — 31 = noir total)
            <input
              type="number" min={1} max={31} value={cmd.dark ?? 31}
              onChange={(e) => onChange({ ...cmd, dark: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <span className="hint">
        Cercle de lumière qui SUIT le héros (grotte, nuit, torche) :
        le décor est assombri hors du cercle. Remplace la teinte et
        le dégradé — et « Teinter l'écran » retire le spotlight
        (même circuit console). Les personnages et le texte restent
        visibles partout (limite matérielle, comme la teinte).
        Immédiat, non bloquant, persiste entre les scènes.
      </span>
    </>
  );
  return { body, valid };
}

export function formScreen(cmd: Extract<Command, { c: "screen" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Écran (Tools → Écrans composés)
          <select
            value={cmd.name}
            onChange={(e) => onChange({ ...cmd, name: e.target.value })}
          >
            <option value="">(choisir un écran…)</option>
            {x.p.screenNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Fondu (frames par sens)
          <input
            type="number" min={0} max={255} value={cmd.dur ?? 20}
            onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })}
          />
        </label>
        <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
      </div>
      <span className="hint">
        Ouvre l'écran composé dessiné dans Tools → Écrans composés :
        son fond, ses images posées, puis son script. Équivaut à la
        suite Ouvrir + Poser + … écrite à la main — mais composée à
        la souris. L'écran se referme par « Fermer l'écran
        composé » (dans son script, ou après).
      </span>
    </>
  );
  return { body, valid };
}

export function formScreenCall(cmd: Extract<Command, { c: "screen_call" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Script de l'écran
        {x.p.screenScriptNames ? (
          <select
            value={cmd.script}
            onChange={(e) => onChange({ ...cmd, script: e.target.value })}
          >
            <option value="">(choisir…)</option>
            {x.p.screenScriptNames.slice(1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : (
          <input
            value={cmd.script}
            placeholder="nom du script"
            onChange={(e) => onChange({ ...cmd, script: e.target.value })}
          />
        )}
      </label>
      <span className="hint">
        Joue un AUTRE script du même écran composé (tes
        sous-routines locales : tour_joueur, victoire…) — comme
        « Appeler un common event », mais rangé dans l'écran.
        Valable uniquement depuis un script d'écran (le build le
        vérifie).
      </span>
    </>
  );
  return { body, valid };
}

export function formStageOpen(cmd: Extract<Command, { c: "stage_open" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Fond (image plein écran, opaque de préférence)
          <select
            value={cmd.pic}
            onChange={(e) => onChange({ ...cmd, pic: e.target.value })}
          >
            <option value="">(aucun — fond noir)</option>
            {x.p.pictures.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Fondu (frames par sens — 0 = instantané)
          <input
            type="number" min={0} max={255} value={cmd.dur ?? 20}
            onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })}
          />
        </label>
        <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
      </div>
      <span className="hint">
        Remplace la vue de la scène par un ÉCRAN COMPOSÉ : le fond
        sur une couche, jusqu'à 5 images posées par-dessus (slots),
        les dialogues et widgets par-dessus tout. C'est l'écran de
        combat façon FF (fond + monstres) — ou un plateau, une carte,
        une scène illustrée. Les personnages de la map sont cachés
        le temps de l'écran. Fermer l'écran restaure la scène ET sa
        musique (les PNJ déplacés reviennent à leur position de
        page, comme après une téléportation).
      </span>
    </>
  );
  return { body, valid };
}

export function formStagePose(cmd: Extract<Command, { c: "stage_pose" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Slot (1-5)
          <select
            value={cmd.slot}
            onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Image (à transparence pour un monstre)
          <select
            value={cmd.pic}
            onChange={(e) => onChange({ ...cmd, pic: e.target.value })}
          >
            <option value="">(choisir une image…)</option>
            {x.p.pictures.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          X (px, arrondi à 8)
          <input
            type="number" min={0} max={255} step={8} value={cmd.x}
            onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })}
          />
        </label>
        <label>
          Y (px, arrondi à 8)
          <input
            type="number" min={0} max={216} step={8} value={cmd.y}
            onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })}
          />
        </label>
      </div>
      <span className="hint">
        Pose l'image sur l'écran composé, avec SA palette (une par
        slot — le clignotement d'un monstre ne touche pas les
        autres). L'image apparaît en quelques frames (transfert
        progressif), le script attend la fin. Re-poser la même
        image dans le même slot = déplacement instantané. Budget
        partagé : ~511 tuiles pour l'écran — au-delà, la pose est
        ignorée (simplifier les images, ou fermer/rouvrir).
        Éviter le chevauchement de deux images (couche unique).
      </span>
    </>
  );
  return { body, valid };
}

export function formStageClear(cmd: Extract<Command, { c: "stage_clear" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Slot à retirer (1-5)
        <select
          value={cmd.slot}
          onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </label>
      <span className="hint">
        Efface l'image du slot (mort d'un monstre, objet ramassé).
        Re-poser la même image plus tard ne recoûte rien.
      </span>
    </>
  );
  return { body, valid };
}

export function formSlotFx(cmd: Extract<Command, { c: "slot_fx" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Slot (1-5)
          <select
            value={cmd.slot}
            onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Effet
          <select
            value={cmd.fx}
            onChange={(e) =>
              onChange({ ...cmd, fx: e.target.value as "restore" | "flash" | "fadeout" | "dark" })
            }
          >
            <option value="flash">Flash blanc (attaque)</option>
            <option value="fadeout">Fondu au noir (mort)</option>
            <option value="dark">Assombrir (état)</option>
            <option value="restore">Restaurer les couleurs</option>
          </select>
        </label>
        {(cmd.fx === "flash" || cmd.fx === "fadeout") && (
          <label>
            Durée (frames)
            <input
              type="number" min={1} max={255}
              value={cmd.frames ?? (cmd.fx === "flash" ? 6 : 30)}
              onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <span className="hint">
        Manipule la PALETTE de l'image du slot — les autres images
        et le fond ne bougent pas (une palette par slot). Flash =
        le monstre attaque ou encaisse ; fondu au noir = mort
        (enchaîner avec « Retirer une image ») ; assombrir =
        poison, pierre (cumulable) ; restaurer = fin d'état. Non
        bloquant — enchaîner avec « Attendre ».
      </span>
    </>
  );
  return { body, valid };
}

// "Zoom cinematique" (M7-A3). The words "Mode 7" never appear: it is an
// implementation detail that belongs to the engine and to docs/, not to
// an author who has never heard of it (PLANNING_SYSTEME_MODE7 section
// 8.1). Nor does a ramp resource — the zoom is four fields here, and
// datagen derives one shared table per distinct zoom.
const M7_PRESETS: {
  label: string;
  from: number;
  to: number;
  frames: number;
  curve: M7Curve;
}[] = [
  { label: "Zoom avant lent", from: 100, to: 150, frames: 90, curve: "ease_in_out" },
  { label: "Impact", from: 100, to: 130, frames: 10, curve: "ease_out" },
  { label: "Zoom arriere", from: 160, to: 100, frames: 75, curve: "ease_in_out" },
  { label: "Revelation", from: 100, to: 200, frames: 120, curve: "ease_in" },
];

export function formM7(cmd: Extract<Command, { c: "m7" }>, x: FormCtx): FormBody {
  let valid = true;
  const onChange = x.p.onChange;
  const imgs = x.p.mode7Images;
  const pct = (v: number) => Math.max(25, Math.min(400, v || 0));
  valid = !!cmd.image && imgs.includes(cmd.image);
  const secs = (cmd.frames / 60).toFixed(1);
  const body = (
    <>
      <div className="row">
        <label>
          Image
          <select
            value={cmd.image}
            onChange={(e) => onChange({ ...cmd, image: e.target.value })}
          >
            <option value="">(choisir une image…)</option>
            {imgs.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Prereglage
          <select
            value=""
            onChange={(e) => {
              const p = M7_PRESETS[Number(e.target.value)];
              if (p)
                onChange({
                  ...cmd,
                  from: p.from,
                  to: p.to,
                  frames: p.frames,
                  curve: p.curve,
                });
            }}
          >
            <option value="">(appliquer un prereglage…)</option>
            {M7_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          De (%)
          <input
            type="number" min={25} max={400} step={5} value={cmd.from}
            onChange={(e) => onChange({ ...cmd, from: pct(Number(e.target.value)) })}
          />
        </label>
        <label>
          a (%)
          <input
            type="number" min={25} max={400} step={5} value={cmd.to}
            onChange={(e) => onChange({ ...cmd, to: pct(Number(e.target.value)) })}
          />
        </label>
        <label>
          Duree (frames)
          <input
            type="number" min={1} max={255} value={cmd.frames}
            onChange={(e) =>
              onChange({
                ...cmd,
                frames: Math.max(1, Math.min(255, Number(e.target.value) || 1)),
              })
            }
          />
        </label>
      </div>
      <div className="row">
        <label>
          Courbe
          <select
            value={cmd.curve}
            onChange={(e) => onChange({ ...cmd, curve: e.target.value as M7Curve })}
          >
            <option value="ease_in_out">Doux aux deux bouts</option>
            <option value="linear">Lineaire</option>
            <option value="ease_in">Doux au depart</option>
            <option value="ease_out">Doux a l'arrivee</option>
          </select>
        </label>
        <label>
          Fondu d'entree et de sortie (frames)
          <input
            type="number" min={0} max={255} value={cmd.dur ?? 20}
            onChange={(e) =>
              onChange({
                ...cmd,
                dur: Math.max(0, Math.min(255, Number(e.target.value) || 0)),
              })
            }
          />
        </label>
      </div>
      <span className="hint">
        Le zoom dure <b>{secs} s</b>. La commande ouvre l'ecran, joue le
        zoom jusqu'au bout, puis le referme et rend la main au jeu — une
        seule ligne, impossible de rester bloque dessus.
      </span>
      <span className="hint">
        ⓘ Pendant le zoom, les <b>dialogues et le HUD sont masques</b> :
        l'ecran n'a qu'une seule couche (limite materielle). Les sprites
        restent affiches mais <b>ne changent pas de taille</b> — garder
        une plage de zoom modeste s'il y a des personnages a l'ecran.
      </span>
      {imgs.length === 0 && (
        <span className="hint">
          Aucune image Mode 7 dans le projet : en importer une dans le
          Gestionnaire de ressources, categorie « Image zoomable ».
        </span>
      )}
    </>
  );
  return { body, valid };
}

export function formStageClose(cmd: Extract<Command, { c: "stage_close" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Fondu (frames par sens — 0 = instantané)
          <input
            type="number" min={0} max={255} value={cmd.dur ?? 20}
            onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })}
          />
        </label>
        <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
      </div>
      <span className="hint">
        Referme l'écran composé et restaure la scène complète :
        décor, personnages, ambiances et musique de la scène.
      </span>
    </>
  );
  return { body, valid };
}

export function formVigShow(cmd: Extract<Command, { c: "vig_show" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Slot (1-2)
          <select
            value={cmd.slot}
            onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label>
          Vignette (bande de frames 32x32)
          <select
            value={cmd.vig}
            onChange={(e) => onChange({ ...cmd, vig: e.target.value })}
          >
            <option value="">(choisir une vignette…)</option>
            {x.p.vigNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Ancrage
          <select
            value={cmd.anchor}
            onChange={(e) =>
              onChange({ ...cmd, anchor: e.target.value as "screen" | "hero" })
            }
          >
            <option value="screen">Position écran</option>
            <option value="hero">Sur le héros</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          {cmd.anchor === "hero" ? "Décalage X (-128 à 127)" : "X (0-255)"}
          <input
            type="number" min={cmd.anchor === "hero" ? -128 : 0} max={255}
            value={cmd.x}
            onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })}
          />
        </label>
        <label>
          {cmd.anchor === "hero" ? "Décalage Y (-128 à 127)" : "Y (0-216)"}
          <input
            type="number" min={cmd.anchor === "hero" ? -128 : 0} max={255}
            value={cmd.y}
            onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })}
          />
        </label>
      </div>
      <span className="hint">
        Petite image en SPRITE (32x32), affichée frame 1 — les
        personnages restent visibles (contrairement aux pictures).
        « Sur le héros » : la vignette le suit (émoticône « ! » :
        X -8, Y -32). 2 vignettes à l'écran max. Marche sur la map
        ET sur l'écran composé (animations d'attaque par-dessus
        les monstres). Persiste entre les scènes.
      </span>
    </>
  );
  return { body, valid };
}

export function formVigPlay(cmd: Extract<Command, { c: "vig_play" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <div className="row">
        <label>
          Slot (1-2)
          <select
            value={cmd.slot}
            onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label>
          Mode
          <select
            value={cmd.mode}
            onChange={(e) =>
              onChange({ ...cmd, mode: e.target.value as "loop" | "once" | "stop" })
            }
          >
            <option value="once">Une fois (puis se cache)</option>
            <option value="loop">En boucle</option>
            <option value="stop">Figer</option>
          </select>
        </label>
        {cmd.mode !== "stop" && (
          <label>
            Vitesse (frames par image)
            <input
              type="number" min={1} max={60} value={cmd.speed ?? 8}
              onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <span className="hint">
        Joue les frames de la planche. « Une fois » se cache tout
        seul à la fin — parfait pour un coup d'épée ou une
        explosion (8 frames/image = ~2 images par seconde ; 4 =
        rapide). Non bloquant — enchaîner avec « Attendre ».
      </span>
    </>
  );
  return { body, valid };
}

export function formAnimPlay(cmd: Extract<Command, { c: "anim_play" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.anim !== "";
  body = (
    <>
      <div className="row">
        <label>
          Animation
          <select
            value={cmd.anim}
            onChange={(e) => onChange({ ...cmd, anim: e.target.value })}
          >
            <option value="">(choisir une animation…)</option>
            {x.p.animNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Sur quoi
          <select
            value={cmd.anchor}
            onChange={(e) =>
              onChange({ ...cmd, anchor: e.target.value as "screen" | "hero" | "event" })
            }
          >
            <option value="screen">L'écran</option>
            <option value="hero">Le héros</option>
            <option value="event">Un event</option>
          </select>
        </label>
        {cmd.anchor === "event" && (
          <label>
            Event
            <select
              value={cmd.event ?? -1}
              onChange={(e) => onChange({ ...cmd, event: Number(e.target.value) })}
            >
              <option value={-1}>Cet event</option>
              {x.p.entryNames.map((n, i) => (
                <option key={i} value={i}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="checkline">
        <input
          type="checkbox"
          checked={!!cmd.wait}
          onChange={(e) => onChange({ ...cmd, wait: e.target.checked })}
        />
        Attendre la fin de l'animation
      </label>
      {x.p.animNames.length === 0 && (
        <span className="hint">
          Aucune animation dans le projet — Tools → Animations… pour
          en composer une.
        </span>
      )}
      <span className="hint">
        Suite de cellules 32x32 avec position et son par image
        (Tools → Animations…). Passe PAR-DESSUS le décor et les
        personnages. Posée sur le héros ou sur un event, elle le
        SUIT s'il se déplace. Sans « attendre la fin », le script
        continue et l'animation vit sa vie — c'est ce qui permet
        d'animer pendant un dialogue. Une animation en boucle ne
        s'arrête jamais toute seule : « Arrêter les animations ».
      </span>
    </>
  );
  return { body, valid };
}

export function formAnimStop(_cmd: Extract<Command, { c: "anim_stop" }>, _x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  body = (
    <span className="hint">
      Arrête TOUTES les animations en cours et range leurs sprites.
      Sert à sortir d'une animation lancée en boucle.
    </span>
  );
  return { body, valid };
}

export function formVigHide(cmd: Extract<Command, { c: "vig_hide" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Slot à cacher (1-2)
        <select
          value={cmd.slot}
          onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </label>
    </>
  );
  return { body, valid };
}

export function formSfx(cmd: Extract<Command, { c: "sfx" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Son
        <select
          value={cmd.sound}
          onChange={(e) => onChange({ ...cmd, sound: e.target.value })}
        >
          <option value="">(choisir un son…)</option>
          {x.p.soundNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <span className="hint">
        Joue l'effet sonore par-dessus la musique (coffre, porte,
        coup…) — immédiat, non bloquant. Les sons s'importent dans
        le Gestionnaire de ressources (WAV, ~2 secondes max). Un
        son vide ou supprimé est signalé au build.
      </span>
    </>
  );
  return { body, valid };
}

export function formBgm(cmd: Extract<Command, { c: "bgm" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Musique
        <select
          value={cmd.music}
          onChange={(e) => onChange({ ...cmd, music: e.target.value })}
        >
          <option value="">(silence)</option>
          {x.p.musicNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <span className="hint">
        Change la musique de fond (combat, boss, moment calme) —
        non bloquant, sans effet si c'est déjà la musique courante.
        Le changement n'est PAS instantané : le module est envoyé
        au processeur audio (jusqu'à quelques secondes pour un gros
        morceau). Au prochain changement de scène, la musique de la
        scène reprend ses droits.
      </span>
    </>
  );
  return { body, valid };
}

export function formWeather(cmd: Extract<Command, { c: "weather" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <>
      <label>
        Météo
        <select
          value={cmd.kind}
          onChange={(e) =>
            onChange({ ...cmd, kind: e.target.value as "off" | "rain" | "snow" })
          }
        >
          <option value="off">Aucune (arrêter)</option>
          <option value="rain">Pluie</option>
          <option value="snow">Neige</option>
        </select>
      </label>
      {cmd.kind !== "off" && (
        <label>
          Intensité
          <select
            value={cmd.power ?? 2}
            onChange={(e) => onChange({ ...cmd, power: Number(e.target.value) })}
          >
            <option value={1}>Légère (8 particules)</option>
            <option value={2}>Normale (16)</option>
            <option value={3}>Forte (24)</option>
          </select>
        </label>
      )}
      <span className="hint">
        Non bloquant — persiste entre les scènes jusqu'au prochain
        changement (modèle RM2003). Les particules tombent DEVANT la
        couche d'effet : orage complet = nuages sombres (soustractif)
        + Pluie + « Flash d'écran » pour les éclairs.
      </span>
    </>
  );
  return { body, valid };
}

export function formFlash(cmd: Extract<Command, { c: "flash" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid =
    [cmd.r, cmd.g, cmd.b].every((v) => v >= 0 && v <= 31) &&
    cmd.frames >= 1 && cmd.frames <= 255;
  body = (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {(["r", "g", "b"] as const).map((k) => (
          <label key={k}>
            {k.toUpperCase()} (0-31)
            <input
              type="number" min={0} max={31} value={cmd[k]}
              onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label>
          Durée (frames)
          <input
            type="number" min={1} max={255} value={cmd.frames}
            onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
          />
        </label>
      </div>
      <span className="hint">
        Éclair qui décroît sur la durée — non bloquant (enchaîner avec
        « Attendre »). Blanc plein : 31,31,31.
      </span>
    </>
  );
  return { body, valid };
}

export function formCallFn(cmd: Extract<Command, { c: "call_fn" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const fns = x.p.fnSigs ?? [];
  const sig = fns[cmd.n];
  valid =
    !!sig &&
    cmd.args.length === sig.params.length &&
    (cmd.dst === undefined || (sig.returns && cmd.dst >= 0 && cmd.dst < 256));
  body = (
    <>
      {fns.length === 0 ? (
        <span className="hint" style={{ color: "#ff7070" }}>
          Aucune fonction dans le projet — les créer via
          Tools → Fonctions…
        </span>
      ) : (
        <>
          <label>
            Fonction
            <select
              value={cmd.n}
              autoFocus
              onChange={(e) => {
                const n = Number(e.target.value);
                const want = fns[n]?.params.length ?? 0;
                // the number of arguments FOLLOWS the chosen function:
                // datagen refuses a mis-sized call, so there is no
                // point letting the author build that case
                const args: ValueSrc[] = [];
                for (let k = 0; k < want; k++)
                  args.push(cmd.args[k] ?? { value: 0 });
                onChange({
                  ...cmd,
                  n,
                  args,
                  dst: fns[n]?.returns ? cmd.dst : undefined,
                });
              }}
            >
              {fns.map((sg, i) => (
                <option key={i} value={i}>
                  {String(i + 1).padStart(4, "0")}: {sg.name}(
                  {sg.params.join(", ")}){sg.returns ? " → résultat" : ""}
                </option>
              ))}
            </select>
          </label>
          {sig?.params.map((pname, k) => (
            <div
              className="row"
              key={k}
              style={{ flexWrap: "wrap", alignItems: "flex-start" }}
            >
              <span
                style={{
                  alignSelf: "center",
                  flex: "0 0 auto",
                  minWidth: 70,
                  textAlign: "right",
                }}
              >
                {pname || `paramètre ${k + 1}`}
              </span>
              <ValueSourceFields
                v={cmd.args[k] ?? { value: 0 }}
                fnParams={x.p.fnParams}
                fnLocals={x.p.fnLocals}
                varNames={x.p.varNames}
                onPickVar={x.p.onPickVar}
                onChange={(v) => {
                  const args = cmd.args.slice();
                  args[k] = v;
                  onChange({ ...cmd, args });
                }}
              />
            </div>
          ))}
          {sig?.returns && (
            <div
              className="row"
              style={{ gap: 6, alignItems: "center", flexWrap: "wrap" }}
            >
              {/* flexDirection spelled out: `.modal label` forces a
                  column, and the checkbox ended up above its
                  label */}
              <label
                style={{
                  flexDirection: "row",
                  gap: 6,
                  alignItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <input
                  type="checkbox"
                  style={{ flex: "0 0 auto", width: 14, height: 14, boxShadow: "none" }}
                  checked={cmd.dst !== undefined}
                  onChange={(e) =>
                    onChange({ ...cmd, dst: e.target.checked ? 0 : undefined })
                  }
                />
                Stocker le résultat
              </label>
              <label style={{ flex: "1 1 160px" }}>
                Variable
                <span className="row" style={{ gap: 4 }}>
                  <input
                    type="number" min={0} max={255}
                    disabled={cmd.dst === undefined}
                    value={cmd.dst ?? 0}
                    onChange={(e) => onChange({ ...cmd, dst: Number(e.target.value) })}
                  />
                  <button className="browse" title="Choisir dans la liste"
                    disabled={cmd.dst === undefined}
                    onClick={() =>
                      x.p.onPickVar("var", cmd.dst ?? 0, (n) =>
                        onChange({ ...cmd, dst: n })
                      )
                    }>…</button>
                </span>
                <span className="hint">{x.p.varNames[cmd.dst ?? 0] || ""}</span>
              </label>
            </div>
          )}
          <span className="hint">
            Sans « Stocker le résultat », la valeur rendue reste lisible
            par la source « Résultat du dernier appel » — c'est ainsi
            qu'on passe le retour d'une fonction en argument d'une
            autre.
          </span>
        </>
      )}
    </>
  );
  return { body, valid };
}

export function formRetFn(cmd: Extract<Command, { c: "ret_fn" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.value >= -32768 && cmd.value <= 65535;
  body = (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <span style={{ alignSelf: "center", minWidth: 90 }}>Valeur rendue</span>
        <ValueSourceFields
          v={cmd}
          fnParams={x.p.fnParams}
          fnLocals={x.p.fnLocals}
          varNames={x.p.varNames}
          onPickVar={x.p.onPickVar}
          onChange={(v) => onChange({ ...cmd, from: v.from, value: v.value })}
        />
      </div>
      <span className="hint">
        Sort de la fonction immédiatement. À n'utiliser que dans le
        corps d'une fonction déclarée « rend une valeur ».
      </span>
    </>
  );
  return { body, valid };
}

export function formCall(cmd: Extract<Command, { c: "call" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = x.p.commonNames.length > 0 && cmd.n >= 0 && cmd.n < x.p.commonNames.length;
  body = (
    <>
      {x.p.commonNames.length === 0 ? (
        <span className="hint" style={{ color: "#ff7070" }}>
          Aucun common event dans le projet — les créer via
          Tools → Common events…
        </span>
      ) : (
        <label>
          Common event
          <select
            value={cmd.n}
            autoFocus
            onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
          >
            {x.p.commonNames.map((n, i) => (
              <option key={i} value={i}>
                {String(i + 1).padStart(4, "0")}: {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="hint">
        Exécute les commandes du common event puis reprend ici (8
        niveaux d'appels max). « Cet event » y désigne l'event
        appelant.
      </span>
    </>
  );
  return { body, valid };
}

export function formDbRead(cmd: Extract<Command, { c: "db_read" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const sc = x.p.db?.schemas.find((s) => s.name === cmd.table);
  const entries = x.p.db?.entries[cmd.table] ?? [];
  valid =
    !!sc &&
    sc.fields.some((f) => f.name === cmd.field) &&
    cmd.dst >= 0 && cmd.dst < 256 &&
    (cmd.from === "var"
      ? Number(cmd.entry) >= 0 && Number(cmd.entry) < 256
      : entries.some((e) => e.id === cmd.entry));
  body = !x.p.db ? (
    <span className="hint" style={{ color: "#ff7070" }}>
      Le projet n'a pas de database — créer une table via
      Tools → Database…
    </span>
  ) : (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <label>
          Table
          <select
            value={cmd.table}
            autoFocus
            onChange={(e) => {
              const ns = x.p.db!.schemas.find((s) => s.name === e.target.value)!;
              onChange({
                ...cmd,
                table: ns.name,
                entry: cmd.from === "var" ? cmd.entry
                  : x.p.db!.entries[ns.name]?.[0]?.id ?? "",
                field: ns.fields[0]?.name ?? "",
              });
            }}
          >
            {x.p.db.schemas.map((s) => (
              <option key={s.name} value={s.name}>
                {s.title || s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fiche
          <select
            value={cmd.from ?? "const"}
            onChange={(e) => {
              const from = e.target.value as "const" | "var";
              onChange({
                ...cmd,
                from: from === "const" ? undefined : from,
                entry: from === "var" ? 0 : entries[0]?.id ?? "",
              });
            }}
          >
            <option value="const">Fixe (choisir)</option>
            <option value="var">Depuis une variable</option>
          </select>
        </label>
        {cmd.from === "var" ? (
          <label>
            Variable (n° de fiche)
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={255} value={Number(cmd.entry)}
                onChange={(e) => onChange({ ...cmd, entry: Number(e.target.value) })}
              />
              <button className="browse" title="Choisir dans la liste"
                onClick={() => x.p.onPickVar("var", Number(cmd.entry), (n) => onChange({ ...cmd, entry: n }))}>…</button>
            </span>
          </label>
        ) : (
          <label>
            Entrée
            <select
              value={String(cmd.entry)}
              onChange={(e) => onChange({ ...cmd, entry: e.target.value })}
            >
              {entries.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.name || en.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Champ
          <select
            value={cmd.field}
            onChange={(e) => onChange({ ...cmd, field: e.target.value })}
          >
            {(sc?.fields ?? []).map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} ({f.type})
              </option>
            ))}
          </select>
        </label>
        <label>
          → Variable destination
          <span className="row" style={{ gap: 4 }}>
            <input
              type="number" min={0} max={255} value={cmd.dst}
              onChange={(e) => onChange({ ...cmd, dst: Number(e.target.value) })}
            />
            <button className="browse" title="Choisir dans la liste"
              onClick={() => x.p.onPickVar("var", cmd.dst, (n) => onChange({ ...cmd, dst: n }))}>…</button>
          </span>
          <span className="hint">{x.p.varNames[cmd.dst] || ""}</span>
        </label>
      </div>
      <span className="hint">
        Copie la valeur du champ dans la variable (flags8 : l'octet des
        bits ; ref : l'index de la fiche visée ; « depuis une
        variable » : le n° de fiche est lu dans la variable, hors
        table → 0).
      </span>
    </>
  );
  return { body, valid };
}

export function formShake(cmd: Extract<Command, { c: "shake" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  valid = cmd.power >= 0 && cmd.power <= 8 && cmd.speed >= 1 && cmd.speed <= 8 &&
    cmd.frames >= 0 && cmd.frames <= 255;
  body = (
    <>
      <div className="row">
        <label>
          Force (px, 0 = arrêter)
          <input
            type="number" min={0} max={8} value={cmd.power} autoFocus
            onChange={(e) => onChange({ ...cmd, power: Number(e.target.value) })}
          />
        </label>
        <label>
          Vitesse (frames par va-et-vient)
          <input
            type="number" min={1} max={8} value={cmd.speed}
            onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
          />
        </label>
        <label>
          Durée (frames)
          <input
            type="number" min={0} max={255} value={cmd.frames}
            onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
          />
        </label>
      </div>
      <span className="hint">
        Secousse horizontale — non bloquante (enchaîner avec
        « Attendre »).
      </span>
    </>
  );
  return { body, valid };
}

export function formWarp(cmd: Extract<Command, { c: "warp" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  const dest = x.p.scenes[cmd.to];
  valid =
    !!dest && cmd.x >= 0 && cmd.y >= 0 && cmd.x < (dest?.width ?? 0) && cmd.y < (dest?.height ?? 0);
  body = (
    <div className="row">
      <label style={{ flex: 2 }}>
        Scène cible
        <select
          value={cmd.to}
          onChange={(e) => {
            const d = x.p.scenes[e.target.value];
            onChange({
              ...cmd,
              to: e.target.value,
              x: d?.player_start[0] ?? 3,
              y: d?.player_start[1] ?? 3,
            });
          }}
        >
          {x.p.sceneNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        x
        <input type="number" min={0} value={cmd.x} onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
      </label>
      <label>
        y
        <input type="number" min={0} value={cmd.y} onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
      </label>
      <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
    </div>
  );
  return { body, valid };
}

export function formFace(cmd: Extract<Command, { c: "face" }>, x: FormCtx): FormBody {
  let body: JSX.Element | null = null;
  let valid = true;
  const onChange = x.p.onChange;
  body = (
    <div className="row">
      <label>
        Event n° (ordre de la scène)
        <input
          type="number"
          min={0}
          max={254}
          value={cmd.event}
          onChange={(e) => onChange({ ...cmd, event: Number(e.target.value) })}
        />
      </label>
      <label>
        Direction
        <select value={cmd.dir} onChange={(e) => onChange({ ...cmd, dir: e.target.value as Direction })}>
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  return { body, valid };
}
