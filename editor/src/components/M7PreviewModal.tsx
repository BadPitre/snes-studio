// "Aperçu Mode 7" window — what a world map ACTUALLY looks like in game,
// from the numbers the author typed.
//
// The scene tab shows a world map flat, from above, like every other
// scene: that is the map DATA, and it is the right thing to paint on.
// But nothing in that view says what a horizon at line 56 with an anchor
// at 176 will do to it, and the design doc's own §11c records an author
// reporting "it looks exactly like a classic scene" about a plane that
// was working perfectly. This window closes that gap.
//
// It is NOT an approximation of the render: it runs the same transform
// the PPU runs, from the same numbers datagen compiles. Per screen line
// d below the horizon, with s = dA/d,
//     A = s*cos   B = s^2*sin   C = s*sin   D = -s^2*cos
// and per column, px = A*(x-128) + B*d + X0, py = C*(x-128) + D*d + Y0,
// the rotation centre being the camera pushed dA units behind itself.
// Above the horizon the plane is masked and the sky shows — flat colour,
// vertical gradient or image, exactly as the three sky products do.
//
// The NPCs go through m7_project's inverse of that transform (engine
// §7.2h), so an author can see where an event will actually stand
// BEFORE building the ROM. The engine caps that loop at three per frame;
// the preview has no such budget and draws them all, which is stated
// rather than silently different.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Scene, TilesetMeta } from "../types";
import { AUTOTILE_BASE, EMPTY_TILE, eventFrame } from "../types";
import { drawAutotileCell } from "../autotile";

interface Props {
  scene: Scene;
  tileset: ImageBitmap | null;
  autotiles: ImageBitmap[];
  meta: TilesetMeta;
  sprites: ImageBitmap | null;
  /** The scene's sky image, already loaded (null when it has none). */
  skyImage: ImageBitmap | null;
  /** Commits a camera angle tried here back onto the scene. */
  onApplyView: (horizon: number, anchor: number) => void;
  onClose: () => void;
}

const SCREEN_W = 256;
const SCREEN_H = 224;
/** The Mode 7 plane is 128x128 tiles whatever the map's size, and it
 *  REPEATS — M7SEL is set to "repeat character 0" outside it, so beyond
 *  the painted area the sky colour shows through. */
const PLANE_PX = 1024;

function hexToRgb(h: string | undefined, fallback: [number, number, number]) {
  if (!h || !/^#[0-9a-fA-F]{6}$/.test(h)) return fallback;
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ] as [number, number, number];
}

