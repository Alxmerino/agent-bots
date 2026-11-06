import { blobRect, chibi, chibiEye, uprightLie, type Skin } from "./types";

// Chibi robot in the project color: boxy head with a screen face and an antenna bulb.
export const robot: Skin = {
  id: "robot",
  label: "Bots",
  lie: uprightLie(12),
  draw(ctx, p, pal, t) {
    chibi(ctx, p, pal, {
      body: pal.body, shade: pal.dark, belly: pal.light, face: false,
      headBack(ctx, p, t, _w, h) {
        // antenna with a bulb that blinks while awake
        ctx.fillStyle = pal.dark;
        ctx.fillRect(-0.5, -h - 2.5, 1, 2.5);
        ctx.fillStyle = p.ghost ? pal.light : p.eyes === "closed" || Math.sin(t * 4) < 0.6 ? "#ffd43b" : "#fff8d6";
        blobRect(ctx, -1.25, -h - 4.5, 2.5, 2.5, 0.5);
        // ear bolts
        ctx.fillStyle = pal.dark;
        ctx.fillRect(-7.5, -h * 0.6, 1.5, 3); ctx.fillRect(6, -h * 0.6, 1.5, 3);
      },
      headFront(ctx, p, _t, w, h) {
        ctx.fillStyle = p.ghost ? "rgba(40,40,60,0.25)" : "#232331";
        blobRect(ctx, -w / 2 + 2, -h + 2.5, w - 4, h - 4.5, 1);
        const e = p.ghost ? "#3b3b55" : "#7ef9ff";
        chibiEye(ctx, p, -2, -h * 0.5, e);
        chibiEye(ctx, p, 3, -h * 0.5, e);
        if (p.mouth === "yawn") { ctx.fillStyle = "#ff8fa3"; ctx.fillRect(0, -3.75, 1.5, 1.5); }
        else if (p.mouth === "o") { ctx.fillStyle = e; ctx.fillRect(0.25, -3.5, 1, 1); }
        else if (!p.ghost) { ctx.fillStyle = "rgba(255,143,163,0.7)"; ctx.fillRect(-4.25, -3.75, 1.5, 0.75); ctx.fillRect(4.75, -3.75, 1.5, 0.75); }
      },
    }, t);
  },
};
