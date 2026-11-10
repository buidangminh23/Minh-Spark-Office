use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub struct CloseGuard(Mutex<CloseState>);

#[derive(Default)]
struct CloseState {
    sequence: u32,
    pending: Option<u32>,
    approved: bool,
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

    fn finish(&mut self, request_id: u32, saved: bool) -> bool {
        if self.pending != Some(request_id) {
            return false;
        }
        self.pending = None;
        self.approved = saved;
        saved
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
    guard: tauri::State<'_, CloseGuard>,
    request_id: u32,
    saved: bool,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the main window can approve application exit".into());
    }
    let exit = guard
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .finish(request_id, saved);
    if exit {
        app.exit(0);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::CloseState;

    #[test]
    fn closing_waits_for_matching_successful_save() {
        let mut state = CloseState::default();
        let request = state.request().unwrap();
        assert!(!state.approved);
        assert_eq!(state.request(), Some(request));
        assert!(!state.finish(request + 1, true));
        assert!(!state.approved);
        assert!(state.finish(request, true));
        assert!(state.approved);
        assert_eq!(state.request(), None);
    }

    #[test]
    fn failed_save_keeps_app_open_and_allows_retry() {
        let mut state = CloseState::default();
        let first = state.request().unwrap();
        assert!(!state.finish(first, false));
        assert!(!state.approved);
        let retry = state.request().unwrap();
        assert_ne!(retry, first);
        assert!(!state.finish(first, true));
        assert!(state.finish(retry, true));
    }
}
