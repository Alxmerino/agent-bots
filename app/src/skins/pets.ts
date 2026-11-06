import type { Palette } from "../rig";
import { blobRect, chibi, uprightLie, type Skin } from "./types";

// Chibi pets standing upright, like plush toys. Coat comes from the project hue; the collar is the project color.

function coat(pal: Palette, coats: [string, string, string][]): [string, string, string] {
  return coats[Math.floor(pal.hue / 30) % coats.length];
}

function collar(ctx: CanvasRenderingContext2D, pal: Palette, tag: string) {
  ctx.fillStyle = pal.body;
  ctx.fillRect(-3.5, -8, 7, 1.25);
  ctx.fillStyle = tag;
  ctx.fillRect(0, -7, 1.25, 1.25);
}

// [fur, shade, muzzle/belly]
const DOG_COATS: [string, string, string][] = [
  ["#c68642", "#8d5a2b", "#f1d3a8"], ["#e8d5b5", "#b89c74", "#fff6e6"], ["#6b5444", "#45352a", "#c9ab8e"],
  ["#d9d9d9", "#a3a3a3", "#ffffff"], ["#4a4a4f", "#2c2c30", "#bdbdc4"], ["#b0623a", "#7a4024", "#f0c9a6"],
];

export const dog: Skin = {
  id: "dog",
  label: "Dogs",
  lie: uprightLie(12),
  draw(ctx, p, pal, t) {
    const [fur, shade, light] = coat(pal, DOG_COATS);
    chibi(ctx, p, pal, {
      body: fur, shade, belly: light,
      behind(ctx, p, t) {
        // wagging tail
        ctx.save();
        ctx.translate(-3, -5.5);
        ctx.rotate(-1.1 + Math.sin(t * (p.eyes === "closed" ? 2 : 11)) * 0.4);
        ctx.fillStyle = fur;
        ctx.fillRect(-0.75, -4, 1.75, 4);
        ctx.restore();
      },
      headFront(ctx, p, _t, w, h) {
        // muzzle and nose
        if (!p.ghost) { ctx.fillStyle = light; blobRect(ctx, -2, -h * 0.45 + 0.75, 5, 3.25, 1); }
        ctx.fillStyle = p.ghost ? "#3b3b55" : "#1f1a24";
        ctx.fillRect(-0.25, -h * 0.45 + 0.75, 1.75, 1.25);
        if (p.mouth === "o" && !p.ghost) { ctx.fillStyle = "#e05a77"; ctx.fillRect(0, -h * 0.45 + 3, 1.25, 1.5); } // tongue
        // floppy ears over the sides of the head
        ctx.fillStyle = p.ghost ? pal.dark : shade;
        const flop = p.lie < 0 ? 0.5 : 0;
        blobRect(ctx, -w / 2 - 1, -h + 1 + flop, 3, 6.5, 1);
        blobRect(ctx, w / 2 - 2, -h + 1 + flop, 3, 6.5, 1);
      },
      bodyFront: (ctx) => collar(ctx, pal, "#ffd43b"),
    }, t);
  },
};

const CAT_COATS: [string, string, string][] = [
  ["#f4a24e", "#c97a2c", "#ffe2bd"], ["#3a3a40", "#222226", "#9a9aa3"], ["#a6a6ad", "#77777e", "#e6e6ea"],
  ["#f5f0e6", "#cfc6b3", "#ffffff"], ["#8a684f", "#5b4433", "#d9bfa6"], ["#e3cfae", "#b39b76", "#fbf1df"],
];

export const cat: Skin = {
  id: "cat",
  label: "Cats",
  lie: uprightLie(12),
  draw(ctx, p, pal, t) {
    const [fur, shade, light] = coat(pal, CAT_COATS);
    chibi(ctx, p, pal, {
      body: fur, shade, belly: light,
      behind(ctx, _p, t) {
        // curly tail swaying out to the side
        const sway = Math.sin(t * 2.2) * 0.2;
        ctx.save();
        ctx.translate(-3, -4);
        ctx.fillStyle = fur;
        for (const bend of [-1.2, -0.5, 0.6]) {
          ctx.rotate(bend + sway);
          ctx.fillRect(-0.75, -3, 1.75, 3);
          ctx.translate(0, -2.75);
        }
        ctx.restore();
      },
      headBack(ctx, p, _t, w, h) {
        // pointy ears
        ctx.fillStyle = p.ghost ? pal.body : fur;
        for (const x of [-w / 2 + 0.5, w / 2 - 4.5]) {
          ctx.fillRect(x, -h - 1.5, 4, 2); ctx.fillRect(x + 0.5, -h - 2.5, 3, 1); ctx.fillRect(x + 1, -h - 3.5, 2, 1);
        }
        if (!p.ghost) {
          ctx.fillStyle = "#f29bb0";
          ctx.fillRect(-w / 2 + 1.75, -h - 1.5, 1.5, 1.5); ctx.fillRect(w / 2 - 3.25, -h - 1.5, 1.5, 1.5);
        }
      },
      headFront(ctx, p, _t, _w, h) {
        if (p.ghost) return;
        // forehead stripes and whiskers
        ctx.fillStyle = shade;
        ctx.fillRect(-1.5, -h, 1, 2); ctx.fillRect(0.25, -h, 1, 2.5); ctx.fillRect(2, -h, 1, 2);
        ctx.fillStyle = "rgba(31,26,36,0.55)";
        ctx.fillRect(-6, -h * 0.45 + 1.25, 2, 0.4); ctx.fillRect(5, -h * 0.45 + 1.25, 2, 0.4);
        ctx.fillRect(-6, -h * 0.45 + 2.25, 2, 0.4); ctx.fillRect(5, -h * 0.45 + 2.25, 2, 0.4);
      },
      bodyFront: (ctx) => collar(ctx, pal, "#ffd43b"),
    }, t);
  },
};

