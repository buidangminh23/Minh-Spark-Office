# Minh Spark Office

Browser-based documents, spreadsheets and PDF workspace with Google sign-in through Firebase Authentication.

## Development

```sh
npm ci
cp .env.example .env.local
npm run dev
npm test
npm run build
```

Set the four `VITE_FIREBASE_*` variables from the Firebase web app configuration. These are public client configuration, not service-account credentials. Never place a Google client secret or Firebase Admin key in a `VITE_*` variable.

## File conversion and OCR

Open **Chuyển đổi định dạng** from the home sidebar or toolbar. The converter processes a queue on the device, supports per-file downloads and a ZIP with collision-safe names, and keeps successful results when another file fails. No document content is sent to a conversion or OCR service.

| Input | Outputs |
| --- | --- |
| DOCX, DOTX, TXT, Markdown, HTML | DOCX, ODT, RTF, PDF, TXT, Markdown, HTML, EPUB, PPTX, PNG, JPEG, WebP; XLSX/CSV/TSV for tables |
| XLSX, XLSM, XLSB, XLS, ODS, CSV, TSV | XLSX, ODS, CSV, TSV, JSON, HTML, DOCX, PDF, PPTX, PNG, JPEG, WebP |
| PPTX, PPSX, POTX | PPTX, DOCX, ODT, RTF, TXT, Markdown, HTML, PDF, PNG, JPEG, WebP |
| PDF and supported images | PDF, DOCX, XLSX, PPTX, TXT, HTML, PNG, JPEG, WebP |

Vietnamese and English OCR runs through bundled Tesseract workers, WASM and language data in `public/ocr`. PDF text extraction uses its existing text layer; OCR is applied to pages without extractable text. Searchable PDF output overlays invisible text on original PDF pages. Layout DOCX/PPTX output embeds page images; editable output reconstructs text and columns and requires comparison with the source. OCR confidence warnings flag uncertain recognition. Mixed pages containing both native text and scanned content currently use only their native text layer.

Identity conversion preserves original DOCX/PPTX/XLSX/ODS bytes. DOTX to DOCX and PPSX/POTX to PPTX preserve the package while updating its document content type. Table extraction preserves text identifiers, merged cell positions and supported column widths. Other Office document conversions reconstruct content and can change fonts, pagination, charts, SmartArt, media, macros and advanced formatting. Legacy DOC/PPT input is not advertised. Image decoding varies by browser, particularly HEIC and TIFF; animated images use a single frame. The interface describes these limits instead of claiming lossless conversion.

Each batch accepts up to 20 files and 200 MB total input/output. Office input is limited to 50 MB per file, PDF/images to 100 MB, and PDF processing to 200 pages. Cancellation and bounded image dimensions protect the device. OCR assets ship with both web and desktop builds and include their licenses and pinned sources.

## Google authentication

Enable Google in Firebase Authentication > Sign-in method. Authorize the exact application hostname in Authentication > Settings > Authorized domains. Development uses `localhost`. Production uses `office.minhspark.com`. Configure the same variables in Vercel before building.

The app uses the Firebase SDK Google popup flow, observes authentication state, persists the session, and supports sign-out. Only standard identity scopes are requested; Gmail and Google Drive permissions are not requested. Popup cancellation, blocked popups, network failures, unauthorized domains and disabled providers show actionable messages. Missing configuration leaves local-only access available.

## Storage and account boundaries

Signed-in workspaces use a dedicated IndexedDB database keyed by Firebase UID and synchronize through owner-only Cloud Firestore records. A durable outbox retains local changes offline; atomic revision checks preserve concurrent edits as separate conflict copies. Open editors retain their original revision until closed, preventing remote changes from silently overwriting ongoing work. Metadata, trash, permanent-deletion tombstones and version history synchronize too.

Guest drafts remain on the device and are never assigned silently to an account. Explicit Save copies the chosen draft and its history to a fresh account file ID. The device-draft selector copies only selected files and retains originals. Sign-out and account switches remount the workspace. The original legacy database is copied once and preserved.

Cloud records contain gzip-compressed document content and up to 30 history entries, split into revision-scoped Firestore chunks that are uploaded in several batches before the manifest switches revisions in one transaction. Each record supports up to 256 MiB compressed / 512 MiB decoded (the practical browser string ceiling); records written by older clients (schema 1, 6 MiB / 32 MiB) remain readable. Oversized records stay local with an explicit error; history or content is never silently truncated for upload. Local profile data is not encrypted against other people using the same OS/browser profile. Export a backup before clearing browser or app data.

Deploy `firestore.rules` and `firestore.indexes.json` to the configured Standard database `(default)` in `asia-southeast1`. Rules require the authenticated UID to match the account path, reject public and cross-account access, and validate metadata/chunk bounds and transaction revisions.

## Verification

`npm test` checks account isolation, version isolation, delayed writes, legacy data preservation, explicit backup transfer, concurrent file creation, persistent drafts, one-time legacy migration, and copying only the selected draft into an account. Verify unauthenticated editing, explicit Save and Ctrl+S, canceled login preserving content, successful login saving the current draft, guest reload recovery, and sign-out returning to the public home screen. Validate another account only with its owner's authorization.

