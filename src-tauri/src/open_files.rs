use serde::Serialize;
use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

const MAX_BYTES: u64 = 64 * 1024 * 1024;
const MAX_PENDING: usize = 16;
const EXTENSIONS: &[&str] = &[
    "docx", "xlsx", "xlsm", "xls", "csv", "tsv", "pdf", "pptx", "ppt", "txt", "md",
];

#[derive(Default)]
struct Queue {
    files: VecDeque<PathBuf>,
    errors: Vec<String>,
}

#[derive(Clone, Default)]
pub struct OpenFiles(Arc<Mutex<Queue>>);

#[derive(Serialize)]
pub struct OpenFile {
    name: String,
    bytes: Vec<u8>,
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

pub fn queue_arguments(app: &tauri::AppHandle, args: impl IntoIterator<Item = String>, cwd: &Path) {
    let paths = args
        .into_iter()
        .skip(1)
        .filter(|value| !value.starts_with('-'))
        .map(|value| {
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        });
    queue_paths(app, paths);
}

fn read_file(path: PathBuf) -> Result<OpenFile, String> {
    if !supported_local_path(&path) {
        return Err("Không thể mở đường dẫn này.".into());
    }
    let resolved = path
        .canonicalize()
        .map_err(|_| "Không tìm thấy tệp cần mở.".to_string())?;
    if !supported_local_path(&resolved) {
        return Err("Không thể mở đường dẫn này.".into());
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NONBLOCK);
    }
    let mut file = options
        .open(&resolved)
        .map_err(|_| "Không đọc được tệp. Hãy kiểm tra quyền truy cập.".to_string())?;
    let metadata = file
        .metadata()
        .map_err(|_| "Không đọc được thông tin tệp.".to_string())?;
    if !metadata.is_file() {
        return Err("Hãy chọn một tệp, không phải thư mục.".into());
    }
    if metadata.len() > MAX_BYTES {
        return Err("Tệp vượt quá giới hạn mở 32 MB.".into());
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    (&mut file)
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Không đọc được nội dung tệp.".to_string())?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("Tệp vượt quá giới hạn mở 32 MB.".into());
    }
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .ok_or_else(|| "Tên tệp không hợp lệ.".to_string())?;
    Ok(OpenFile { name, bytes })
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
        if let Some(path) = path {
            match read_file(path) {
                Ok(file) => files.push(file),
                Err(error) => errors.push(error),
            }
        }
        let pending = queue.0.lock().unwrap_or_else(|error| error.into_inner());
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
pub fn open_default_apps() -> Result<(), String> {
    #[cfg(windows)]
    {
        return open::that_detached("ms-settings:defaultapps?registeredAppUser=MinhSparkOffice")
            .map_err(|_| "Không mở được cài đặt ứng dụng mặc định.".to_string());
    }
    #[cfg(not(windows))]
    {
        Err(
            "Trong Finder: chọn tệp → Get Info → Open with → Minh Spark Office → Change All."
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

    #[test]
    fn rejects_unsupported_relative_and_remote_paths() {
        assert!(!supported_local_path(Path::new("relative.docx")));
        assert!(!supported_local_path(&fixture("legacy.doc")));
        assert!(!supported_local_path(&fixture("script.exe")));
        assert!(supported_local_path(&fixture("sample.XLSX")));
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
    fn reads_regular_file_and_rejects_oversized_or_directory() {
        let path = fixture("content.txt");
        std::fs::write(&path, b"example").unwrap();
        let file = read_file(path.clone()).unwrap();
        assert_eq!(file.bytes, b"example");
        assert!(!file.name.contains(std::path::MAIN_SEPARATOR));
        std::fs::File::create(&path)
            .unwrap()
            .set_len(MAX_BYTES + 1)
            .unwrap();
        assert!(read_file(path.clone()).is_err());
        std::fs::remove_file(&path).unwrap();
        std::fs::create_dir(&path).unwrap();
        assert!(read_file(path.clone()).is_err());
        std::fs::remove_dir(&path).unwrap();
    }
}
