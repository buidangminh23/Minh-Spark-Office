const ORIGIN_URL: &str = "https://office.minhspark.com";
const PUBLIC_KEY_LENGTH: usize = 87;

fn valid_public_key(key: &str) -> bool {
    key.len() == PUBLIC_KEY_LENGTH
        && key.starts_with('B')
        && key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

fn sign_in_url(public_key: &str) -> Result<String, String> {
    if !valid_public_key(public_key) {
        return Err("auth/desktop-invalid-request".to_string());
    }
    Ok(format!("{ORIGIN_URL}/#desktopLogin=2&key={public_key}"))
}

fn bring_to_front(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = window.set_always_on_top(false);
    if !window.is_focused().unwrap_or(false) {
        let _ = window.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
}

#[tauri::command]
pub fn desktop_google_sign_in(public_key: String) -> Result<(), String> {
    let url = sign_in_url(&public_key)?;
    open::that_detached(url).map_err(|_| "auth/desktop-browser".to_string())
}

#[tauri::command]
pub fn desktop_sign_in_received(window: tauri::WebviewWindow) {
    bring_to_front(&window);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key() -> String {
        format!("B{}", "a".repeat(PUBLIC_KEY_LENGTH - 1))
    }

    #[test]
    fn builds_url_only_for_a_raw_p256_public_key() {
        assert_eq!(
            sign_in_url(&key()).unwrap(),
            format!("{ORIGIN_URL}/#desktopLogin=2&key={}", key())
        );
    }

    #[test]
    fn rejects_keys_that_could_change_the_url() {
        for candidate in [
            String::new(),
            format!("A{}", "a".repeat(PUBLIC_KEY_LENGTH - 1)),
            format!("B{}", "a".repeat(PUBLIC_KEY_LENGTH)),
            format!("B{}&x=1", "a".repeat(PUBLIC_KEY_LENGTH - 5)),
            format!("B{}#", "a".repeat(PUBLIC_KEY_LENGTH - 2)),
            format!("B{}/", "a".repeat(PUBLIC_KEY_LENGTH - 2)),
            format!("B{}é", "a".repeat(PUBLIC_KEY_LENGTH - 3)),
        ] {
            assert!(sign_in_url(&candidate).is_err(), "{candidate}");
        }
    }
}
