use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::fs::OpenOptions;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

const MAX_PENDING: usize = 16;
const EXTENSIONS: &[&str] = &[
    "docx", "xlsx", "xlsm", "xls", "csv", "tsv", "pdf", "pptx", "ppt", "txt", "md",
    "markdown", "png", "jpg", "jpeg", "jfif", "jpe", "webp", "gif", "svg", "svgz", "bmp",
    "dib", "ico", "avif", "tiff", "tif", "heic", "heif",
];

#[derive(Default)]
struct Queue {
    files: VecDeque<PathBuf>,
    errors: Vec<String>,
    staged: HashMap<u64, PathBuf>,
    next_id: u64,
}

#[derive(Clone, Default)]
pub struct OpenFiles(Arc<Mutex<Queue>>);

#[derive(Serialize)]
pub struct OpenFile {
    name: String,
    id: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFilesBatch {
    files: Vec<OpenFile>,
    errors: Vec<String>,
    has_more: bool,
}

fn supported_local_path(path: &Path) -> bool {
    if !path.is_absolute() || path.to_string_lossy().len() > 32_768 {
        return false;
    }
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};
        let Some(Component::Prefix(prefix)) = path.components().next() else {
            return false;
        };
        if !matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)) {
            return false;
        }
        let stem = path
            .file_stem()
            .and_then(|part| part.to_str())
            .unwrap_or("")
            .to_uppercase();
        if matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || (stem.len() == 4
                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && stem.as_bytes()[3].is_ascii_digit())
            || path
                .file_name()
                .is_some_and(|part| part.to_string_lossy().contains(':'))
        {
            return false;
        }
    }
    path.extension()
        .and_then(|part| part.to_str())
        .is_some_and(|extension| EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
}

fn enqueue(queue: &OpenFiles, paths: impl IntoIterator<Item = PathBuf>) {
    let mut pending = queue.0.lock().unwrap_or_else(|error| error.into_inner());
    for path in paths.into_iter().take(MAX_PENDING + 1) {
        if !supported_local_path(&path) {
            if pending.errors.len() < MAX_PENDING {
                pending
                    .errors
                    .push("Tệp không được hỗ trợ hoặc không nằm trên ổ đĩa cục bộ.".into());
            }
        } else if pending.files.len() >= MAX_PENDING {
            if pending.errors.len() < MAX_PENDING {
                pending.errors.push(
                    "Chỉ có thể mở tối đa 16 tệp mỗi lần. Hãy mở các tệp còn lại sau.".into(),
                );
            }
        } else if !pending.files.contains(&path) {
            pending.files.push_back(path);
        }
    }
}

pub fn queue_paths(app: &tauri::AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    enqueue(&app.state::<OpenFiles>(), paths);
    let _ = app.emit("office-open-files-changed", ());
}

fn launch_paths(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
    let args: Vec<_> = args.into_iter().skip(1).collect();
    #[cfg(windows)]
    if args.len() > 1
        && Path::new(&args[0]).is_absolute()
        && Path::new(&args[0]).extension().is_none()
        && args[1..].iter().all(|arg| {
            !arg.is_empty() && !arg.starts_with('-')
                && matches!(Path::new(arg).components().next(), Some(std::path::Component::Normal(_)))
        })
        && args[..args.len() - 1].iter().all(|arg| Path::new(arg).extension().is_none())
    {
        let candidate = PathBuf::from(args.join(" "));
        if supported_local_path(&candidate) && candidate.is_file() {
            return vec![candidate];
        }
    }
    args
        .into_iter()
        .filter(|value| !value.is_empty() && !value.starts_with('-'))
        .map(|value| {
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        })
        .collect()
}

pub fn queue_arguments(app: &tauri::AppHandle, args: impl IntoIterator<Item = String>, cwd: &Path) {
    let paths = launch_paths(args, cwd);
    if !paths.is_empty() {
        queue_paths(app, paths);
    }
}

fn prepare_file(path: PathBuf) -> Result<(PathBuf, String), String> {
    if !supported_local_path(&path) {
        return Err("Không thể mở đường dẫn này.".into());
    }
    let resolved = path
        .canonicalize()
        .map_err(|_| "Không tìm thấy tệp cần mở.".to_string())?;
    let metadata =
        std::fs::metadata(&resolved).map_err(|_| "Không đọc được thông tin tệp.".to_string())?;
    if !metadata.is_file() {
        return Err("Hãy chọn một tệp, không phải thư mục.".into());
    }
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .ok_or_else(|| "Tên tệp không hợp lệ.".to_string())?;
    Ok((resolved, name))
}

fn read_file(path: &Path) -> Result<Vec<u8>, String> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NONBLOCK);
    }
    let mut file = options
        .open(path)
        .map_err(|_| "Không đọc được tệp. Hãy kiểm tra quyền truy cập.".to_string())?;
    let metadata = file
        .metadata()
        .map_err(|_| "Không đọc được thông tin tệp.".to_string())?;
    if !metadata.is_file() {
        return Err("Hãy chọn một tệp, không phải thư mục.".into());
    }
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(usize::try_from(metadata.len()).unwrap_or(usize::MAX))
        .map_err(|_| "Không đủ bộ nhớ để mở tệp này.".to_string())?;
    file.read_to_end(&mut bytes)
        .map_err(|_| "Không đọc được nội dung tệp.".to_string())?;
    Ok(bytes)
}

