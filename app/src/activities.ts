import { pose, type Pose } from "./rig";
import type { Bot } from "./bot";

export interface Activity {
  name: string;
  duration: number; // seconds; Infinity = until state changes or update() returns true
  pose(t: number, bot: Bot): Pose;
  start?(bot: Bot): void;
  update?(dt: number, bot: Bot): boolean | void; // return true when finished early
  draw?(ctx: CanvasRenderingContext2D, bot: Bot, t: number): void; // props in screen space
  travels?: boolean; // moves the bot along the strip
}

const { sin, cos, PI, abs, min, max, random } = Math;
const clamp01 = (v: number) => min(1, max(0, v));
const ease = (v: number) => 0.5 - cos(clamp01(v) * PI) / 2;

/** One step of a moving animation that keeps near where the turn began (turns around at the edge of
 *  its range), so a bot that moonwalks or sweeps all turn doesn't wander into the others. */
function pace(b: Bot, dir: number, speed: number, dt: number) {
  const next = b.clampX(b.x + dir * speed * b.speed * (b.scale / 3) * dt);
  if (next === b.x || Math.abs(next - b.home) > 28 * b.scale) b.facing = -b.facing;
  else b.x = next;
}

const runPose = (t: number, f = 11): Pose =>
  pose({
    legL: max(0, sin(t * f)) * 0.7,
    legR: max(0, -sin(t * f)) * 0.7,
    armL: 0.5 + sin(t * f) * 0.5,
    armR: 0.5 - sin(t * f) * 0.5,
    dy: -abs(sin(t * f)) * 1,
    rot: 0.12,
    eyes: "open",
  });

// ---------- working ----------

export const run: Activity = {
  name: "running",
  duration: 8,
  travels: true,
  start(b) {
    b.data.target = b.randomX();
    b.facing = b.data.target > b.x ? 1 : -1;
  },
  update(dt, b) {
    const step = 70 * b.speed * (b.scale / 3) * dt;
    const d = b.data.target - b.x;
    if (abs(d) <= step) { b.x = b.data.target; return true; }
    b.x += Math.sign(d) * step;
  },
  pose: (t) => runPose(t),
};

export const moonwalk: Activity = {
  name: "moonwalking",
  duration: 4.5,
  travels: true,
  update(dt, b) {
    pace(b, -b.facing, 22, dt); // slides backwards
  },
  pose(t) {
    const ph = (t * 2.2) % 1;
    const a = ph < 0.5 ? ph * 2 : 2 - ph * 2; // 0..1..0
    return pose({
      legL: -0.35 * a + 0.1,
      legR: -0.35 * (1 - a) + 0.1,
      dy: -0.4 * sin(ph * PI * 2),
      armL: 0.25 + 0.2 * sin(t * 4.4),
      armR: 0.25 - 0.2 * sin(t * 4.4),
      head: -0.08,
      rot: -0.06,
      eyes: "half",
    });
  },
};

export const robotDance: Activity = {
  name: "doing the robot",
  duration: 4,
  pose(t) {
    const beat = Math.floor(t * 4);
    const moves: [number, number, number][] = [
      [PI / 2, 0, 0.15], [PI / 2, PI / 2, -0.15], [0, PI / 2, 0.15], [PI, 0, 0],
      [PI / 2, PI, -0.15], [0, 0, 0.15], [PI / 2, PI * 0.75, 0], [PI * 0.75, PI / 2, -0.15],
    ];
    const [aL, aR, head] = moves[beat % moves.length];
    return pose({
      armL: aL, armR: aR, head,
      legL: beat % 2 ? 0.25 : 0, legR: beat % 2 ? 0 : 0.25,
      dy: beat % 2 ? -0.5 : 0,
      eyes: beat % 4 === 3 ? "closed" : "open",
    });
  },
};

export const jumpingJacks: Activity = {
  name: "doing jumping jacks",
  duration: 3.6,
  pose(t) {
    const ph = (sin(t * 7.5 - PI / 2) + 1) / 2; // 0..1
    return pose({
      dy: -3 * abs(sin(t * 7.5 / 2)),
      armL: PI * 0.95 * ph, armR: PI * 0.95 * ph,
      legL: 0.45 * ph, legR: 0.45 * ph,
      mouth: ph > 0.5 ? "o" : "none",
    });
  },
};

