param(
    [switch]$CreateNew,
    [Parameter(Mandatory = $true)][string]$BackupDirectory
)
$ErrorActionPreference = 'Stop'
$phase = 'preflight'
$secretBytes = $null
$randomBytes = $null
$exitCode = 1
try {
    if (-not $CreateNew) { throw 'Use -CreateNew only after explicit authorization.' }
    Add-Type -AssemblyName System.Security
    $signingDirectory = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.mod-finder/signing'))
    $backupPath = [IO.Path]::GetFullPath($BackupDirectory)
    if ($backupPath -eq [IO.Path]::GetPathRoot($backupPath) -or $backupPath.StartsWith($signingDirectory, [StringComparison]::OrdinalIgnoreCase)) { throw 'Use a separate backup directory.' }
    if ((Test-Path -LiteralPath $signingDirectory) -and @(Get-ChildItem -LiteralPath $signingDirectory -Force).Count) { throw 'Existing signing files were found; refusing to overwrite them.' }
    if (Test-Path -LiteralPath $backupPath) { throw 'The backup directory already exists; choose a new directory.' }
    $javaHome = $env:JAVA_HOME
    if (-not $javaHome) { $javaHome = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr' }
    $keytool = Join-Path $javaHome 'bin/keytool.exe'
    if (-not (Test-Path -LiteralPath $keytool)) { throw 'A JDK keytool is required.' }
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    foreach ($directory in @($signingDirectory, $backupPath)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        & icacls.exe $directory '/inheritance:r' '/grant:r' "*${currentSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not restrict signing directory permissions.' }
    }
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd')
    $keyName = "android-release-$stamp.p12"
    $alias = "mod-finder-release-$stamp"
    $passwordName = 'android-password.dpapi'
    $keyPath = Join-Path $signingDirectory $keyName
    $phase = 'protecting the signing password'
    $randomBytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
    $password = [Convert]::ToBase64String($randomBytes)
    $secretBytes = [Text.Encoding]::UTF8.GetBytes($password)
    $protected = [Security.Cryptography.ProtectedData]::Protect($secretBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes((Join-Path $signingDirectory $passwordName), $protected)
    $settings = [ordered]@{ store = $keyName; alias = $alias; passwordDpapi = $passwordName }
    [IO.File]::WriteAllText((Join-Path $signingDirectory 'android.json'), ($settings | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
    $env:MODFINDER_KEYSTORE_PASSWORD = $password
    $env:MODFINDER_KEY_PASSWORD = $password
    $phase = 'generating the authorized release key'
    $ErrorActionPreference = 'Continue'
    $keyOutput = & $keytool '-J-Duser.language=en' '-J-Duser.country=US' '-genkeypair' '-keystore' $keyPath '-storetype' 'PKCS12' '-alias' $alias '-keyalg' 'RSA' '-keysize' '4096' '-sigalg' 'SHA256withRSA' '-validity' '10000' '-dname' 'CN=Mod Finder' '-storepass:env' 'MODFINDER_KEYSTORE_PASSWORD' '-keypass:env' 'MODFINDER_KEY_PASSWORD' '-noprompt' 2>&1
    $keyExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($keyExit -ne 0) { throw 'Key generation failed; the protected password has been preserved.' }
    $phase = 'checking the public certificate'
    $ErrorActionPreference = 'Continue'
    $certificate = & $keytool '-J-Duser.language=en' '-J-Duser.country=US' '-list' '-v' '-keystore' $keyPath '-storetype' 'PKCS12' '-storepass:env' 'MODFINDER_KEYSTORE_PASSWORD' '-alias' $alias 2>&1
    $certificateExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($certificateExit -ne 0) { throw 'Certificate verification failed.' }
    $match = [regex]::Match(($certificate -join "`n"), 'SHA256:\s*([A-F0-9:]+)')
    if (-not $match.Success) { throw 'The public certificate fingerprint was not found.' }
    $fingerprint = $match.Groups[1].Value.Replace(':', '').ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $signingDirectory 'certificate-sha256.txt'), $fingerprint + "`r`n")
    $phase = 'verifying the private backup'
    foreach ($name in @($keyName, $passwordName, 'android.json', 'certificate-sha256.txt')) {
        $source = Join-Path $signingDirectory $name
        $destination = Join-Path $backupPath $name
        Copy-Item -LiteralPath $source -Destination $destination
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash) { throw 'Backup verification failed.' }
    }
    $recovery = "Restore all four files together to %USERPROFILE%\.mod-finder\signing on this Windows account. The password is protected by Windows CurrentUser DPAPI. This backup protects against accidental deletion; a new Windows profile or another PC also needs a separately protected, portable password backup. Never publish the .p12, .dpapi or private android.json. Only certificate-sha256.txt is public information."
    [IO.File]::WriteAllText((Join-Path $backupPath 'RECOVERY.txt'), $recovery)
    Write-Output "Signing directory: $signingDirectory"
    Write-Output "Verified backup directory: $backupPath"
    Write-Output "Public certificate SHA-256: $fingerprint"
    $exitCode = 0
} catch {
    [Console]::Error.WriteLine("Android signing setup stopped during $phase. Existing files were preserved; no secret details are logged.")
} finally {
    if ($null -ne $secretBytes) { [Array]::Clear($secretBytes, 0, $secretBytes.Length) }
    if ($null -ne $randomBytes) { [Array]::Clear($randomBytes, 0, $randomBytes.Length) }
    $password = $null
    $env:MODFINDER_KEYSTORE_PASSWORD = $null
    $env:MODFINDER_KEY_PASSWORD = $null
}
exit $exitCode
