#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::{Color, NewWindowResponse};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
mod close_guard;
mod desktop_auth;
mod native_print;
mod open_files;
mod printers;

#[tauri::command]
fn open_web_app() -> Result<(), String> {
    open::that("https://office.minhspark.com").map_err(|error| error.to_string())
}

const DESKTOP_MARKER_SCRIPT: &str = "(()=>{const mark=()=>{const root=document.documentElement;if(!root)return false;root.classList.add('ms-desktop');return true};if(!mark())new MutationObserver((_,observer)=>{if(mark())observer.disconnect()}).observe(document,{childList:true})})()";

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            open_files::queue_arguments(app, args, std::path::Path::new(&cwd));
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(desktop_auth::DesktopLogin::default())
        .manage(open_files::OpenFiles::default())
        .manage(close_guard::CloseGuard::default())
        .invoke_handler(tauri::generate_handler![
            open_web_app,
            native_print::print_window,
            native_print::default_printer,
            native_print::list_printers,
            desktop_auth::desktop_google_sign_in,
            desktop_auth::cancel_desktop_sign_in,
            open_files::drain_open_files,
            open_files::take_open_file,
            open_files::open_default_apps,
            close_guard::pending_close_request,
            close_guard::finish_close_request
        ])
        .setup(|app| {
            if let Ok(cwd) = std::env::current_dir() {
                open_files::queue_arguments(
                    app.handle(),
                    std::env::args_os().map(|value| value.to_string_lossy().into_owned()),
                    &cwd,
                );
            }
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .icon(
                    app.default_window_icon()
                        .expect("Office window icon")
                        .clone(),
                )?
                .title("Minh Spark Office")
                .background_color(Color(246, 247, 251, 255))
                .initialization_script(DESKTOP_MARKER_SCRIPT)
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
        .build(tauri::generate_context!())
        .expect("Failed to build Minh Spark Office")
        .run(|app, event| {
            match &event {
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::CloseRequested { api, .. },
                    ..
                } if label == "main" && !close_guard::approved(app) => {
                    api.prevent_close();
                    close_guard::request(app);
                }
                tauri::RunEvent::ExitRequested { api, code, .. }
                    if *code != Some(tauri::RESTART_EXIT_CODE) && !close_guard::approved(app) =>
                {
                    api.prevent_exit();
                    close_guard::request(app);
                }
                _ => {}
            }
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                open_files::queue_paths(
                    app,
                    urls.into_iter().filter_map(|url| url.to_file_path().ok()),
                );
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
