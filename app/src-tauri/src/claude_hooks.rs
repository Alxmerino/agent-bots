//! Connect/disconnect the bundled hook to Claude Code, mirroring scripts/install.sh and uninstall.sh.
//! settings.json keeps its key order (serde_json preserve_order) and is backed up before every write.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const HOOK_SRC: &str = include_str!("../../../hook/hook.sh");

/// (event, async). Tool events fire constantly, so they run async; the rest stay sync to keep state order.
const EVENTS: &[(&str, bool)] = &[
    ("SessionStart", false), ("UserPromptSubmit", false), ("PreToolUse", true), ("PostToolUse", true),
    ("PermissionRequest", false), ("Notification", false), ("Stop", false), ("StopFailure", false),
    ("SubagentStart", false), ("SubagentStop", false), ("SessionEnd", false),
];

fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
}
fn hook_path() -> PathBuf {
    home().join(".agentbots/hook.sh")
}
fn settings_path() -> PathBuf {
    home().join(".claude/settings.json")
}
fn command() -> String {
    hook_path().to_string_lossy().into_owned()
}

fn read_settings() -> Result<Value, String> {
    match std::fs::read_to_string(settings_path()) {
        Ok(s) if s.trim().is_empty() => Ok(json!({})),
        Ok(s) => serde_json::from_str(&s).map_err(|e| format!("~/.claude/settings.json isn't valid JSON ({e}), so it was left untouched.")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(e) => Err(format!("Couldn't read ~/.claude/settings.json: {e}")),
    }
}

fn write_settings(v: &Value) -> Result<(), String> {
    let path = settings_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    if path.exists() {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let backup = path.with_file_name(format!("settings.json.agentbots-backup.{ts}"));
        std::fs::copy(&path, backup).map_err(|e| format!("Couldn't back up settings: {e}"))?;
    }
    let tmp = path.with_extension("json.agentbots-tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(v).unwrap() + "\n").map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// Remove our entries; drop groups and events left empty by that.
fn strip(settings: &mut Value) {
    let cmd = command();
    let Some(hooks) = settings.get_mut("hooks").and_then(Value::as_object_mut) else { return };
    for groups in hooks.values_mut() {
        if let Some(arr) = groups.as_array_mut() {
            for g in arr.iter_mut() {
                if let Some(hs) = g.get_mut("hooks").and_then(Value::as_array_mut) {
                    hs.retain(|h| h["command"] != cmd.as_str());
                }
            }
            arr.retain(|g| g["hooks"].as_array().is_none_or(|h| !h.is_empty()));
        }
    }
    hooks.retain(|_, g| g.as_array().is_none_or(|a| !a.is_empty()));
}

pub fn is_connected() -> bool {
    let cmd = command();
    read_settings().ok().is_some_and(|s| {
        s["hooks"].as_object().is_some_and(|h| {
            h.values().flat_map(|g| g.as_array().into_iter().flatten())
                .flat_map(|g| g["hooks"].as_array().into_iter().flatten())
                .any(|h| h["command"] == cmd.as_str())
        })
    })
}

/// Write the bundled hook to ~/.agentbots/hook.sh if it differs (so app updates update the hook).
pub fn write_hook() -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let path = hook_path();
    if std::fs::read_to_string(&path).ok().as_deref() != Some(HOOK_SRC) {
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        std::fs::write(&path, HOOK_SRC).map_err(|e| e.to_string())?;
    }
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())
}

pub fn connect() -> Result<(), String> {
    write_hook()?;
    let mut s = read_settings()?;
    if !s.is_object() { return Err("~/.claude/settings.json isn't a JSON object, so it was left untouched.".into()); }
    strip(&mut s);
    let cmd = command();
    let hooks = s.as_object_mut().unwrap().entry("hooks").or_insert_with(|| json!({}));
    let hooks = hooks.as_object_mut().ok_or("\"hooks\" in settings.json isn't an object")?;
    for (event, is_async) in EVENTS {
        let mut h = json!({"type": "command", "command": cmd});
        if *is_async { h["async"] = json!(true); }
        let list = hooks.entry(*event).or_insert_with(|| json!([]));
        if let Some(a) = list.as_array_mut() { a.push(json!({"matcher": "", "hooks": [h]})); }
    }
    write_settings(&s)
}

pub fn disconnect() -> Result<(), String> {
    let mut s = read_settings()?;
    strip(&mut s);
    write_settings(&s)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_home<F: FnOnce()>(f: F) {
        let dir = std::env::temp_dir().join(format!("agentbots-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join(".claude")).unwrap();
        // SAFETY: only one test in this crate touches HOME, so nothing reads it concurrently.
        unsafe { std::env::set_var("HOME", &dir) };
        f();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn connect_disconnect_roundtrip() {
        with_home(|| {
            let original = json!({
                "model": "opus",
                "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "other"}]}]},
                "env": {"A": "1"}
            });
            std::fs::write(settings_path(), serde_json::to_string_pretty(&original).unwrap()).unwrap();

            connect().unwrap();
            connect().unwrap(); // idempotent
            assert!(is_connected());
            let s = read_settings().unwrap();
            let pre = s["hooks"]["PreToolUse"].as_array().unwrap();
            assert_eq!(pre.len(), 2, "other hook kept, ours added once");
            assert_eq!(pre[1]["hooks"][0]["async"], true);
            assert_eq!(s["hooks"].as_object().unwrap().len(), EVENTS.len());
            let keys: Vec<_> = s.as_object().unwrap().keys().cloned().collect();
            assert_eq!(keys, ["model", "hooks", "env"], "key order preserved");
            assert!(hook_path().exists());

            disconnect().unwrap();
            assert!(!is_connected());
            assert_eq!(read_settings().unwrap(), original, "disconnect restores original");

            // invalid JSON is never overwritten
            std::fs::write(settings_path(), "{ not json").unwrap();
            assert!(connect().is_err());
            assert_eq!(std::fs::read_to_string(settings_path()).unwrap(), "{ not json");
        });
    }
}
