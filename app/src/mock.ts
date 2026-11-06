// Browser-only preview: fake sessions plus a small control panel. Not loaded inside Tauri.
import type { AgentState, Config, Session } from "./types";
import { SKINS } from "./skins";

const PROJECTS = ["agent-bots", "marketing-site", "design-system", "api-server", "docs"];
const STATES: AgentState[] = ["working", "waiting", "idle"];

export function startMock(onSessions: (s: Session[]) => void, onConfig: (c: Config) => void, config: Config) {
  const sessions = new Map<string, Session>();
  let n = 0;
  const emit = () => onSessions([...sessions.values()].map((s) => structuredClone(s)));

  const add = (state: AgentState = "working") => {
    const id = `mock-${++n}`;
    sessions.set(id, {
      session_id: id,
      name: ["Bolt", "Sprocket", "Gizmo", "Ziggy", "Pixel"][(n - 1) % 5],
      project: PROJECTS[(n - 1) % PROJECTS.length],
      state,
      last_tool: "Bash",
      subagents: {},
    });
    emit();
  };
  const pick = () => [...sessions.values()].pop();

  document.body.style.background = "linear-gradient(#3b4252, #20242c)";
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;top:12px;left:12px;display:flex;flex-wrap:wrap;gap:6px;max-width:720px;font:12px -apple-system,sans-serif";
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "padding:6px 10px;border-radius:6px;border:0;background:#e5e7eb;cursor:pointer";
    b.onclick = fn;
    panel.append(b);
  };

  btn("+ session", () => add());
  btn("cycle state (last)", () => {
    const s = pick(); if (!s) return;
    s.state = STATES[(STATES.indexOf(s.state) + 1) % 3]; emit();
  });
  for (const st of STATES) btn(`all ${st}`, () => { sessions.forEach((s) => (s.state = st)); emit(); });
  btn("+ subagent (last)", () => {
    const s = pick(); if (!s) return;
    s.subagents[`a${Date.now()}`] = { type: "Explore", since: Date.now() / 1000 }; emit();
  });
  btn("- subagent (last)", () => {
    const s = pick(); if (!s) return;
    const k = Object.keys(s.subagents)[0]; if (k) delete s.subagents[k]; emit();
  });
  btn("kill last ☠", () => { const s = pick(); if (s) { sessions.delete(s.session_id); emit(); } });
  btn("kill + revive", () => {
    const s = pick(); if (!s) return;
    sessions.delete(s.session_id); emit();
    setTimeout(() => { sessions.set(s.session_id, s); emit(); }, 1200);
  });
  for (const size of ["S", "M", "L"] as const) btn(`size ${size}`, () => onConfig((config = { ...config, size })));
  for (const speed of ["slow", "normal", "fast"] as const) btn(speed, () => onConfig((config = { ...config, speed })));
  btn("subagents on/off", () => onConfig((config = { ...config, subagents: !config.subagents })));
  btn("names on/off", () => onConfig((config = { ...config, show_names: !config.show_names })));
  for (const s of SKINS) btn(s.label, () => onConfig((config = { ...config, skin: s.id })));
  document.body.append(panel);

  add("working");
  add("idle");
  add("waiting");
  const s = pick()!;
  s.state = "working";
  s.subagents = { a1: { type: "Explore", since: 0 }, a2: { type: "Plan", since: 0 } };
  emit();
}
