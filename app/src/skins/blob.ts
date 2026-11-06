import type { Pose } from "../rig";
import { blobRect, chibiEye, type Skin } from "./types";

// Jelly blob in the project color. No legs: it squashes and stretches instead, with two little nubs
// for arms so dances still read. Resting flattens it; dying melts it into a puddle.
export const blob: Skin = {
  id: "blob",
  label: "Blobs",
  // A blob doesn't tip over; it flattens in draw().
  lie: () => ({ rot: 0, pivotY: 0, dx: 0, dy: 0 }),
  draw(ctx, p: Pose, pal, t) {
    const ghost = p.ghost;
    const step = Math.min(1, Math.abs(p.legL - p.legR)); // 0..1 while walking
    const flat = Math.abs(p.lie); // 0 upright, 1 fully flat
    const wobble = Math.sin(t * 3) * 0.3;
    let w = 14 + step * 1.5 + flat * 6 + wobble;
    let h = 12 - step * 1.5 - flat * (p.lie > 0 ? 9 : 5) - wobble;
    if (p.dy < -0.5) { w -= 1.5; h += 1.5; } // stretched mid-jump
    w = Math.round(w * 2) / 2; h = Math.max(3, Math.round(h * 2) / 2);

    ctx.save();
    ctx.rotate(p.head * 0.5);
    ctx.fillStyle = pal.body;
    // dome: full width at the bottom, rounding in toward the top
    ctx.fillRect(-w / 2, -h * 0.62, w, h * 0.62);
    ctx.fillRect(-w / 2 + 1, -h * 0.82, w - 2, h * 0.2 + 0.05);
    ctx.fillRect(-w / 2 + 2.5, -h * 0.94, w - 5, h * 0.12 + 0.05);
    ctx.fillRect(-w / 2 + 4.5, -h, w - 9, h * 0.06 + 0.05);
    if (!ghost) {
      ctx.fillStyle = pal.dark;
      ctx.fillRect(-w / 2 + 1.5, -1.25, w - 3, 1.25); // base shadow
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(-w / 2 + 3, -h * 0.85, 2, 1); ctx.fillRect(-w / 2 + 2, -h * 0.85 + 1, 1, 1.5); // shine
    } else {
      ctx.fillStyle = pal.body; // ghost drips
      ctx.fillRect(-w / 2 + 1, 0, 2, 1.5); ctx.fillRect(-1, 0, 2, 2); ctx.fillRect(w / 2 - 3, 0, 2, 1.5);
    }

    // arm nubs on the sides
    ctx.fillStyle = ghost ? pal.dark : pal.body;
    for (const [side, a] of [[-1, p.armL], [1, p.armR]] as const) {
      const ang = Math.max(-0.6, Math.min(2.6, a));
      const x = side * (w / 2) + side * Math.sin(ang) * 1.5;
      const y = -h * 0.4 - (1 - Math.cos(ang)) * 2;
      blobRect(ctx, x - 1, y - 1, 2, 2, 0.5);
    }

    // face
    const e = ghost ? "#3b3b55" : "#1f1a24";
    const fy = -Math.max(2, h * 0.5);
    chibiEye(ctx, p, -2 + 0.75, fy, e);
    chibiEye(ctx, p, 2.5 + 0.75, fy, e);
    if (!ghost) { ctx.fillStyle = "rgba(255,120,150,0.55)"; ctx.fillRect(-4.5, fy + 1.75, 2, 1); ctx.fillRect(4, fy + 1.75, 2, 1); }
    ctx.fillStyle = p.mouth === "yawn" ? "#c2415d" : e;
    if (p.mouth === "yawn") ctx.fillRect(0.25, fy + 1.5, 1.5, 1.5);
    else if (p.mouth === "o") ctx.fillRect(0.5, fy + 1.75, 1, 1);
    else { ctx.fillRect(0.25, fy + 2, 0.75, 0.5); ctx.fillRect(1, fy + 2, 0.75, 0.5); }
    ctx.restore();
  },
};
