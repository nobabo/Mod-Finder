param(
    [Parameter(Mandatory = $true)][string]$NodePath,
    [Parameter(Mandatory = $true)][string]$ConfigPath,
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$exitCode = 1
$clearBytes = $null
$names = @('MODFINDER_KEYSTORE_PATH', 'MODFINDER_KEYSTORE_PASSWORD', 'MODFINDER_KEY_ALIAS', 'MODFINDER_KEY_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    Add-Type -AssemblyName System.Security
    $settings = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    $directory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ConfigPath))
    $passwordPath = [IO.Path]::GetFullPath((Join-Path $directory $settings.passwordDpapi))
    if (-not $passwordPath.StartsWith($directory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid password path' }
    $clearBytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($passwordPath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $password = [Text.Encoding]::UTF8.GetString($clearBytes)
    if ([string]::IsNullOrWhiteSpace($password)) { throw 'Empty password' }
    $env:MODFINDER_KEYSTORE_PATH = [IO.Path]::GetFullPath((Join-Path $directory $settings.store))
    $env:MODFINDER_KEY_ALIAS = $settings.alias
    $env:MODFINDER_KEYSTORE_PASSWORD = $password
    $env:MODFINDER_KEY_PASSWORD = $password
    $repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    $options = @('android')
    if ($CheckOnly) { $options += '--check' }
    $ErrorActionPreference = 'Continue'
    & $NodePath (Join-Path $repoRoot 'tooling/scripts/build-native.mjs') @options
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
} catch {
    [Console]::Error.WriteLine('[Android] Could not unlock the signing configuration for this Windows account.')
} finally {
    if ($null -ne $clearBytes) { [Array]::Clear($clearBytes, 0, $clearBytes.Length) }
    $password = $null
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
exit $exitCode
