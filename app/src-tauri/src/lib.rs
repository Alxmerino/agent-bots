mod claude_hooks;
mod updates;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, Wry};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

// ---------- config ----------

#[derive(Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
struct Config {
    show: bool,
    size: String,  // S | M | L
    speed: String, // slow | normal | fast
    subagents: bool,
    hide_when_empty: bool,
    display: String, // primary | cursor
    side: String,    // left | right half of the screen
    stale_minutes: u64,
    show_names: bool,
    skin: String,
    asked_connect: bool, // first-launch "Connect to Claude Code?" prompt already shown
}

impl Default for Config {
    fn default() -> Self {
        Config {
            show: true,
            size: "M".into(),
            speed: "normal".into(),
            subagents: true,
            hide_when_empty: false,
            display: "primary".into(),
            side: "left".into(),
            stale_minutes: 30,
            show_names: true,
            skin: "robot".into(),
            asked_connect: false,
        }
    }
}

impl Config {
    /// CSS px per logical bot pixel; strip height is 40 bot pixels.
    fn strip_height(&self) -> f64 {
        let names = if self.show_names { 16.0 } else { 0.0 }; // name tags under the feet
        40.0 * match self.size.as_str() { "S" => 2.0, "L" => 4.0, _ => 3.0 } + names
    }
}

fn base_dir() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".agentbots")
}

