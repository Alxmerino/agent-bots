import { Bot, type World } from "./bot";
import { DEFAULT_CONFIG, SCALE, SPEED, type Config, type Session } from "./types";
import { getSkin } from "./skins";

const NAME_SPACE = 16; // px below the feet for name tags

export class Strip {
  bots = new Map<string, Bot>();
  config: Config = { ...DEFAULT_CONFIG };
  world: World = { width: 0, groundY: 0, scale: SCALE.M, speed: SPEED.normal, skin: getSkin(DEFAULT_CONFIG.skin), showNames: DEFAULT_CONFIG.show_names };
  // Each bot draws into its own small canvas that moves with a CSS transform. Moving a layer is nearly
  // free for the compositor, so only bot-sized pixels get repainted instead of a full-width strip.
  private layers = new Map<Bot, { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();
  private last = performance.now();

  constructor(private root: HTMLElement, private tip: HTMLElement) {
    this.resize();
    addEventListener("resize", () => this.resize());
    this.schedule();
  }

  /** Height the strip needs for the current bot size (headroom for flips, "!" and ghosts). */
  get height() { return 40 * this.world.scale + (this.world.showNames ? NAME_SPACE : 0); }

  setConfig(c: Config) {
    this.config = c;
    this.world.scale = SCALE[c.size];
    this.world.speed = SPEED[c.speed];
    this.world.skin = getSkin(c.skin);
    this.world.showNames = c.show_names;
    this.resize();
  }

  /** Layer width: room for the bot plus props (easel, z's, ghost drift) and its name tag. */
  private get layerWidth() { return Math.max(64 * this.world.scale, 140); }

  private resize() {
    this.world.width = innerWidth;
    for (const l of this.layers.values()) this.sizeLayer(l.c);
    this.world.groundY = this.height - 4 - (this.world.showNames ? NAME_SPACE : 0);
  }

  // Pixel art doesn't need Retina: layers draw at 1x and CSS scales them crisply.
  private sizeLayer(c: HTMLCanvasElement) {
    c.width = this.layerWidth;
    c.height = this.height;
    c.style.width = `${this.layerWidth}px`;
    c.style.height = `${this.height}px`;
  }

  private layer(b: Bot) {
    let l = this.layers.get(b);
    if (!l) {
      const c = document.createElement("canvas");
      c.className = "bot";
      this.sizeLayer(c);
      this.root.append(c);
      l = { c, ctx: c.getContext("2d")! };
      this.layers.set(b, l);
    }
    return l;
  }

  sync(sessions: Session[]) {
    const seen = new Set<string>();
    for (const s of sessions) {
      seen.add(s.session_id);
      let b = this.bots.get(s.session_id);
      if (!b) {
        b = new Bot(s, this.world);
        b.placeAwayFrom([...this.bots.values()].filter((o) => !o.dying).map((o) => o.x));
        this.bots.set(s.session_id, b);
      }
      else if (b.dying) b.revive();
      b.update(s);
      this.syncMinis(b, s);
    }
    for (const [id, b] of this.bots) if (!seen.has(id)) b.kill();
    this.schedule(); // pick up the new frame rate right away
  }

  private syncMinis(b: Bot, s: Session) {
    const want = this.config.subagents ? s.subagents : {};
    for (const [id, sub] of Object.entries(want)) {
      const m = b.minis.get(id);
      if (!m) b.minis.set(id, new Bot({ ...s, subagents: {} }, this.world, b, sub.type));
      else if (m.dying) m.revive();
      else m.update({ ...s, subagents: {} });
    }
    for (const [id, m] of b.minis) if (!(id in want)) m.kill();
  }

  /** Returns the bot under a point (strip-local CSS px), if any. */
  hitTest(x: number, y: number): Bot | undefined {
    const top = innerHeight - this.height;
    for (const b of this.bots.values()) if (b.hit(x, y - top)) return b;
    for (const b of this.bots.values()) for (const m of b.minis.values()) if (m.hit(x, y - top)) return b;
  }

  showTip(b: Bot | undefined, x: number) {
    if (!b) { this.tip.style.display = "none"; return; }
    const s = b.session;
    const subs = Object.keys(s.subagents).length;
    this.tip.innerHTML =
      `<b>${esc(s.name ?? s.project)}</b>${s.name ? ` · ${esc(s.project)}` : ""}<br>${b.dying ? "dying…" : b.activity.name} · ${s.state}` +
      (s.last_tool ? `<br>last tool: ${esc(s.last_tool)}` : "") +
      (subs ? `<br>${subs} subagent${subs > 1 ? "s" : ""}` : "");
    this.tip.style.display = "block";
    const right = x + 14 * this.world.scale;
    const w = this.tip.offsetWidth;
    this.tip.style.left = `${right + w > innerWidth ? x - 14 * this.world.scale - w : right}px`;
    this.tip.style.bottom = `${8}px`;
  }

  /** 12fps while anything moves (pixel-art sprite rate), 5fps when every bot is asleep, nothing when there are no bots. */
  private fps() {
    if (!this.config.show || this.bots.size === 0) return 0;
    for (const b of this.bots.values()) if (b.state !== "idle" || b.dying || b.activity.name !== "sleeping") return 12;
    return 5;
  }

  // A timer at the rate we need, not requestAnimationFrame: rAF wakes WebKit on every display refresh
  // (up to 120Hz) even when we skip the frame. Measured: 16.6% -> 13% total CPU at 20fps.
  private timer = 0;
  private schedule() {
    clearTimeout(this.timer);
    const fps = this.fps();
    // No bots: check back slowly; sync() reschedules immediately when a session appears.
    this.timer = setTimeout(() => this.frame(performance.now()), fps ? 1000 / fps : 1000);
  }

  private frame(now: number) {
    this.schedule();
    if (this.fps() === 0) { this.last = now; this.prune(new Set()); return; }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    for (const b of this.bots.values()) b.tick(dt);
    for (const [id, b] of this.bots) if (b.dead) this.bots.delete(id);

    const alive = new Set<Bot>();
    for (const b of this.bots.values()) for (const x of [...b.minis.values(), b]) {
      alive.add(x);
      const { c, ctx } = this.layer(x);
      const x0 = Math.round(x.x - this.layerWidth / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.translate(-x0, 0);
      x.draw(ctx);
      c.style.transform = `translate3d(${x0}px, 0, 0)`;
    }
    this.prune(alive);
  }

  /** Remove layers of bots that are gone. */
  private prune(alive: Set<Bot>) {
    for (const [b, l] of this.layers) if (!alive.has(b)) { l.c.remove(); this.layers.delete(b); }
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