export const flip: Activity = {
  name: "doing flips",
  duration: 2.2,
  pose(t) {
    const one = 1.1;
    const k = (t % one) / one; // 0..1 per flip
    const air = clamp01((k - 0.15) / 0.7);
    const crouch = k < 0.15 ? sin((k / 0.15) * PI) : k > 0.85 ? sin(((k - 0.85) / 0.15) * PI) : 0;
    return pose({
      dy: -sin(air * PI) * 14 + crouch * 1.5,
      rot: -ease(air) * PI * 2,
      armL: air > 0 && air < 1 ? PI * 0.9 : -0.4 * crouch,
      armR: air > 0 && air < 1 ? PI * 0.9 : -0.4 * crouch,
      legL: air > 0 && air < 1 ? 0.35 : 0,
      legR: air > 0 && air < 1 ? 0.35 : 0,
      eyes: air > 0.3 && air < 0.7 ? "wide" : "open",
    });
  },
};

interface Dab { x: number; y: number; c: string; w: number }

export const painting: Activity = {
  name: "painting",
  duration: 6,
  start(b) {
    const dabs: Dab[] = [];
    b.data.dabs = dabs;
    b.data.next = 0;
  },
  update(_dt, b) {
    const t = b.actT;
    if (t > 0.6 && t < b.activity.duration - 0.8 && t > b.data.next) {
      b.data.next = t + 0.18;
      const hue = Math.floor(random() * 360);
      (b.data.dabs as Dab[]).push({ x: random() * 7, y: random() * 7, c: `hsl(${hue} 85% 60%)`, w: 1 + random() });
    }
  },
  pose(t) {
    const stroke = sin(t * 9);
    return pose({
      armR: 1.25 + stroke * 0.35,
      armL: 0.2,
      head: 0.06 * sin(t * 1.3),
      eyes: t % 3 > 2.8 ? "closed" : "open",
    });
  },
  draw(ctx, b, t) {
    const s = b.scale;
    const fade = min(clamp01(t / 0.4), clamp01((b.activity.duration - t) / 0.5));
    const ex = b.x + b.facing * 9 * s; // easel center
    const g = b.groundY;
    ctx.save();
    ctx.globalAlpha *= fade;
    // legs
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(ex - 4 * s, g - 12 * s, s, 12 * s);
    ctx.fillRect(ex + 3 * s, g - 12 * s, s, 12 * s);
    ctx.fillRect(ex - 4 * s, g - 9 * s, 8 * s, s);
    // canvas
    ctx.fillStyle = "#fbfaf5";
    const cx = ex - 4.5 * s, cy = g - 20 * s;
    ctx.fillRect(cx, cy, 9 * s, 9 * s);
    for (const d of b.data.dabs as Dab[]) {
      ctx.fillStyle = d.c;
      ctx.fillRect(cx + (d.x + 1) * s, cy + (d.y + 1) * s, d.w * s, d.w * s);
    }
    // brush tip follows the front arm roughly
    ctx.restore();
  },
};

// ---------- work ----------
// Props use bot-relative logical px (x forward from the bot, y up is negative) and are drawn before the
// bot, so they sit behind it. rect() mirrors them when the bot faces left.

function rect(ctx: CanvasRenderingContext2D, b: Bot, x: number, y: number, w: number, h: number, c: string) {
  const s = b.scale;
  ctx.fillStyle = c;
  ctx.fillRect(b.x + (b.facing > 0 ? x : -x - w) * s, b.groundY + y * s, w * s, h * s);
}

/** A pixel line (broom and shovel handles). */
function stick(ctx: CanvasRenderingContext2D, b: Bot, x1: number, y1: number, x2: number, y2: number, w: number, c: string) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.5));
  for (let i = 0; i <= n; i++) rect(ctx, b, x1 + ((x2 - x1) * i) / n - w / 2, y1 + ((y2 - y1) * i) / n - w / 2, w, w, c);
}

/** Front hand for a front-arm angle (chibi shoulder at (3, -7.5), arm 3.5 long). */
const hand = (a: number) => ({ x: 3 + 3.5 * sin(a), y: -7.5 + 3.5 * cos(a) });

const CODE = ["#7ef9ff", "#ffd43b", "#ff8fa3", "#a3e635", "#c4b5fd"];