fn load_config() -> Config {
    std::fs::read_to_string(base_dir().join("config.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(c: &Config) {
    let _ = std::fs::create_dir_all(base_dir());
    let _ = std::fs::write(base_dir().join("config.json"), serde_json::to_string_pretty(c).unwrap());
}

// ---------- sessions ----------

#[derive(Default)]
struct AppState {
    config: Config,
    sessions: Vec<Value>,
    skins: Vec<(String, String)>, // (id, label), registered by the frontend
    pending_update: Option<String>, // version installed by the updater, waiting for a restart
}

type Shared = Mutex<AppState>;

fn pid_alive(pid: i64) -> bool {
    // kill(pid, 0) succeeds (or fails with EPERM) when the process exists.
    unsafe { libc::kill(pid as i32, 0) == 0 || *libc::__error() == libc::EPERM }
}

fn read_sessions(stale_minutes: u64) -> Vec<Value> {
    read_sessions_in(&base_dir().join("sessions"), stale_minutes)
}

fn read_sessions_in(dir: &std::path::Path, stale_minutes: u64) -> Vec<Value> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let Ok(dir) = std::fs::read_dir(dir) else { return vec![] };
    let mut out: Vec<Value> = dir
        .flatten()
        .filter(|e| {
            let n = e.file_name();
            let n = n.to_string_lossy();
            n.ends_with(".json") && !n.starts_with('.')
        })
        .filter_map(|e| serde_json::from_str::<Value>(&std::fs::read_to_string(e.path()).ok()?).ok())
        .filter(|s| match s["pid"].as_i64() {
            Some(pid) => pid_alive(pid),
            None => now - s["updated"].as_i64().unwrap_or(0) < (stale_minutes * 60) as i64,
        })
        .collect();
    out.sort_by(|a, b| a["session_id"].as_str().cmp(&b["session_id"].as_str()));
    out
}

fn refresh(app: &AppHandle) {
    let state = app.state::<Shared>();
    let (sessions, cfg) = {
        let mut s = state.lock().unwrap();
        let fresh = read_sessions(s.config.stale_minutes);
        if fresh == s.sessions { return; }
        s.sessions = fresh.clone();
        (fresh, s.config.clone())
    };
    let _ = app.emit("sessions-changed", &sessions);
    update_tray(app, &sessions, &cfg);
    apply_visibility(app, &sessions, &cfg);
}

/// Watch the sessions folder (debounced 100ms) and rescan every 3s to catch crashed sessions.
fn start_watcher(app: AppHandle) {
    use notify::{RecursiveMode, Watcher};
    let dir = base_dir().join("sessions");
    let _ = std::fs::create_dir_all(&dir);
    let (tx, rx) = mpsc::channel::<()>();
    std::thread::spawn(move || {
        let mut watcher = notify::recommended_watcher(move |_res| { let _ = tx.send(()); }).expect("watcher");
        watcher.watch(&dir, RecursiveMode::NonRecursive).expect("watch sessions dir");
        let mut last_scan = Instant::now();
        loop {
            match rx.recv_timeout(Duration::from_secs(3)) {
                Ok(()) => {
                    std::thread::sleep(Duration::from_millis(100));
                    while rx.try_recv().is_ok() {}
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => break,
            }
            if last_scan.elapsed() >= Duration::from_millis(90) {
                refresh(&app);
                last_scan = Instant::now();
            }
        }
    });
}

// ---------- window ----------

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

/// Place the strip full-width at the bottom of the chosen display's work area (just above the Dock).
/// Put the strip on the left or right half of the usable area, flush with its bottom (above a bottom
/// Dock, beside a side Dock). Works in AppKit points: Tauri's physical work area put the strip mid-screen
/// on Retina displays and ignored where the Dock sits.
#[cfg(target_os = "macos")]
fn place(app: &AppHandle, cfg: &Config) {
    let Some(win) = main_window(app) else { return };
    let (cursor, left, h) = (cfg.display == "cursor", cfg.side == "left", cfg.strip_height());
    let _ = app.run_on_main_thread(move || {
        use objc2_app_kit::{NSEvent, NSScreen, NSWindow};
        use objc2_foundation::{MainThreadMarker, NSPoint, NSRect, NSSize};
        let Some(mtm) = MainThreadMarker::new() else { return };
        let screens = NSScreen::screens(mtm);
        let m = NSEvent::mouseLocation();
        let under_cursor = screens.iter().find(|s| {
            let f = s.frame();
            m.x >= f.origin.x && m.x < f.origin.x + f.size.width && m.y >= f.origin.y && m.y < f.origin.y + f.size.height
        });
        let Some(screen) = under_cursor.filter(|_| cursor).or_else(|| screens.firstObject()) else { return };
        let vf = screen.visibleFrame();
        let half = (vf.size.width / 2.0).round();
        let frame = NSRect::new(NSPoint::new(if left { vf.origin.x } else { vf.origin.x + vf.size.width - half }, vf.origin.y), NSSize::new(half, h));
        let Ok(ptr) = win.ns_window() else { return };
        let ns = unsafe { &*(ptr as *const NSWindow) };
        if ns.frame() != frame { ns.setFrame_display(frame, true); }
    });
}

/// Tauri's "visible on all workspaces" doesn't cover fullscreen apps. Those need the
/// fullScreenAuxiliary collection behavior plus a window level above normal windows.
#[cfg(target_os = "macos")]
fn float_over_fullscreen(win: &WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior as B};
    let Ok(ptr) = win.ns_window() else { return };
    let ns = unsafe { &*(ptr as *const NSWindow) };
    ns.setCollectionBehavior(B::CanJoinAllSpaces | B::FullScreenAuxiliary | B::Stationary | B::IgnoresCycle);
    ns.setLevel(25); // NSStatusWindowLevel
}

fn apply_visibility(app: &AppHandle, sessions: &[Value], cfg: &Config) {
    let Some(win) = main_window(app) else { return };
    let visible = cfg.show && !(cfg.hide_when_empty && sessions.is_empty());
    let _ = if visible { win.show() } else { win.hide() };
}

/// The window ignores the mouse except while the cursor is over a bot. The frontend hit-tests and
/// calls `set_interactive`; Rust feeds it the cursor position because an ignoring window gets no events.
fn start_cursor_feed(app: AppHandle) {
    std::thread::spawn(move || {
        // Only send when something changed: an idle mouse costs nothing on the WebKit side.
        let mut last: Option<(f64, f64)> = None;
        let mut tick: u32 = 0;
        loop {
            std::thread::sleep(Duration::from_millis(33));
            tick = tick.wrapping_add(1);
            let (has_bots, cfg) = {
                let state = app.state::<Shared>();
                let s = state.lock().unwrap();
                (!s.sessions.is_empty(), s.config.clone())
            };
            if tick % 15 == 0 { place(&app, &cfg); } // follows Dock moves, resolution and display changes
            if !has_bots || !cfg.show { continue; }
            let (Some(win), Ok(p)) = (main_window(&app), app.cursor_position()) else { continue };
            let (Ok(pos), Ok(size), Ok(sf)) = (win.outer_position(), win.outer_size(), win.scale_factor()) else { continue };
            let (x, y) = (p.x - pos.x as f64, p.y - pos.y as f64);
            let inside = x >= 0.0 && y >= 0.0 && x < size.width as f64 && y < size.height as f64;
            let now = if inside { Some((x / sf, y / sf)) } else { None };
            if now != last {
                last = now;
                let _ = app.emit("cursor", now);
            }
        }
    });
}

/// The frontend owns the skin registry; it sends the list once so the menu can offer it.
#[tauri::command]
fn register_skins(app: AppHandle, skins: Vec<(String, String)>) {
    let (sessions, cfg) = {
        let state = app.state::<Shared>();
        let mut s = state.lock().unwrap();
        s.skins = skins;
        (s.sessions.clone(), s.config.clone())
    };
    update_tray(&app, &sessions, &cfg);
}

#[tauri::command]
fn get_state(state: tauri::State<Shared>) -> (Vec<Value>, Config) {
    let s = state.lock().unwrap();
    (s.sessions.clone(), s.config.clone())
}

#[tauri::command]
fn set_interactive(app: AppHandle, on: bool) {
    if let Some(w) = main_window(&app) { let _ = w.set_ignore_cursor_events(!on); }
}

// ---------- terminal focus ----------

/// The .app that hosts a process: walk up its parents until one runs from inside an app bundle. This
/// finds the terminal whatever it is (Terminal, iTerm, Ghostty, Warp, VS Code, ...), with no AppleScript
/// and no permission prompt. Sessions under tmux or ssh have no app above them and get None.
fn owning_app(mut pid: i32) -> Option<String> {
    for _ in 0..32 {
        if pid <= 1 { return None; }
        let mut buf = [0u8; libc::PROC_PIDPATHINFO_MAXSIZE as usize];
        let n = unsafe { libc::proc_pidpath(pid, buf.as_mut_ptr().cast(), buf.len() as u32) };
        if n > 0 {
            let path = String::from_utf8_lossy(&buf[..n as usize]);
            // The first ".app/" is the outermost bundle (VS Code's terminal runs in a nested helper app).
            if let Some(i) = path.find(".app/") { return Some(path[..i + 4].to_string()); }
        }
        let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
        let size = std::mem::size_of::<libc::proc_bsdinfo>() as i32;
        let got = unsafe { libc::proc_pidinfo(pid, libc::PROC_PIDTBSDINFO, 0, (&mut info as *mut libc::proc_bsdinfo).cast(), size) };
        if got != size { return None; }
        pid = info.pbi_ppid as i32;
    }
    None
}

/// Brings the app hosting a session's terminal to the front. Focuses the app, not the exact tab.
#[tauri::command]
fn focus_session(state: tauri::State<Shared>, id: String) {
    let pid = state.lock().unwrap().sessions.iter().find(|s| s["session_id"] == id.as_str()).and_then(|s| s["pid"].as_i64());
    let Some(app) = pid.and_then(|p| owning_app(p as i32)) else { return };
    let _ = std::process::Command::new("open").arg("-a").arg(app).spawn();
}

// ---------- Claude Code connection ----------

fn do_connect(app: &AppHandle) {
    match claude_hooks::connect() {
        Ok(()) => {
            // Installed builds run all the time; dev builds must never register a login item.
            if !cfg!(debug_assertions) { let _ = app.autolaunch().enable(); }
        }
        Err(e) => {
            app.dialog().message(e).title("Couldn't connect to Claude Code").kind(MessageDialogKind::Error).show(|_| {});
        }
    }
    rebuild_tray(app);
}

fn do_disconnect(app: &AppHandle) {
    if let Err(e) = claude_hooks::disconnect() {
        app.dialog().message(e).title("Couldn't disconnect").kind(MessageDialogKind::Error).show(|_| {});
    }
    rebuild_tray(app);
}

fn prompt_connect(app: &AppHandle) {
    let handle = app.clone();
    app.dialog()
        .message(
            "Agent Bots shows a little bot for each Claude Code session you have running.\n\n\
             To see your sessions, it adds a small hook to your Claude Code settings. \
             It backs up your settings first, and you can disconnect any time from its menu bar icon.",
        )
        .title("Connect to Claude Code?")
        .buttons(MessageDialogButtons::OkCancelCustom("Connect".into(), "Not now".into()))
        .show(move |ok| {
            {
                let state = handle.state::<Shared>();
                let mut s = state.lock().unwrap();
                s.config.asked_connect = true;
                save_config(&s.config);
            }
            if ok { do_connect(&handle) } else { rebuild_tray(&handle) }
        });
}

fn set_pending_update(app: &AppHandle, version: String) {
    app.state::<Shared>().lock().unwrap().pending_update = Some(version);
    rebuild_tray(app);
}

fn rebuild_tray(app: &AppHandle) {
    let (sessions, cfg) = {
        let state = app.state::<Shared>();
        let s = state.lock().unwrap();
        (s.sessions.clone(), s.config.clone())
    };
    update_tray(app, &sessions, &cfg);
}

// ---------- tray ----------

fn build_menu(app: &AppHandle, sessions: &[Value], cfg: &Config) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    if sessions.is_empty() {
        menu.append(&MenuItem::with_id(app, "none", "No agents running", false, None::<&str>)?)?;
    }
    for s in sessions {
        let state = match s["state"].as_str() { Some("working") => "working", Some("waiting") => "needs you", _ => "done" };
        let subs = s["subagents"].as_object().map_or(0, |o| o.len());
        let label = format!(
            "{}{}  —  {state}{}",
            s["name"].as_str().map(|n| format!("{n} · ")).unwrap_or_default(),
            s["project"].as_str().unwrap_or("?"),
            if subs > 0 { format!(" (+{subs})") } else { String::new() }
        );
        let id = format!("session:{}", s["session_id"].as_str().unwrap_or(""));
        menu.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;

    let check = |id: &str, label: &str, on: bool| CheckMenuItem::with_id(app, id, label, true, on, None::<&str>);
    menu.append(&check("show", "Show bots", cfg.show)?)?;
    menu.append(&check("subagents", "Show subagents", cfg.subagents)?)?;
    menu.append(&check("show_names", "Show names", cfg.show_names)?)?;
    menu.append(&check("hide_when_empty", "Hide when no agents", cfg.hide_when_empty)?)?;

    let radio = |title: &str, key: &str, current: &str, opts: &[(&str, &str)]| -> tauri::Result<Submenu<Wry>> {
        let sub = Submenu::new(app, title, true)?;
        for (v, label) in opts {
            sub.append(&CheckMenuItem::with_id(app, format!("{key}:{v}"), *label, true, current == *v, None::<&str>)?)?;
        }
        Ok(sub)
    };
    let skins = app.state::<Shared>().lock().unwrap().skins.clone();
    if !skins.is_empty() {
        let opts: Vec<(&str, &str)> = skins.iter().map(|(i, l)| (i.as_str(), l.as_str())).collect();
        menu.append(&radio("Style", "skin", &cfg.skin, &opts)?)?;
    }
    menu.append(&radio("Bot size", "size", &cfg.size, &[("S", "Small"), ("M", "Medium"), ("L", "Large")])?)?;
    menu.append(&radio("Walk speed", "speed", &cfg.speed, &[("slow", "Slow"), ("normal", "Normal"), ("fast", "Fast")])?)?;
    menu.append(&radio("Position", "side", &cfg.side, &[("left", "Bottom left"), ("right", "Bottom right")])?)?;
    menu.append(&radio("Display", "display", &cfg.display, &[("primary", "Primary display"), ("cursor", "Follow cursor")])?)?;
    let stale = cfg.stale_minutes.to_string();
    menu.append(&radio("Stale timeout", "stale", &stale, &[("10", "10 min"), ("30", "30 min"), ("60", "60 min")])?)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    if claude_hooks::is_connected() {
        menu.append(&MenuItem::with_id(app, "connected", "✓ Connected to Claude Code", false, None::<&str>)?)?;
        menu.append(&MenuItem::with_id(app, "disconnect", "Disconnect from Claude Code", true, None::<&str>)?)?;
    } else {
        menu.append(&MenuItem::with_id(app, "connect", "Connect to Claude Code…", true, None::<&str>)?)?;
    }
    let login = app.autolaunch().is_enabled().unwrap_or(false);
    menu.append(&check("login", "Start at login", login)?)?;
    match app.state::<Shared>().lock().unwrap().pending_update.clone() {
        Some(v) => menu.append(&MenuItem::with_id(app, "restart", format!("Restart to update to {v}"), true, None::<&str>)?)?,
        None => menu.append(&MenuItem::with_id(app, "check_updates", "Check for updates…", true, None::<&str>)?)?,
    }
    menu.append(&MenuItem::with_id(app, "quit", "Quit Agent Bots", true, None::<&str>)?)?;
    Ok(menu)
}

fn update_tray(app: &AppHandle, sessions: &[Value], cfg: &Config) {
    let Some(tray) = app.tray_by_id("main") else { return };
    let working = sessions.iter().filter(|s| s["state"] == "working").count();
    let waiting = sessions.iter().filter(|s| s["state"] == "waiting").count();
    // Next to the bot icon: how many are working, plus "!n" for sessions waiting on you. Nothing when all is quiet.
    let title = match (working, waiting) { (0, 0) => String::new(), (w, 0) => w.to_string(), (w, n) => format!("{w}  !{n}") };
    let _ = tray.set_title(Some(title));
    if let Ok(menu) = build_menu(app, sessions, cfg) { let _ = tray.set_menu(Some(menu)); }
}

fn on_menu(app: &AppHandle, id: &str) {
    if let Some(sid) = id.strip_prefix("session:") {
        return focus_session(app.state::<Shared>(), sid.to_string());
    }
    match id {
        "quit" => return app.exit(0),
        "restart" => app.restart(),
        "check_updates" => { tauri::async_runtime::spawn(updates::check(app.clone(), true)); return; }
        "connect" => return do_connect(app),
        "disconnect" => return do_disconnect(app),
        "login" => {
            let al = app.autolaunch();
            let _ = if al.is_enabled().unwrap_or(false) { al.disable() } else { al.enable() };
        }
        _ => {}
    }
    let state = app.state::<Shared>();
    let (cfg, sessions) = {
        let mut s = state.lock().unwrap();
        let c = &mut s.config;
        match id.split_once(':') {
            Some(("size", v)) => c.size = v.into(),
            Some(("speed", v)) => c.speed = v.into(),
            Some(("display", v)) => c.display = v.into(),
            Some(("side", v)) => c.side = v.into(),
            Some(("stale", v)) => c.stale_minutes = v.parse().unwrap_or(30),
            Some(("skin", v)) => c.skin = v.into(),
            _ => match id {
                "show" => c.show = !c.show,
                "subagents" => c.subagents = !c.subagents,
                "show_names" => c.show_names = !c.show_names,
                "hide_when_empty" => c.hide_when_empty = !c.hide_when_empty,
                _ => {}
            },
        }
        save_config(c);
        (c.clone(), s.sessions.clone())
    };
    let _ = app.emit("config-changed", &cfg);
    place(app, &cfg);
    apply_visibility(app, &sessions, &cfg);
    update_tray(app, &sessions, &cfg); // rebuild so check marks stay in sync
}

// ---------- app ----------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_config();
    let sessions = read_sessions(config.stale_minutes);
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Mutex::new(AppState { config, sessions, ..Default::default() }))
        .invoke_handler(tauri::generate_handler![get_state, set_interactive, focus_session, register_skins])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            let (cfg, sessions) = {
                let s = handle.state::<Shared>();
                let s = s.lock().unwrap();
                (s.config.clone(), s.sessions.clone())
            };
            TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true) // black on transparent; macOS tints it for light and dark menu bars
                .menu(&build_menu(&handle, &sessions, &cfg)?)
                .on_menu_event(|app, e| on_menu(app, e.id().as_ref()))
                .build(app)?;
            update_tray(&handle, &sessions, &cfg);

            if let Some(w) = main_window(&handle) {
                w.set_ignore_cursor_events(true)?;
                w.set_visible_on_all_workspaces(true)?;
                #[cfg(target_os = "macos")]
                float_over_fullscreen(&w);
            }
            place(&handle, &cfg);
            apply_visibility(&handle, &sessions, &cfg);
            // Keep the installed hook in step with this app version; ask once if not connected.
            if claude_hooks::is_connected() {
                let _ = claude_hooks::write_hook();
            } else if !cfg.asked_connect {
                prompt_connect(&handle);
            }
            start_watcher(handle.clone());
            updates::start(handle.clone());
            start_cursor_feed(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn owning_app_finds_the_outer_bundle() {
        assert_eq!(owning_app(1), None); // launchd: nothing above it
        let out = std::process::Command::new("pgrep").args(["-x", "Finder"]).output().unwrap();
        let finder: i32 = String::from_utf8_lossy(&out.stdout).trim().parse().expect("Finder is running");
        assert_eq!(owning_app(finder).as_deref(), Some("/System/Library/CoreServices/Finder.app"));
        // This test's own parent chain leads to whatever terminal ran it, or nothing under tmux/CI.
        if let Some(app) = owning_app(std::process::id() as i32) { assert!(app.ends_with(".app"), "{app}"); println!("test runs under {app}"); }
    }

    #[test]
    fn dead_and_stale_sessions_are_dropped() {
        let dir = std::env::temp_dir().join(format!("agentbots-sessions-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        let mut child = std::process::Command::new("sleep").arg("30").spawn().unwrap();
        let write = |id: &str, v: Value| std::fs::write(dir.join(format!("{id}.json")), v.to_string()).unwrap();
        write("alive", json!({"session_id": "alive", "pid": child.id(), "updated": now - 99_999}));
        write("nopid-fresh", json!({"session_id": "nopid-fresh", "pid": null, "updated": now}));
        write("nopid-stale", json!({"session_id": "nopid-stale", "pid": null, "updated": now - 3600}));
        std::fs::write(dir.join(".tmp.x.1"), "{}").unwrap(); // in-flight temp file is ignored

        let ids = |v: Vec<Value>| v.iter().map(|s| s["session_id"].as_str().unwrap().to_string()).collect::<Vec<_>>();
        // A live process keeps its bot no matter how long it has been idle.
        assert_eq!(ids(read_sessions_in(&dir, 30)), ["alive", "nopid-fresh"]);

        child.kill().unwrap(); // SIGKILL, like kill -9
        child.wait().unwrap();
        assert_eq!(ids(read_sessions_in(&dir, 30)), ["nopid-fresh"]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