Workspace backups include document contents and version history from one consistent local transaction. Imports validate every record before writing, preserve existing file IDs, and accept older backups without history. Parallel local snapshot creation and deletion update history atomically.

Desktop window close and application quit wait for a successful local save. Pending spreadsheet cell and formula-bar edits are committed before the snapshot. Failed saves or active document operations keep the application open. Editing and OS file imports are blocked during the final save or update installation; force termination and power loss cannot run this handshake, so normal autosave remains necessary.

## Deployment

Use the existing Vercel project `minh-spark-office`. Set all four Firebase variables in the production environment. Build and deploy a clean, tested commit. Do not deploy the shared working directory while other agents have unfinished changes. This release retains the production Minh Docs feature set, all 22 export formats, approved product artwork and the canonical `office.minhspark.com` domain.

Google button artwork is the official Firebase UI Google asset from https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg.

## Product logos

The default Minh Docs, Minh Sheets and Minh PDF identities are the approved layered PNG assets in `public/logos/`. Use `SuiteLogo` and the `suiteLogos` mapping in `src/lib/suiteBranding.ts` for product navigation, templates, file types, editor headers and browser favicons. Preserve the separate Office identity in `public/logo-icon.png`. Keep the original transparent artwork unchanged.

## Windows releases and updates

Run `pwsh -NoProfile -File scripts/build-desktop.ps1 -StageWeb` to build updater-signed NSIS/MSI installers, verify each signature and signed version, and stage downloads plus `/updates/latest.json`. Omit `-StageWeb` for local release artifacts only. Rebuild the web after native packaging: the native build removes generated installer downloads from `dist` to prevent recursive bundling. The app identifier remains `com.minhspark.office` to preserve installed data.

The persistent updater private key is outside the repository at `%LOCALAPPDATA%\MinhSparkOffice\signing\updater.key`, accessible only to its Windows owner and SYSTEM. Back it up securely; replacing it after shipping breaks verification for existing clients. Never commit or print the private key. Update payloads include cryptographically bound versions. HTTPS manifests provide separate NSIS/MSI targets. The app checks at startup and every 15 minutes, offers manual checks, shows real download progress, verifies signatures before install, and saves the active document before restarting. A failed save or installation restores editing without navigating away from the document.

Windows trusted-publisher signing requires a separately issued code-signing certificate. Set `MINHSPARK_CERTIFICATE_THUMBPRINT` to a trusted CurrentUser\My certificate and build with `-RequireAuthenticode`; the script rejects missing, expired, untrusted or unsuitable certificates and verifies all three Windows artifacts. Optionally set `MINHSPARK_TIMESTAMP_URL`. Without that certificate, update signatures work but Windows publisher identity remains unverified. Version 0.1.0 has no updater and requires installing the new release once.

Native Google login uses the system browser at `https://office.minhspark.com/`, an expiring one-time loopback callback, exact origin/host validation and POST-only credentials. It requests standard identity scopes only. The browser bridge must retain its origin referrer policy and permit form navigation to the generated loopback address.

## macOS releases

Run `scripts/build-macos.sh` on an Apple Silicon Mac using the prepared web `dist` directory. The script produces an arm64 DMG and updater `.app.tar.gz`, verifies the disk image and application signature, and requires macOS 13.3 or newer. Copy both artifacts into `release/` on the signing workstation, then run `node scripts/package-macos.mjs` after staging the matching Windows release. This verifies the updater signature and merges the `darwin-aarch64` target into the shared manifest without moving the private key to the Mac.

The current Mac app has an ad-hoc signature; it has no Apple Developer ID or notarization. An Intel native build is not included. The web app remains available on Intel Macs.

Gatekeeper blocks any ad-hoc app that carries the `com.apple.quarantine` attribute, which browsers attach to every download. A DMG downloaded in a browser therefore shows "Minh Spark Office chưa được mở" on first launch. The supported install path is the terminal installer served from `public/install-macos.sh`:

```sh
curl -fsSL https://office.minhspark.com/install-macos.sh | bash
```

`curl` attaches no quarantine attribute. The installer reads `downloads/SHA256SUMS.txt` (CRLF or LF), downloads the newest macOS `.app.tar.gz`, verifies its SHA-256, bundle identifier, version and code signature, swaps it into `/Applications` (or `~/Applications`) with a rollback on failure, strips any remaining quarantine attribute and refuses to replace a copy that is running. In-app updates download through the updater plugin and are never quarantined. Keep the DMG only as a secondary download with the "Open Anyway" instructions on `tai-ung-dung.html`; never present it as the primary macOS path while the app is not notarized. Developer ID signing and notarization remove the warning for every path and require a paid Apple Developer Program membership.

After any change to `public/install-macos.sh` or the macOS release artifacts, run it against production with `--dir <scratch directory> --no-launch` and confirm `codesign --verify --deep --strict` passes and no file inside the bundle reports `com.apple.quarantine`.

## Opening local files

Windows installers register Open With entries and Default Apps capabilities for DOCX, XLSX, XLSM, XLS, CSV, TSV, PDF, TXT and MD without overwriting existing default handlers or UserChoice. The application offers a button to open Windows Default Apps settings. macOS advertises alternate document handlers and shows Finder instructions for choosing a default. The native queue accepts only OS-provided paths, bounds file sizes and waits until the current editor is closed before opening another document. A second launch focuses the existing window.
