param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$separator = [IO.Path]::DirectorySeparatorChar
$prefix = $repoRoot.TrimEnd($separator) + $separator
if ((Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).name -ne 'mod-finder') {
    throw 'Run this script from the Mod Finder project.'
}

function Get-WorkspacePath([string]$RelativePath) {
    $full = [IO.Path]::GetFullPath((Join-Path $repoRoot $RelativePath))
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside workspace: $RelativePath" }
    $parent = $full
    while ($parent -ne $repoRoot) {
        if (Test-Path -LiteralPath $parent) {
            if ((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Linked cleanup path: $RelativePath"
            }
        }
        $parent = [IO.Path]::GetDirectoryName($parent)
    }
    return $full
}

# Fixed generated directories only. Keep source, release copies, screenshots and AVD user data.
$targets = @(
    'output/archive/android-before-restructure',
    'output/archive/native-before-restructure',
    'output/android/gradle',
    'src/native/gen/android',
    'src/native/gen/schemas',
    'output/native',
    'tooling/android/.gradle',
    'tooling/android/.kotlin',
    'output/android/avd/snapshots',
    'output/android/avd36/snapshots'
)
$preserve = @(
    'output/archive/android-before-restructure/app-build/outputs',
    'output/archive/android-before-restructure/build/reports',
    'output/archive/native-before-restructure/release/bundle',
    'output/android/gradle/app/outputs',
    'output/android/gradle/app/reports',
    'output/android/gradle/app/test-results',
    'output/android/gradle/root/reports',
    'output/native/release/bundle'
)

$plan = @()
foreach ($relative in $targets) {
    $path = Get-WorkspacePath $relative
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $entries = @(Get-ChildItem -LiteralPath $path -Force -Recurse)
    # Never traverse a junction or directory symlink, including during recursive removal.
    if ($entries | Where-Object { $_.PSIsContainer -and ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) }) {
        throw "Linked directory inside cleanup target: $relative"
    }
    $files = @($entries | Where-Object { -not $_.PSIsContainer })
    $plan += [ordered]@{ path = $relative; files = $files.Count; bytes = [long](($files | Measure-Object Length -Sum).Sum); removed = $false }
}
if (-not $plan.Count) { Write-Output 'No generated native files to clean.'; return }
$plan | ForEach-Object { Write-Output ('{0,-58} {1,8:N2} MiB' -f $_.path, ($_.bytes / 1MB)) }
if (-not $Apply) { Write-Output 'Preview only. Add -Apply to preserve artifacts and remove these generated directories.'; return }

if ($IsWindows) {
    $active = @(Get-Process | Where-Object { $_.ProcessName -match '^(cargo|rustc|java|javaw|emulator|qemu-system.*|mod-finder)$' })
    if ($active.Count) { throw ('Close builds, Gradle daemons, emulators and the app before cleanup: ' + (($active | ForEach-Object { "$($_.ProcessName) ($($_.Id))" }) -join ', ')) }
}

$backupRelative = 'output/archive/build-artifacts-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
$backupRoot = Get-WorkspacePath $backupRelative
New-Item -ItemType Directory -Path $backupRoot | Out-Null
$kept = @()
foreach ($relative in $preserve) {
    $source = Get-WorkspacePath $relative
    if (-not (Test-Path -LiteralPath $source)) { continue }
    foreach ($file in Get-ChildItem -LiteralPath $source -Force -Recurse -File) {
        if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked artifact: $($file.FullName)" }
        $original = [IO.Path]::GetRelativePath($repoRoot, $file.FullName)
        $destination = Get-WorkspacePath (Join-Path $backupRelative $original)
        New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($destination)) -Force | Out-Null
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        Copy-Item -LiteralPath $file.FullName -Destination $destination
        if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) {
            throw "Artifact copy mismatch: $original"
        }
        $kept += [ordered]@{ path = $original; bytes = $file.Length; sha256 = $hash }
    }
}

$manifest = [ordered]@{ createdAt = [DateTimeOffset]::Now.ToString('o'); targets = $plan; preserved = $kept }
$manifestPath = Join-Path $backupRoot 'manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8
foreach ($entry in $plan) {
    # Resolve and check again immediately before every recursive deletion.
    $path = Get-WorkspacePath $entry.path
    Remove-Item -LiteralPath $path -Recurse -Force
    $entry.removed = $true
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8
    Write-Output "Removed: $($entry.path)"
}
Write-Output "Preserved $($kept.Count) artifacts/reports with SHA-256: $backupRelative/manifest.json"