export default function M7PreviewModal(props: Props) {
  const { scene, tileset, autotiles, sprites, skyImage } = props;
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [horizon, setHorizon] = useState(scene.m7_horizon ?? 56);
  const [anchor, setAnchor] = useState(scene.m7_anchor ?? 176);
  const steps = scene.m7_rotate ?? 0;
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [showEvents, setShowEvents] = useState(true);
  // Camera, in plane pixels — the hero's centre. Starts where the scene's
  // player start is, which is where the game will actually open.
  const [cam, setCam] = useState<[number, number]>([
    scene.player_start[0] * 16 + 8,
    scene.player_start[1] * 16 + 8,
  ]);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    setHorizon(scene.m7_horizon ?? 56);
    setAnchor(scene.m7_anchor ?? 176);
    setAngle(0);
    setCam([scene.player_start[0] * 16 + 8, scene.player_start[1] * 16 + 8]);
  }, [scene.name, scene.m7_horizon, scene.m7_anchor]);

  // ---- the plane, rendered flat once ------------------------------------
  // 16 px per map cell, the same expansion the engine does when it turns
  // 16x16 blocks into pairs of 8x8 plane tiles. Rebuilt only when the map
  // or its graphics change, never when the camera moves.
  const plane = useMemo(() => {
    if (!tileset) return null;
    const w = scene.width * 16;
    const h = scene.height * 16;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    const perRow = Math.max(1, Math.floor(tileset.width / 16));
    // Only the LOWER layer exists on a plane: Mode 7 has one background,
    // which is why the scene tab refuses to paint an upper layer here.
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        const t = scene.tilemap[y][x];
        if (t === EMPTY_TILE) continue;
        if (t >= AUTOTILE_BASE) {
          const img = autotiles[t - AUTOTILE_BASE];
          if (!img) continue;
          drawAutotileCell(ctx, img, x * 16, y * 16, 16, (ox, oy) => {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= scene.width || ny >= scene.height) return true;
            return scene.tilemap[ny][nx] === t;
          });
          continue;
        }
        ctx.drawImage(tileset, (t % perRow) * 16, Math.floor(t / perRow) * 16, 16, 16,
                      x * 16, y * 16, 16, 16);
      }
    }
    return { data: ctx.getImageData(0, 0, w, h), w, h };
  }, [scene.tilemap, scene.width, scene.height, tileset, autotiles]);

  // ---- the sky image, as pixels, when there is one ----------------------
  const skyPix = useMemo(() => {
    if (!skyImage) return null;
    const cv = document.createElement("canvas");
    cv.width = skyImage.width;
    cv.height = skyImage.height;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(skyImage, 0, 0);
    return { data: ctx.getImageData(0, 0, cv.width, cv.height), w: cv.width, h: cv.height };
  }, [skyImage]);

  const da = anchor - horizon;
  const viewOk = horizon <= 180 && anchor <= 216 && da >= 16;
  // The first line the plane is allowed to show, the engine's own rule:
  // above it the sampled point is still inside the plane for the columns
  // near x = 128, and a rectangle of map would hang in the sky.
  const sky = horizon + Math.floor(da / 8) + 1;
  const theta = steps ? (angle * Math.PI * 2) / steps : 0;

  // ---- the render -------------------------------------------------------
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !plane || !viewOk) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const out = ctx.createImageData(SCREEN_W, SCREEN_H);
    const o = out.data;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // The rotation centre: the camera pushed dA units "behind" itself,
    // and behind turns with the camera (engine §7.2d).
    const x0 = cam[0] - da * sin;
    const y0 = cam[1] + da * cos;

    // --- the sky, line by line ---
    const flat = hexToRgb(scene.m7_sky, [0, 0, 0]);
    const top = hexToRgb(scene.m7_sky_top, flat);
    const bot = hexToRgb(scene.m7_sky_bottom, flat);
    const grad = !!(scene.m7_sky_top && scene.m7_sky_bottom);
    for (let y = 0; y < sky && y < SCREEN_H; y++) {
      let r = flat[0], g = flat[1], b = flat[2];
      if (grad) {
        const t = sky > 1 ? y / (sky - 1) : 0;
        r = Math.round(top[0] + (bot[0] - top[0]) * t);
        g = Math.round(top[1] + (bot[1] - top[1]) * t);
        b = Math.round(top[2] + (bot[2] - top[2]) * t);
      }
      for (let x = 0; x < SCREEN_W; x++) {
        const i = (y * SCREEN_W + x) << 2;
        o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255;
      }
    }
    // A sky IMAGE sits on the flat colour with its bottom on the horizon,
    // its index 0 transparent — which is what lets clouds show the colour
    // behind them.
    if (skyPix) {
      const src = skyPix.data.data;
      for (let y = 0; y < sky && y < SCREEN_H; y++) {
        const sy = y - (sky - skyPix.h);
        if (sy < 0 || sy >= skyPix.h) continue;
        for (let x = 0; x < SCREEN_W; x++) {
          const sx = x % skyPix.w;
          const si = (sy * skyPix.w + sx) << 2;
          if (src[si + 3] === 0) continue;
          const i = (y * SCREEN_W + x) << 2;
          o[i] = src[si]; o[i + 1] = src[si + 1]; o[i + 2] = src[si + 2]; o[i + 3] = 255;
        }
      }
    }

    // --- the plane ---
    const src = plane.data.data;
    for (let y = sky; y < SCREEN_H; y++) {
      const d = y - horizon;
      const s = da / d;
      const a = s * cos;
      const bb = s * s * sin;
      const c = s * sin;
      const dd = -s * s * cos;
      // px and py are affine in x, so the per-column step is a constant:
      // one multiply per line and two adds per pixel, which is exactly
      // what the hardware does.
      let px = a * (0 - 128) + bb * d + x0;
      let py = c * (0 - 128) + dd * d + y0;
      for (let x = 0; x < SCREEN_W; x++, px += a, py += c) {
        const i = (y * SCREEN_W + x) << 2;
        // Outside the 128x128-tile plane the PPU repeats character 0,
        // which the engine leaves blank: the sky colour shows.
        const wx = ((px % PLANE_PX) + PLANE_PX) % PLANE_PX;
        const wy = ((py % PLANE_PX) + PLANE_PX) % PLANE_PX;
        if (wx >= plane.w || wy >= plane.h) {
          o[i] = flat[0]; o[i + 1] = flat[1]; o[i + 2] = flat[2]; o[i + 3] = 255;
          continue;
        }
        const si = ((wy | 0) * plane.w + (wx | 0)) << 2;
        if (src[si + 3] === 0) {
          // An ERASED cell inside the map is not the same thing as being
          // outside it: datagen compiles the eraser to a black block (S10,
          // "black in game"), while past the painted area the plane holds
          // character 0 and shows CGRAM colour 0 — the sky. Two different
          // blanks, and the preview keeps them apart because the game does.
          o[i] = 0; o[i + 1] = 0; o[i + 2] = 0; o[i + 3] = 255;
          continue;
        }
        o[i] = src[si]; o[i + 1] = src[si + 1]; o[i + 2] = src[si + 2]; o[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);

    // --- the sprites, through the INVERSE transform (engine m7_project) ---
    ctx.imageSmoothingEnabled = false;
    if (showEvents && sprites) {
      for (const ev of scene.events) {
        if (ev.sprite < 0) continue; /* invisible event: a trigger */
        const ux = ev.x * 16 + 8 - cam[0];
        const uy = ev.y * 16 + 8 - cam[1];
        const d0 = ux * sin - uy * cos + da;
        if (d0 <= 0) continue; /* behind the camera */
        const dpix = (da * da) / d0;
        const sy = horizon + dpix;
        if (dpix < 2 || sy > 232) continue;
        const sx = 128 + ((ux * cos + uy * sin) * da) / d0;
        if (sx < -8 || sx > 264) continue;
        ctx.drawImage(sprites, eventFrame(ev) * 16, 0, 16, 24,
                      Math.round(sx) - 8, Math.round(sy) - 16 - 8, 16, 24);
      }
    }
    // The hero: always on the anchor line, always in the middle — that is
    // what "the camera IS the hero" means, and it is why he needs no
    // projection of his own.
    if (sprites) ctx.drawImage(sprites, 0, 0, 16, 24, 120, anchor - 16 - 8, 16, 24);
  }, [plane, skyPix, cam, horizon, anchor, angle, steps, theta, da, sky, viewOk,
      scene.m7_sky, scene.m7_sky_top, scene.m7_sky_bottom, scene.events, sprites,
      showEvents]);

  // ---- moving the camera: drag on the image ------------------------------
  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: cam[0], cy: cam[1] };
  };
  const onMove = (e: React.MouseEvent) => {
    const g = drag.current;
    if (!g) return;
    // Dragging moves the GROUND, so the camera goes the other way; the
    // rotation applies to the drag too, or a turned view would scroll
    // sideways when you pull it forward.
    const dx = (e.clientX - g.x) / zoom;
    const dy = (e.clientY - g.y) / zoom;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    setCam([
      Math.round(g.cx - dx * cos - dy * sin),
      Math.round(g.cy - dx * sin + dy * cos),
    ]);
  };
  const onUp = () => { drag.current = null; };

  const viewChanged =
    horizon !== (scene.m7_horizon ?? 56) || anchor !== (scene.m7_anchor ?? 176);

  return (
    <div className="modal-backdrop">
      <div className="modal m7preview" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">
          Aperçu Mode 7 — « {scene.name} »
          <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button>
        </div>

        {!tileset && <p className="hint">Tileset introuvable : rien à projeter.</p>}
        {!viewOk && (
          <p className="hint">
            Horizon 0-180, ancrage 0-216, et au moins 16 lignes d'écart. En
            dessous, la perspective sort du registre et tout l'écran devient
            ciel — datagen refuse ces valeurs, l'aperçu aussi.
          </p>
        )}

        <div className="m7preview-row">
          <canvas
            ref={cvRef}
            width={SCREEN_W}
            height={SCREEN_H}
            className="m7preview-canvas"
            style={{ width: SCREEN_W * zoom, height: SCREEN_H * zoom, cursor: "move" }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          />
          <div className="m7preview-side">
            <label>
              Horizon — ligne {horizon}
              <input type="range" min={0} max={180} value={horizon}
                     onChange={(e) => setHorizon(Number(e.target.value))} />
            </label>
            <label>
              Ancrage — ligne {anchor}
              <input type="range" min={16} max={216} value={anchor}
                     onChange={(e) => setAnchor(Number(e.target.value))} />
            </label>
            <p className="hint">
              L'écart EST l'inclinaison : {da} lignes
              {da >= 150 ? " — presque vue de dessus"
                : da <= 70 ? " — sol très rasant" : ""}.
            </p>
            {steps > 0 ? (
              <label>
                Rotation — cran {angle} / {steps} ({((angle * 360) / steps).toFixed(1)}°)
                <input type="range" min={0} max={steps - 1} value={Math.min(angle, steps - 1)}
                       onChange={(e) => setAngle(Number(e.target.value))} />
              </label>
            ) : (
              <p className="hint">
                Rotation désactivée sur cette scène : le nord reste en haut.
                Elle s'active dans l'onglet Scène.
              </p>
            )}
            <label>
              Zoom d'affichage
              <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                <option value={1}>1:1 (256x224)</option>
                <option value={2}>x2</option>
                <option value={3}>x3</option>
              </select>
            </label>
            <label className="m7preview-check">
              <input type="checkbox" checked={showEvents}
                     onChange={(e) => setShowEvents(e.target.checked)} />
              Montrer les événements
            </label>
            <p className="hint">
              Caméra en {Math.floor(cam[0] / 16)}, {Math.floor(cam[1] / 16)} —
              glissez l'image pour vous déplacer sur la carte.
            </p>
            <button disabled={!viewChanged || !viewOk}
                    onClick={() => props.onApplyView(horizon, anchor)}>
              Appliquer l'angle à la scène
            </button>
          </div>
        </div>

        <p className="hint">
          Ce n'est pas une imitation : l'aperçu applique ligne par ligne la
          même matrice que le PPU, à partir des mêmes nombres que datagen
          compile. Deux écarts assumés — les sprites ne rapetissent pas avec
          la distance (la SNES ne sait pas réduire un sprite) et l'aperçu les
          projette TOUS, là où le moteur n'en traite que trois par image et
          fait tourner les autres.
        </p>

        <div className="modal-actions">
          <button onClick={props.onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
