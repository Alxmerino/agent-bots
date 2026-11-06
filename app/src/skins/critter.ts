import { chibi, uprightLie, type Skin } from "./types";

// Chubby terracotta critter with a sparkle on its head. Project color shows as a scarf.
export const critter: Skin = {
  id: "critter",
  label: "Critters",
  lie: uprightLie(12),
  draw(ctx, p, pal, t) {
    chibi(ctx, p, pal, {
      body: "#d97757", shade: "#b4573a", belly: "#f0a184", eye: "#2a1a14", headW: 14,
      headBack(ctx, p, _t, _w, h) {
        ctx.fillStyle = p.ghost ? pal.light : "#f4c7a8";
        ctx.fillRect(-0.5, -h - 3, 1, 3);
        ctx.fillRect(-1.5, -h - 2, 3, 1);
      },
      bodyFront(ctx) {
        ctx.fillStyle = pal.body;
        ctx.fillRect(-3.5, -8, 7, 1.5);
        ctx.fillRect(1.5, -6.5, 1.5, 2);
      },
    }, t);
  },
};
