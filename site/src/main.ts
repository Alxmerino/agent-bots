import "@fontsource/press-start-2p/400.css";
import "./style.css";
import { Stage } from "./stage";
import { SKINS } from "../../app/src/skins";
import type { Bot } from "../../app/src/bot";
import type { AgentState } from "../../app/src/types";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- hero: a fake desktop you can drive ----------

const NAMES = ["Bolt", "Sprocket", "Gizmo", "Ziggy", "Pixel", "Widget", "Rivet", "Cog"];
const PROJECTS = ["agent-bots", "marketing-site", "design-system", "api-server", "docs", "mobile-app"];
const MAX_BOTS = 6;
let made = 0;

const hero = new Stage($("#hero-stage"), { scale: (w) => (w < 500 ? 3 : w < 900 ? 4 : 5), names: true });
const log = $("#pg-log");
const tray = $("#tray");
const term = $("#term");

function spawn(state: AgentState) {
  const i = made++;
  return hero.add(state, PROJECTS[i % PROJECTS.length], NAMES[i % NAMES.length]);
}
spawn("working");
spawn("idle");
spawn("waiting");
hero.addSubagent(hero.bots[0], "Explore");

const label = (b: Bot) => b.session.name ?? b.session.project;
const live = () => hero.bots.filter((b) => !b.dying);
const pick = (state?: AgentState) => {
  const pool = live().filter((b) => !state || b.state === state);
  return pool[Math.floor(Math.random() * pool.length)];
};

function refresh(msg?: string) {
  const bots = live();
  const working = bots.filter((b) => b.state === "working").length;
  const waiting = bots.filter((b) => b.state === "waiting").length;
  tray.textContent = waiting ? `${working} · !${waiting}` : `${working}`;
  term.textContent = msg ? `> claude\n${msg}` : "> claude";
  if (msg) log.textContent = msg;
}

refresh();

const ACTIONS: Record<string, () => string> = {
  new() {
    if (live().length >= MAX_BOTS) return "That's a full house. End a session to make room.";
    const b = spawn("working");
    return `${label(b)} started a session in ${b.session.project}.`;
  },
  prompt() {
    const b = pick("idle") ?? pick("waiting");
    if (!b) return "Everyone is already working.";
    hero.setState(b, "working");
    return `${label(b)} got a prompt and is back to work.`;
  },
  ask() {
    const b = pick("working");
    if (!b) return "Nobody is working, so nobody needs permission.";
    hero.setState(b, "waiting");
    return `${label(b)} needs your permission. See the "!"?`;
  },
  done() {
    const b = pick("working") ?? pick("waiting");
    if (!b) return "Everyone is already asleep.";
    hero.setState(b, "idle");
    return `${label(b)} finished the turn and is taking a nap.`;
  },
  sub() {
    const b = pick("working");
    if (!b) return "Subagents only join a working session. Send a prompt first.";
    if (b.minis.size >= 3) return `${label(b)} already has plenty of help.`;
    hero.addSubagent(b, ["Explore", "Plan", "general-purpose"][b.minis.size]);
    return `${label(b)} spawned a subagent. It follows ${label(b)} around.`;
  },
  end() {
    const b = pick();
    if (!b) return "No sessions left. Start a new one.";
    b.kill();
    return `${label(b)}'s session ended. Goodbye, ${label(b)}.`;
  },
};

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-act]")) {
  btn.addEventListener("click", () => refresh(ACTIONS[btn.dataset.act!]()));
}

// Hover tooltip, like the app's.
const tip = $("#tip");
const heroEl = $("#hero-stage");
heroEl.addEventListener("pointermove", (e) => {
  const r = heroEl.getBoundingClientRect();
  const b = hero.hitTest(e.clientX - r.left, e.clientY - r.top);
  if (!b) { tip.hidden = true; return; }
  const subs = b.minis.size;
  tip.innerHTML =
    `<b>${label(b)}</b> · ${b.session.project}<br>${b.activity.name} · ${b.state}` +
    (subs ? `<br>${subs} subagent${subs > 1 ? "s" : ""}` : "");
  tip.hidden = false;
  const host = tip.offsetParent!.getBoundingClientRect();
  tip.style.left = `${e.clientX - host.left + 14}px`;
  tip.style.top = `${e.clientY - host.top - tip.offsetHeight - 10}px`;
});
heroEl.addEventListener("pointerleave", () => (tip.hidden = true));

// ---------- state cards ----------

for (const el of document.querySelectorAll<HTMLElement>("[data-stage]")) {
  const kind = el.dataset.stage!;
  const stage = new Stage(el, { scale: 3 });
  if (kind !== "ended") {
    const b = stage.add(kind as AgentState, `card-${kind}`);
    // The working card shows a new turn every few seconds, so visitors see more than one animation.
    if (kind === "working") setInterval(() => { if (!reduced()) { stage.setState(b, "idle"); stage.setState(b, "working"); } }, 5000);
    continue;
  }
  // Work for a bit, die, come back. A new bot only appears once the ghost is gone, and death only
  // plays while the card is on screen, so bots never pile up offscreen.
  const cycle = () => {
    if (stage.bots.length === 0) {
      const b = stage.add("working", "card-ended");
      if (reduced()) return;
      setTimeout(() => b.kill(), 2500);
    }
    setTimeout(cycle, 1000);
  };
  cycle();
}

// ---------- subagents band ----------

const sub = new Stage($("#sub-stage"), { scale: 4 });
const parent = sub.add("working", "design-system");
for (const t of ["Explore", "Plan", "general-purpose"]) sub.addSubagent(parent, t);

// ---------- styles ----------

const grid = $("#styles-grid");
for (const skin of SKINS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "style";
  btn.setAttribute("aria-pressed", String(skin.id === "robot"));
  btn.innerHTML = `<span class="stage style-stage"></span><span class="style-label">${skin.label}</span>`;
  grid.append(btn);
  const st = new Stage(btn.querySelector<HTMLElement>(".style-stage")!, { scale: () => 3, skin: skin.id });
  st.add("waiting", `style-${skin.id}`);
  btn.addEventListener("click", () => {
    for (const b of grid.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === btn));
    hero.setSkin(skin.id);
    log.textContent = `Your crew is now ${skin.label.toLowerCase()}.`;
  });
}

// ---------- footer: everyone's asleep ----------

const footer = new Stage($("#footer-stage"), { scale: 3 });
["docs", "api-server", "agent-bots", "marketing-site"].forEach((p) => footer.add("idle", p));
