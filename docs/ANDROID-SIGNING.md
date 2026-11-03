# Android release signing and recovery

Android 0.2.5 uses a new, explicitly authorized pre-distribution signing identity. Its public certificate SHA-256 is:

`7eb2f512afeadea8f5f70cac6abb875ea9f16ec4e3642b10273c34723de1551c`

The package remains `io.modfinder.app`, version 0.2.5, versionCode 2005. An existing test installation signed with the previous certificate cannot receive this as an ordinary update. Removing that installation can delete favorites, folders, history and settings. The app disables cloud backup and device-transfer backups and currently has no user export/import screen. Preserve any needed test data before uninstalling. No device is uninstalled automatically by the build or release tools.

## Private storage

The local signing directory is `%USERPROFILE%\.mod-finder\signing`. Keep its complete contents private. The new configuration contains public path/alias metadata and a `passwordDpapi` filename; it does not store the plaintext password. The encrypted password is unlocked only in a build child process and supplied to Gradle using the existing four `MODFINDER_KEYSTORE_*` / `MODFINDER_KEY_*` environment variables. It is never sent to the frontend, a command argument, a log, Git, a release asset or the website.

The creation script restricts its new directories to the current Windows user and SYSTEM, refuses to overwrite an existing signing directory, and requires an explicit `-CreateNew` switch. `Build-Android.bat` and `npm run android:build` use the existing identity; they do not generate keys.

## Backup and restoration

A separate verified backup is kept under `D:\Backup\Private\ModFinder-Signing\<date>`. Restore these four files together into the signing directory on the same Windows account:

- The release `.p12` keystore named by `android.json`.
- `android-password.dpapi`.
- `android.json`.
- `certificate-sha256.txt`.

Each copied file is checked against its original before the backup is reported complete. The backup's `RECOVERY.txt` contains no password. Protect the directory and keep it outside Git, website assets and ordinary shared folders.

CurrentUser DPAPI depends on the Windows profile. This copy is a recovery path for accidental file deletion on the current account, not a complete password recovery plan after replacing the PC or Windows profile. Before that change, arrange an independently protected, portable password backup in a password manager or offline encrypted storage and verify restoration. Do not treat a copy of the DPAPI blob alone as a portable password backup. No secret is printed or uploaded by the project tools.

Confirm recovery with `Build-Android.bat --check`, then build and compare `apksigner verify --print-certs` with the public fingerprint above. Never create another identity just because a backup cannot be unlocked.

## Play App Signing

The project's recorded distribution uses locally signed APKs on GitHub and website download routes. The existing APK has no Google Play signing stamp, and the repository has no Play App Signing enrollment record or Play upload workflow. Those observations do not verify a Play Console account's enrollment state. An upload-key reset applies only when Play App Signing is actually configured; it does not recreate a lost, locally managed signing key.

References: [Android app signing](https://developer.android.com/studio/publish/app-signing), [Windows DPAPI](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata).
