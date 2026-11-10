use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrinterKind {
    Usb,
    Network,
    Shared,
    Local,
    Pdf,
    Xps,
    Onenote,
    Fax,
    Virtual,
    Class,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrinterState {
    Ready,
    Printing,
    Paused,
    Offline,
    Error,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrinterIssue {
    PaperOut,
    PaperJam,
    TonerLow,
    TonerEmpty,
    DoorOpen,
    OutputFull,
    NeedsAttention,
    NotAccepting,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterInfo {
    pub name: String,
    pub display_name: String,
    pub is_default: bool,
    pub kind: PrinterKind,
    pub state: PrinterState,
    pub issues: Vec<PrinterIssue>,
    pub location: Option<String>,
    pub model: Option<String>,
    pub installed: bool,
    pub duplex: Option<bool>,
    pub color: Option<bool>,
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    let lower = haystack.to_ascii_lowercase();
    needles.iter().any(|needle| lower.contains(needle))
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value.map(str::trim).filter(|v| !v.is_empty()).map(str::to_string)
}

pub mod cups_rules {
    use super::{contains_any, PrinterIssue, PrinterKind, PrinterState};

    pub const CLASS: u32 = 0x0001;
    pub const REMOTE: u32 = 0x0002;
    pub const COLOR: u32 = 0x0008;
    pub const DUPLEX: u32 = 0x0010;
    pub const FAX: u32 = 0x40000;
    pub const REJECTING: u32 = 0x80000;
    pub const DISCOVERED: u32 = 0x100_0000;

    pub fn kind(name: &str, uri: Option<&str>, bits: u32, model: Option<&str>) -> PrinterKind {
        let uri = uri.unwrap_or("").to_ascii_lowercase();
        let scheme = uri.split(':').next().unwrap_or("");
        if bits & FAX != 0 || scheme == "fax" || contains_any(model.unwrap_or(""), &["fax"]) {
            return PrinterKind::Fax;
        }
        if scheme == "cups-pdf" || contains_any(name, &["pdf"]) || contains_any(model.unwrap_or(""), &["pdf"]) {
            return PrinterKind::Pdf;
        }
        if bits & CLASS != 0 {
            return PrinterKind::Class;
        }
        match scheme {
            "usb" | "parallel" | "serial" => PrinterKind::Usb,
            "ipp" | "ipps" | "dnssd" | "mdns" | "lpd" | "socket" | "http" | "https" | "smb" | "bjnp" | "hp" | "hpfax" => PrinterKind::Network,
            "file" | "cups-brf" => PrinterKind::Virtual,
            _ if bits & (REMOTE | DISCOVERED) != 0 => PrinterKind::Network,
            _ => PrinterKind::Local,
        }
    }

    pub fn state(state: Option<&str>, reasons: Option<&str>, bits: u32, accepting: Option<&str>) -> (PrinterState, Vec<PrinterIssue>) {
        let reasons = reasons.unwrap_or("").to_ascii_lowercase();
        let has = |key: &str| reasons.split(',').any(|r| r.trim().starts_with(key) && !r.trim().ends_with("-report"));
        let mut issues = Vec::new();
        if has("media-empty") || has("media-needed") {
            issues.push(PrinterIssue::PaperOut);
        }
        if has("media-jam") {
            issues.push(PrinterIssue::PaperJam);
        }
        if has("toner-empty") || has("marker-supply-empty") {
            issues.push(PrinterIssue::TonerEmpty);
        } else if has("toner-low") || has("marker-supply-low") {
            issues.push(PrinterIssue::TonerLow);
        }
        if has("door-open") || has("cover-open") {
            issues.push(PrinterIssue::DoorOpen);
        }
        if has("output-area-full") {
            issues.push(PrinterIssue::OutputFull);
        }
        if has("moving-to-paused") || has("other-error") {
            issues.push(PrinterIssue::NeedsAttention);
        }
        if bits & REJECTING != 0 || accepting.map(|v| v.eq_ignore_ascii_case("false")).unwrap_or(false) {
            issues.push(PrinterIssue::NotAccepting);
        }
        let offline = reasons.split(',').any(|r| {
            let r = r.trim();
            r.starts_with("offline") || r.starts_with("connecting-to-device") || r.starts_with("shutdown") || r.starts_with("timed-out")
        });
        let state = match state.map(str::trim) {
            _ if offline => PrinterState::Offline,
            Some("3") => PrinterState::Ready,
            Some("4") => PrinterState::Printing,
            Some("5") => PrinterState::Paused,
            _ => PrinterState::Unknown,
        };
        let state = if state == PrinterState::Ready && issues.iter().any(|i| matches!(i, PrinterIssue::PaperJam | PrinterIssue::DoorOpen | PrinterIssue::TonerEmpty)) {
            PrinterState::Error
        } else {
            state
        };
        (state, issues)
    }
}

pub mod windows_rules {
    use super::{contains_any, PrinterIssue, PrinterKind, PrinterState};

    pub const ATTR_SHARED: u32 = 0x0008;
    pub const ATTR_NETWORK: u32 = 0x0010;
    pub const ATTR_WORK_OFFLINE: u32 = 0x0400;
    pub const ATTR_FAX: u32 = 0x4000;

    pub fn kind(name: &str, driver: &str, port: &str, attributes: u32) -> PrinterKind {
        let port_lower = port.to_ascii_lowercase();
        if attributes & ATTR_FAX != 0 || contains_any(driver, &["fax"]) || port_lower.starts_with("shrfax") {
            return PrinterKind::Fax;
        }
        if contains_any(name, &["pdf"]) || contains_any(driver, &["pdf"]) {
            return PrinterKind::Pdf;
        }
        if contains_any(name, &["xps"]) || contains_any(driver, &["xps"]) {
            return PrinterKind::Xps;
        }
        if contains_any(name, &["onenote"]) || contains_any(driver, &["onenote"]) {
            return PrinterKind::Onenote;
        }
        if name.starts_with("\\\\") || attributes & ATTR_NETWORK != 0 {
            return PrinterKind::Network;
        }
        if port_lower.starts_with("usb") || port_lower.starts_with("lpt") || port_lower.starts_with("dot4") || port_lower.starts_with("com") {
            return PrinterKind::Usb;
        }
        if port_lower.starts_with("wsd") || port_lower.starts_with("ip_") || port_lower.starts_with("tcp") || port_lower.starts_with("http") || port_lower.starts_with("\\\\") || port_lower.contains('.') {
            return PrinterKind::Network;
        }
        if ["nul:", "file:", "portprompt:"].contains(&port_lower.as_str()) || contains_any(port, &["virtual"]) {
            return PrinterKind::Virtual;
        }
        if attributes & ATTR_SHARED != 0 {
            return PrinterKind::Shared;
        }
        PrinterKind::Local
    }

    pub fn state(status: u32, attributes: u32) -> (PrinterState, Vec<PrinterIssue>) {
        let mut issues = Vec::new();
        if status & 0x0010 != 0 {
            issues.push(PrinterIssue::PaperOut);
        }
        if status & 0x0008 != 0 {
            issues.push(PrinterIssue::PaperJam);
        }
        if status & 0x0004_0000 != 0 {
            issues.push(PrinterIssue::TonerEmpty);
        } else if status & 0x0002_0000 != 0 {
            issues.push(PrinterIssue::TonerLow);
        }
        if status & 0x0040_0000 != 0 {
            issues.push(PrinterIssue::DoorOpen);
        }
        if status & 0x0800 != 0 {
            issues.push(PrinterIssue::OutputFull);
        }
        if status & (0x0010_0000 | 0x0040 | 0x0020) != 0 {
            issues.push(PrinterIssue::NeedsAttention);
        }
        let state = if attributes & ATTR_WORK_OFFLINE != 0 || status & (0x0080 | 0x1000 | 0x0080_0000) != 0 {
            PrinterState::Offline
        } else if status & 0x0001 != 0 {
            PrinterState::Paused
        } else if status & (0x0002 | 0x0008 | 0x0040_0000 | 0x0004_0000) != 0 {
            PrinterState::Error
        } else if status & (0x0400 | 0x4000 | 0x0200 | 0x0100) != 0 {
            PrinterState::Printing
        } else {
            PrinterState::Ready
        };
        (state, issues)
    }
}

fn sort_printers(list: &mut [PrinterInfo]) {
    list.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then(b.installed.cmp(&a.installed))
            .then(a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()))
    });
}

