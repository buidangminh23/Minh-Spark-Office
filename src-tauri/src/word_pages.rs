use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PageLayout {
    page_count: usize,
    boundaries: Vec<PageBoundary>,
    page_numbers: Vec<i32>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageBoundary {
    paragraph: usize,
    offset: usize,
    text: String,
    in_table: bool,
}

#[tauri::command]
pub(crate) async fn word_physical_pages(data: String) -> Result<PageLayout, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || platform::read_layout(&data))
            .await
            .map_err(|_| "Không đọc được bố cục trang trong Microsoft Word.".to_owned())?
    }
    #[cfg(not(windows))]
    {
        drop(data);
        Err("Cần ứng dụng Minh Spark Office trên Windows có Microsoft Word để dàn trang tài liệu này.".into())
    }
}

#[cfg(windows)]
mod platform {
    use super::PageLayout;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use crate::win_job::{Job, Workspace};
    use std::fs::{self, File};
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::path::PathBuf;
    use std::process::{Command, Stdio};
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    const MAX_INPUT: usize = 50 * 1024 * 1024;
    const MAX_OUTPUT: u64 = 16 * 1024 * 1024;
    const INPUT_ERROR: &str = "Chọn tệp DOCX hợp lệ có dung lượng tối đa 50 MB.";
    const LAYOUT_ERROR: &str = "Không đọc được bố cục trang trong Microsoft Word.";
    const WORD_ERROR: &str =
        "Cần cài Microsoft Word trên Windows để xác định các trang của tài liệu này.";
    static ACTIVE: Mutex<()> = Mutex::new(());

    pub(super) fn read_layout(data: &str) -> Result<PageLayout, String> {
        let _active = ACTIVE
            .try_lock()
            .map_err(|_| "Microsoft Word đang dàn trang một tài liệu khác.")?;
        if data.len() > 4 * MAX_INPUT.div_ceil(3) {
            return Err(INPUT_ERROR.into());
        }
        let bytes = STANDARD.decode(data).map_err(|_| INPUT_ERROR)?;
        if bytes.len() > MAX_INPUT || !bytes.starts_with(b"PK\x03\x04") {
            return Err(INPUT_ERROR.into());
        }
        let workspace = Workspace::create("mso-word").map_err(|_| LAYOUT_ERROR)?;
        let dir = &workspace.0;
        fs::write(dir.join("input.docx"), bytes).map_err(|_| LAYOUT_ERROR)?;
        let script = dir.join("word_pages.ps1");
        let mut file = File::create(&script).map_err(|_| LAYOUT_ERROR)?;
        file.write_all(b"\xef\xbb\xbf")
            .and_then(|_| file.write_all(include_bytes!("word_pages.ps1")))
            .map_err(|_| LAYOUT_ERROR)?;
        drop(file);
        let system = std::env::var_os("SystemRoot").ok_or(LAYOUT_ERROR)?;
        let powershell =
            PathBuf::from(system).join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let job = Job::create().map_err(|_| LAYOUT_ERROR)?;
        let mut child = Command::new(powershell)
            .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-File"])
            .arg(script)
            .current_dir(dir)
            .creation_flags(0x08000000)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| LAYOUT_ERROR)?;
        if job.attach(&child).is_err() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(LAYOUT_ERROR.into());
        }
        fs::write(dir.join("ready"), []).map_err(|_| LAYOUT_ERROR)?;
        let started = Instant::now();
        let status = loop {
            if let Some(status) = child.try_wait().map_err(|_| LAYOUT_ERROR)? {
                break status;
            }
            if started.elapsed() > Duration::from_secs(120) {
                drop(job);
                let _ = child.wait();
                return Err("Microsoft Word mất quá nhiều thời gian để xác định số trang.".into());
            }
            std::thread::sleep(Duration::from_millis(100));
        };
        if !status.success() {
            let error = fs::read_to_string(dir.join("error.txt")).unwrap_or_default();
            return Err(match error.trim() {
                "unsupported" => {
                    "Tài liệu Word có nội dung hoặc liên kết chưa hỗ trợ dàn trang trực tiếp."
                }
                "word" => WORD_ERROR,
                _ => LAYOUT_ERROR,
            }
            .into());
        }
        let output = dir.join("result.json");
        if fs::metadata(&output).map_err(|_| LAYOUT_ERROR)?.len() > MAX_OUTPUT {
            return Err(LAYOUT_ERROR.into());
        }
        let result: PageLayout =
            serde_json::from_slice(&fs::read(output).map_err(|_| LAYOUT_ERROR)?)
                .map_err(|_| LAYOUT_ERROR)?;
        if result.page_count == 0
            || result.page_count > 10000
            || result.boundaries.len() + 1 != result.page_count
            || result.page_numbers.len() != result.page_count
        {
            return Err(LAYOUT_ERROR.into());
        }
        Ok(result)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn rejects_non_docx_before_opening_word() {
            assert!(matches!(read_layout("YWJj"), Err(message) if message == INPUT_ERROR));
        }

        #[test]
        #[ignore = "requires Microsoft Word and MSO_PAGE_TEST_DOCX with a matching reference JSON"]
        fn word_matches_reference_pagination() {
            let fixture = PathBuf::from(std::env::var_os("MSO_PAGE_TEST_DOCX").unwrap());
            let expected = fs::read(fixture.with_extension("json")).unwrap();
            let expected: PageLayout = serde_json::from_slice(&expected).unwrap();
            assert!(expected.page_count > 1);
            let input = STANDARD.encode(fs::read(fixture).unwrap());
            let actual = read_layout(&input).unwrap();
            assert_eq!(
                serde_json::to_value(actual).unwrap(),
                serde_json::to_value(expected).unwrap()
            );
        }
    }
}
