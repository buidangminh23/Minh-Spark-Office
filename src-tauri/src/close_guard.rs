use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub struct CloseGuard(Mutex<CloseState>);

#[derive(Default)]
struct CloseState {
    sequence: u32,
    pending: Option<u32>,
    approved: bool,
    native_pending: bool,
}

#[derive(Debug, PartialEq)]
pub(crate) enum CloseCompletion {
    StayOpen,
    Exit,
    ReplyNative(bool),
}

impl CloseState {
    fn request(&mut self) -> Option<u32> {
        if self.approved {
            return None;
        }
        if self.pending.is_none() {
            self.sequence = self.sequence.wrapping_add(1);
            self.pending = Some(self.sequence);
        }
        self.pending
    }

    fn request_native(&mut self) -> Option<u32> {
        let request = self.request()?;
        self.native_pending = true;
        Some(request)
    }

    fn finish(&mut self, request_id: u32, saved: bool) -> Option<CloseCompletion> {
        if self.pending != Some(request_id) {
            return None;
        }
        self.pending = None;
        self.approved = saved;
        Some(if std::mem::take(&mut self.native_pending) {
            CloseCompletion::ReplyNative(saved)
        } else if saved {
            CloseCompletion::Exit
        } else {
            CloseCompletion::StayOpen
        })
    }
}

pub fn approved(app: &AppHandle) -> bool {
    app.state::<CloseGuard>()
        .0
        .lock()
        .map(|state| state.approved)
        .unwrap_or(false)
}

pub fn request(app: &AppHandle) {
    let guard = app.state::<CloseGuard>();
    let request_id = guard.0.lock().ok().and_then(|mut state| state.request());
    if let Some(request_id) = request_id {
        if let Err(error) = app.emit_to("main", "office-close-requested", request_id) {
            eprintln!("Unable to request document save before exit: {error}");
        }
    }
}

#[cfg(target_os = "macos")]
pub fn request_native(app: &AppHandle) -> Result<(), String> {
    let guard = app.state::<CloseGuard>();
    let request_id = guard
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .request_native()
        .ok_or("Application exit has already been approved")?;
    if let Err(error) = app.emit_to("main", "office-close-requested", request_id) {
        guard
            .0
            .lock()
            .map_err(|error| error.to_string())?
            .native_pending = false;
        return Err(error.to_string());
    }
    Ok(())
}

pub(crate) fn complete(
    app: &AppHandle,
    request_id: u32,
    saved: bool,
) -> Result<Option<CloseCompletion>, String> {
    app.state::<CloseGuard>()
        .0
        .lock()
        .map_err(|error| error.to_string())
        .map(|mut state| state.finish(request_id, saved))
}

#[tauri::command]
pub fn pending_close_request(
    window: tauri::WebviewWindow,
    guard: tauri::State<'_, CloseGuard>,
) -> Result<Option<u32>, String> {
    if window.label() != "main" {
        return Err("Only the main window can coordinate application exit".into());
    }
    guard
        .0
        .lock()
        .map(|state| state.pending)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn finish_close_request(
    app: AppHandle,
    window: tauri::WebviewWindow,
    request_id: u32,
    saved: bool,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the main window can approve application exit".into());
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        crate::native_quit::dispatch_completion(request_id, saved)?;
    }
    #[cfg(not(target_os = "macos"))]
    if complete(&app, request_id, saved)? == Some(CloseCompletion::Exit) {
        app.exit(0);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{CloseCompletion, CloseState};

    #[test]
    fn closing_waits_for_matching_successful_save() {
        let mut state = CloseState::default();
        let request = state.request().unwrap();
        assert!(!state.approved);
        assert_eq!(state.request(), Some(request));
        assert_eq!(state.finish(request + 1, true), None);
        assert!(!state.approved);
        assert_eq!(state.finish(request, true), Some(CloseCompletion::Exit));
        assert!(state.approved);
        assert_eq!(state.request(), None);
    }

    #[test]
    fn failed_save_keeps_app_open_and_allows_retry() {
        let mut state = CloseState::default();
        let first = state.request().unwrap();
        assert_eq!(state.finish(first, false), Some(CloseCompletion::StayOpen));
        assert!(!state.approved);
        let retry = state.request().unwrap();
        assert_ne!(retry, first);
        assert_eq!(state.finish(first, true), None);
        assert_eq!(state.finish(retry, true), Some(CloseCompletion::Exit));
    }

    #[test]
    fn native_save_replies_to_original_termination_without_requesting_another_exit() {
        let mut state = CloseState::default();
        let request = state.request_native().unwrap();
        assert_eq!(state.request_native(), Some(request));
        assert_eq!(state.finish(request + 1, true), None);
        assert_eq!(
            state.finish(request, true),
            Some(CloseCompletion::ReplyNative(true))
        );
        assert_eq!(state.finish(request, true), None);
        assert!(state.approved);
    }

    #[test]
    fn rejected_native_save_cancels_once_and_next_close_can_exit_normally() {
        let mut state = CloseState::default();
        let request = state.request_native().unwrap();
        assert_eq!(
            state.finish(request, false),
            Some(CloseCompletion::ReplyNative(false))
        );
        assert!(!state.approved);
        let retry = state.request().unwrap();
        assert_eq!(state.finish(request, true), None);
        assert_eq!(state.finish(retry, true), Some(CloseCompletion::Exit));
    }

    #[test]
    fn native_termination_attaches_to_an_in_progress_window_close() {
        let mut state = CloseState::default();
        let request = state.request().unwrap();
        assert_eq!(state.request_native(), Some(request));
        assert_eq!(
            state.finish(request, true),
            Some(CloseCompletion::ReplyNative(true))
        );
    }
}