pub fn list(discover: bool) -> Vec<PrinterInfo> {
    let mut printers = platform::list(discover);
    sort_printers(&mut printers);
    printers
}

#[cfg(unix)]
mod platform {
    use super::{cups_rules, non_empty, PrinterInfo};
    use std::collections::HashMap;
    use std::ffi::{c_char, c_int, c_uint, c_void, CStr, CString};
    use std::sync::OnceLock;

    #[repr(C)]
    struct CupsOption {
        name: *mut c_char,
        value: *mut c_char,
    }

    #[repr(C)]
    struct CupsDest {
        name: *mut c_char,
        instance: *mut c_char,
        is_default: c_int,
        num_options: c_int,
        options: *mut CupsOption,
    }

    type GetDests = unsafe extern "C" fn(*mut *mut CupsDest) -> c_int;
    type FreeDests = unsafe extern "C" fn(c_int, *mut CupsDest);
    type DestCallback = unsafe extern "C" fn(*mut c_void, c_uint, *mut CupsDest) -> c_int;
    type EnumDests = unsafe extern "C" fn(c_uint, c_int, *mut c_int, c_uint, c_uint, DestCallback, *mut c_void) -> c_int;

    struct Cups {
        get_dests: GetDests,
        free_dests: FreeDests,
        enum_dests: Option<EnumDests>,
    }

