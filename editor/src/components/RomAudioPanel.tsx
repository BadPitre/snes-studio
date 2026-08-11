// ROM ripper, "Sons" tab (X3): find BRR samples in the open file, listen
// to them, send one to the project's sound register.
//
// Two sources, and the difference matters. From a ROM the tool SCANS —
// reliable, but it finds every sample in the cart with no idea what any
// of them is. From an .spc it READS THE DIRECTORY the sound driver was
// using: exact boundaries, real loop points, and the instrument numbers
// of one specific song. When the author can produce an .spc, they should.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type BrrSample,
  type Spc,
  BRR_BLOCK,
  SFX_MAX_BRR,
  aramVerdict,
  brrSizeAtBuild,
  decodeBrr,
  encodeWav,
  scanBrr,
  spcSamples,
} from "../brr";
import { stopPreview } from "./AudioPreview";

interface Props {
  // The byte range to look in: the ROM, or an SPC's 64 KB of ARAM.
  bytes: Uint8Array;
  spc: Spc | null;
  stem: string; // file stem, to name the extraction
  onSend: (name: string, wav: Uint8Array) => void;
  setStatus: (s: string) => void;
}

// BRR carries no sample rate — pitch came from the driver's per-voice
// register at play time. 32000 Hz is the DSP's output rate and the usual
// convention; the slider is there because only the ear can settle it.
const RATES = [8000, 11025, 16000, 22050, 32000];

