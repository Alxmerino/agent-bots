// A strip of ground anywhere on the page, with real Agent Bots walking on it. Uses the app's Bot,
// activities and skins unchanged; only the world (width, ground, scale, skin) is per stage.
import { Bot, type World } from "../../app/src/bot";
import { getSkin } from "../../app/src/skins";
import { SPEED, type AgentState, type Session } from "../../app/src/types";

const NAME_SPACE = 16;
const FPS = 12; // the app's sprite rate
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const stages = new Set<Stage>();
let ids = 0;

export interface StageOptions {
  skin?: string;
  /** Bot scale, or a function of the stage width. Default 3, one smaller below 220px. */
  scale?: number | ((width: number) => number);
  names?: boolean;
}

export class Stage {
  bots: Bot[] = [];
  world: World;
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private visible = false;
  private scaleFor: (width: number) => number;

  constructor(public el: HTMLElement, o: StageOptions = {}) {
    const base = o.scale ?? 3;
    this.scaleFor = typeof base === "function" ? base : (w) => (w < 220 ? Math.max(2, base - 1) : base);
    this.world = {
      width: 0, groundY: 0, scale: 3, speed: SPEED.normal,
      skin: getSkin(o.skin ?? "robot"), showNames: o.names ?? false,
    };
    this.canvas.className = "stage-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    el.append(this.canvas);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(el);
    new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: "100px" }).observe(el);
    stages.add(this);
  }

  get height() { return 40 * this.world.scale + (this.world.showNames ? NAME_SPACE : 0); }

  setSkin(id: string) {
    this.world.skin = getSkin(id);
    this.draw();
  }

  /** Adds a bot. Its color comes from the project name, the same as in the app. */
  add(state: AgentState, project: string, name?: string): Bot {
    const s: Session = { session_id: `s${++ids}`, name, project, state, last_tool: "Edit", subagents: {} };
    const b = new Bot(s, this.world);
    b.placeAwayFrom(this.bots.filter((o) => !o.dying).map((o) => o.x));
    this.bots.push(b);
    this.draw();
    return b;
  }

  setState(b: Bot, state: AgentState) {
    b.update({ ...b.session, state });
  }

  addSubagent(b: Bot, type = "Explore") {
    const id = `a${++ids}`;
    b.session.subagents[id] = { type, since: Date.now() / 1000 };
    b.minis.set(id, new Bot({ ...b.session, subagents: {} }, this.world, b, type));
  }

  removeSubagent(b: Bot) {
    const [id] = Object.keys(b.session.subagents);
    if (!id) return;
    delete b.session.subagents[id];
    b.minis.get(id)?.kill();
  }

  /** Bot under a point in stage-local CSS px. */
  hitTest(x: number, y: number) {
    const top = this.el.clientHeight - this.height;
    return this.bots.find((b) => b.hit(x, y - top));
  }

  private resize() {
    const w = this.el.clientWidth;
    const first = this.world.width === 0;
    this.world.scale = this.scaleFor(w); // narrow stages get smaller bots so they still have room to walk
    this.world.width = w;
    this.world.groundY = this.height - 4 - (this.world.showNames ? NAME_SPACE : 0);
    this.canvas.width = w;
    this.canvas.height = this.height;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${this.height}px`;
    if (first) this.bots.forEach((b, i) => { b.x = b.randomX(); b.placeAwayFrom(this.bots.slice(0, i).map((o) => o.x)); });
    else for (const b of this.bots) b.x = b.clampX(b.x);
    this.draw();
  }

  tick(dt: number) {
    if (!this.visible) return;
    for (const b of this.bots) b.tick(dt);
    this.bots = this.bots.filter((b) => !b.dead);
    this.draw();
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of this.bots) {
      for (const m of b.minis.values()) m.draw(ctx);
      b.draw(ctx);
    }
  }
}

// One shared timer for every stage, at the app's sprite rate. Reduced motion: bots hold still.
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (reduced.matches || document.hidden) return;
  for (const s of stages) s.tick(dt);
}, 1000 / FPS);