    const CUPS_DEST_FLAGS_REMOVED: c_uint = 0x04;
    const DISCOVERY_MS: c_int = 1500;

    #[cfg(target_os = "macos")]
    const LIBRARIES: &[&str] = &["/usr/lib/libcups.2.dylib", "libcups.2.dylib"];
    #[cfg(not(target_os = "macos"))]
    const LIBRARIES: &[&str] = &["libcups.so.2", "libcups.so"];

    fn cups() -> Option<&'static Cups> {
        static CUPS: OnceLock<Option<Cups>> = OnceLock::new();
        CUPS.get_or_init(|| unsafe {
            let handle = LIBRARIES.iter().find_map(|path| {
                let path = CString::new(*path).ok()?;
                let handle = libc::dlopen(path.as_ptr(), libc::RTLD_LAZY | libc::RTLD_LOCAL);
                (!handle.is_null()).then_some(handle)
            })?;
            let symbol = |name: &str| {
                let name = CString::new(name).ok()?;
                let ptr = libc::dlsym(handle, name.as_ptr());
                (!ptr.is_null()).then_some(ptr)
            };
            Some(Cups {
                get_dests: std::mem::transmute::<*mut c_void, GetDests>(symbol("cupsGetDests")?),
                free_dests: std::mem::transmute::<*mut c_void, FreeDests>(symbol("cupsFreeDests")?),
                enum_dests: symbol("cupsEnumDests").map(|ptr| std::mem::transmute::<*mut c_void, EnumDests>(ptr)),
            })
        })
        .as_ref()
    }

    unsafe fn text(ptr: *const c_char) -> Option<String> {
        (!ptr.is_null()).then(|| CStr::from_ptr(ptr).to_string_lossy().into_owned())
    }

    struct RawDest {
        name: String,
        is_default: bool,
        options: HashMap<String, String>,
    }

    unsafe fn read_dest(dest: &CupsDest) -> Option<RawDest> {
        if !dest.instance.is_null() {
            return None;
        }
        let name = text(dest.name)?;
        let mut options = HashMap::new();
        for index in 0..dest.num_options.max(0) as usize {
            let option = &*dest.options.add(index);
            if let (Some(key), Some(value)) = (text(option.name), text(option.value)) {
                options.insert(key, value);
            }
        }
        Some(RawDest { name, is_default: dest.is_default != 0, options })
    }

    unsafe extern "C" fn collect(user: *mut c_void, flags: c_uint, dest: *mut CupsDest) -> c_int {
        let found = &mut *(user as *mut Vec<RawDest>);
        if flags & CUPS_DEST_FLAGS_REMOVED == 0 && !dest.is_null() {
            if let Some(raw) = read_dest(&*dest) {
                found.push(raw);
            }
        }
        1
    }

    fn to_info(raw: &RawDest, installed: bool) -> PrinterInfo {
        let get = |key: &str| raw.options.get(key).map(String::as_str);
        let bits = get("printer-type").and_then(|v| v.trim().parse::<u32>().ok()).unwrap_or(0);
        let model = non_empty(get("printer-make-and-model"));
        let (state, issues) = cups_rules::state(get("printer-state"), get("printer-state-reasons"), bits, get("printer-is-accepting-jobs"));
        let has_bits = get("printer-type").is_some();
        PrinterInfo {
            name: raw.name.clone(),
            display_name: non_empty(get("printer-info")).unwrap_or_else(|| raw.name.replace('_', " ")),
            is_default: raw.is_default,
            kind: cups_rules::kind(&raw.name, get("device-uri").or(get("printer-uri-supported")), bits, model.as_deref()),
            state,
            issues,
            location: non_empty(get("printer-location")),
            model,
            installed,
            duplex: has_bits.then_some(bits & cups_rules::DUPLEX != 0),
            color: has_bits.then_some(bits & cups_rules::COLOR != 0),
        }
    }

    pub fn list(discover: bool) -> Vec<PrinterInfo> {
        let Some(cups) = cups() else { return Vec::new() };
        let mut installed = Vec::new();
        unsafe {
            let mut dests: *mut CupsDest = std::ptr::null_mut();
            let count = (cups.get_dests)(&mut dests);
            if !dests.is_null() {
                for index in 0..count.max(0) as usize {
                    if let Some(raw) = read_dest(&*dests.add(index)) {
                        installed.push(raw);
                    }
                }
                (cups.free_dests)(count, dests);
            }
        }
        let mut printers: Vec<PrinterInfo> = installed.iter().map(|raw| to_info(raw, true)).collect();
        if discover {
            if let Some(enum_dests) = cups.enum_dests {
                let mut found: Vec<RawDest> = Vec::new();
                let mut cancel: c_int = 0;
                unsafe {
                    enum_dests(0, DISCOVERY_MS, &mut cancel, 0, 0, collect, &mut found as *mut Vec<RawDest> as *mut c_void);
                }
                for raw in &found {
                    if let Some(existing) = printers.iter_mut().find(|p| p.name == raw.name) {
                        let richer = to_info(raw, true);
                        if existing.model.is_none() {
                            existing.model = richer.model;
                        }
                        if existing.location.is_none() {
                            existing.location = richer.location;
                        }
                        continue;
                    }
                    let mut info = to_info(raw, false);
                    info.is_default = false;
                    printers.push(info);
                }
            }
        }
        printers
    }
}

