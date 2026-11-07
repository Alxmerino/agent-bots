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
  private turn?: Activity; // this turn's working animation
  home = 0; // where the bot stood when its turn began; moving animations stay near it
  private bag: Activity[] = []; // animations not played yet; refilled when empty

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

  /** Moves to a spot far from the other bots: the best of a few random tries, so bots spread out
   *  across the strip without lining up on a grid. Matters because most work animations stay put. */
  placeAwayFrom(others: number[]) {
    if (!others.length) return;
    let bestD = -1;
    for (let i = 0; i < 16; i++) {
      const x = this.randomX();
      const d = Math.min(...others.map((o) => Math.abs(o - x)));
      if (d > bestD) { bestD = d; this.x = x; }
    }
    this.home = this.x;
  }

  update(s: Session) {
    this.session = s;
    if (s.state !== this.state) this.setState(s.state);
  }

  setState(state: AgentState, initial = false) {
    const wasLying = this.activity === A.sleep || this.activity === A.lieDown;
    // A new turn starts when work begins after idle. Waiting on a permission and going back to work
    // is the same turn, so the bot picks up the animation it was doing.
    if (state === "working" && (initial || this.state === "idle" || !this.turn)) this.newTurn();
    this.state = state;
    if (state === "idle") this.play(initial ? A.sleep : A.yawn);
    else if (wasLying && !initial) this.play(A.getUp);
    else if (state === "waiting") this.play(A.alert);
    else this.play(this.turn!);
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

  /** Picks this turn's animation: every one plays once, in random order, before any repeats. */
  private newTurn() {
    if (!this.bag.length) {
      const bag = [...(this.parent ? A.MINI_WORKING : A.WORKING)];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === this.turn) bag.reverse(); // no repeat across refills
      this.bag = bag;
    }
    this.turn = this.bag.pop()!;
    this.home = this.x;
  }

  private next() {
    if (this.state === "idle") this.play(this.activity === A.yawn ? A.lieDown : A.sleep);
    else if (this.state === "waiting") this.play(A.alert);
    else this.play(this.turn ?? A.WORKING[0]); // the same animation all turn (it loops)
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
