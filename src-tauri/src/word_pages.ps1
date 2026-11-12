$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$workspace = $PSScriptRoot
$inputFile = Join-Path $workspace 'input.docx'
$encoding = New-Object System.Text.UTF8Encoding($false)
$failure = 'layout'

function Test-PassiveField([string]$code) {
    return $code -match '^\s*(?:PAGE|NUMPAGES|SECTION|SECTIONPAGES|STYLEREF|REF|PAGEREF|SEQ|TOC|DATE|TIME|CREATEDATE|SAVEDATE|PRINTDATE|TITLE|AUTHOR|FILENAME|DOCPROPERTY|IF|EQ|FORMTEXT|FORMCHECKBOX|FORMDROPDOWN|SYMBOL|HYPERLINK|MERGEFIELD|LISTNUM|NOTEREF|QUOTE|=)(?:\s|\\|$)'
}

function Assert-DataDocument([string]$path) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($path)
    try {
        if (!$archive.GetEntry('word/document.xml') -or !$archive.GetEntry('[Content_Types].xml') -or $archive.Entries.Count -gt 10000) { throw 'package' }
        $known = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        $total = [long]0
        foreach ($entry in $archive.Entries) {
            $total += $entry.Length
            if ($total -gt 209715200 -or !$known.Add($entry.FullName) -or $entry.FullName -match '(?:^/|[\\:]|(?:^|/)\.\.?(?:/|$)|(?:^|/)(?:activeX|embeddings|webextensions|customUI|vbaProject|_xmlsignatures)(?:[./]|$))') { throw 'package' }
        }
        $allowed = @('officeDocument','core-properties','extended-properties','custom-properties','thumbnail','styles','stylesWithEffects','settings','webSettings','fontTable','font','theme','numbering','header','footer','footnotes','endnotes','comments','commentsExtended','commentsIds','commentsExtensible','people','customXml','customXmlProps','image','hyperlink','glossaryDocument','chart','chartUserShapes','chartStyle','chartColorStyle','diagramData','diagramLayout','diagramQuickStyle','diagramColors')
        $cfg = [Xml.XmlReaderSettings]::new()
        $cfg.DtdProcessing = [Xml.DtdProcessing]::Prohibit
        $cfg.XmlResolver = $null
        $cfg.MaxCharactersInDocument = 52428800
        $typesOk = $false
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName
            if ($name.EndsWith('/')) { continue }
            if ($name -notmatch '\.(?:xml|rels|svg|vml)$') {
                if ($name -notmatch '\.(?:jpeg|jpg|png|gif|tiff?|bmp|emf|wmf|odttf|ttf|woff2?)$') { throw 'package' }
                continue
            }
            $xml = [Xml.XmlDocument]::new()
            $xml.XmlResolver = $null
            $stream = $entry.Open()
            try {
                $reader = [Xml.XmlReader]::Create($stream,$cfg)
                try { $xml.Load($reader) } finally { $reader.Dispose() }
            } finally { $stream.Dispose() }
            if ($name -eq '[Content_Types].xml') {
                foreach ($type in $xml.DocumentElement.ChildNodes) {
                    if ($type.NodeType -ne [Xml.XmlNodeType]::Element) { continue }
                    $mime = $type.GetAttribute('ContentType')
                    if ($mime -match '(macroEnabled|vbaProject|activeX|oleObject|application/x-ms|application/x-shockwave|java-archive)') { throw 'package' }
                    if ($type.GetAttribute('PartName') -ceq '/word/document.xml' -and $mime -ceq 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') { $typesOk = $true }
                }
            }
            if ($name.EndsWith('.rels', [StringComparison]::OrdinalIgnoreCase)) {
                $owner = $name -replace '(^|/)_rels/', '$1' -replace '\.rels$', ''
                $base = [Uri]('https://doc.invalid/' + $owner)
                foreach ($link in $xml.DocumentElement.ChildNodes) {
                    if ($link.NodeType -ne [Xml.XmlNodeType]::Element) { continue }
                    $kind = ($link.GetAttribute('Type') -split '/')[-1]
                    $target = $link.GetAttribute('Target')
                    if ($allowed -notcontains $kind) { throw 'package' }
                    if ($link.GetAttribute('TargetMode') -eq 'External') {
                        if ($kind -ne 'hyperlink' -or $target -notmatch '^(https?://|mailto:|#)') { throw 'external' }
                    } else {
                        if ($target -match '[:\\?#]|^//') { throw 'external' }
                        $resolved = [Uri]::new($base, $target)
                        if ($resolved.Host -ne 'doc.invalid' -or !$known.Contains([Uri]::UnescapeDataString($resolved.AbsolutePath.TrimStart('/')))) { throw 'external' }
                    }
                }
                continue
            }
            if ($xml.SelectSingleNode('//processing-instruction("xml-stylesheet")')) { throw 'external' }
            foreach ($a in $xml.SelectNodes('//@*[local-name()="src" or local-name()="href" or local-name()="base" or local-name()="codebase"]')) {
                if ($a.Value -and !$a.Value.StartsWith('#')) { throw 'external' }
            }
            $stack = [Collections.Generic.Stack[Text.StringBuilder]]::new()
            foreach ($field in $xml.SelectNodes('//*[local-name()="fldSimple" or local-name()="fldChar" or local-name()="instrText" or local-name()="delInstrText"]')) {
                $ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
                if ($field.NamespaceURI -ne $ns) { throw 'field' }
                switch ($field.LocalName) {
                    fldSimple { if (!(Test-PassiveField $field.GetAttribute('instr',$ns))) { throw 'field' } }
                    fldChar {
                        switch ($field.GetAttribute('fldCharType',$ns)) {
                            begin { $stack.Push([Text.StringBuilder]::new()) }
                            end {
                                if (!$stack.Count -or !(Test-PassiveField $stack.Pop().ToString())) { throw 'field' }
                            }
                        }
                    }
                    default {
                        if (!$stack.Count) { throw 'field' }
                        [void]$stack.Peek().Append($field.InnerText)
                    }
                }
            }
            if ($stack.Count) { throw 'field' }
        }
        if (!$typesOk) { throw 'package' }
    } finally { $archive.Dispose() }
}

