use serde::{Deserialize, Serialize};

const MAX_MESSAGES: usize = 1000;
const MAX_FIELD: usize = 4000;
const MAX_BODY: usize = 8 * 1024 * 1024;
const MAX_ATTACHMENTS: usize = 200 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MailAttachment {
    name: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MailMessage {
    to: String,
    #[serde(default)]
    cc: String,
    #[serde(default)]
    bcc: String,
    subject: String,
    body: String,
    #[serde(default)]
    html: bool,
    #[serde(default)]
    attachments: Vec<MailAttachment>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MailOutcome {
    done: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScriptMessage {
    to: String,
    cc: String,
    bcc: String,
    subject: String,
    body_file: String,
    html: bool,
    files: Vec<String>,
}

#[derive(Serialize)]
struct ScriptJob<'a> {
    mode: &'a str,
    messages: Vec<ScriptMessage>,
}

pub(crate) fn safe_attachment_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !c.is_control() && !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'))
        .collect();
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']).trim_start_matches('.');
    let mut result: String = trimmed.chars().take(120).collect();
    if result.is_empty() {
        result = "tep-dinh-kem".into();
    }
    let stem = result.split('.').next().unwrap_or_default().to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        result.insert(0, '_');
    }
    result
}

fn validate(messages: &[MailMessage], mode: &str) -> Result<(), String> {
    if !matches!(mode, "send" | "draft" | "display") {
        return Err("Chế độ gửi thư không hợp lệ.".into());
    }
    if messages.is_empty() || messages.len() > MAX_MESSAGES {
        return Err(format!("Mỗi lần gửi tối đa {MAX_MESSAGES} thư qua Outlook."));
    }
    let mut attachments = 0usize;
    for message in messages {
        let fields = [&message.to, &message.cc, &message.bcc, &message.subject];
        if message.to.trim().is_empty() || fields.iter().any(|field| field.len() > MAX_FIELD) {
            return Err("Có thư thiếu người nhận hoặc tiêu đề quá dài.".into());
        }
        if message.body.len() > MAX_BODY {
            return Err("Nội dung một thư vượt quá 8 MB.".into());
        }
        attachments += message.attachments.iter().map(|item| item.data.len()).sum::<usize>();
    }
    if attachments > MAX_ATTACHMENTS * 4 / 3 {
        return Err("Tổng tệp đính kèm vượt quá 200 MB.".into());
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn outlook_status() -> bool {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(platform::installed)
            .await
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
pub(crate) async fn outlook_send(messages: Vec<MailMessage>, mode: String) -> Result<MailOutcome, String> {
    validate(&messages, &mode)?;
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || platform::send(messages, &mode))
            .await
            .map_err(|_| platform::OUTLOOK_ERROR.to_owned())?
    }
    #[cfg(not(windows))]
    {
        drop(messages);
        Err("Gửi qua Outlook chỉ có trong ứng dụng Office 23 trên Windows.".into())
    }
}

#[cfg(windows)]
mod platform {
    use super::{safe_attachment_name, MailMessage, MailOutcome, ScriptJob, ScriptMessage};
    use crate::win_job::{Job, Workspace};
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::fs::{self, File};
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::path::PathBuf;
    use std::process::{Command, Stdio};
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    const NO_WINDOW: u32 = 0x0800_0000;
    pub(super) const OUTLOOK_ERROR: &str = "Không gửi được thư qua Microsoft Outlook.";
    static ACTIVE: Mutex<()> = Mutex::new(());

    pub(super) fn installed() -> bool {
        let system = match std::env::var_os("SystemRoot") {
            Some(value) => PathBuf::from(value),
            None => return false,
        };
        Command::new(system.join("System32/reg.exe"))
            .args(["query", r"HKCR\Outlook.Application\CLSID", "/ve"])
            .creation_flags(NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    fn write_job(dir: &PathBuf, messages: Vec<MailMessage>, mode: &str) -> Result<usize, String> {
        let total = messages.len();
        let mut script_messages = Vec::with_capacity(total);
        for (index, message) in messages.into_iter().enumerate() {
            let folder = format!("m{index}");
            fs::create_dir(dir.join(&folder)).map_err(|_| OUTLOOK_ERROR)?;
            let body_file = format!("{folder}/body.txt");
            fs::write(dir.join(&body_file), message.body.as_bytes()).map_err(|_| OUTLOOK_ERROR)?;
            let mut files = Vec::new();
            for (position, attachment) in message.attachments.iter().enumerate() {
                let bytes = STANDARD
                    .decode(attachment.data.as_bytes())
                    .map_err(|_| "Tệp đính kèm không hợp lệ.")?;
                let sub = format!("{folder}/a{position}");
                fs::create_dir(dir.join(&sub)).map_err(|_| OUTLOOK_ERROR)?;
                let path = format!("{sub}/{}", safe_attachment_name(&attachment.name));
                fs::write(dir.join(&path), bytes).map_err(|_| OUTLOOK_ERROR)?;
                files.push(path);
            }
            script_messages.push(ScriptMessage {
                to: message.to,
                cc: message.cc,
                bcc: message.bcc,
                subject: message.subject,
                body_file,
                html: message.html,
                files,
            });
        }
        let json = serde_json::to_vec(&ScriptJob { mode, messages: script_messages }).map_err(|_| OUTLOOK_ERROR)?;
        fs::write(dir.join("messages.json"), json).map_err(|_| OUTLOOK_ERROR)?;
        Ok(total)
    }

    fn failure_message(dir: &PathBuf, total: usize) -> String {
        let error = fs::read_to_string(dir.join("error.txt")).unwrap_or_default();
        let error = error.trim();
        if error == "outlook" {
            return "Không mở được Microsoft Outlook. Hãy mở Outlook, đăng nhập hộp thư rồi thử lại.".into();
        }
        if let Some(done) = error.strip_prefix("message:").and_then(|value| value.parse::<usize>().ok()) {
            return format!("Outlook đã xử lý {done}/{total} thư rồi dừng ở thư tiếp theo. Kiểm tra địa chỉ người nhận của thư số {}.", done + 1);
        }
        OUTLOOK_ERROR.into()
    }

    pub(super) fn send(messages: Vec<MailMessage>, mode: &str) -> Result<MailOutcome, String> {
        let _active = ACTIVE
            .try_lock()
            .map_err(|_| "Outlook đang gửi một đợt thư khác.")?;
        let workspace = Workspace::create("mso-mail").map_err(|_| OUTLOOK_ERROR)?;
        let dir = &workspace.0;
        let total = write_job(dir, messages, mode)?;
        let script = dir.join("outlook_mail.ps1");
        let mut file = File::create(&script).map_err(|_| OUTLOOK_ERROR)?;
        file.write_all(b"\xef\xbb\xbf")
            .and_then(|_| file.write_all(include_bytes!("outlook_mail.ps1")))
            .map_err(|_| OUTLOOK_ERROR)?;
        drop(file);
        let system = std::env::var_os("SystemRoot").ok_or(OUTLOOK_ERROR)?;
        let powershell = PathBuf::from(system).join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let job = Job::create().map_err(|_| OUTLOOK_ERROR)?;
        let mut child = Command::new(powershell)
            .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File"])
            .arg(&script)
            .current_dir(dir)
            .creation_flags(NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| OUTLOOK_ERROR)?;
        if job.attach(&child).is_err() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(OUTLOOK_ERROR.into());
        }
        let limit = Duration::from_secs((60 + total as u64 * 5).min(3600));
        let started = Instant::now();
        let status = loop {
            if let Some(status) = child.try_wait().map_err(|_| OUTLOOK_ERROR)? {
                break status;
            }
            if started.elapsed() > limit {
                drop(job);
                let _ = child.wait();
                let done = fs::read_to_string(dir.join("progress.txt")).unwrap_or_default();
                return Err(format!("Outlook phản hồi quá lâu, đã xử lý {}/{total} thư.", done.trim().parse::<usize>().unwrap_or(0)));
            }
            std::thread::sleep(Duration::from_millis(150));
        };
        if !status.success() {
            return Err(failure_message(dir, total));
        }
        let result = fs::read(dir.join("result.json")).map_err(|_| OUTLOOK_ERROR)?;
        serde_json::from_slice(&result).map_err(|_| OUTLOOK_ERROR.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(to: &str) -> MailMessage {
        MailMessage { to: to.into(), cc: String::new(), bcc: String::new(), subject: "Chào".into(), body: "Nội dung".into(), html: false, attachments: Vec::new() }
    }

    #[test]
    fn attachment_names_cannot_escape_the_message_folder() {
        assert_eq!(safe_attachment_name("../../evil.ps1"), "evil.ps1");
        assert_eq!(safe_attachment_name("C:\\Windows\\a.txt"), "CWindowsa.txt");
        assert_eq!(safe_attachment_name("con.txt"), "_con.txt");
        assert_eq!(safe_attachment_name("   "), "tep-dinh-kem");
        assert_eq!(safe_attachment_name("Hợp đồng.pdf"), "Hợp đồng.pdf");
    }

    #[test]
    fn rejects_unknown_modes_and_missing_recipients() {
        assert!(validate(&[message("a@b.vn")], "send").is_ok());
        assert!(validate(&[message("a@b.vn")], "delete").is_err());
        assert!(validate(&[message("  ")], "draft").is_err());
        assert!(validate(&[], "send").is_err());
    }
}