#[cfg(windows)]
mod platform {
    use super::{non_empty, windows_rules, PrinterInfo};
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Graphics::Printing::{EnumPrintersW, GetDefaultPrinterW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_2W};
    use windows::Win32::Storage::Xps::{DeviceCapabilitiesW, DC_COLORDEVICE, DC_DUPLEX};

    unsafe fn wide(ptr: PWSTR) -> String {
        if ptr.is_null() {
            String::new()
        } else {
            ptr.to_string().unwrap_or_default()
        }
    }

    fn default_name() -> Option<String> {
        unsafe {
            let mut size: u32 = 0;
            let _ = GetDefaultPrinterW(None, &mut size);
            if size == 0 {
                return None;
            }
            let mut buffer = vec![0u16; size as usize];
            if !GetDefaultPrinterW(Some(PWSTR(buffer.as_mut_ptr())), &mut size).as_bool() {
                return None;
            }
            let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
            Some(String::from_utf16_lossy(&buffer[..end]))
        }
    }

    fn capabilities(name: &str, port: &str) -> (Option<bool>, Option<bool>) {
        static CACHE: OnceLock<Mutex<HashMap<String, (Option<bool>, Option<bool>)>>> = OnceLock::new();
        let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        if let Some(hit) = cache.lock().ok().and_then(|map| map.get(name).copied()) {
            return hit;
        }
        let name_w: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        let port_w: Vec<u16> = port.encode_utf16().chain(Some(0)).collect();
        let read = |capability| unsafe { DeviceCapabilitiesW(PCWSTR(name_w.as_ptr()), PCWSTR(port_w.as_ptr()), capability, None, None) };
        let to_flag = |value: i32| (value >= 0).then_some(value == 1);
        let result = (to_flag(read(DC_DUPLEX)), to_flag(read(DC_COLORDEVICE)));
        if let Ok(mut map) = cache.lock() {
            map.insert(name.to_string(), result);
        }
        result
    }

