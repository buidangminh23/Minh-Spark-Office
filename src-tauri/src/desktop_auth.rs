use http_body_util::{BodyExt, Full, Limited};
use hyper::body::{Bytes, Incoming};
use hyper::header::{CONTENT_LENGTH, CONTENT_TYPE, HOST, ORIGIN, TRANSFER_ENCODING};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use serde::Deserialize;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use subtle::ConstantTimeEq;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Notify;
use tokio::task::JoinSet;
use tokio::time::timeout;

const ORIGIN_URL: &str = "https://office.minhspark.com";
const MAX_CONNECTIONS: usize = 8;
const MAX_BODY: usize = 16_384;
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Default)]
pub struct DesktopLogin {
    pending: Mutex<Option<Arc<Notify>>>,
}

struct LoginGuard<'a>(&'a DesktopLogin);

impl Drop for LoginGuard<'_> {
    fn drop(&mut self) {
        *self
            .0
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = None;
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Callback {
    state: String,
    #[serde(rename = "idToken")]
    id_token: String,
}

fn validate_headers<B>(request: &Request<B>, port: u16) -> Result<usize, StatusCode> {
    if request.method() != hyper::Method::POST || request.uri().to_string() != "/callback" {
        return Err(StatusCode::NOT_FOUND);
    }
    let headers = request.headers();
    for header in [ORIGIN, HOST, CONTENT_TYPE, CONTENT_LENGTH] {
        if headers.get_all(&header).iter().count() != 1 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }
    if headers.get(ORIGIN).and_then(|value| value.to_str().ok()) != Some(ORIGIN_URL) {
        return Err(StatusCode::FORBIDDEN);
    }
    let host = format!("127.0.0.1:{port}");
    if headers.get(HOST).and_then(|value| value.to_str().ok()) != Some(host.as_str()) {
        return Err(StatusCode::FORBIDDEN);
    }
    if headers.contains_key(TRANSFER_ENCODING) {
        return Err(StatusCode::BAD_REQUEST);
    }
    let content_type = headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if content_type != "application/x-www-form-urlencoded" {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }
    let raw_length = headers
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if raw_length.is_empty() || !raw_length.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(StatusCode::BAD_REQUEST);
    }
    let length = raw_length
        .parse::<usize>()
        .map_err(|_| StatusCode::PAYLOAD_TOO_LARGE)?;
    if length == 0 || length > MAX_BODY {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }
    Ok(length)
}

fn parse_callback(body: &[u8], state: &str) -> Result<String, StatusCode> {
    if body.len() > MAX_BODY {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }
    let callback: Callback =
        serde_urlencoded::from_bytes(body).map_err(|_| StatusCode::BAD_REQUEST)?;
    if callback.state.len() != state.len()
        || !bool::from(callback.state.as_bytes().ct_eq(state.as_bytes()))
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let parts: Vec<&str> = callback.id_token.split('.').collect();
    if parts.len() != 3
        || parts.iter().any(|part| part.is_empty())
        || !callback
            .id_token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(callback.id_token)
}

fn response(status: StatusCode, success: bool) -> Response<Full<Bytes>> {
    let (mark, title, message) = if success {
        (
            "<svg width=\"28\" height=\"28\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#15803d\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"/></svg>",
            "Đăng nhập thành công",
            "Minh Spark Office đã nhận tài khoản và được mở lên phía trước. Có thể đóng tab này.",
        )
    } else {
        (
            "<svg width=\"28\" height=\"28\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b42318\" stroke-width=\"2.5\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M12 7v6M12 17h.01\"/></svg>",
            "Chưa đăng nhập được",
            "Không nhận được yêu cầu đăng nhập hợp lệ. Hãy quay lại Minh Spark Office và bấm đăng nhập lại.",
        )
    };
    let tint = if success { "#e9f7ee" } else { "#fdeceb" };
    let body = format!("<!doctype html><html lang=\"vi\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Minh Spark Office</title><style>*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px 16px;background:radial-gradient(ellipse at top left,#e6edff,transparent 60%),#f6f7fb;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#182033}}main{{width:min(100%,420px);display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 32px;background:#fff;border:1px solid #e3e7ee;border-radius:20px;box-shadow:0 24px 64px #14243b1f;text-align:center}}.mark{{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:{tint}}}h1{{margin:0;font-size:22px;line-height:1.3}}p{{margin:0;color:#4a5568;font-size:14px;line-height:1.6}}</style><main><div class=\"mark\">{mark}</div><h1>{title}</h1><p>{message}</p></main></html>");
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "text/html; charset=utf-8")
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .header("Referrer-Policy", "no-referrer")
        .header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        )
        .header("X-Content-Type-Options", "nosniff")
        .header("Connection", "close")
        .body(Full::new(Bytes::from(body)))
        .expect("Static callback response")
}

