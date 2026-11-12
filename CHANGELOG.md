# Changelog

## Unreleased

- Fix the app freezing after sitting idle: cloud sync no longer calls `ReadableStreamDefaultReader.releaseLock()`, which can deadlock WebKit's garbage collector on macOS and leave the whole window unclickable.
- Share from the editors: the Docs "Chia sẻ" button opens the Share pane directly, and Docs, Sheets and PDF can send the current file to a team in one click.
- Team invite links always point to office.minhspark.com, also when sent from the desktop app, and "Ứng dụng email" works there.
- Viewers see the published content of a shared document instead of a blank page, and editors take over the first setup when nobody else is online.
- Teams can share PDF files (members open their own copy), and shared files may be as large as personal cloud files (up to 256 MB compressed).
- Show errors from the "Lời mời dành cho bạn" list and retry it, and leave room for clock differences when creating invites.

- Open any number of documents at once in tabs above the workspace (Word, Excel, PowerPoint, PDF and images together). Each tab keeps its own editor alive, so switching is instant and undo history, selection and scroll position survive.
- Switch tabs from the keyboard on the web and in the desktop app (Alt on Windows/Linux, Control on macOS): Alt+] / Alt+[ next and previous tab, Alt+1 Home, Alt+2-8 that tab, Alt+9 the last tab, Alt+W close, Alt+Shift+T reopen the last closed tab, Alt+T back to Home to open or create a file. Ctrl+Tab / Ctrl+Shift+Tab and Ctrl+W also work in the desktop app, where no browser claims them. Tab tooltips show each shortcut.
- Restore open tabs after reloading; closing a tab saves it first and keeps it open if saving fails.
- Defer cloud updates for every file open in any tab, so a change from another device creates a conflict copy instead of overwriting an open document.
- Print from a document tab in the desktop app through the main window, so every page prints.
- Allow the app to frame itself (same origin only); other sites stay blocked.
- Keep open tabs when the desktop app restarts or updates, instead of reopening only the last document.
- Load a restored tab only when it is first opened, so startup no longer boots every document at once.
- Hide the Home sidebar scrollbar while a document tab is shown; on macOS it was drawn over the document.
- Store each queued cloud change in its own outbox entry, so a large pending upload (such as a big PDF) no longer slows every save and makes new tabs load for a long time.
- Stop intermittent sync errors: a single network hiccup no longer turns the status red; failures retry with growing delays and only show after several in a row.
- Recognise a save that reached the cloud before its reply was lost, instead of reporting a conflict with yourself or making a conflict copy.
- Starring, renaming or opening a file from Home while it is open in a tab no longer creates a conflict copy or undoes the star.
- Opening a file no longer re-uploads the whole document and its version history.
- Reconnect the live update listener after it drops, so changes from other devices keep arriving.
- Run cloud sync once per window instead of once per open tab, and keep the sign-in session in one place so tabs no longer see a momentary sign-out.
- Retry reads of a file that another device is saving instead of reporting it as damaged, and keep a file that is too large from blocking the rest.

## 0.2.40

- Wait for a successful document save before closing the desktop window or quitting the app; retain the document when saving fails, and preserve deferred macOS termination requests.
- Commit pending spreadsheet cell and formula-bar edits before exit, including text entered without pressing Enter.
- Prevent exit during document processing and prevent editing or queued file imports during update installation.
- Preserve image filters, transformations and comments when reopening files or restoring snapshots.
- Include version history in workspace backups, validate complete imports before writes, and retain compatibility with older backups.
- Update local version history atomically so concurrent saves or deletes cannot overwrite each other.
- Continue opening queued desktop files after an unreadable file, failed import or canceled password prompt.
- Advertise PowerPoint document associations in the macOS app.
