param(
    [switch]$StageWeb,
    [switch]$RequireAuthenticode
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$signingKey = if ($env:MINHSPARK_UPDATER_KEY_PATH) { $env:MINHSPARK_UPDATER_KEY_PATH } else { Join-Path $env:LOCALAPPDATA 'MinhSparkOffice\signing\updater.key' }
$originalSigningKey = $env:TAURI_SIGNING_PRIVATE_KEY
$originalSigningPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
$originalLocation = Get-Location

if (-not (Test-Path -LiteralPath $signingKey -PathType Leaf)) {
    throw 'Updater signing key is missing. Restore the existing release key in LOCALAPPDATA\MinhSparkOffice\signing\updater.key; never generate a replacement for an existing release.'
}

$certificateThumbprint = $env:MINHSPARK_CERTIFICATE_THUMBPRINT
$buildArguments = @('node_modules/@tauri-apps/cli/tauri.js', 'build', '--bundles', 'nsis,msi')
if ($RequireAuthenticode -and -not $certificateThumbprint) {
    throw 'Set MINHSPARK_CERTIFICATE_THUMBPRINT to an installed trusted code-signing certificate.'
}

if ($certificateThumbprint) {
    if ($certificateThumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'Invalid certificate thumbprint.' }
    $certificatePath = "Cert:\CurrentUser\My\$certificateThumbprint"
    if (-not (Test-Path -LiteralPath $certificatePath)) { throw 'Requested code-signing certificate was not found in CurrentUser\My.' }
    $certificate = Get-Item -LiteralPath $certificatePath
    $now = Get-Date
    if (-not $certificate.HasPrivateKey -or $certificate.NotBefore -gt $now -or $certificate.NotAfter -le $now) { throw 'Requested code-signing certificate has no private key or is outside its validity period.' }
    if ('1.3.6.1.5.5.7.3.3' -notin @($certificate.EnhancedKeyUsageList | ForEach-Object { $_.ObjectId.Value })) { throw 'Requested certificate is not valid for code signing.' }
    $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
    try {
        if (-not $chain.Build($certificate)) { throw 'Requested code-signing certificate is not trusted by Windows.' }
    } finally { $chain.Dispose() }
    $timestampUrl = if ($env:MINHSPARK_TIMESTAMP_URL) { $env:MINHSPARK_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' }
    $timestampUri = [Uri]$timestampUrl
    if (-not $timestampUri.IsAbsoluteUri -or $timestampUri.Scheme -notin @('http', 'https')) { throw 'Invalid timestamp service URL.' }
    $override = @{ bundle = @{ windows = @{ certificateThumbprint = $certificateThumbprint; digestAlgorithm = 'sha256'; timestampUrl = $timestampUrl; tsp = $true } } } | ConvertTo-Json -Depth 8 -Compress
    $buildArguments += @('--config', $override)
}

try {
    Set-Location -LiteralPath $projectRoot
    $env:TAURI_SIGNING_PRIVATE_KEY = $signingKey
    if ($null -eq $originalSigningPassword) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '' }
    & node @buildArguments
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    if ($certificateThumbprint) {
        $config = Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
        $signedFiles = @((Join-Path $projectRoot 'src-tauri/target/release/minh-spark-office.exe'))
        foreach ($bundle in @('nsis', 'msi')) {
            $directory = Join-Path $projectRoot "src-tauri/target/release/bundle/$bundle"
            $extension = if ($bundle -eq 'nsis') { '.exe' } else { '.msi' }
            $matches = @(Get-ChildItem -LiteralPath $directory -File | Where-Object { $_.Extension -eq $extension -and $_.Name.Contains("_$($config.version)_") })
            if ($matches.Count -ne 1) { throw "Expected exactly one current $bundle artifact." }
            $signedFiles += $matches[0].FullName
        }
        foreach ($artifactPath in $signedFiles) {
            $signature = Get-AuthenticodeSignature -LiteralPath $artifactPath
            if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $certificateThumbprint) { throw 'Authenticode verification failed for a release artifact.' }
        }
    }
    $packageArguments = @('scripts/package-desktop.mjs')
    if ($StageWeb) { $packageArguments += '--stage-web' }
    & node @packageArguments
    if ($LASTEXITCODE -ne 0) { throw 'Installer packaging or signature verification failed.' }
} finally {
    $env:TAURI_SIGNING_PRIVATE_KEY = $originalSigningKey
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $originalSigningPassword
    Set-Location -LiteralPath $originalLocation
}
