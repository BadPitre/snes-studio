// ROM ripper, audio side (X3/X5): find the instruments, listen to them,
// transcribe the song, send either to the project.
//
// Two sources, and the difference matters. From a ROM the tool SCANS —
// reliable, but it finds every sample in the cart with no idea what any
// of them is. From an .spc it READS THE DIRECTORY the sound driver was
// using: exact boundaries, real loop points, and the instrument numbers
// of one specific song. When the author can produce an .spc, they should.
//
// Three columns, and the order is deliberate: what this song IS on the
// left (its name first, then the technical facts as a list), the
// instruments in the middle with a play button on every row, and the two
// things one can DO with it on the right. Both of those end in the same
// verb — "Envoyer … vers le projet" — because a sound and a song leaving
// by different-sounding doors is the kind of small confusion that costs
// an author ten minutes.

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
  loopSample,
  scanBrr,
  spcSamples,
} from "../brr";
import { Spc700 } from "../spc700";
import { type TranscribeReport, transcribe } from "../transcribe";
import { stopPreview, toggleBytes, usePreviewState } from "./AudioPreview";

interface Props {
  // The byte range to look in: the ROM, or an SPC's 64 KB of ARAM.
  bytes: Uint8Array;
  spc: Spc | null;
  stem: string; // file stem, to name the extraction
  onSend: (name: string, wav: Uint8Array) => void;
  onSendMusic: (name: string, it: Uint8Array) => void;
  setStatus: (s: string) => void;
}

// BRR carries no sample rate — pitch came from the driver's per-voice
// register at play time. 32000 Hz is the DSP's output rate and the usual
// convention; the slider is there because only the ear can settle it.
const RATES = [8000, 11025, 16000, 22050, 32000];

// The shared audio player keys previews by resource path; the ripper's
// module has no path, so it takes a name of its own.
const MUSIC_KEY = "romrip:module";

