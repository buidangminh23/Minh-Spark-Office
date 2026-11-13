#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::borrow::Cow;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::webview::{Color, NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, Wry};
mod close_guard;
mod desktop_auth;
mod native_print;
#[cfg(target_os = "macos")]
mod native_quit;
mod open_files;
mod outlook_mail;
mod printers;
#[cfg(windows)]
mod win_job;
mod word_pages;

#[tauri::command]
fn open_web_app() -> Result<(), String> {
    open::that("https://office.minhspark.com").map_err(|error| error.to_string())
}

const DESKTOP_MARKER_SCRIPT: &str = "(()=>{const mark=()=>{const root=document.documentElement;if(!root)return false;root.classList.add('ms-desktop');return true};if(!mark())new MutationObserver((_,observer)=>{if(mark())observer.disconnect()}).observe(document,{childList:true})})()";

static APP_WINDOW_COUNT: AtomicUsize = AtomicUsize::new(0);

fn correct_asset_content_type(
    request: tauri::http::Request<Vec<u8>>,
    response: &mut tauri::http::Response<Cow<'static, [u8]>>,
) {
    let Ok(url) = Url::parse(&request.uri().to_string()) else {
        return;
    };
    if !is_app_url(&url) || !url.path().starts_with("/assets/") || !response.status().is_success() {
        return;
    }
    let content_type = match url.path().rsplit('.').next() {
        Some("js" | "mjs") => "text/javascript",
        Some("css") => "text/css",
        _ => return,
    };
    response.headers_mut().insert(
        tauri::http::header::CONTENT_TYPE,
        tauri::http::HeaderValue::from_static(content_type),
    );
}

fn is_app_url(url: &Url) -> bool {
    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https")
            && url.host_str() == Some("tauri.localhost")
            && url.port().is_none())
        || (cfg!(debug_assertions)
            && url.scheme() == "http"
            && url.host_str() == Some("127.0.0.1")
            && url.port() == Some(1420))
}

fn open_externally(url: &Url) -> NewWindowResponse<Wry> {
    if matches!(url.scheme(), "https" | "http" | "mailto") {
        let _ = open::that(url.as_str());
    }
    NewWindowResponse::Deny
}

fn open_app_window(app: &AppHandle, features: NewWindowFeatures) -> NewWindowResponse<Wry> {
    let label = format!(
        "window-{}",
        APP_WINDOW_COUNT.fetch_add(1, Ordering::Relaxed) + 1
    );
    let Ok(blank) = "about:blank".parse() else {
        return NewWindowResponse::Deny;
    };
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(blank))
        .window_features(features)
        .title("Minh Spark Office")
        .background_color(Color(246, 247, 251, 255))
        .initialization_script(DESKTOP_MARKER_SCRIPT)
        .min_inner_size(480.0, 360.0)
        .disable_drag_drop_handler()
        .on_web_resource_request(correct_asset_content_type)
        .on_navigation(|url| url.as_str() == "about:blank" || is_app_url(url))
        .on_new_window(|url, _| open_externally(&url))
        .on_document_title_changed(|window, title| {
            let _ = window.set_title(&title);
        });
    if let Some(icon) = app.default_window_icon() {
        builder = match builder.icon(icon.clone()) {
            Ok(next) => next,
            Err(_) => return NewWindowResponse::Deny,
        };
    }
    match builder.build() {
        Ok(window) => NewWindowResponse::Create { window },
        Err(_) => NewWindowResponse::Deny,
    }
}

fn main() {
    let builder = tauri::Builder::default();
    #[cfg(windows)]
    let builder = {
        let mut restart_env = tauri::Env::default();
        restart_env.args_os.truncate(1);
        builder.manage(restart_env)
    };
    builder
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
        .manage(open_files::OpenFiles::default())
        .manage(close_guard::CloseGuard::default())
        .invoke_handler(tauri::generate_handler![
            open_web_app,
            word_pages::word_physical_pages,
            outlook_mail::outlook_status,
            outlook_mail::outlook_send,
            native_print::print_window,
            native_print::default_printer,
            native_print::list_printers,
            desktop_auth::desktop_google_sign_in,
            desktop_auth::desktop_sign_in_received,
            open_files::drain_open_files,
            open_files::take_open_file,
            open_files::open_default_apps,
            close_guard::pending_close_request,
            close_guard::finish_close_request
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            native_quit::install(app.handle()).map_err(std::io::Error::other)?;
            if let Ok(cwd) = std::env::current_dir() {
                open_files::queue_arguments(
                    app.handle(),
                    std::env::args_os().map(|value| value.to_string_lossy().into_owned()),
                    &cwd,
                );
            }
            let handle = app.handle().clone();
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
                .on_web_resource_request(correct_asset_content_type)
                .on_navigation(is_app_url)
                .on_new_window(move |url, features| {
                    if is_app_url(&url) {
                        open_app_window(&handle, features)
                    } else {
                        open_externally(&url)
                    }
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
                    event: tauri::WindowEvent::Destroyed,
                    ..
                } if label == "main" => {
                    for (other, window) in app.webview_windows() {
                        if other != "main" {
                            let _ = window.close();
                        }
                    }
                }
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

#[cfg(test)]
mod tests {
    use super::{correct_asset_content_type, is_app_url};
    use std::borrow::Cow;
    use tauri::http::{Request, Response};
    use tauri::Url;

    fn app(url: &str) -> bool {
        is_app_url(&Url::parse(url).unwrap())
    }

    #[test]
    fn app_pages_stay_inside_the_desktop_app() {
        assert!(app("http://tauri.localhost/?mirror=w_13zfclo"));
        assert!(app("https://tauri.localhost/?officeTab=doc-1"));
        assert!(app("tauri://localhost/index.html"));
    }

    #[test]
    fn other_pages_open_in_the_browser() {
        assert!(!app("http://tauri.localhost:8080/"));
        assert!(!app("https://office.minhspark.com/"));
        assert!(!app("http://localhost/"));
        assert!(!app("mailto:someone@example.com"));
    }

    #[test]
    fn bundled_modules_keep_script_mime_when_they_contain_file_signatures() {
        let body: Cow<'static, [u8]> = Cow::Borrowed(b"export const magic = '%PDF-';");
        for origin in ["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"] {
            for extension in ["js", "mjs"] {
                let request = Request::builder()
                    .uri(format!("{origin}/assets/pdfBytes-test.{extension}?v=1"))
                    .body(Vec::new()).unwrap();
                let mut response = Response::builder()
                    .header("content-type", "application/pdf")
                    .header("content-security-policy", "default-src 'self'")
                    .body(body.clone()).unwrap();
                correct_asset_content_type(request, &mut response);
                assert_eq!(response.headers()["content-type"], "text/javascript");
                assert_eq!(response.headers()["content-security-policy"], "default-src 'self'");
                assert_eq!(response.body(), &body);
            }
        }
    }

    #[test]
    fn asset_mime_correction_preserves_documents_external_responses_and_errors() {
        for (url, status) in [
            ("http://tauri.localhost/assets/document.pdf", 200),
            ("http://tauri.localhost/document.js", 200),
            ("https://example.com/assets/module.js", 200),
            ("http://tauri.localhost/assets/missing.js", 404),
        ] {
            let request = Request::builder().uri(url).body(Vec::new()).unwrap();
            let mut response = Response::builder().status(status)
                .header("content-type", "application/pdf")
                .body(Cow::Borrowed(b"%PDF-".as_slice())).unwrap();
            correct_asset_content_type(request, &mut response);
            assert_eq!(response.headers()["content-type"], "application/pdf");
        }
    }
}
