# Changelog

## Unreleased

- Open any number of documents at once in tabs above the workspace (Word, Excel, PowerPoint, PDF and images together). Each tab keeps its own editor alive, so switching is instant and undo history, selection and scroll position survive.
- Restore open tabs after reloading; closing a tab saves it first and keeps it open if saving fails.
- Defer cloud updates for every file open in any tab, so a change from another device creates a conflict copy instead of overwriting an open document.
- Print from a document tab in the desktop app through the main window, so every page prints.
- Allow the app to frame itself (same origin only); other sites stay blocked.

## 0.2.40

- Wait for a successful document save before closing the desktop window or quitting the app; retain the document when saving fails, and preserve deferred macOS termination requests.
- Commit pending spreadsheet cell and formula-bar edits before exit, including text entered without pressing Enter.
- Prevent exit during document processing and prevent editing or queued file imports during update installation.
- Preserve image filters, transformations and comments when reopening files or restoring snapshots.
- Include version history in workspace backups, validate complete imports before writes, and retain compatibility with older backups.
- Update local version history atomically so concurrent saves or deletes cannot overwrite each other.
- Continue opening queued desktop files after an unreadable file, failed import or canceled password prompt.
- Advertise PowerPoint document associations in the macOS app.