    pub fn list(_discover: bool) -> Vec<PrinterInfo> {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut needed: u32 = 0;
        let mut returned: u32 = 0;
        unsafe {
            let _ = EnumPrintersW(flags, PCWSTR::null(), 2, None, &mut needed, &mut returned);
        }
        if needed == 0 {
            return Vec::new();
        }
        let mut storage = vec![0u64; (needed as usize).div_ceil(8)];
        let bytes = unsafe { std::slice::from_raw_parts_mut(storage.as_mut_ptr() as *mut u8, storage.len() * 8) };
        if unsafe { EnumPrintersW(flags, PCWSTR::null(), 2, Some(bytes), &mut needed, &mut returned) }.is_err() {
            return Vec::new();
        }
        let default = default_name();
        let infos = unsafe { std::slice::from_raw_parts(storage.as_ptr() as *const PRINTER_INFO_2W, returned as usize) };
        infos
            .iter()
            .map(|info| unsafe {
                let name = wide(info.pPrinterName);
                let port = wide(info.pPortName);
                let driver = wide(info.pDriverName);
                let (state, issues) = windows_rules::state(info.Status, info.Attributes);
                let (duplex, color) = capabilities(&name, &port);
                PrinterInfo {
                    is_default: default.as_deref() == Some(name.as_str()),
                    display_name: name.trim_start_matches('\\').to_string(),
                    kind: windows_rules::kind(&name, &driver, &port, info.Attributes),
                    state,
                    issues,
                    location: non_empty(Some(&wide(info.pLocation))),
                    model: non_empty(Some(&driver)),
                    installed: true,
                    duplex,
                    color,
                    name,
                }
            })
            .collect()
    }
}

#[cfg(not(any(unix, windows)))]
mod platform {
    pub fn list(_discover: bool) -> Vec<super::PrinterInfo> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cups_kinds_cover_every_connection() {
        assert_eq!(cups_rules::kind("HP_M404", Some("usb://HP/LaserJet?serial=1"), 0, None), PrinterKind::Usb);
        assert_eq!(cups_rules::kind("Canon", Some("dnssd://Canon._ipp._tcp.local./"), 0, None), PrinterKind::Network);
        assert_eq!(cups_rules::kind("Office", Some("ipps://10.0.0.5/ipp/print"), 0, None), PrinterKind::Network);
        assert_eq!(cups_rules::kind("Brother", Some("socket://192.168.1.20"), 0, None), PrinterKind::Network);
        assert_eq!(cups_rules::kind("Lab", None, cups_rules::DISCOVERED, None), PrinterKind::Network);
        assert_eq!(cups_rules::kind("Faxer", Some("ipp://x"), cups_rules::FAX, None), PrinterKind::Fax);
        assert_eq!(cups_rules::kind("Cups-PDF", Some("cups-pdf:/"), 0, None), PrinterKind::Pdf);
        assert_eq!(cups_rules::kind("Floor2", Some("ipp://x"), cups_rules::CLASS, None), PrinterKind::Class);
        assert_eq!(cups_rules::kind("Dev", Some("file:///dev/null"), 0, None), PrinterKind::Virtual);
        assert_eq!(cups_rules::kind("Odd", None, 0, None), PrinterKind::Local);
    }

