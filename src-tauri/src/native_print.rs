use crate::printers::{self, PrinterInfo};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PrintTarget {
    #[default]
    System,
    Printer {
        name: String,
        display_name: Option<String>,
    },
    Pdf,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(any(target_os = "macos", windows)), allow(dead_code))]
pub struct PrintRequest {
    pub width_mm: f64,
    pub height_mm: f64,
    pub landscape: bool,
    pub title: String,
    #[serde(default)]
    pub target: PrintTarget,
    #[serde(default)]
    pub duplex: bool,
    #[serde(default)]
    #[cfg_attr(not(windows), allow(dead_code))]
    pub grayscale: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintOutcome {
    pub status: &'static str,
    pub path: Option<String>,
}

impl PrintOutcome {
    fn dialog() -> Self {
        Self { status: "dialog", path: None }
    }
    fn sent() -> Self {
        Self { status: "sent", path: None }
    }
    fn saved(path: &Path) -> Self {
        Self { status: "saved", path: Some(path.to_string_lossy().into_owned()) }
    }
    fn cancelled() -> Self {
        Self { status: "cancelled", path: None }
    }
}

const JOB_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[tauri::command]
pub async fn list_printers(discover: Option<bool>) -> Vec<PrinterInfo> {
    let discover = discover.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || printers::list(discover)).await.unwrap_or_default()
}

#[tauri::command]
pub async fn default_printer() -> Option<String> {
    tauri::async_runtime::spawn_blocking(|| printers::list(false).into_iter().find(|p| p.is_default).map(|p| p.display_name))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
pub async fn print_window(window: tauri::WebviewWindow, request: Option<PrintRequest>) -> Result<PrintOutcome, String> {
    let Some(request) = request else {
        window.print().map_err(|error| error.to_string())?;
        return Ok(PrintOutcome::dialog());
    };
    if matches!(request.target, PrintTarget::System) && !cfg!(target_os = "macos") {
        window.print().map_err(|error| error.to_string())?;
        return Ok(PrintOutcome::dialog());
    }
    let pdf_path = match request.target {
        PrintTarget::Pdf => Some(pdf_destination(&request.title)?),
        _ => None,
    };
    let (sender, receiver) = tokio::sync::oneshot::channel::<Result<bool, String>>();
    platform::start(&window, request.clone(), pdf_path.clone(), sender)?;
    if matches!(request.target, PrintTarget::System) {
        return Ok(PrintOutcome::dialog());
    }
    let finished = tokio::time::timeout(JOB_TIMEOUT, receiver)
        .await
        .map_err(|_| "PRINT_TIMEOUT".to_string())?
        .map_err(|_| "PRINT_ABORTED".to_string())??;
    if !finished {
        return Ok(PrintOutcome::cancelled());
    }
    match pdf_path {
        Some(path) => {
            if !path.is_file() {
                return Err("PDF_NOT_WRITTEN".into());
            }
            reveal(&path);
            Ok(PrintOutcome::saved(&path))
        }
        None => Ok(PrintOutcome::sent()),
    }
}

fn downloads_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).ok_or("NO_HOME")?;
    let dir = PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

pub fn safe_file_stem(title: &str) -> String {
    let stem = title.rsplit_once('.').filter(|(_, ext)| ext.len() <= 5 && !ext.contains(' ')).map(|(stem, _)| stem).unwrap_or(title);
    let cleaned: String = stem
        .chars()
        .map(|c| if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') { ' ' } else { c })
        .collect();
    let cleaned = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let cleaned = cleaned.trim_matches(|c: char| c == '.' || c == ' ').chars().take(120).collect::<String>();
    let reserved = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "LPT1", "LPT2", "LPT3"];
    if cleaned.is_empty() || reserved.contains(&cleaned.to_ascii_uppercase().as_str()) {
        "Ban in".to_string()
    } else {
        cleaned
    }
}

pub fn unique_path(dir: &Path, stem: &str) -> PathBuf {
    let first = dir.join(format!("{stem}.pdf"));
    if !first.exists() {
        return first;
    }
    (2..10_000).map(|n| dir.join(format!("{stem} ({n}).pdf"))).find(|p| !p.exists()).unwrap_or(first)
}

fn pdf_destination(title: &str) -> Result<PathBuf, String> {
    Ok(unique_path(&downloads_dir()?, &safe_file_stem(title)))
}

