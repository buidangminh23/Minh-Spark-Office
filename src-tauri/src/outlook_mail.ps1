$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$workspace = $PSScriptRoot
$encoding = New-Object System.Text.UTF8Encoding($false)

function Write-Text([string]$name, [string]$value) {
    [IO.File]::WriteAllText((Join-Path $workspace $name), $value, $encoding)
}

function Stop-Job([string]$code, [int]$exitCode) {
    Write-Text 'error.txt' $code
    exit $exitCode
}

try {
    $job = [IO.File]::ReadAllText((Join-Path $workspace 'messages.json'), $encoding) | ConvertFrom-Json
} catch {
    Stop-Job 'input' 2
}

try {
    try {
        $outlook = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
    } catch {
        $outlook = New-Object -ComObject Outlook.Application
    }
    $null = $outlook.GetNamespace('MAPI')
} catch {
    Stop-Job 'outlook' 2
}

$done = 0
foreach ($message in @($job.messages)) {
    try {
        $mail = $outlook.CreateItem(0)
        $mail.To = [string]$message.to
        if ($message.cc) { $mail.CC = [string]$message.cc }
        if ($message.bcc) { $mail.BCC = [string]$message.bcc }
        $mail.Subject = [string]$message.subject
        $body = [IO.File]::ReadAllText((Join-Path $workspace ([string]$message.bodyFile)), $encoding)
        if ($message.html) { $mail.HTMLBody = $body } else { $mail.Body = $body }
        foreach ($file in @($message.files)) {
            if ($file) { $null = $mail.Attachments.Add((Join-Path $workspace ([string]$file))) }
        }
        switch ([string]$job.mode) {
            'send' { $mail.Send() }
            'draft' { $mail.Save() }
            default { $mail.Display($false) }
        }
        $done++
        Write-Text 'progress.txt' "$done"
    } catch {
        Stop-Job "message:$done" 3
    }
}

Write-Text 'result.json' (@{ done = $done } | ConvertTo-Json -Compress)
exit 0
