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

## Google authentication

Enable Google in Firebase Authentication > Sign-in method. Authorize the exact application hostname in Authentication > Settings > Authorized domains. Development uses `localhost`. Production uses `office.minhspark.com`. Configure the same variables in Vercel before building.

The app uses the Firebase SDK Google popup flow, observes authentication state, persists the session, and supports sign-out. Only standard identity scopes are requested; Gmail and Google Drive permissions are not requested. Popup cancellation, blocked popups, network failures, unauthorized domains and disabled providers show actionable messages. Missing configuration leaves local-only access available.

## Storage and account boundaries

Signed-in workspaces use a dedicated IndexedDB database keyed by Firebase UID and synchronize through owner-only Cloud Firestore records. A durable outbox retains local changes offline; atomic revision checks preserve concurrent edits as separate conflict copies. Open editors retain their original revision until closed, preventing remote changes from silently overwriting ongoing work. Metadata, trash, permanent-deletion tombstones and version history synchronize too.

Guest drafts remain on the device and are never assigned silently to an account. Explicit Save copies the chosen draft and its history to a fresh account file ID. The device-draft selector copies only selected files and retains originals. Sign-out and account switches remount the workspace. The original legacy database is copied once and preserved.

Cloud records contain gzip-compressed document content and up to 30 history entries, split into bounded Firestore chunks. Each record supports at most 6 MiB compressed / 32 MiB decoded. Oversized records stay local with an explicit error; history or content is never silently truncated for upload. Local profile data is not encrypted against other people using the same OS/browser profile. Export a backup before clearing browser or app data.

Deploy `firestore.rules` and `firestore.indexes.json` to the configured Standard database `(default)` in `asia-southeast1`. Rules require the authenticated UID to match the account path, reject public and cross-account access, and validate metadata/chunk bounds and transaction revisions.

## Verification

`npm test` checks account isolation, version isolation, delayed writes, legacy data preservation, explicit backup transfer, concurrent file creation, persistent drafts, one-time legacy migration, and copying only the selected draft into an account. Verify unauthenticated editing, explicit Save and Ctrl+S, canceled login preserving content, successful login saving the current draft, guest reload recovery, and sign-out returning to the public home screen. Validate another account only with its owner's authorization.

## Deployment

Use the existing Vercel project `minh-spark-office`. Set all four Firebase variables in the production environment. Build and deploy a clean, tested commit. Do not deploy the shared working directory while other agents have unfinished changes. This Google authentication release is based on production commit `2f4f173` to retain the full Minh Docs feature set and all 22 export formats.

Google button artwork is the official Firebase UI Google asset from https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg.

## Product logos

The default Minh Docs, Minh Sheets and Minh PDF identities are the approved layered PNG assets in `public/logos/`. Use `SuiteLogo` and the `suiteLogos` mapping in `src/lib/suiteBranding.ts` for product navigation, templates, file types, editor headers and browser favicons. Preserve the separate Office identity in `public/logo-icon.png`. Keep the original transparent artwork unchanged.

## Windows releases and updates

Run `pwsh -NoProfile -File scripts/build-desktop.ps1 -StageWeb` to build updater-signed NSIS/MSI installers, verify each signature and signed version, and stage downloads plus `/updates/latest.json`. Omit `-StageWeb` for local release artifacts only. Rebuild the web after native packaging: the native build removes generated installer downloads from `dist` to prevent recursive bundling. The app identifier remains `com.minhspark.office` to preserve installed data.

The persistent updater private key is outside the repository at `%LOCALAPPDATA%\MinhSparkOffice\signing\updater.key`, accessible only to its Windows owner and SYSTEM. Back it up securely; replacing it after shipping breaks verification for existing clients. Never commit or print the private key. Update payloads include cryptographically bound versions. HTTPS manifests provide separate NSIS/MSI targets. The app checks at startup and every six hours, offers manual checks, shows real download progress, verifies signatures before install, and requires leaving the editor before restarting.

Windows trusted-publisher signing requires a separately issued code-signing certificate. Set `MINHSPARK_CERTIFICATE_THUMBPRINT` to a trusted CurrentUser\My certificate and build with `-RequireAuthenticode`; the script rejects missing, expired, untrusted or unsuitable certificates and verifies all three Windows artifacts. Optionally set `MINHSPARK_TIMESTAMP_URL`. Without that certificate, update signatures work but Windows publisher identity remains unverified. Version 0.1.0 has no updater and requires installing the new release once.

Native Google login uses the system browser at `https://office.minhspark.com/`, an expiring one-time loopback callback, exact origin/host validation and POST-only credentials. It requests standard identity scopes only. The browser bridge must retain its origin referrer policy and permit form navigation to the generated loopback address.
