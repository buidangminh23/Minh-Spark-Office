# Changelog

## Unreleased

- Wait for a successful document save before closing the desktop window or quitting the app; retain the document when saving fails.
- Commit pending spreadsheet cell and formula-bar edits before exit, including text entered without pressing Enter.
- Prevent exit during document processing and prevent editing or queued file imports during update installation.
- Preserve image filters, transformations and comments when reopening files or restoring snapshots.
- Include version history in workspace backups, validate complete imports before writes, and retain compatibility with older backups.
- Update local version history atomically so concurrent saves or deletes cannot overwrite each other.
- Continue opening queued desktop files after an unreadable file, failed import or canceled password prompt.
- Advertise PowerPoint document associations in the macOS app.