async fn handle_callback(
    request: Request<Incoming>,
    port: u16,
    state: Arc<String>,
    result: Arc<Mutex<Option<String>>>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let expected_length = match validate_headers(&request, port) {
        Ok(value) => value,
        Err(status) => return Ok(response(status, false)),
    };
    let body = match Limited::new(request.into_body(), MAX_BODY).collect().await {
        Ok(value) => value.to_bytes(),
        Err(_) => return Ok(response(StatusCode::BAD_REQUEST, false)),
    };
    if body.len() != expected_length {
        return Ok(response(StatusCode::BAD_REQUEST, false));
    }
    match parse_callback(&body, &state) {
        Ok(token) => {
            let mut slot = result.lock().unwrap_or_else(|error| error.into_inner());
            if slot.is_some() {
                return Ok(response(StatusCode::CONFLICT, false));
            }
            *slot = Some(token);
            Ok(response(StatusCode::OK, true))
        }
        Err(status) => Ok(response(status, false)),
    }
}

async fn receive_token() -> Result<String, String> {
    let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|_| "auth/desktop-listener".to_string())?;
    let port = listener
        .local_addr()
        .map_err(|_| "auth/desktop-listener".to_string())?
        .port();
    let mut random = [0u8; 32];
    getrandom::fill(&mut random).map_err(|_| "auth/desktop-random".to_string())?;
    let state = Arc::new(
        random
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>(),
    );
    let url = format!("{ORIGIN_URL}/#desktopLogin=1&port={port}&state={state}");
    open::that_detached(url).map_err(|_| "auth/desktop-browser".to_string())?;
    listen_for_token(listener, port, state).await
}

async fn listen_for_token(
    listener: TcpListener,
    port: u16,
    state: Arc<String>,
) -> Result<String, String> {
    let mut connections = JoinSet::new();
    loop {
        tokio::select! {
            accepted = listener.accept(), if connections.len() < MAX_CONNECTIONS => {
                let (stream, address) = accepted.map_err(|_| "auth/desktop-listener".to_string())?;
                if address.ip().is_loopback() {
                    connections.spawn(serve_connection(stream, port, state.clone()));
                }
            }
            Some(finished) = connections.join_next() => {
                if let Ok(Some(token)) = finished {
                    return Ok(token);
                }
            }
        }
    }
}

