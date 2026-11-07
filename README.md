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

Enable Google in Firebase Authentication > Sign-in method. Authorize the exact application hostname in Authentication > Settings > Authorized domains. Development uses `localhost`. Production uses `minhsparkoffice.minhspark.com`. Configure the same variables in Vercel before building.

The app uses the Firebase SDK Google popup flow, observes authentication state, persists the session, and supports sign-out. Only standard identity scopes are requested; Gmail and Google Drive permissions are not requested. Popup cancellation, blocked popups, network failures, unauthorized domains and disabled providers show actionable messages. Missing configuration leaves local-only access available.

## Storage and account boundaries

Authentication is live; document cloud synchronization is not implemented. Signed-in workspaces use a dedicated IndexedDB database keyed by the Firebase UID. The main interface and editors are available without signing in. Unsigned edits live in memory for the current tab session; reload or closing the tab discards unsaved drafts. The original `minh-office` database is read as a legacy snapshot and is never modified by guest editing. Explicit Save and Ctrl+S prompt for Google authentication, then save only the current document to that account. Canceling authentication preserves the open draft. Other guest documents are never silently assigned to the account. Downloads remain available without signing in.

Every editor and asynchronous document action captures an immutable workspace instance. Guest-to-account login preserves the mounted editor and its content. Signing out or switching between authenticated accounts remounts the workspace and its dialogs. A delayed save continues writing to its original workspace, never the replacement account. Local database separation prevents accidental mixing in the UI; it does not encrypt files or protect them from another person with access to the same browser profile or developer tools. Future cloud APIs must verify Firebase ID tokens and enforce ownership on the server.

## Verification

`npm test` checks account isolation, version isolation, delayed writes, legacy data preservation, explicit backup transfer, concurrent file creation, memory-only drafts, immutable legacy snapshots, and copying only the selected draft into an account. Verify unauthenticated editing, explicit Save and Ctrl+S, canceled login preserving content, successful login saving the current draft, reload persistence, and sign-out returning to the public home screen. Validate another account only with its owner's authorization.

## Deployment

Use the existing Vercel project `minh-spark-office`. Set all four Firebase variables in the production environment. Build and deploy a clean, tested commit. Do not deploy the shared working directory while other agents have unfinished changes. This Google authentication release is based on production commit `2f4f173` to retain the full Minh Docs feature set and all 22 export formats.

Google button artwork is the official Firebase UI Google asset from https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg.
