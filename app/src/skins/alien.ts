import { blobRect, chibi, uprightLie, type Skin } from "./types";

// Chibi alien in the project color: wide head, big glossy eyes, bobbing antennae.
export const alien: Skin = {
  id: "alien",
  label: "Aliens",
  lie: uprightLie(12),
  draw(ctx, p, pal, t) {
    chibi(ctx, p, pal, {
      body: pal.body, shade: pal.dark, belly: pal.light, headW: 15, headH: 10, face: false,
      headBack(ctx, p, t, _w, h) {
        const bob = Math.sin(t * 5) * 0.5;
        ctx.fillStyle = pal.dark;
        ctx.fillRect(-4, -h - 2.5, 1, 3); ctx.fillRect(3, -h - 2.5, 1, 3);
        ctx.fillStyle = p.ghost ? pal.light : "#fff36b";
        blobRect(ctx, -4.75, -h - 4.5 + bob, 2.5, 2.5, 0.5); blobRect(ctx, 2.25, -h - 4.5 - bob, 2.5, 2.5, 0.5);
      },
      headFront(ctx, p, _t, _w, h) {
        const e = p.ghost ? "#3b3b55" : "#101014";
        const y = -h * 0.55;
        ctx.fillStyle = e;
        if (p.eyes === "closed" || p.eyes === "half") {
          ctx.fillRect(-4.5, y + 0.5, 3, 0.75); ctx.fillRect(2, y + 0.5, 3, 0.75);
        } else if (p.eyes === "x") {
          ctx.fillStyle = "#ff6b6b";
          for (const x of [-3, 3.5]) { ctx.fillRect(x - 1, y - 1, 0.75, 0.75); ctx.fillRect(x + 0.25, y - 1, 0.75, 0.75); ctx.fillRect(x - 0.4, y - 0.4, 0.75, 0.75); ctx.fillRect(x - 1, y + 0.2, 0.75, 0.75); ctx.fillRect(x + 0.25, y + 0.2, 0.75, 0.75); }
        } else {
          const g = p.eyes === "wide" ? 0.5 : 0;
          blobRect(ctx, -5 - g, y - 1.5 - g, 3.5 + g, 3 + g, 0.75);
          blobRect(ctx, 2 , y - 1.5 - g, 3.5 + g, 3 + g, 0.75);
          if (!p.ghost) { ctx.fillStyle = "#ffffff"; ctx.fillRect(-4.5, y - 1.25, 1, 1); ctx.fillRect(2.5, y - 1.25, 1, 1); }
        }
        if (!p.ghost) { ctx.fillStyle = "rgba(255,120,150,0.5)"; ctx.fillRect(-6, y + 2, 1.5, 1); ctx.fillRect(5, y + 2, 1.5, 1); }
        if (p.mouth !== "none") { ctx.fillStyle = p.mouth === "yawn" ? "#3a1030" : e; ctx.fillRect(0, y + 2.5, 1, p.mouth === "yawn" ? 1.5 : 0.75); }
      },
    }, t);
  },
};
