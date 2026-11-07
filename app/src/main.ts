import { Strip } from "./world";
import { DEFAULT_CONFIG, type Config, type Session } from "./types";

const strip = new Strip(
  document.body,
  document.getElementById("tip")!,
);

let config: Config = { ...DEFAULT_CONFIG };
const applyConfig = (c: Config) => {
  config = c;
  strip.setConfig(c);
};

// Hover tooltip (in Tauri, cursor events arrive only while over a bot; see click-through in Rust).
addEventListener("mousemove", (e) => strip.showTip(strip.hitTest(e.clientX, e.clientY), e.clientX));
addEventListener("mouseleave", () => strip.showTip(undefined, 0));

if ("__TAURI_INTERNALS__" in window) {
  startTauri();
} else {
  import("./mock").then(({ startMock }) => startMock((s) => strip.sync(s), applyConfig, config));
}

async function startTauri() {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");

  await listen<Session[]>("sessions-changed", (e) => strip.sync(e.payload));
  await listen<Config>("config-changed", (e) => applyConfig(e.payload));

  // The window ignores the mouse until the cursor is over a bot (Rust streams the cursor position).
  let interactive = false;
  await listen<[number, number] | null>("cursor", (e) => {
    const hit = e.payload ? strip.hitTest(e.payload[0], e.payload[1]) : undefined;
    if (!!hit !== interactive) {
      interactive = !!hit;
      invoke("set_interactive", { on: interactive });
    }
    // macOS doesn't send mousemove to an unfocused window, so drive the tooltip from the cursor feed.
    strip.showTip(hit, e.payload?.[0] ?? 0);
  });

  // Clicking a bot brings its terminal app to the front.
  addEventListener("mousedown", (e) => {
    const b = strip.hitTest(e.clientX, e.clientY);
    if (b) invoke("focus_session", { id: b.session.session_id });
  });

  const { SKINS } = await import("./skins");
  invoke("register_skins", { skins: SKINS.map((s) => [s.id, s.label]) });

  const [sessions, cfg] = await invoke<[Session[], Config]>("get_state");
  applyConfig(cfg);
  strip.sync(sessions);
}