fn reveal(path: &Path) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("/usr/bin/open").arg("-R").arg(path).spawn();
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("explorer.exe").raw_arg(format!("/select,\"{}\"", path.display())).spawn();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(path.parent().unwrap_or(path)).spawn();
}

type Done = tokio::sync::oneshot::Sender<Result<bool, String>>;

#[cfg(target_os = "macos")]
mod platform {
    use super::{Done, PrintRequest, PrintTarget};
    use objc2::encode::{Encode, Encoding};
    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, Bool, NSObject, Sel};
    use objc2::{class, define_class, msg_send, sel, AnyThread};
    use std::cell::RefCell;
    use std::ffi::{c_void, CString};
    use std::path::PathBuf;

    const POINTS_PER_MM: f64 = 72.0 / 25.4;
    const PORTRAIT: isize = 0;
    const LANDSCAPE: isize = 1;
    const DUPLEX_NONE: u32 = 1;
    const DUPLEX_LONG_EDGE: u32 = 2;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct PaperSize {
        width: f64,
        height: f64,
    }

    unsafe impl Encode for PaperSize {
        const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
    }

    #[link(name = "AppKit", kind = "framework")]
    extern "C" {
        static NSPrintJobDisposition: *const AnyObject;
        static NSPrintSaveJob: *const AnyObject;
        static NSPrintJobSavingURL: *const AnyObject;
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn PMSetDuplex(settings: *mut c_void, mode: u32) -> i32;
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "MinhSparkPrintDelegate"]
        struct PrintDelegate;

        impl PrintDelegate {
            #[unsafe(method(printOperationDidRun:success:contextInfo:))]
            fn did_run(&self, _operation: *mut AnyObject, success: Bool, context: *mut c_void) {
                if context.is_null() {
                    return;
                }
                let done = unsafe { Box::from_raw(context as *mut Done) };
                let _ = done.send(Ok(success.as_bool()));
            }
        }
    );

    thread_local! {
        static DELEGATE: RefCell<Option<Retained<PrintDelegate>>> = const { RefCell::new(None) };
    }

    fn delegate() -> *mut AnyObject {
        DELEGATE.with(|cell| {
            let mut slot = cell.borrow_mut();
            let delegate = slot.get_or_insert_with(|| unsafe { msg_send![PrintDelegate::alloc(), init] });
            Retained::as_ptr(delegate) as *mut AnyObject
        })
    }

    unsafe fn ns_string(value: &str) -> *mut AnyObject {
        match CString::new(value.replace('\0', "")) {
            Ok(text) => msg_send![class!(NSString), stringWithUTF8String: text.as_ptr()],
            Err(_) => std::ptr::null_mut(),
        }
    }

    pub fn start(window: &tauri::WebviewWindow, request: PrintRequest, pdf: Option<PathBuf>, done: Done) -> Result<(), String> {
        window
            .with_webview(move |webview| {
                if let Err((message, done)) = unsafe { run(webview.inner(), webview.ns_window(), &request, pdf.as_ref(), done) } {
                    let _ = done.send(Err(message));
                }
            })
            .map_err(|error| error.to_string())
    }

    unsafe fn run(webview: *mut c_void, ns_window: *mut c_void, request: &PrintRequest, pdf: Option<&PathBuf>, done: Done) -> Result<(), (String, Done)> {
        let webview = webview as *mut AnyObject;
        let ns_window = ns_window as *mut AnyObject;
        if webview.is_null() || ns_window.is_null() {
            return Err(("NO_WEBVIEW".into(), done));
        }
        let shared: *mut AnyObject = msg_send![class!(NSPrintInfo), sharedPrintInfo];
        let info: *mut AnyObject = msg_send![shared, copy];
        if info.is_null() {
            return Err(("NO_PRINT_INFO".into(), done));
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

        let show_panel = matches!(request.target, PrintTarget::System);
        match &request.target {
            PrintTarget::Printer { name, display_name } => {
                let printer = [display_name.as_deref(), Some(name.as_str()), Some(name.replace('_', " ").as_str())]
                    .into_iter()
                    .flatten()
                    .map(|candidate| {
                        let printer: *mut AnyObject = msg_send![class!(NSPrinter), printerWithName: ns_string(candidate)];
                        printer
                    })
                    .find(|printer| !printer.is_null());
                let Some(printer) = printer else {
                    let _: () = msg_send![info, release];
                    return Err(("PRINTER_NOT_FOUND".into(), done));
                };
                let _: () = msg_send![info, setPrinter: printer];
                let settings: *mut c_void = msg_send![info, PMPrintSettings];
                if !settings.is_null() {
                    PMSetDuplex(settings, if request.duplex { DUPLEX_LONG_EDGE } else { DUPLEX_NONE });
                    let _: () = msg_send![info, updateFromPMPrintSettings];
                }
            }
            PrintTarget::Pdf => {
                let Some(path) = pdf else {
                    let _: () = msg_send![info, release];
                    return Err(("NO_PDF_PATH".into(), done));
                };
                let url: *mut AnyObject = msg_send![class!(NSURL), fileURLWithPath: ns_string(&path.to_string_lossy())];
                let dict: *mut AnyObject = msg_send![info, dictionary];
                let _: () = msg_send![dict, setObject: NSPrintSaveJob, forKey: NSPrintJobDisposition];
                let _: () = msg_send![dict, setObject: url, forKey: NSPrintJobSavingURL];
            }
            PrintTarget::System => {}
        }

        let operation: *mut AnyObject = msg_send![webview, printOperationWithPrintInfo: info];
        let _: () = msg_send![info, release];
        if operation.is_null() {
            return Err(("NO_PRINT_OPERATION".into(), done));
        }
        let job = ns_string(&request.title);
        if !job.is_null() {
            let _: () = msg_send![operation, setJobTitle: job];
        }
        let _: () = msg_send![operation, setShowsPrintPanel: Bool::new(show_panel)];
        let _: () = msg_send![operation, setShowsProgressPanel: Bool::YES];
        let _: () = msg_send![operation, setCanSpawnSeparateThread: Bool::YES];
        let (target, selector, context): (*mut AnyObject, Option<Sel>, *mut c_void) = if show_panel {
            drop(done);
            (std::ptr::null_mut(), None, std::ptr::null_mut())
        } else {
            (delegate(), Some(sel!(printOperationDidRun:success:contextInfo:)), Box::into_raw(Box::new(done)) as *mut c_void)
        };
        let _: () = msg_send![
            operation,
            runOperationModalForWindow: ns_window,
            delegate: target,
            didRunSelector: selector,
            contextInfo: context
        ];
        Ok(())
    }
}