#[tauri::command]
pub async fn drain_open_files(
    pending: tauri::State<'_, OpenFiles>,
) -> Result<OpenFilesBatch, String> {
    let queue = pending.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (path, mut errors) = {
            let mut pending = queue.0.lock().unwrap_or_else(|error| error.into_inner());
            (
                pending.files.pop_front(),
                std::mem::take(&mut pending.errors),
            )
        };
        let mut files = Vec::new();
        let prepared = path.map(prepare_file);
        let mut pending = queue.0.lock().unwrap_or_else(|error| error.into_inner());
        match prepared {
            Some(Ok((resolved, name))) => {
                if pending.staged.len() >= MAX_PENDING {
                    pending.staged.clear();
                }
                let id = pending.next_id;
                pending.next_id += 1;
                pending.staged.insert(id, resolved);
                files.push(OpenFile { name, id });
            }
            Some(Err(error)) => errors.push(error),
            None => {}
        }
        OpenFilesBatch {
            files,
            errors,
            has_more: !pending.files.is_empty() || !pending.errors.is_empty(),
        }
    })
    .await
    .map_err(|_| "Không xử lý được yêu cầu mở tệp.".to_string())
}

#[tauri::command]
pub async fn take_open_file(
    pending: tauri::State<'_, OpenFiles>,
    id: u64,
) -> Result<tauri::ipc::Response, String> {
    let path = pending
        .0
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .staged
        .remove(&id)
        .ok_or_else(|| "Tệp cần mở không còn trong hàng chờ. Hãy mở lại tệp.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || read_file(&path))
        .await
        .map_err(|_| "Không xử lý được yêu cầu mở tệp.".to_string())?
        .map(tauri::ipc::Response::new)
}

#[tauri::command]
pub fn open_default_apps() -> Result<(), String> {
    #[cfg(windows)]
    {
        return open::that_detached("ms-settings:defaultapps?registeredAppUser=MinhSparkOffice")
            .map_err(|_| "Không mở được cài đặt ứng dụng mặc định.".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        Err(
            "Trong Finder: chọn tệp → Get Info → Open with → Minh Spark Office → Change All."
                .into(),
        )
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        Err(
            "Trong trình quản lý tệp: nhấp chuột phải tài liệu → Thuộc tính → Mở bằng → Minh Spark Office → Đặt làm mặc định."
                .into(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("minh-office-{}-{name}", std::process::id()))
    }

    #[cfg(windows)]
    #[test]
    fn windows_relaunch_recovers_one_existing_split_path_and_preserves_distinct_files() {
        let dir = fixture("Minh Spark");
        std::fs::create_dir_all(&dir).unwrap();
        let pdf = dir.join("scan sample.pdf");
        std::fs::write(&pdf, b"%PDF-").unwrap();
        let cwd = std::env::temp_dir();
        let args = |parts: Vec<String>| std::iter::once("office.exe".to_string()).chain(parts);
        let path = pdf.to_str().unwrap();
        let fragments = path.split(' ').map(str::to_owned).collect();
        assert_eq!(launch_paths(args(fragments), &cwd), [pdf.clone()]);
        assert_eq!(launch_paths(args(vec![path.into()]), &cwd), [pdf.clone()]);
        assert_eq!(launch_paths(args(vec![path.into(), "missing.docx".into()]), &cwd),
                   [pdf.clone(), cwd.join("missing.docx")]);
        assert!(launch_paths(args(vec![]), &cwd).is_empty());
        std::fs::remove_file(pdf).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }

    #[test]
    fn rejects_unsupported_relative_and_remote_paths() {
        assert!(!supported_local_path(Path::new("relative.docx")));
        assert!(!supported_local_path(&fixture("legacy.doc")));
        assert!(!supported_local_path(&fixture("script.exe")));
        assert!(supported_local_path(&fixture("sample.XLSX")));
        assert!(supported_local_path(&fixture("sample.PNG")));
        #[cfg(windows)]
        {
            assert!(!supported_local_path(Path::new(
                r"\\server\share\file.docx"
            )));
            assert!(!supported_local_path(Path::new(r"C:\NUL.txt")));
            assert!(!supported_local_path(Path::new(r"C:\file.txt:secret.txt")));
        }
    }

    #[test]
    fn queue_is_bounded_and_deduplicated() {
        let queue = OpenFiles::default();
        enqueue(&queue, [fixture("same.docx"), fixture("same.docx")]);
        assert_eq!(queue.0.lock().unwrap().files.len(), 1);
        enqueue(
            &queue,
            (0..100).map(|index| fixture(&format!("{index}.txt"))),
        );
        let pending = queue.0.lock().unwrap();
        assert_eq!(pending.files.len(), MAX_PENDING);
        assert!(pending.errors.len() <= MAX_PENDING);
    }

    #[test]
    fn reads_large_regular_file_and_rejects_directory() {
        let path = fixture("content.txt");
        std::fs::write(&path, b"example").unwrap();
        let (resolved, name) = prepare_file(path.clone()).unwrap();
        assert_eq!(read_file(&resolved).unwrap(), b"example");
        assert!(!name.contains(std::path::MAIN_SEPARATOR));
        let large = 96 * 1024 * 1024;
        std::fs::File::create(&path)
            .unwrap()
            .set_len(large)
            .unwrap();
        let (resolved, _) = prepare_file(path.clone()).unwrap();
        assert_eq!(read_file(&resolved).unwrap().len() as u64, large);
        std::fs::remove_file(&path).unwrap();
        std::fs::create_dir(&path).unwrap();
        assert!(prepare_file(path.clone()).is_err());
        std::fs::remove_dir(&path).unwrap();
    }
}