function Find-Word {
    $folders = @([Environment]::GetFolderPath('ProgramFiles'), [Environment]::GetFolderPath('ProgramFilesX86'))
    foreach ($folder in $folders) {
        foreach ($relative in @('Microsoft Office\root\Office16\WINWORD.EXE', 'Microsoft Office\Office16\WINWORD.EXE')) {
            $binary = Join-Path $folder $relative
            if (![IO.File]::Exists($binary)) { continue }
            $signature = Get-AuthenticodeSignature -LiteralPath $binary
            if ($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -match '(?:^|,\s*)O=Microsoft Corporation(?:,|$)') { return $binary }
        }
    }
    throw 'word'
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class WordPageWindow {
  private delegate bool Finder(IntPtr hwnd, IntPtr arg);
  [DllImport("user32.dll")] private static extern bool EnumWindows(Finder fn, IntPtr arg);
  [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr hwnd, Finder fn, IntPtr arg);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint id);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("oleacc.dll")] private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint objectId, ref Guid iid, [MarshalAs(UnmanagedType.IDispatch)] out object result);
  public static object Get(int process) {
    object found = null;
    EnumWindows(delegate(IntPtr hwnd, IntPtr arg) {
      uint pid;
      GetWindowThreadProcessId(hwnd,out pid);
      if(pid != process) return true;
      EnumChildWindows(hwnd, delegate(IntPtr child, IntPtr unused) {
        var name = new StringBuilder(80); GetClassName(child,name,80);
        if(name.ToString() != "_WwG") return true;
        Guid dispatch = new Guid("00020400-0000-0000-C000-000000000046");
        return AccessibleObjectFromWindow(child,0xFFFFFFF0,ref dispatch,out found) != 0;
      },IntPtr.Zero);
      return found == null;
    },IntPtr.Zero);
    return found;
  }
}
'@

$worker = $null
$app = $null
$doc = $null
$exitCode = 1
try {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    while (![IO.File]::Exists((Join-Path $workspace 'ready'))) {
        if ($timer.Elapsed.TotalSeconds -gt 10) { throw 'job' }
        Start-Sleep -Milliseconds 50
    }
    $failure = 'unsupported'
    Assert-DataDocument $inputFile
    $failure = 'word'
    $binary = Find-Word
    $worker = Start-Process -FilePath $binary -ArgumentList @('/x','/a','/q','/w') -WindowStyle Hidden -PassThru
    $timer.Restart()
    do {
        $handle = [WordPageWindow]::Get($worker.Id)
        if (!$handle) { Start-Sleep -Milliseconds 150 }
    } while (!$handle -and !$worker.HasExited -and $timer.Elapsed.TotalSeconds -lt 20)
    if (!$handle) { throw 'word' }
    $app = $handle.Application
    $app.Visible = $false
    $app.DisplayAlerts = 0
    $app.AutomationSecurity = 3
    $failure = 'layout'
    $oldLinks = $app.Options.UpdateLinksAtOpen
    $app.Options.UpdateLinksAtOpen = $false
    $doc = $app.Documents.OpenNoRepairDialog($inputFile,$false,$true,$false)
    $doc.Repaginate()
    $count = [int]$doc.ComputeStatistics(2)
    if ($count -lt 1 -or $count -gt 10000) { throw 'layout' }
    $boundaries = [Collections.Generic.List[object]]::new()
    $numbers = [Collections.Generic.List[int]]::new()
    $last = -1
    $characters = 0
    for ($i = 1; $i -le $count; $i++) {
        $at = $doc.GoTo(1,1,$i)
        if ($at.Information(3) -ne $i -or $at.Start -le $last) { throw 'layout' }
        $last = $at.Start
        $numbers.Add([int]$at.Information(1))
        if ($i -eq 1) { continue }
        $paragraph = $at.Paragraphs.Item(1).Range
        $text = [string]$paragraph.Text -replace '\r\x07?$',''
        $index = if ($paragraph.Start -eq 0) { 0 } else { $doc.Range(0,$paragraph.Start).Paragraphs.Count }
        $offset = $at.Start - $paragraph.Start
        $characters += $text.Length
        if ($offset -lt 0 -or $offset -gt $text.Length -or $characters -gt 2000000) { throw 'layout' }
        $boundaries.Add(@{paragraph=[int]$index; offset=[int]$offset; text=$text; inTable=[bool]$at.Information(12)})
    }
    $result = @{pageCount=$count; pageNumbers=$numbers.ToArray(); boundaries=$boundaries.ToArray()}
    [IO.File]::WriteAllText((Join-Path $workspace 'result.json'),(ConvertTo-Json -InputObject $result -Depth 5 -Compress),$encoding)
    $exitCode = 0
} catch {
    [IO.File]::WriteAllText((Join-Path $workspace 'error.txt'),$failure,$encoding)
} finally {
    if ($doc) { try { $doc.Close(0) } catch {} }
    if ($app) {
        if ($null -ne $oldLinks) { try { $app.Options.UpdateLinksAtOpen = $oldLinks } catch {} }
        try { $app.Quit(0) } catch {}
    }
    if ($worker) { $worker.Dispose() }
}
exit $exitCode
