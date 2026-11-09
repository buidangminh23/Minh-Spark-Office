use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct PrintRequest {
    pub width_mm: f64,
    pub height_mm: f64,
    pub landscape: bool,
    pub title: String,
}

#[cfg(target_os = "macos")]
const POINTS_PER_MM: f64 = 72.0 / 25.4;

#[tauri::command]
pub fn print_window(window: tauri::WebviewWindow, request: Option<PrintRequest>) -> Result<(), String> {
    match request {
        Some(request) => print_with_request(&window, request),
        None => window.print().map_err(|error| error.to_string()),
    }
}

#[tauri::command]
pub async fn default_printer() -> Option<String> {
    tauri::async_runtime::spawn_blocking(read_default_printer).await.ok().flatten()
}

#[cfg(target_os = "windows")]
fn read_default_printer() -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding=[Text.Encoding]::UTF8; (Get-CimInstance Win32_Printer -Filter 'Default=TRUE').Name",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!name.is_empty()).then_some(name)
}

#[cfg(not(target_os = "windows"))]
fn read_default_printer() -> Option<String> {
    let output = std::process::Command::new("lpstat").arg("-d").output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let name = text.split(':').nth(1)?.trim().to_string();
    (!name.is_empty()).then_some(name)
}

#[cfg(target_os = "macos")]
fn print_with_request(window: &tauri::WebviewWindow, request: PrintRequest) -> Result<(), String> {
    window
        .with_webview(move |webview| unsafe { mac::run(webview.inner(), webview.ns_window(), &request) })
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn print_with_request(window: &tauri::WebviewWindow, _request: PrintRequest) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
mod mac {
    use super::{PrintRequest, POINTS_PER_MM};
    use objc2::encode::{Encode, Encoding};
    use objc2::runtime::{AnyObject, Bool, Sel};
    use objc2::{class, msg_send};
    use std::ffi::{c_void, CString};

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct PaperSize {
        width: f64,
        height: f64,
    }

    unsafe impl Encode for PaperSize {
        const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
    }

    const PORTRAIT: isize = 0;
    const LANDSCAPE: isize = 1;

    pub unsafe fn run(webview: *mut c_void, ns_window: *mut c_void, request: &PrintRequest) {
        let webview = webview as *mut AnyObject;
        let ns_window = ns_window as *mut AnyObject;
        if webview.is_null() || ns_window.is_null() {
            return;
        }
        let shared: *mut AnyObject = msg_send![class!(NSPrintInfo), sharedPrintInfo];
        let info: *mut AnyObject = msg_send![shared, copy];
        if info.is_null() {
            return;
        }
        let short = request.width_mm.min(request.height_mm) * POINTS_PER_MM;
        let long = request.width_mm.max(request.height_mm) * POINTS_PER_MM;
        let _: () = msg_send![info, setOrientation: PORTRAIT];
        let _: () = msg_send![info, setPaperSize: PaperSize { width: short, height: long }];
        let _: () = msg_send![info, setOrientation: if request.landscape { LANDSCAPE } else { PORTRAIT }];
        let _: () = msg_send![info, setTopMargin: 0.0f64];
        let _: () = msg_send![info, setBottomMargin: 0.0f64];
        let _: () = msg_send![info, setLeftMargin: 0.0f64];
        let _: () = msg_send![info, setRightMargin: 0.0f64];
        let _: () = msg_send![info, setHorizontallyCentered: Bool::NO];
        let _: () = msg_send![info, setVerticallyCentered: Bool::NO];
        let operation: *mut AnyObject = msg_send![webview, printOperationWithPrintInfo: info];
        let _: () = msg_send![info, release];
        if operation.is_null() {
            return;
        }
        if let Ok(title) = CString::new(request.title.replace('\0', "")) {
            let job: *mut AnyObject = msg_send![class!(NSString), stringWithUTF8String: title.as_ptr()];
            if !job.is_null() {
                let _: () = msg_send![operation, setJobTitle: job];
            }
        }
        let _: () = msg_send![operation, setShowsPrintPanel: Bool::YES];
        let _: () = msg_send![operation, setShowsProgressPanel: Bool::YES];
        let _: () = msg_send![operation, setCanSpawnSeparateThread: Bool::YES];
        let no_selector: Option<Sel> = None;
        let _: () = msg_send![
            operation,
            runOperationModalForWindow: ns_window,
            delegate: std::ptr::null_mut::<AnyObject>(),
            didRunSelector: no_selector,
            contextInfo: std::ptr::null_mut::<c_void>()
        ];
    }
}