export const typing: Activity = {
  name: "typing at a desk",
  duration: 8,
  pose(t) {
    return pose({
      armR: 1.5 + sin(t * 28) * 0.12,
      armL: 1.4 + sin(t * 28 + 1.7) * 0.12,
      head: t % 4 > 3.5 ? -0.05 : 0.12, // glances up at the screen now and then
      eyes: t % 3 > 2.85 ? "closed" : "open",
    });
  },
  draw(ctx, b, t) {
    rect(ctx, b, 4, -7, 12, 1, "#8b5a2b"); // standing desk
    rect(ctx, b, 5, -6, 1, 6, "#6b4423");
    rect(ctx, b, 14, -6, 1, 6, "#6b4423");
    rect(ctx, b, 5, -7.75, 4, 0.75, "#cbd5e1"); // keyboard
    rect(ctx, b, 11.5, -10, 1, 3, "#475569"); // monitor stand
    rect(ctx, b, 8.5, -17, 7, 7, "#1f1a24");
    rect(ctx, b, 9, -16.5, 6, 6, "#0b1020");
    const top = Math.floor(t * 3); // code scrolls up
    for (let i = 0; i < 4; i++) {
      const n = top + i;
      rect(ctx, b, 9.5 + (n % 3 ? 1 : 0), -16 + i * 1.4, 1 + ((n * 7) % 4), 0.75, CODE[n % CODE.length]);
    }
  },
};

export const sweeping: Activity = {
  name: "sweeping up",
  duration: 6,
  travels: true,
  update(dt, b) {
    pace(b, b.facing, 8, dt);
  },
  pose(t) {
    const sw = sin(t * 6);
    return pose({
      armR: 0.9 + sw * 0.25, armL: 0.7 + sw * 0.25,
      legL: max(0, sw) * 0.3, legR: max(0, -sw) * 0.3,
      rot: 0.08, head: 0.1,
    });
  },
  draw(ctx, b, t) {
    const sw = sin(t * 6);
    const h = hand(0.9 + sw * 0.25);
    const tip = h.x + 5 + sw * 2;
    stick(ctx, b, h.x - 1, h.y - 2, tip, -2, 0.75, "#a16207");
    rect(ctx, b, tip - 1.5, -2.5, 3.5, 0.75, "#92400e");
    rect(ctx, b, tip - 1.5, -1.75, 3.5, 1.75, "#facc15");
    if (sw > 0.2) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const k = (t * 3 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        rect(ctx, b, tip + 2 + k * 4 + i, -1 - k * 3 - i * 0.5, 0.75, 0.75, "#d6d3d1");
      }
      ctx.restore();
    }
  },
};

const SCOOP = 1.6; // seconds per shovelful
/** Front-arm angle while shoveling: dig low, lift, toss over the shoulder, swing back. */
function shovelArm(t: number) {
  const k = (t % SCOOP) / SCOOP;
  if (k < 0.35) return 0.5;
  if (k < 0.6) return 0.5 + ease((k - 0.35) / 0.25) * 0.9;
  if (k < 0.75) return 1.4 + ease((k - 0.6) / 0.15) * 1.8;
  return 3.2 - ease((k - 0.75) / 0.25) * 2.7;
}

export const shoveling: Activity = {
  name: "shoveling",
  duration: SCOOP * 8,
  pose(t) {
    const k = (t % SCOOP) / SCOOP;
    const a = shovelArm(t);
    return pose({
      armR: a, armL: a - 0.2,
      rot: k < 0.35 ? 0.15 : k > 0.6 && k < 0.8 ? -0.1 : 0,
      legL: k < 0.35 ? 0.2 : 0,
      head: k < 0.35 ? 0.15 : -0.05,
      eyes: k > 0.6 && k < 0.8 ? "closed" : "open",
    });
  },
  draw(ctx, b, t) {
    const k = (t % SCOOP) / SCOOP;
    const a = shovelArm(t);
    const h = hand(a);
    const dx = sin(a), dy = cos(a);
    const bx = h.x + dx * 5.5, by = h.y + dy * 5.5; // blade
    stick(ctx, b, h.x - dx, h.y - dy, bx, by, 0.75, "#a16207");
    rect(ctx, b, bx - 1.25, by - 1, 2.5, 2.5, "#94a3b8");
    if (k > 0.35 && k < 0.7) rect(ctx, b, bx - 1, by - 1.5, 2, 1, "#78350f"); // a load of dirt
    // the pile behind grows with every toss
    const pile = min(7, Math.floor(t / SCOOP));
    for (let r = 0; r < pile; r++) rect(ctx, b, -11 - (pile - r) * 0.6, -1 - r * 0.7, (pile - r) * 1.2 + 1, 0.75, r % 2 ? "#92400e" : "#78350f");
    if (k > 0.7 && k < 0.92) { // clod in flight
      const f = (k - 0.7) / 0.22;
      rect(ctx, b, bx + (-11 - bx) * f, by + (-4 - by) * f - sin(f * PI) * 6, 1, 1, "#78350f");
    }
  },
};

