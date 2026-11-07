# Minh Spark Office

Minh Docs, Minh Sheets and Minh PDF, available on the web and as a Windows desktop application.

Web: https://minhsparkoffice.minhspark.com

## Development

Requires Node.js and npm. Desktop builds additionally require Rust, Microsoft C++ Build Tools and the Windows SDK.

```sh
npm ci
npm run dev
npm test
npm run build
npm run desktop:dev
npm run desktop:build
```

`desktop:build` creates two Windows x64 installers and SHA-256 checksums in `release/`:

- `MinhSparkOffice-0.1.0-windows-x64-vi-Setup.exe`: Vietnamese setup wizard, current-user installation, Start Menu and Desktop shortcuts, no administrator rights required for the app.
- `MinhSparkOffice-0.1.0-windows-x64-en-US.msi`: English Windows Installer package with maintenance and uninstall support.
- `SHA256SUMS.txt`: checksums for both installers.

Use one installer format on a machine; do not install both side by side. The stable application identifier is `com.minhspark.office`. The MSI upgrade code must remain unchanged across releases. Update the version in both `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` before building a new release.

The Windows app embeds the built frontend and uses Microsoft Edge WebView2. Windows 10/11 x64 is the supported target. If WebView2 is missing, the included Microsoft bootstrapper downloads the runtime during installation. Once installed, the local workspace does not need the website to load. Online services and externally linked images still need a connection.

Desktop starts directly in a local workspace. Google sign-in remains available on the website through the app's **Open web version** action; the desktop does not attempt Google OAuth in an embedded browser. Web and desktop workspaces are separate and do not synchronize automatically. Use the existing workspace backup/export and import controls to move documents. Uninstalling should preserve the application data unless the user explicitly chooses to remove it; export a backup before changing computers.

The initial installers are not Authenticode-signed. Automatic desktop updates are not configured; install a later release manually. Frontend source updates require a new desktop build.

## Branding

The app and installer use the existing `public/logo-icon.png` brand asset. To regenerate assets on Windows:

```powershell
npx.cmd tauri icon public/logo-icon.png --output src-tauri/icons --fit contain
pwsh -NoProfile -File scripts/build-installer-art.ps1
```

The installer artwork is generated at the exact NSIS/WiX dimensions. The EXE uses Vietnamese NSIS strings; MSI uses the upstream English WiX strings.

## Publishing

The existing Vercel website may be deployed from a different branch from the desktop source. Verify the live deployment before publishing web changes. Do not deploy this checkout over production merely to publish installers. Keep `src-tauri`, generated build output and installer artifacts out of the normal web upload.

## Verification

Run `npm test`, `npm run build`, and `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`. Test the packaged app on Windows: open Docs/Sheets/PDF, edit and reopen a local document, export a file, open the print dialog, open the web version, and verify installer shortcuts. A successful frontend build alone does not verify WebView2 behavior.
