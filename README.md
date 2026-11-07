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

Authentication is live; document cloud synchronization is not implemented. Signed-in workspaces use a dedicated IndexedDB database keyed by the Firebase UID. The unsigned local workspace retains the original `minh-office` database. Existing files are never silently assigned to the first person who signs in. To copy old files into an account, export a backup from local mode, sign in, and restore it into that account.

Every editor and asynchronous document action captures an immutable workspace instance. Switching accounts remounts the entire workspace and its dialogs. A delayed save continues writing to its original workspace, never the replacement account. Local database separation prevents accidental mixing in the UI; it does not encrypt files or protect them from another person with access to the same browser profile or developer tools. Future cloud APIs must verify Firebase ID tokens and enforce ownership on the server.

## Verification

`npm test` checks account isolation, version isolation, delayed writes, legacy data preservation, explicit backup transfer, and concurrent file creation. Run a real Google login on an authorized hostname, reload, open a document, return home, sign out, and confirm that the login screen returns. Validate another account only with its owner's authorization.

## Deployment

Use the existing Vercel project `minh-spark-office`. Set all four Firebase variables in the production environment. Build and deploy a clean, tested commit. Do not deploy the shared working directory while other agents have unfinished changes. This Google authentication release is based on production commit `2f4f173` to retain the full Minh Docs feature set and all 22 export formats.

Google button artwork is the official Firebase UI Google asset from https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg.