export default function RomAudioPanel(p: Props) {
  const [list, setList] = useState<BrrSample[] | null>(null);
  const [sel, setSel] = useState(0);
  const [rate, setRate] = useState(32000);
  const [minBlocks, setMinBlocks] = useState(16);
  const [name, setName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  // An SPC needs no scan: its directory is the answer.
  useEffect(() => {
    if (!p.spc) return;
    const s = spcSamples(p.spc);
    setList(s);
    setSel(0);
    p.setStatus(
      s.length
        ? `SPC : ${s.length} instrument(s) dans le répertoire d'échantillons`
        : "SPC : répertoire d'échantillons illisible"
    );
    // p.setStatus is stable enough for a one-shot on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.spc]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current?.pause();
    },
    []
  );

  const found = list && list.length ? list[Math.min(sel, list.length - 1)] : null;

  // A scan pins the END of a sample exactly and its START only
  // approximately (see scanBrr): junk in front of a real sample often
  // parses as one more block. Trimming blocks off the head is the same
  // idea as the +-1 byte nudge on the graphics side.
  const [trim, setTrim] = useState(0);
  useEffect(() => setTrim(0), [sel, list]);

  const cur = found
    ? {
        ...found,
        offset: found.offset + trim * BRR_BLOCK,
        blocks: found.blocks - trim,
      }
    : null;

  const pcm = useMemo(
    () => (cur ? decodeBrr(p.bytes, cur.offset, cur.blocks) : null),
    [p.bytes, cur]
  );

  // Only meaningful for an SPC: a ROM scan collects samples from the whole
  // cart, so totalling them says nothing about any one song.
  const aram = useMemo(
    () => (p.spc && list && list.length ? aramVerdict(list) : null),
    [p.spc, list]
  );

  function runScan() {
    const t0 = performance.now();
    const s = scanBrr(p.bytes, minBlocks);
    setList(s);
    setSel(0);
    p.setStatus(
      s.length
        ? `${s.length} échantillon(s) trouvé(s) en ${Math.round(performance.now() - t0)} ms`
        : "Aucun échantillon BRR — le jeu compresse peut-être son bloc audio"
    );
  }

  function play() {
    if (!pcm) return;
    stopPreview(); // one sound at a time, resource manager included
    const wav = encodeWav(pcm, rate);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" }));
    audioRef.current?.pause();
    const a = new Audio(urlRef.current);
    audioRef.current = a;
    void a.play().catch((e) => p.setStatus(`Lecture : ${e}`));
  }

  function send() {
    if (!pcm || !cur) return;
    const stem = (name || `${p.stem}_${cur.offset.toString(16)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    p.onSend(`${stem}.wav`, encodeWav(pcm, rate));
  }

  const seconds = pcm ? pcm.length / rate : 0;
  const built = pcm ? brrSizeAtBuild(pcm.length, rate) : 0;
  const tooBig = built > SFX_MAX_BRR;

  return (
    <div className="romrip-audio">
      <div className="romrip-col">
        <div className="panel-title">Échantillons</div>
        {p.spc ? (
          <>
            <div className="hint">
              Répertoire du SPC{p.spc.game ? ` — ${p.spc.game}` : ""}
              {p.spc.title ? ` / ${p.spc.title}` : ""}. Bornes et points de boucle
              exacts, aucun scan nécessaire.
            </div>
            {aram && (
              <>
                <div className="panel-title">Ce morceau tiendrait-il ?</div>
                <div className={`hint${aram.fits ? "" : " romrip-why"}`}>{aram.verdict}</div>
                <div className="hint">
                  {aram.total} o de BRR pour {aram.budget} o d'ARAM laissés à un module
                  par le driver snesmod. Le répertoire peut lister des échantillons que
                  ce morceau n'utilise pas : c'est un majorant.
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <label className="hint">
              Blocs minimum
              <input
                type="number"
                min={2}
                max={512}
                value={minBlocks}
                onChange={(e) => setMinBlocks(Math.max(2, Math.min(512, +e.target.value || 2)))}
              />
            </label>
            <button onClick={runScan}>🔍 Scanner les échantillons</button>
            <div className="hint">
              Un BRR se décrit lui-même : blocs de 9 octets, portée ≤ 12, un seul
              drapeau de fin. Le scan affirme, il ne devine pas.
            </div>
          </>
        )}
        {list && (
          <div className="hint">
            {list.length} échantillon(s)
            {!p.spc && list.length >= 400 ? " (limite atteinte)" : ""}
          </div>
        )}
      </div>

      <div className="romrip-samples">
        {!list ? (
          <div className="hint" style={{ padding: 10 }}>
            Ouvrir une ROM et lancer le scan, ou ouvrir un fichier .spc — un émulateur
            en produit un d'une touche, et c'est la meilleure source pour l'audio.
          </div>
        ) : list.length === 0 ? (
          <div className="hint" style={{ padding: 10 }}>Rien trouvé ici.</div>
        ) : (
          <table className="romrip-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Offset</th>
                <th>Blocs</th>
                <th>Durée</th>
                <th>Boucle</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr
                  key={s.offset}
                  className={i === sel ? "sel" : ""}
                  onClick={() => setSel(i)}
                  onDoubleClick={() => {
                    setSel(i);
                    play();
                  }}
                >
                  <td>{s.dirIndex ?? i}</td>
                  <td className="mono">${s.offset.toString(16).toUpperCase()}</td>
                  <td>{s.blocks}</td>
                  <td>{((s.blocks * 16) / rate).toFixed(2)} s</td>
                  <td>{s.loop ? "↻" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="romrip-col">
        <div className="panel-title">Écoute</div>
        <label className="hint">
          Taux supposé
          <select value={rate} onChange={(e) => setRate(+e.target.value)}>
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r} Hz
              </option>
            ))}
          </select>
        </label>
        <div className="hint">
          Le BRR ne porte pas de taux : la hauteur venait du registre de voix du
          driver. 32000 Hz est la convention — ajuster à l'oreille.
        </div>
        <button disabled={!pcm} onClick={play}>
          ▶ Écouter
        </button>
        {!p.spc && (
          <>
            <div className="row romrip-nav">
              <button
                disabled={!found || trim === 0}
                title="Le scan cale la FIN exactement, le début à un bloc près"
                onClick={() => setTrim((t) => Math.max(0, t - 1))}
              >
                ◀ bloc
              </button>
              <span className="hint">début +{trim}</span>
              <button
                disabled={!found || trim >= found.blocks - 1}
                title="Retirer un bloc parasite en tête"
                onClick={() => setTrim((t) => t + 1)}
              >
                bloc ▶
              </button>
            </div>
            <div className="hint">
              Un clic ou deux si l'attaque du son commence par un craquement : les
              octets qui précèdent un échantillon passent souvent pour un en-tête.
            </div>
          </>
        )}

        <div className="panel-title">Vers le projet</div>
        {cur ? (
          <div className="hint">
            {pcm!.length} échantillons, {seconds.toFixed(2)} s
            <br />
            au build : {built} o de BRR à 8 kHz
          </div>
        ) : (
          <div className="hint">Aucun échantillon sélectionné.</div>
        )}
        {tooBig && (
          <div className="hint romrip-why">
            Budget dépassé : {built} o pour {SFX_MAX_BRR} o max par son (~1,8 s à
            8 kHz). Le build refusera — prendre un échantillon plus court.
          </div>
        )}
        {cur && !tooBig && (
          <div className="hint">
            Le son sera rééchantillonné en 8 kHz au build : il sonnera plus terne que
            dans le jeu d'origine.
          </div>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={cur ? `${p.stem}_${cur.offset.toString(16)}` : "nom du fichier"}
        />
        <button disabled={!pcm || tooBig} onClick={send}>
          ⬇ Envoyer vers Son
        </button>
      </div>
    </div>
  );
}
