// Shared pose model + renderer. Skins (src/skins/) draw the actual character.
// All geometry is in logical pixels; origin = between the feet, y up is negative.

import type { Skin } from "./skins/types";

export interface Pose {
  dx: number; // body offset (logical px)
  dy: number;
  rot: number; // whole-body rotation (rad) around (0, pivotY)
  pivotY: number;
  lie: number; // -1 = lying down to rest, +1 = fallen over dead, 0 = upright. Each skin decides how to lie.
  armL: number; // limb angles (rad); 0 = hanging down, positive = outward/up, negative = across the body
  armR: number;
  legL: number;
  legR: number;
  head: number; // head tilt (rad)
  eyes: "open" | "closed" | "x" | "wide" | "half";
  mouth: "none" | "o" | "yawn";
  alpha: number;
  ghost?: boolean;
}

export const BASE: Pose = {
  dx: 0, dy: 0, rot: 0, pivotY: -11, lie: 0,
  armL: 0, armR: 0, legL: 0, legR: 0, head: 0,
  eyes: "open", mouth: "none", alpha: 1,
};

export const pose = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });

export interface Palette {
  hue: number;
  body: string;
  dark: string;
  light: string;
}

// 12 well-separated hues. A project hashes to a slot; if another project already holds it, take the next free one.
const HUES = [0, 210, 120, 45, 280, 175, 25, 330, 90, 240, 155, 60];
const assigned = new Map<string, number>();

export function palette(project: string): Palette {
  let hue = assigned.get(project);
  if (hue === undefined) {
    let h = 0;
    for (const c of project) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const taken = new Set(assigned.values());
    hue = HUES[h % HUES.length];
    for (let i = 0; i < HUES.length && taken.has(hue); i++) hue = HUES[(h + i + 1) % HUES.length];
    assigned.set(project, hue);
  }
  return {
    hue,
    body: `hsl(${hue} 62% 58%)`,
    dark: `hsl(${hue} 45% 34%)`,
    light: `hsl(${hue} 80% 82%)`,
  };
}

const GHOST: Palette = { hue: 0, body: "rgba(255,255,255,0.85)", dark: "rgba(220,225,255,0.7)", light: "rgba(255,255,255,0.85)" };

const OUTLINE = "#1f1a24";
const GHOST_OUTLINE = "rgba(150, 160, 230, 0.6)";

/** The same context, but every fill comes out in one color: draws a character's silhouette. */
function silhouette(ctx: CanvasRenderingContext2D, color: string): CanvasRenderingContext2D {
  return new Proxy(ctx, {
    get(t, k) {
      if (k === "fillStyle") return color;
      const v = Reflect.get(t, k, t);
      return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, k, v) { return Reflect.set(t, k, k === "fillStyle" ? color : v, t); },
  });
}

/** Draw a character with a 1-pixel dark outline. (x, groundY) in screen px, s = pixel scale, facing = 1 right / -1 left, t = clock for idle details. */
export function drawBot(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  s: number,
  facing: number,
  p: Pose,
  pal: Palette,
  skin: Skin,
  t = 0,
) {
  const l = p.lie ? skin.lie(p.lie) : { rot: 0, pivotY: p.pivotY, dx: 0, dy: 0 };
  const pivotY = p.lie ? l.pivotY : p.pivotY;
  const colors = p.ghost ? GHOST : pal;
  const one = (c: CanvasRenderingContext2D, ox: number, oy: number) => {
    c.save();
    c.translate(x + ox + (p.dx + l.dx) * s * facing, groundY + oy + (p.dy + l.dy) * s);
    c.scale(facing * s, s);
    c.translate(0, pivotY);
    c.rotate(p.rot + l.rot);
    c.translate(0, -pivotY);
    skin.draw(c, p, colors, t);
    c.restore();
  };
  ctx.save();
  ctx.globalAlpha *= p.alpha;
  // Outline: the silhouette nudged one bot pixel each way, under the character.
  const sil = silhouette(ctx, p.ghost ? GHOST_OUTLINE : OUTLINE);
  for (const [ox, oy] of [[s, 0], [-s, 0], [0, s], [0, -s]]) one(sil, ox, oy);
  one(ctx, 0, 0);
  ctx.restore();
}
