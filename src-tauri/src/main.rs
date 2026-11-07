#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::NewWindowResponse;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn open_web_app() -> Result<(), String> {
    open::that("https://minhsparkoffice.minhspark.com").map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_web_app])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Minh Spark Office")
                .inner_size(1440.0, 940.0)
                .min_inner_size(1024.0, 680.0)
                .disable_drag_drop_handler()
                .on_navigation(|url| {
                    matches!(url.scheme(), "tauri")
                        || (matches!(url.scheme(), "http" | "https")
                            && matches!(
                                url.host_str(),
                                Some("tauri.localhost" | "localhost" | "127.0.0.1")
                            ))
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
