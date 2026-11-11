import { Strip } from "./world";
import type { Bot } from "./bot";
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

// Press on a bot and drag to move it along the strip; press and release without moving is a click.
let drag: { bot: Bot; dx: number; startX: number; moved: boolean } | undefined;
let onClick = (_b: Bot) => {};
const DRAG_PX = 4;

function dragTo(x: number) {
  if (!drag) return;
  if (!drag.moved && Math.abs(x - drag.startX) < DRAG_PX) return;
  drag.moved = true;
  drag.bot.moveTo(x + drag.dx);
  strip.follow(drag.bot);
}

function endDrag() {
  if (!drag) return;
  const { bot, moved } = drag;
  bot.held = false;
  drag = undefined;
  if (!moved) onClick(bot);
}

addEventListener("mousedown", (e) => {
  const bot = strip.hitTest(e.clientX, e.clientY);
  if (!bot || e.button !== 0) return;
  bot.held = true;
  drag = { bot, dx: bot.x - e.clientX, startX: e.clientX, moved: false };
  strip.showTip(undefined, 0);
});
addEventListener("mouseup", endDrag);

// Hover tooltip (in Tauri, cursor events arrive only while over a bot; see click-through in Rust).
addEventListener("mousemove", (e) => {
  if (drag) {
    if (e.buttons === 0) return endDrag(); // the release happened somewhere we didn't hear about
    return dragTo(e.clientX);
  }
  strip.showTip(strip.hitTest(e.clientX, e.clientY), e.clientX);
});
addEventListener("mouseleave", () => { if (!drag) strip.showTip(undefined, 0); });

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
  // While dragging it stays interactive so the release reaches us.
  let interactive = false;
  await listen<[number, number] | null>("cursor", (e) => {
    if (drag) {
      // macOS doesn't send mousemove to an unfocused window, so the cursor feed moves the bot too.
      if (e.payload) dragTo(e.payload[0]);
      return;
    }
    const hit = e.payload ? strip.hitTest(e.payload[0], e.payload[1]) : undefined;
    if (!!hit !== interactive) {
      interactive = !!hit;
      invoke("set_interactive", { on: interactive });
    }
    strip.showTip(hit, e.payload?.[0] ?? 0);
  });

  // Clicking a bot brings its session forward (its terminal app, or the desktop session).
  onClick = (b) => invoke("focus_session", { id: b.session.session_id });

  const { SKINS } = await import("./skins");
  invoke("register_skins", { skins: SKINS.map((s) => [s.id, s.label]) });

  const [sessions, cfg] = await invoke<[Session[], Config]>("get_state");
  applyConfig(cfg);
  strip.sync(sessions);
}
