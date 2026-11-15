# @minhspark/minh-spark-office

Installer for [Minh Spark Office](https://office.minhspark.com), a free office suite with Docs, Sheets, Slides and PDF tools.

```bash
npx @minhspark/minh-spark-office
```

It downloads the latest desktop build for your computer from office.minhspark.com, checks it against the published `SHA256SUMS.txt` and installs it:

- **Windows x64:** runs the setup program.
- **Ubuntu / Debian x64:** installs the `.deb` with `sudo apt-get install`.
- **Other Linux x64:** saves the AppImage as `~/.local/bin/minh-spark-office.AppImage`.
- **macOS (Apple Silicon):** runs the site's `install-macos.sh`, which verifies the app and installs it into Applications.

Use `npx @minhspark/minh-spark-office --download <folder>` to only download and verify the installer.

The MIT license in this package covers the installer script only.