function slug(s: string, fallback: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

// A sample directory is full of very short entries; "0.00 s" on twenty
// rows tells the eye nothing, milliseconds tell it which is which.
function dur(seconds: number): string {
  return seconds < 0.1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;
}

export default function RomAudioPanel(p: Props) {
  const [list, setList] = useState<BrrSample[] | null>(null);
  const [sel, setSel] = useState(0);
  const [rate, setRate] = useState(32000);
  const [minBlocks, setMinBlocks] = useState(16);
  const [name, setName] = useState("");
  const [playingRow, setPlayingRow] = useState<number | null>(null);
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

  // Trimming blocks off the head shifts the loop point with them; trim
  // past it and there is no loop left to carry.
  const loop = cur ? loopSample(cur) : undefined;

  // Only meaningful for an SPC: a ROM scan collects samples from the whole
  // cart, so totalling them says nothing about any one song.
  const aram = useMemo(
    () => (p.spc && list && list.length ? aramVerdict(list) : null),
    [p.spc, list]
  );

  // The echo the game had, read straight off the snapshot's DSP registers.
  const echo = useMemo(() => {
    if (!p.spc) return null;
    const d = p.spc.dsp;
    const sb = (x: number) => (x << 24) >> 24;
    const edl = d[0x7d] & 15;
    if (d[0x6c] & 0x20 || edl === 0 || d[0x4d] === 0) return null;
    return {
      edl,
      efb: sb(d[0x0d]),
      evolL: sb(d[0x2c]),
      evolR: sb(d[0x3c]),
      eon: d[0x4d],
      fir: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => sb(d[0x0f + i * 16])),
    };
  }, [p.spc]);

  // How many voices were actually sounding when the photograph was taken.
  // ENVX is the envelope's current level: zero means that voice was idle.
  const liveVoices = useMemo(() => {
    if (!p.spc) return 0;
    let n = 0;
    for (let i = 0; i < 8; i++) if (p.spc.dsp[i * 16 + 8]) n++;
    return n;
  }, [p.spc]);

  // ---- transcription (X5-c/X5-d) --------------------------------------
  // Run the game's own driver and write down what it asks the eight
  // voices to do. Around 170x real time, so a 30-second capture costs
  // under a fifth of a second — no need to leave the main thread.
  const [capture, setCapture] = useState(30);
  const [rowsPerSecond, setRowsPerSecond] = useState<15 | 30 | 60>(30);
  const [report, setReport] = useState<TranscribeReport | null>(null);
  const [it, setIt] = useState<Uint8Array | null>(null);
  const musicState = usePreviewState(MUSIC_KEY);

  // Changing the capture settings invalidates the module that is playing:
  // silently keeping the old one would make the two selects look broken.
  useEffect(() => {
    setReport(null);
    setIt(null);
    stopPreview();
  }, [capture, rowsPerSecond, p.spc]);

  // Returns the module, transcribing it if that has not happened yet, so
  // the play button works on the first click without a preliminary step.
  function ensureIt(): Uint8Array | null {
    if (it) return it;
    if (!p.spc || !list) return null;
    try {
      const t0 = performance.now();
      const cpu = new Spc700(p.spc.aram, p.spc.dsp, p.spc.regs);
      const trace = cpu.run(capture);
      const r = transcribe(trace, p.spc.aram, list, {
        rowsPerSecond,
        name: p.spc.title || p.stem,
        echo: echo ?? undefined,
      });
      setReport(r.report);
      setIt(r.it);
      p.setStatus(
        `Transcription : ${r.report.notes} notes, ${r.report.samples} instrument(s), ` +
          `${r.report.patterns} pattern(s) — ${Math.round(performance.now() - t0)} ms`
      );
      return r.it;
    } catch (e) {
      setReport(null);
      setIt(null);
      p.setStatus(`Transcription : ${e}`);
      return null;
    }
  }

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

  function stopRow() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingRow(null);
  }

  // The play button on a row. It also selects the row, so listening and
  // choosing are one gesture instead of two.
  function playRow(i: number) {
    if (!list || !list[i]) return;
    if (playingRow === i) {
      stopRow();
      return;
    }
    stopRow();
    stopPreview(); // one sound at a time, module and resource manager included
    setSel(i);
    const s = list[i];
    const wav = encodeWav(decodeBrr(p.bytes, s.offset, s.blocks), rate, loopSample(s));
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" }));
    const a = new Audio(urlRef.current);
    a.onended = () => setPlayingRow((k) => (k === i ? null : k));
    audioRef.current = a;
    setPlayingRow(i);
    void a.play().catch((e) => {
      setPlayingRow(null);
      p.setStatus(`Lecture : ${e}`);
    });
  }

  function playMusic() {
    stopRow();
    toggleBytes(MUSIC_KEY, ensureIt);
  }

  function send() {
    if (!pcm || !cur) return;
    const stem = slug(name || `${p.stem}_${cur.offset.toString(16)}`, "son");
    p.onSend(`${stem}.wav`, encodeWav(pcm, rate, loop));
  }

  const seconds = pcm ? pcm.length / rate : 0;
  const built = pcm ? brrSizeAtBuild(pcm.length, rate) : 0;
  const tooBig = built > SFX_MAX_BRR;

  const fact = (label: string, value: string) => (
    <li key={label}>
      <span>{label}</span>
      <b>{value}</b>
    </li>
  );

  return (
    <div className="romrip-audio">
      {/* ---- what this song is ---------------------------------------- */}
      <div className="romrip-col">
        {p.spc ? (
          <>
            <div className="romrip-song">
              <div className="romrip-song-title">{p.spc.title || "Titre inconnu"}</div>
              <div className="romrip-song-game">{p.spc.game || "Jeu inconnu"}</div>
            </div>
            <div className="panel-title">Fiche technique</div>
            <ul className="romrip-facts">
              {fact("Instruments", String(list?.length ?? 0))}
              {fact("Voix actives", `${liveVoices} / 8`)}
              {aram && fact("Échantillons", `${aram.total} o`)}
              {aram && fact("Budget d'un module", `${aram.budget} o`)}
              {aram &&
                fact("Occupation", `${Math.round((aram.total / aram.budget) * 100)} %`)}
              {aram && fact("Tient dans un module", aram.fits ? "oui" : "non")}
              {fact(
                "Écho d'origine",
                echo ? `EDL ${echo.edl} — ${echo.edl * 2048} o` : "aucun"
              )}
              {report && fact("Notes transcrites", String(report.notes))}
              {report && fact("Lignes", `${report.rows} en ${report.patterns} patterns`)}
              {report && fact("Nuances de volume", String(report.volCells))}
              {report &&
                fact(
                  "BRR du module",
                  `${report.brrBytes} o${
                    report.downsampled > 1 ? ` (1/${report.downsampled})` : ""
                  }`
                )}
            </ul>
            {aram && (
              <div className={`hint${aram.fits ? "" : " romrip-why"}`}>{aram.verdict}</div>
            )}
            <div className="hint">
              Le répertoire peut lister des échantillons que ce morceau n'utilise pas :
              le total est un majorant.
            </div>
            {report?.warnings.map((w, i) => (
              <div key={i} className="hint romrip-why">
                {w}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="panel-title">Échantillons</div>
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
            {list && (
              <div className="hint">
                {list.length} échantillon(s)
                {list.length >= 400 ? " (limite atteinte)" : ""}
              </div>
            )}
          </>
        )}
      </div>

      {/* ---- the instruments ------------------------------------------ */}
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
                <th className="romrip-playcol" />
                <th>Instrument</th>
                <th>Adresse</th>
                <th className="num">Durée</th>
                <th className="num">Taille</th>
                <th>Boucle</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr
                  key={s.offset}
                  className={i === sel ? "sel" : ""}
                  onClick={() => setSel(i)}
                >
                  <td className="romrip-playcol">
                    <button
                      className="browse"
                      title={playingRow === i ? "Arrêter" : "Écouter cet instrument"}
                      onClick={(e) => {
                        e.stopPropagation();
                        playRow(i);
                      }}
                    >
                      {playingRow === i ? "⏹" : "▶"}
                    </button>
                  </td>
                  <td>
                    {s.dirIndex !== undefined
                      ? `Instrument ${String(s.dirIndex).padStart(2, "0")}`
                      : `Échantillon ${String(i + 1).padStart(2, "0")}`}
                  </td>
                  <td className="mono">${s.offset.toString(16).toUpperCase()}</td>
                  <td className="num">{dur((s.blocks * 16) / rate)}</td>
                  <td className="num">{s.blocks * BRR_BLOCK} o</td>
                  <td>{s.loop ? "↻ oui" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- what one can do with it ---------------------------------- */}
      <div className="romrip-col">
        {p.spc && (
          <>
            <div className="panel-title">Le morceau</div>
            <button
              className="romrip-bigplay"
              disabled={!list || !list.length}
              onClick={playMusic}
            >
              {musicState === "playing"
                ? "⏸ Pause"
                : musicState === "loading"
                  ? "… Chargement"
                  : musicState === "paused"
                    ? "▶ Reprendre"
                    : "▶ Jouer le morceau"}
            </button>
            <div className="hint">
              On fait tourner le driver du jeu et on note ce qu'il demande aux huit
              voix. C'est une exécution, pas une partition : ni patterns, ni boucles
              propres — à finir dans OpenMPT.
            </div>
            <label className="hint">
              Durée capturée
              <select value={capture} onChange={(e) => setCapture(+e.target.value)}>
                {[10, 30, 60, 120].map((s) => (
                  <option key={s} value={s}>
                    {s} s
                  </option>
                ))}
              </select>
            </label>
            <label className="hint">
              Précision
              <select
                value={rowsPerSecond}
                onChange={(e) => setRowsPerSecond(+e.target.value as 15 | 30 | 60)}
              >
                <option value={15}>15 lignes/s (grossier)</option>
                <option value={30}>30 lignes/s</option>
                <option value={60}>60 lignes/s (fin, patterns longs)</option>
              </select>
            </label>
            <button
              disabled={!list || !list.length}
              onClick={() => {
                const b = ensureIt();
                if (!b) return;
                p.onSendMusic(`${slug(p.spc!.title || p.stem, "rip")}.it`, b);
              }}
            >
              ⬇ Envoyer le morceau vers le projet
            </button>
          </>
        )}

        <div className="panel-title">L'instrument sélectionné</div>
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
        {cur ? (
          <div className="hint">
            {pcm!.length} échantillons, {dur(seconds)}
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
          ⬇ Envoyer l'instrument vers le projet
        </button>
      </div>
    </div>
  );
}
