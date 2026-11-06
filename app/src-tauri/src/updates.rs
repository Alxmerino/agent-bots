//! Auto-update from GitHub releases (tauri-plugin-updater). Checks at launch and every 6 hours,
//! downloads and installs in the background, then offers a restart. Updates are signed with the
//! key in ~/.tauri/agent-bots.key (see scripts/release.sh); the public half is in tauri.conf.json.

use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

/// Installs any newer version. `manual` = the user picked "Check for updates…", so report every outcome.
pub async fn check(app: AppHandle, manual: bool) {
    let say = |msg: String| app.dialog().message(msg).title("Agent Bots").show(|_| {});
    let update = match app.updater() {
        Ok(u) => u.check().await,
        Err(e) => Err(e),
    };
    let update = match update {
        Ok(Some(u)) => u,
        Ok(None) => { if manual { say(format!("You're on the latest version ({}).", app.package_info().version)); } return; }
        Err(e) => { if manual { say(format!("Couldn't check for updates: {e}")); } return; }
    };
    let version = update.version.clone();
    if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
        if manual { say(format!("Couldn't install version {version}: {e}")); }
        return;
    }
    super::set_pending_update(&app, version.clone());
    let handle = app.clone();
    app.dialog()
        .message(format!("Agent Bots {version} is installed. Restart now to use it? Otherwise it starts next time you open Agent Bots."))
        .title("Update ready")
        .buttons(MessageDialogButtons::OkCancelCustom("Restart now".into(), "Later".into()))
        .show(move |restart| if restart { handle.restart() });
}

pub fn start(app: AppHandle) {
    if cfg!(debug_assertions) { return; } // dev builds never update themselves
    std::thread::spawn(move || loop {
        tauri::async_runtime::block_on(check(app.clone(), false));
        std::thread::sleep(Duration::from_secs(6 * 60 * 60));
    });
}