#[cfg(windows)]
mod platform {
    use super::{Done, PrintRequest, PrintTarget};
    use std::path::PathBuf;
    use std::sync::Mutex;
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use webview2_com::{PrintCompletedHandler, PrintToPdfCompletedHandler};
    use windows::core::{Interface, HSTRING};

    const MM_PER_INCH: f64 = 25.4;

    pub fn start(window: &tauri::WebviewWindow, request: PrintRequest, pdf: Option<PathBuf>, done: Done) -> Result<(), String> {
        window
            .with_webview(move |webview| {
                let shared = std::sync::Arc::new(Mutex::new(Some(done)));
                let finish = {
                    let shared = shared.clone();
                    move |result: Result<bool, String>| {
                        if let Some(done) = shared.lock().ok().and_then(|mut slot| slot.take()) {
                            let _ = done.send(result);
                        }
                    }
                };
                if let Err(error) = unsafe { run(webview.controller(), &request, pdf.as_ref(), finish.clone()) } {
                    finish(Err(format!("WEBVIEW2_{:#010x}", error.code().0)));
                }
            })
            .map_err(|error| error.to_string())
    }

    unsafe fn run(controller: ICoreWebView2Controller, request: &PrintRequest, pdf: Option<&PathBuf>, finish: impl Fn(Result<bool, String>) + Clone + 'static) -> windows::core::Result<()> {
        let core = controller.CoreWebView2()?;
        let environment = core.cast::<ICoreWebView2_2>()?.Environment()?.cast::<ICoreWebView2Environment6>()?;
        let settings = environment.CreatePrintSettings()?;
        let short = request.width_mm.min(request.height_mm) / MM_PER_INCH;
        let long = request.width_mm.max(request.height_mm) / MM_PER_INCH;
        settings.SetOrientation(if request.landscape { COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE } else { COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT })?;
        settings.SetPageWidth(short)?;
        settings.SetPageHeight(long)?;
        settings.SetMarginTop(0.0)?;
        settings.SetMarginBottom(0.0)?;
        settings.SetMarginLeft(0.0)?;
        settings.SetMarginRight(0.0)?;
        settings.SetScaleFactor(1.0)?;
        settings.SetShouldPrintBackgrounds(true)?;
        settings.SetShouldPrintHeaderAndFooter(false)?;
        settings.SetShouldPrintSelectionOnly(false)?;
        let extended = settings.cast::<ICoreWebView2PrintSettings2>()?;
        extended.SetCopies(1)?;
        extended.SetPagesPerSide(1)?;
        extended.SetColorMode(if request.grayscale { COREWEBVIEW2_PRINT_COLOR_MODE_GRAYSCALE } else { COREWEBVIEW2_PRINT_COLOR_MODE_DEFAULT })?;

        match &request.target {
            PrintTarget::Printer { name, .. } => {
                extended.SetPrinterName(&HSTRING::from(name.as_str()))?;
                extended.SetDuplex(if request.duplex { COREWEBVIEW2_PRINT_DUPLEX_TWO_SIDED_LONG_EDGE } else { COREWEBVIEW2_PRINT_DUPLEX_ONE_SIDED })?;
                let handler = PrintCompletedHandler::create(Box::new(move |result, status| {
                    finish(match (result, status) {
                        (Ok(()), COREWEBVIEW2_PRINT_STATUS_SUCCEEDED) => Ok(true),
                        (Ok(()), COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE) => Err("PRINTER_UNAVAILABLE".into()),
                        (Ok(()), _) => Err("PRINT_FAILED".into()),
                        (Err(error), _) => Err(format!("WEBVIEW2_{:#010x}", error.code().0)),
                    });
                    Ok(())
                }));
                core.cast::<ICoreWebView2_16>()?.Print(&settings, &handler)?;
            }
            PrintTarget::Pdf => {
                let Some(path) = pdf else {
                    finish(Err("NO_PDF_PATH".into()));
                    return Ok(());
                };
                let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, success| {
                    finish(match result {
                        Ok(()) if success => Ok(true),
                        Ok(()) => Err("PDF_NOT_WRITTEN".into()),
                        Err(error) => Err(format!("WEBVIEW2_{:#010x}", error.code().0)),
                    });
                    Ok(())
                }));
                core.cast::<ICoreWebView2_7>()?.PrintToPdf(&HSTRING::from(path.as_os_str()), &settings, &handler)?;
            }
            PrintTarget::System => finish(Ok(true)),
        }
        Ok(())
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
mod platform {
    use super::{Done, PrintRequest};
    use std::path::PathBuf;

