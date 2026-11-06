import { drawBot, palette, type Palette } from "./rig";
import * as A from "./activities";
import type { Activity } from "./activities";
import type { AgentState, Session } from "./types";
import type { Skin } from "./skins/types";

export interface World {
  width: number;
  groundY: number;
  scale: number;
  speed: number;
  skin: Skin;
  showNames: boolean;
}

/** One bot on the strip. Mini bots (subagents) follow a parent. */
export class Bot {
  x: number;
  facing = 1;
  state: AgentState = "idle";
  activity: Activity = A.sleep;
  actT = 0;
  data: Record<string, any> = {};
  dying = false;
  deathT = 0;
  minis = new Map<string, Bot>();
  pal: Palette;
  session: Session;
  private lastWorking?: Activity;

  constructor(
    session: Session,
    private world: World,
    public parent?: Bot,
    public label = "",
  ) {
    this.session = session;
    this.pal = palette(session.project);
    this.x = parent ? parent.x : this.randomX();
    this.setState(session.state, true);
  }

  get scale() { return this.parent ? Math.max(1, Math.round(this.world.scale * 0.6)) : this.world.scale; }
  get speed() { return this.world.speed; }
  get width() { return this.world.width; }
  get groundY() { return this.world.groundY; }
  get dead() { return this.dying && this.deathT >= A.DEATH_DURATION; }

  clampX(x: number) {
    const m = 24 * this.world.scale;
    return Math.min(this.world.width - m, Math.max(m, x));
  }
  randomX() { return this.clampX(Math.random() * this.world.width); }

  update(s: Session) {
    this.session = s;
    if (s.state !== this.state) this.setState(s.state);
  }

  setState(state: AgentState, initial = false) {
    const wasLying = this.activity === A.sleep || this.activity === A.lieDown;
    this.state = state;
    if (state === "idle") this.play(initial ? A.sleep : A.yawn);
    else if (wasLying && !initial) this.play(A.getUp);
    else if (state === "waiting") this.play(A.alert);
    else this.play(this.pickWorking());
  }

  kill() {
    if (this.dying) return;
    this.dying = true;
    this.deathT = 0;
    for (const m of this.minis.values()) m.kill();
  }

  revive() {
    this.dying = false;
    this.deathT = 0;
    this.play(A.getUp);
  }

  private play(a: Activity) {
    this.activity = a;
    this.actT = 0;
    this.data = {};
    a.start?.(this);
  }

  private pickWorking(): Activity {
    const pool = this.parent
      ? A.MINI_WORKING.map((a) => ({ a, w: 1 }))
      : A.WORKING;
    const choices = pool.filter((c) => c.a !== this.lastWorking);
    let r = Math.random() * choices.reduce((n, c) => n + c.w, 0);
    for (const c of choices) if ((r -= c.w) <= 0) return (this.lastWorking = c.a);
    return (this.lastWorking = choices[0].a);
  }

  private next() {
    if (this.state === "idle") this.play(this.activity === A.yawn ? A.lieDown : A.sleep);
    else if (this.state === "waiting") this.play(A.alert);
    else this.play(this.pickWorking());
  }

  tick(dt: number) {
    if (this.dying) {
      this.deathT += dt;
    } else {
      this.actT += dt;
      const done = this.activity.update?.(dt, this);
      if (done || this.actT >= this.activity.duration) this.next();
    }
    if (this.parent) this.follow(dt);
    for (const m of this.minis.values()) m.tick(dt);
    for (const [id, m] of this.minis) if (m.dead) this.minis.delete(id);
  }

  private follow(dt: number) {
    const p = this.parent!;
    const idx = [...p.minis.values()].indexOf(this);
    const gap = (13 + idx * 8) * this.scale;
    const target = this.clampX(p.x - p.facing * gap);
    const d = target - this.x;
    this.data.moving = Math.abs(d) > 2;
    if (this.data.moving) this.facing = Math.sign(d);
    else if (!this.dying) this.facing = p.facing;
    this.x += d * Math.min(1, dt * 4);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const s = this.scale;
    const { skin } = this.world;
    const clock = performance.now() / 1000 + this.x * 0.01;
    if (!this.parent && this.world.showNames) this.drawName(ctx);
    if (this.dying) {
      drawBot(ctx, this.x, this.groundY, s, this.facing, A.deathPose(this.deathT), this.pal, skin, clock);
      const g = A.ghostPose(this.deathT);
      if (g) drawBot(ctx, this.x, this.groundY, s, this.facing, g, this.pal, skin, clock);
      return;
    }
    const t = this.actT;
    const p = this.parent && this.data.moving && this.state === "working"
      ? A.run.pose(t, this)
      : this.activity.pose(t, this);
    this.activity.draw?.(ctx, this, t);
    drawBot(ctx, this.x, this.groundY, s, this.facing, p, this.pal, skin, clock);
  }

  private drawName(ctx: CanvasRenderingContext2D) {
    const name = this.session.name ?? this.session.project;
    ctx.save();
    if (this.dying) ctx.globalAlpha = Math.max(0, 1 - this.deathT / A.DEATH_DURATION);
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const w = ctx.measureText(name).width + 8;
    ctx.fillStyle = "rgba(24, 24, 27, 0.7)";
    ctx.beginPath();
    ctx.roundRect(this.x - w / 2, this.groundY + 2, w, 13, 6);
    ctx.fill();
    ctx.fillStyle = this.pal.light;
    ctx.fillText(name, this.x, this.groundY + 3.5);
    ctx.restore();
  }

  hit(px: number, py: number) {
    const s = this.scale;
    return !this.dying && Math.abs(px - this.x) < 8 * s && py > this.groundY - 24 * s && py < this.groundY + 2;
  }
}