async fn serve_connection(stream: TcpStream, port: u16, state: Arc<String>) -> Option<String> {
    let result = Arc::new(Mutex::new(None));
    let callback_result = result.clone();
    let service = service_fn(move |request| {
        handle_callback(request, port, state.clone(), callback_result.clone())
    });
    let mut builder = http1::Builder::new();
    builder
        .keep_alive(false)
        .max_headers(32)
        .max_buf_size(16_384);
    let _ = timeout(
        CONNECTION_TIMEOUT,
        builder.serve_connection(TokioIo::new(stream), service),
    )
    .await;
    let token = result
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .take();
    token
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
pub async fn desktop_google_sign_in(
    window: tauri::WebviewWindow,
    login: tauri::State<'_, DesktopLogin>,
) -> Result<String, String> {
    let cancel = {
        let mut pending = login
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if pending.is_some() {
            return Err("auth/desktop-pending".to_string());
        }
        let cancel = Arc::new(Notify::new());
        *pending = Some(cancel.clone());
        cancel
    };
    let _guard = LoginGuard(&login);
    let result = tokio::select! {
        result = timeout(LOGIN_TIMEOUT, receive_token()) => result.unwrap_or_else(|_| Err("auth/desktop-timeout".to_string())),
        _ = cancel.notified() => Err("auth/desktop-cancelled".to_string()),
    };
    if result.is_ok() {
        bring_to_front(&window);
    }
    result
}

#[tauri::command]
pub fn cancel_desktop_sign_in(login: tauri::State<'_, DesktopLogin>) {
    if let Some(cancel) = login
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_ref()
    {
        cancel.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn idle_connections_do_not_block_the_callback() {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(listen_for_token(
            listener,
            port,
            Arc::new("expected".to_string()),
        ));
        let mut idle = Vec::new();
        for _ in 0..3 {
            idle.push(
                TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port))
                    .await
                    .unwrap(),
            );
        }
        let accepted = timeout(
            Duration::from_secs(2),
            post(port, ORIGIN_URL, "state=expected&idToken=abc.def.ghi"),
        )
        .await
        .unwrap();
        assert!(accepted.starts_with("HTTP/1.1 200"));
        assert_eq!(task.await.unwrap().unwrap(), "abc.def.ghi");
        drop(idle);
    }

    async fn post(port: u16, origin: &str, body: &str) -> String {
        let mut stream = TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port))
            .await
            .unwrap();
        let request = format!("POST /callback HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nOrigin: {origin}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut response = String::new();
        timeout(Duration::from_secs(2), stream.read_to_string(&mut response))
            .await
            .unwrap()
            .unwrap();
        response
    }

    #[tokio::test]
    async fn real_loopback_rejects_bad_origin_then_accepts_once() {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(listen_for_token(
            listener,
            port,
            Arc::new("expected".to_string()),
        ));
        let body = "state=expected&idToken=abc.def.ghi";
        let denied = post(port, "https://attacker.test", body).await;
        assert!(denied.starts_with("HTTP/1.1 403"));
        let accepted = post(port, ORIGIN_URL, body).await;
        assert!(accepted.starts_with("HTTP/1.1 200"));
        assert!(!accepted.contains("abc.def.ghi"));
        assert!(accepted.contains("no-store"));
        assert_eq!(task.await.unwrap().unwrap(), "abc.def.ghi");
        assert!(TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port))
            .await
            .is_err());
    }

    fn valid_request() -> Request<()> {
        Request::builder()
            .method("POST")
            .uri("/callback")
            .header(ORIGIN, ORIGIN_URL)
            .header(HOST, "127.0.0.1:49152")
            .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
            .header(CONTENT_LENGTH, "100")
            .body(())
            .unwrap()
    }

    #[test]
    fn accepts_only_expected_origin_and_loopback_host() {
        assert_eq!(validate_headers(&valid_request(), 49152), Ok(100));
        for origin in [
            "null",
            "https://attacker.test",
            "https://minhsparkoffice.minhspark.com.attacker.test",
        ] {
            let mut request = valid_request();
            request
                .headers_mut()
                .insert(ORIGIN, origin.parse().unwrap());
            assert_eq!(
                validate_headers(&request, 49152),
                Err(StatusCode::FORBIDDEN)
            );
        }
        let mut request = valid_request();
        request
            .headers_mut()
            .insert(HOST, "attacker.test:49152".parse().unwrap());
        assert_eq!(
            validate_headers(&request, 49152),
            Err(StatusCode::FORBIDDEN)
        );
    }

    #[test]
    fn rejects_wrong_method_path_and_ambiguous_headers() {
        for path in [
            "/",
            "/callback?token=secret",
            "http://127.0.0.1:49152/callback",
        ] {
            let mut request = valid_request();
            *request.uri_mut() = path.parse().unwrap();
            assert!(validate_headers(&request, 49152).is_err());
        }
        let mut request = valid_request();
        *request.method_mut() = hyper::Method::GET;
        assert!(validate_headers(&request, 49152).is_err());
        let mut request = valid_request();
        request
            .headers_mut()
            .append(ORIGIN, ORIGIN_URL.parse().unwrap());
        assert!(validate_headers(&request, 49152).is_err());
        let mut request = valid_request();
        request
            .headers_mut()
            .insert(TRANSFER_ENCODING, "chunked".parse().unwrap());
        assert!(validate_headers(&request, 49152).is_err());
    }

    #[test]
    fn enforces_content_type_and_bounded_body() {
        for length in ["0", "16385", "999999999999999999999999", "-2"] {
            let mut request = valid_request();
            request
                .headers_mut()
                .insert(CONTENT_LENGTH, length.parse().unwrap());
            assert!(validate_headers(&request, 49152).is_err());
        }
        let mut request = valid_request();
        request.headers_mut().remove(CONTENT_LENGTH);
        assert!(validate_headers(&request, 49152).is_err());
        let mut request = valid_request();
        request
            .headers_mut()
            .insert(CONTENT_TYPE, "application/json".parse().unwrap());
        assert!(validate_headers(&request, 49152).is_err());
    }

    #[test]
    fn rejects_bad_state_duplicate_fields_and_invalid_tokens() {
        assert_eq!(
            parse_callback(b"state=expected&idToken=abc.def.ghi", "expected"),
            Ok("abc.def.ghi".into())
        );
        for body in [
            "state=wrong&idToken=abc.def.ghi",
            "state=expected&state=expected&idToken=abc.def.ghi",
            "state=expected&idToken=abc.def.ghi&idToken=x.y.z",
            "state=expected&idToken=abc.def.ghi&extra=1",
            "state=expected&idToken=not-a-jwt",
            "state=expected&idToken=abc.%0A.ghi",
        ] {
            assert!(parse_callback(body.as_bytes(), "expected").is_err());
        }
        assert!(parse_callback(&vec![b'a'; MAX_BODY + 1], "expected").is_err());
    }

    #[test]
    fn resets_active_login_when_guard_is_dropped() {
        let login = DesktopLogin::default();
        *login.pending.lock().unwrap() = Some(Arc::new(Notify::new()));
        drop(LoginGuard(&login));
        assert!(login.pending.lock().unwrap().is_none());
    }
}