    #[test]
    fn cups_states_read_reasons() {
        assert_eq!(cups_rules::state(Some("3"), Some("none"), 0, Some("true")), (PrinterState::Ready, vec![]));
        assert_eq!(cups_rules::state(Some("4"), None, 0, None).0, PrinterState::Printing);
        assert_eq!(cups_rules::state(Some("5"), Some("paused"), 0, None).0, PrinterState::Paused);
        assert_eq!(cups_rules::state(Some("3"), Some("offline-report"), 0, None).0, PrinterState::Offline);
        let (state, issues) = cups_rules::state(Some("3"), Some("media-empty-warning,toner-low-report"), 0, None);
        assert_eq!(state, PrinterState::Ready);
        assert_eq!(issues, vec![PrinterIssue::PaperOut]);
        let (state, issues) = cups_rules::state(Some("3"), Some("media-jam-error"), cups_rules::REJECTING, None);
        assert_eq!(state, PrinterState::Error);
        assert_eq!(issues, vec![PrinterIssue::PaperJam, PrinterIssue::NotAccepting]);
    }

    #[test]
    fn windows_kinds_match_measured_printers() {
        assert_eq!(windows_rules::kind("Microsoft Print to PDF", "Microsoft Print To PDF", "PORTPROMPT:", 0x0840), PrinterKind::Pdf);
        assert_eq!(windows_rules::kind("Export to WPS PDF", "Kingsoft Virtual Printer Driver", "Kingsoft Virtual Printer Port", 0x0840), PrinterKind::Pdf);
        assert_eq!(windows_rules::kind("OneNote (Desktop)", "Send to Microsoft OneNote 16 Driver", "nul:", 0x0840), PrinterKind::Onenote);
        assert_eq!(windows_rules::kind("Microsoft XPS Document Writer", "Microsoft XPS Document Writer v4", "PORTPROMPT:", 0x0840), PrinterKind::Xps);
        assert_eq!(windows_rules::kind("Fax", "Microsoft Shared Fax Driver", "SHRFAX:", 0x4000), PrinterKind::Fax);
        assert_eq!(windows_rules::kind("\\\\server\\HP", "HP Universal", "IP_10.0.0.9", 0x0010), PrinterKind::Network);
        assert_eq!(windows_rules::kind("Canon G3010", "Canon G3010 series", "WSD-1234", 0x0040), PrinterKind::Network);
        assert_eq!(windows_rules::kind("Epson L3150", "EPSON L3150 Series", "USB001", 0x0040), PrinterKind::Usb);
        assert_eq!(windows_rules::kind("Shared", "Generic", "LOCALPORT", 0x0008), PrinterKind::Shared);
    }

    #[test]
    fn windows_states_read_status_bits() {
        assert_eq!(windows_rules::state(0, 0), (PrinterState::Ready, vec![]));
        assert_eq!(windows_rules::state(0, windows_rules::ATTR_WORK_OFFLINE).0, PrinterState::Offline);
        assert_eq!(windows_rules::state(0x0080, 0).0, PrinterState::Offline);
        assert_eq!(windows_rules::state(0x0001, 0).0, PrinterState::Paused);
        assert_eq!(windows_rules::state(0x0400, 0).0, PrinterState::Printing);
        assert_eq!(windows_rules::state(0x0010, 0), (PrinterState::Ready, vec![PrinterIssue::PaperOut]));
        assert_eq!(windows_rules::state(0x0008, 0), (PrinterState::Error, vec![PrinterIssue::PaperJam]));
    }

    #[test]
    fn default_printer_sorts_first() {
        let make = |name: &str, is_default: bool, installed: bool| PrinterInfo {
            name: name.into(),
            display_name: name.into(),
            is_default,
            kind: PrinterKind::Local,
            state: PrinterState::Ready,
            issues: vec![],
            location: None,
            model: None,
            installed,
            duplex: None,
            color: None,
        };
        let mut list = vec![make("b", false, false), make("c", false, true), make("a", true, true)];
        sort_printers(&mut list);
        assert_eq!(list.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(), ["a", "c", "b"]);
    }
}

#[cfg(test)]
mod live {
    #[test]
    #[ignore]
    fn print_live_list() {
        let started = std::time::Instant::now();
        let list = super::list(true);
        println!("LIVE {} printers in {:?}: {}", list.len(), started.elapsed(), serde_json::to_string_pretty(&list).unwrap());
    }
}