const BRICK = 1.1, COLS = 3, ROWS = 5;
/** Front-arm angle while laying bricks: pick one off the stack, lift, set it on the wall. */
function brickArm(t: number) {
  const k = (t % BRICK) / BRICK;
  if (k < 0.3) return 0.6;
  if (k < 0.7) return 0.6 + ease((k - 0.3) / 0.4) * 0.9;
  return 1.5 - ease((k - 0.7) / 0.3) * 0.9;
}

export const bricklaying: Activity = {
  name: "laying bricks",
  duration: COLS * ROWS * BRICK + 2,
  pose(t) {
    const k = (t % BRICK) / BRICK;
    const a = brickArm(t);
    return pose({ armR: a, armL: 0.4 + a * 0.4, rot: k < 0.3 ? 0.2 : 0, head: 0.1 });
  },
  draw(ctx, b, t) {
    const red = "#c2410c";
    rect(ctx, b, 4.5, -1.5, 3, 1.5, red); // stack of bricks at the feet
    rect(ctx, b, 5, -3, 3, 1.5, "#9a3412");
    const laid = min(COLS * ROWS, Math.floor(t / BRICK));
    for (let i = 0; i < laid; i++) {
      const r = Math.floor(i / COLS), c = i % COLS;
      rect(ctx, b, 9.5 + c * 3.25 + (r % 2 ? 1.5 : 0), -1.75 - r * 1.75, 3, 1.5, red);
    }
    const k = (t % BRICK) / BRICK;
    if (laid < COLS * ROWS && k > 0.3 && k < 0.95) {
      const h = hand(brickArm(t));
      rect(ctx, b, h.x - 0.5, h.y - 1, 3, 1.5, red); // brick in hand
    }
  },
};

export const treadmill: Activity = {
  name: "on the treadmill",
  duration: 10,
  pose(t) {
    const p = runPose(t, 13);
    return { ...p, dy: p.dy - 2.5 }; // stand on the belt
  },
  draw(ctx, b, t) {
    rect(ctx, b, -10, -1, 20, 1, "#1f1a24"); // base
    rect(ctx, b, -10, -2.5, 20, 1.5, "#334155"); // belt
    for (let i = 0; i < 5; i++) rect(ctx, b, ((i * 4 + 20 - ((t * 18) % 20)) % 20) - 10, -2.5, 1, 0.5, "#94a3b8"); // belt moves back
    rect(ctx, b, 9, -9, 1, 6.5, "#64748b"); // upright
    rect(ctx, b, 5, -9, 5, 1, "#64748b"); // handlebar
    rect(ctx, b, 7.5, -11, 3, 2, "#0f172a"); // console
    if (t % 1 < 0.6) rect(ctx, b, 8.25, -10.5, 1.5, 0.75, "#22c55e");
  },
};

/** Each working turn plays one of these, and a bot goes through all of them before repeating. */
export const WORKING: Activity[] = [
  treadmill, typing, sweeping, shoveling, bricklaying, painting, moonwalk, robotDance, jumpingJacks, flip,
];
export const MINI_WORKING = [robotDance, jumpingJacks, flip];

// ---------- idle ----------

export const yawn: Activity = {
  name: "yawning",
  duration: 2.4,
  pose(t) {
    const k = sin(clamp01(t / 2.2) * PI);
    return pose({
      armL: PI * 0.85 * k, armR: PI * 0.85 * k,
      head: -0.25 * k,
      dy: -0.6 * k,
      mouth: k > 0.3 ? "yawn" : "none",
      eyes: k > 0.3 ? "closed" : "half",
    });
  },
};

