// Draws the 1200x630 link preview (see og.html). Static frame of real bots doing real activities.
import "@fontsource/press-start-2p/400.css";
import * as A from "../../app/src/activities";
import { drawBot, palette } from "../../app/src/rig";
import { getSkin } from "../../app/src/skins";
import type { Activity } from "../../app/src/activities";

const c = document.querySelector("canvas")!;
const ctx = c.getContext("2d")!;
await document.fonts.load('40px "Press Start 2P"');

ctx.fillStyle = "#0f172a";
ctx.fillRect(0, 0, 1200, 630);
ctx.fillStyle = "#ffffff0d"; // the site's dot grid
for (let y = 8; y < 630; y += 16) for (let x = 8; x < 1200; x += 16) ctx.fillRect(x, y, 1, 1);

ctx.fillStyle = "#f8fafc";
ctx.font = '52px "Press Start 2P"';
ctx.fillText("Agent Bots", 72, 130);
ctx.fillStyle = "#a3b1c6";
ctx.font = "600 32px system-ui, -apple-system, sans-serif";
ctx.fillText("A little bot for every Claude Code session.", 74, 192);
ctx.fillStyle = "#22c55e";
ctx.fillText("Free for macOS", 74, 240);

const g = 548, s = 6;
ctx.fillStyle = "#475569";
ctx.fillRect(0, g + s, 1200, 6);
const cast: [string, string, Activity, number][] = [
  ["robot", "agent-bots", A.typing, 2.3],
  ["cat", "docs", A.alert, 0.2],
  ["robot", "api-server", A.treadmill, 0.4],
  ["dog", "marketing-site", A.bricklaying, 13.4],
  ["alien", "design-system", A.sleep, 1.2],
];
cast.forEach(([skin, project, act, t], i) => {
  const x = 150 + i * 225;
  const bot = { x, facing: 1, scale: s, groundY: g, width: 1200, speed: 1, actT: t, data: { dabs: [] }, activity: act } as any;
  act.draw?.(ctx, bot, t);
  drawBot(ctx, x, g, s, 1, act.pose(t, bot), palette(project), getSkin(skin), t);
});
document.title = "ready";
