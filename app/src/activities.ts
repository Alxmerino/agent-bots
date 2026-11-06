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
  start(b) {
    // face toward the wider side so the slide (backwards) has room
    b.facing = b.x > b.width / 2 ? 1 : -1;
  },
  update(dt, b) {
    b.x -= b.facing * 22 * b.speed * (b.scale / 3) * dt;
    b.x = b.clampX(b.x);
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

export const WORKING: { a: Activity; w: number }[] = [
  { a: run, w: 3 },
  { a: moonwalk, w: 1 },
  { a: robotDance, w: 1 },
  { a: jumpingJacks, w: 1 },
  { a: flip, w: 1 },
  { a: painting, w: 1 },
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