const lying = (k: number): Partial<Pose> => ({
  lie: -ease(k),
  armL: ease(k) * 0.4,
  armR: ease(k) * 0.4,
});

export const lieDown: Activity = {
  name: "lying down",
  duration: 1,
  pose: (t) => pose({ ...lying(t / 1), eyes: "half" }),
};

export const sleep: Activity = {
  name: "sleeping",
  duration: Infinity,
  pose(t) {
    return pose({ ...lying(1), dy: -0.25 * sin(t * 1.8), eyes: "closed" });
  },
  draw(ctx, b, t) {
    const s = b.scale;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textBaseline = "bottom";
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.45 + k / 3) % 1;
      ctx.globalAlpha = sin(ph * PI);
      ctx.font = `bold ${Math.round((4 + ph * 4) * s)}px ui-monospace, monospace`;
      ctx.fillText("z", b.x - b.facing * 14 * s + ph * 6 * s, b.groundY - 8 * s - ph * 10 * s);
    }
    ctx.restore();
  },
};

export const getUp: Activity = {
  name: "getting up",
  duration: 0.6,
  pose: (t) => pose({ ...lying(1 - t / 0.6), eyes: "wide" }),
};

// ---------- waiting ----------

export const alert: Activity = {
  name: "waiting for you",
  duration: Infinity,
  pose(t) {
    const hop = abs(sin(t * 6));
    return pose({
      dy: -hop * 2,
      armR: PI * 0.9 + sin(t * 12) * 0.35, // waving
      armL: 0.2,
      eyes: "wide",
      mouth: "o",
    });
  },
  draw(ctx, b, t) {
    const s = b.scale;
    const y = b.groundY - 30 * s - abs(sin(t * 6)) * 2 * s;
    ctx.save();
    ctx.fillStyle = "#ffd43b";
    ctx.fillRect(b.x - s, y, 2 * s, 5 * s);
    ctx.fillRect(b.x - s, y + 6 * s, 2 * s, 2 * s);
    ctx.restore();
  },
};

// ---------- death ----------

export const DEATH_DURATION = 3.6;

export function deathPose(t: number): Pose {
  if (t < 0.7) {
    // clutch chest, shake
    return pose({
      armL: -2.2, armR: -2.0,
      dx: sin(t * 60) * 0.4,
      head: 0.25,
      eyes: "wide", mouth: "o",
    });
  }
  if (t < 1.5) {
    // stagger back and forth
    const k = (t - 0.7) / 0.8;
    return pose({
      dx: sin(k * PI * 3) * 3,
      rot: sin(k * PI * 3) * 0.25,
      pivotY: 0,
      armL: 2.4 + sin(k * 20) * 0.4, armR: -0.6 + sin(k * 17) * 0.5,
      legL: max(0, sin(k * PI * 3)) * 0.5, legR: max(0, -sin(k * PI * 3)) * 0.5,
      head: -0.3,
      eyes: "half", mouth: "o",
    });
  }
  // fall over, twitch once, lie dead
  const k = clamp01((t - 1.5) / 0.45);
  const fall = k * k; // accelerate
  const twitch = t > 2.15 && t < 2.35 ? sin((t - 2.15) * 50) * 0.6 : 0;
  return pose({
    lie: fall,
    dy: (k >= 1 ? -abs(sin((t - 1.95) * 18)) * max(0, 1 - (t - 1.95) * 4) : 0), // bounce on impact
    armL: 0.8 * fall + twitch, armR: 2.5 * fall,
    legL: twitch * 0.5,
    eyes: "x",
    alpha: t > DEATH_DURATION - 0.6 ? (DEATH_DURATION - t) / 0.6 : 1,
  });
}

export function ghostPose(t: number): Pose | null {
  const start = 2.0;
  if (t < start) return null;
  const k = (t - start) / (DEATH_DURATION - start);
  return pose({
    ghost: true,
    dy: -k * 26,
    dx: sin(k * PI * 4) * 2,
    armL: 2.6 + sin(t * 8) * 0.3, armR: 2.6 - sin(t * 8) * 0.3,
    eyes: "closed",
    alpha: 0.85 * sin(clamp01(k) * PI) + 0.1 * (1 - k),
  });
}