    pub fn start(window: &tauri::WebviewWindow, _request: PrintRequest, _pdf: Option<PathBuf>, done: Done) -> Result<(), String> {
        let _ = done.send(Err("DIRECT_PRINT_UNSUPPORTED".into()));
        let _ = window;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pdf_names_are_safe_on_every_os() {
        assert_eq!(safe_file_stem("Báo cáo tháng 11.docx"), "Báo cáo tháng 11");
        assert_eq!(safe_file_stem("a/b:c*d?.xlsx"), "a b c d");
        assert_eq!(safe_file_stem("  ..  "), "Ban in");
        assert_eq!(safe_file_stem("CON"), "Ban in");
        assert_eq!(safe_file_stem("Hợp đồng v1.2 bản cuối"), "Hợp đồng v1.2 bản cuối");
    }

    #[test]
    fn pdf_paths_never_overwrite() {
        let dir = std::env::temp_dir().join(format!("minh-print-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let first = unique_path(&dir, "Doc");
        assert_eq!(first.file_name().unwrap(), "Doc.pdf");
        std::fs::write(&first, b"x").unwrap();
        assert_eq!(unique_path(&dir, "Doc").file_name().unwrap(), "Doc (2).pdf");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn targets_parse_from_the_web_request() {
        let request: PrintRequest = serde_json::from_str(r#"{"widthMm":210,"heightMm":297,"landscape":false,"title":"t","target":{"kind":"printer","name":"HP_M404","displayName":"HP M404"},"duplex":true}"#).unwrap();
        assert!(matches!(request.target, PrintTarget::Printer { ref name, ref display_name } if name == "HP_M404" && display_name.as_deref() == Some("HP M404")));
        assert!(request.duplex);
        let legacy: PrintRequest = serde_json::from_str(r#"{"widthMm":210,"heightMm":297,"landscape":true,"title":"t"}"#).unwrap();
        assert!(matches!(legacy.target, PrintTarget::System));
        let pdf: PrintRequest = serde_json::from_str(r#"{"widthMm":210,"heightMm":297,"landscape":true,"title":"t","target":{"kind":"pdf"}}"#).unwrap();
        assert!(matches!(pdf.target, PrintTarget::Pdf));
    }
}
