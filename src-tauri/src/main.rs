#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::NewWindowResponse;
use tauri::{WebviewUrl, WebviewWindowBuilder};
mod desktop_auth;

#[tauri::command]
fn open_web_app() -> Result<(), String> {
    open::that("https://office.minhspark.com").map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(desktop_auth::DesktopLogin::default())
        .invoke_handler(tauri::generate_handler![
            open_web_app,
            desktop_auth::desktop_google_sign_in,
            desktop_auth::cancel_desktop_sign_in
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Minh Spark Office")
                .inner_size(1440.0, 940.0)
                .min_inner_size(1024.0, 680.0)
                .disable_drag_drop_handler()
                .on_navigation(|url| {
                    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                        || (matches!(url.scheme(), "http" | "https")
                            && url.host_str() == Some("tauri.localhost")
                            && url.port().is_none())
                        || (cfg!(debug_assertions)
                            && url.scheme() == "http"
                            && url.host_str() == Some("127.0.0.1")
                            && url.port() == Some(1420))
                })
                .on_new_window(|url, _| {
                    if matches!(url.scheme(), "https" | "http") {
                        let _ = open::that(url.as_str());
                    }
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to run Minh Spark Office");
}
