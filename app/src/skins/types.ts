import type { Palette, Pose } from "../rig";

/**
 * A character skin. To add one: create a file in this folder exporting a Skin, then add it to SKINS in index.ts.
 * draw() runs in logical pixels with the origin between the feet (y up is negative) and the character facing +x.
 * Skins get the same Pose as every other skin, so all activities work for free; interpret limbs however fits
 * (e.g. quadrupeds use arms as front legs). Use pal for project colors (body or an accent like a collar).
 */
export interface Skin {
  id: string;
  label: string;
  /** How to lie down: lie < 0 resting, lie > 0 dead. Returns an extra transform applied before draw(). */
  lie(lie: number): { rot: number; pivotY: number; dx: number; dy: number };
  draw(ctx: CanvasRenderingContext2D, p: Pose, pal: Palette, t: number): void;
}

/** A limb hanging from (x, y), rotated outward by `angle` (pass -angle for the left side). */
export function limb(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, w: number, len: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.fillRect(-w / 2, 0, w, len);
  ctx.restore();
}

/** Lying for upright characters: tip over backwards to rest, forwards when dead. */
export const uprightLie = (height = 10) => (lie: number) => ({
  rot: (lie * Math.PI) / 2,
  pivotY: 0,
  dx: -lie * 6,
  dy: -Math.abs(lie) * (height / 2),
});

/** Lying for four-legged characters: crouch low to rest, roll belly-up when dead. */
export const quadrupedLie = (bodyY: number) => (lie: number) =>
  lie > 0
    ? { rot: lie * Math.PI, pivotY: bodyY, dx: 0, dy: 0 }
    : { rot: 0, pivotY: bodyY, dx: 0, dy: -lie * 3 };

/** Two-eye face (front view). Eye centers at ex, row y. */
export function frontEyes(ctx: CanvasRenderingContext2D, p: Pose, ex: number[], y: number, color: string, size = 1.5) {
  for (const x of ex) eye(ctx, p, x, y, color, size);
}

/** One eye centered at (x, y). */
export function eye(ctx: CanvasRenderingContext2D, p: Pose, x: number, y: number, color: string, size = 1.5) {
  ctx.fillStyle = color;
  const h = size / 2;
  switch (p.eyes) {
    case "open": ctx.fillRect(x - h, y - h, size, size); break;
    case "wide": ctx.fillRect(x - h - 0.25, y - h - 0.5, size + 0.5, size + 0.5); break;
    case "half": ctx.fillRect(x - h, y, size, h); break;
    case "closed": ctx.fillRect(x - h - 0.25, y + 0.25, size + 0.5, 0.5); break;
    case "x":
      ctx.fillStyle = "#ff6b6b";
      ctx.fillRect(x - 1, y - 1, 0.6, 0.6); ctx.fillRect(x + 0.4, y - 1, 0.6, 0.6);
      ctx.fillRect(x - 0.3, y - 0.3, 0.6, 0.6);
      ctx.fillRect(x - 1, y + 0.4, 0.6, 0.6); ctx.fillRect(x + 0.4, y + 0.4, 0.6, 0.6);
      break;
  }
}

// ---------- chibi characters ----------
// Big round head, small body, stubby limbs. drawBot() adds the dark outline around the whole character.

/** Rectangle with 1px corners cut off. */
export function blobRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 1) {
  ctx.fillRect(x + r, y, w - 2 * r, h);
  ctx.fillRect(x, y + r, w, h - 2 * r);
}

/** Tall dot eye with a glint, the chibi way. */
export function chibiEye(ctx: CanvasRenderingContext2D, p: Pose, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  switch (p.eyes) {
    case "open": ctx.fillRect(x - 0.75, y - 1, 1.5, 2); break;
    case "wide": ctx.fillRect(x - 1, y - 1.5, 2, 2.75); break;
    case "half": ctx.fillRect(x - 0.75, y, 1.5, 1); return;
    case "closed": ctx.fillRect(x - 1, y + 0.25, 2, 0.6); ctx.fillRect(x - 1.5, y - 0.25, 0.6, 0.6); ctx.fillRect(x + 0.9, y - 0.25, 0.6, 0.6); return;
    case "x": eye(ctx, p, x, y, color); return;
  }
  if (!p.ghost) { ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 0.75, y - 1, 0.6, 0.6); }
}

export interface Chibi {
  body: string;
  shade: string; // legs, back arm
  head?: string; // defaults to body
  belly?: string;
  eye?: string;
  headW?: number;
  headH?: number;
  face?: boolean; // default eyes, blush and mouth (false = skin draws its own in headFront)
  behind?(ctx: CanvasRenderingContext2D, p: Pose, t: number): void; // body space, before anything (tails)
  headBack?(ctx: CanvasRenderingContext2D, p: Pose, t: number, w: number, h: number): void; // head space, behind the head (ears)
  headFront?(ctx: CanvasRenderingContext2D, p: Pose, t: number, w: number, h: number): void; // head space, on top of the face
  bodyFront?(ctx: CanvasRenderingContext2D, p: Pose): void; // body space, over the body (collars, scarves)
}

export const CHIBI_HEIGHT = 19; // feet to top of head, before ears and antennae
const BLUSH = "rgba(255, 120, 150, 0.55)";

export function chibi(ctx: CanvasRenderingContext2D, p: Pose, pal: Palette, c: Chibi, t: number) {
  const ghost = p.ghost;
  const body = ghost ? pal.body : c.body;
  const shade = ghost ? pal.dark : c.shade;
  const head = ghost ? pal.body : c.head ?? c.body;
  const w = c.headW ?? 13, h = c.headH ?? 11;
  if (!ghost) c.behind?.(ctx, p, t);

  // legs, or a wavy ghost tail
  if (!ghost) {
    ctx.fillStyle = shade;
    limb(ctx, -1.75, -3, -p.legL, 2.5, 3);
    limb(ctx, 1.75, -3, p.legR, 2.5, 3);
  } else {
    ctx.fillStyle = body;
    ctx.fillRect(-3.5, -3.5, 7, 1.5); ctx.fillRect(-3.5, -2, 1.75, 1.5); ctx.fillRect(-0.75, -2, 1.75, 1.5); ctx.fillRect(2, -2, 1.5, 1);
  }
  ctx.fillStyle = shade;
  limb(ctx, -3, -7.5, -p.armL, 2, 3.5); // back arm sits behind the body

  ctx.fillStyle = body;
  blobRect(ctx, -3.5, -8, 7, 5.5);
  if (c.belly && !ghost) { ctx.fillStyle = c.belly; blobRect(ctx, -2, -6.5, 4, 3.5); }
  if (!ghost) c.bodyFront?.(ctx, p);

  ctx.save();
  ctx.translate(0, -7.5);
  ctx.rotate(p.head);
  c.headBack?.(ctx, p, t, w, h);
  ctx.fillStyle = head;
  blobRect(ctx, -w / 2, -h, w, h, 1.5);
  if (c.face !== false) {
    const e = ghost ? "#3b3b55" : c.eye ?? "#1f1a24";
    // the face leans a little toward where the character is going
    chibiEye(ctx, p, -2.25 + 0.5, -h * 0.45, e);
    chibiEye(ctx, p, 2.75 + 0.5, -h * 0.45, e);
    if (!ghost) { ctx.fillStyle = BLUSH; ctx.fillRect(-4.75, -h * 0.45 + 1.75, 2, 1); ctx.fillRect(4.25, -h * 0.45 + 1.75, 2, 1); }
    ctx.fillStyle = p.mouth === "yawn" ? "#c2415d" : e;
    if (p.mouth === "yawn") ctx.fillRect(-0.25, -h * 0.45 + 1.5, 1.5, 1.75);
    else if (p.mouth === "o") ctx.fillRect(0, -h * 0.45 + 1.75, 1, 1);
    else { ctx.fillRect(-0.25, -h * 0.45 + 2, 0.75, 0.5); ctx.fillRect(0.5, -h * 0.45 + 2, 0.75, 0.5); ctx.fillRect(0.25, -h * 0.45 + 2.5, 0.5, 0.5); }
  }
  c.headFront?.(ctx, p, t, w, h);
  ctx.restore();

  ctx.fillStyle = body;
  limb(ctx, 3, -7.5, p.armR, 2, 3.5);
}
