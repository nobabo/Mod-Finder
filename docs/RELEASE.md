# Release operations

## Development and public release are different

The generated loopback Windows installer and debug Android APK are local-test artifacts. The API runs separately. Do not publicly ship them as a fully online service.

For the web service, follow [Workers deployment](WORKERS.md). No separate Node host, database or cache service is required.

For native apps or the optional standalone Node backend, before a public release:

1. Use the deployed Workers HTTPS API, or deploy `src/server/main.ts` on Node 22.12+ behind HTTPS. Use `HOST=0.0.0.0` only inside the intended service network; expose only through the gateway.
2. No server database or cache service is required. Thunderstore and Nexus search anonymously on demand.
3. Store operator keys as server secrets. Connect providers only after the integration ledger requirements are fulfilled.
4. Set allowed CORS origins to the app's actual origin and any intended browser deployment. Public proxies must block `/internal/*`, redact query strings and apply request/rate limits.
5. Set `VITE_API_BASE_URL` for Windows and `MODFINDER_API_URL` for Kotlin Android to the real HTTPS origin, run checks and rebuild. Narrow Windows `connect-src` to that host for public release. Android builds reject loopback and cleartext endpoints.
6. Supply publisher signing credentials for Windows and Android. No production signing keys are included in this repository.
7. Test on a Windows 11 device and an Android 10+ device, including favorites after restart, external browser return and offline behavior.
8. Distribute the signed Windows installer and signed Android APK. Galaxy Store accepts an APK through Seller Portal. Complete its seller registration, listing, privacy policy, screenshots and review requirements before publication. This project does not currently generate a Google Play AAB.

No scripts publish binaries, send platform registration requests, or launch Docker automatically.

## Android signing

The Kotlin Android Gradle project is in `tooling/android`; its source is in `src/android`. Keep keystores and `local.properties` out of source control. Gradle reads `MODFINDER_KEYSTORE_PATH`, `MODFINDER_KEYSTORE_PASSWORD`, `MODFINDER_KEY_ALIAS`, and `MODFINDER_KEY_PASSWORD` from the build environment. Supply all four together; a partial configuration fails without printing the values. Direct Gradle builds without these variables are unsigned. The public build launcher requires the existing key and verifies the APK signature. Debug builds use the development identity and a separate `io.modfinder.app.debug` package. Release cleartext traffic and cloud backup remain disabled.

## Root build launchers

On Windows x64, double-click `Build-Windows.bat` for an NSIS `setup.exe` or `Build-Android.bat` for a signed universal Kotlin APK (Android 10+). Both default to `https://modfinder.pages.dev`, regardless of the local development `.env`. Android accepts an explicit `MODFINDER_API_URL` HTTPS origin. Results and SHA-256 checksums are copied to `output/releases/v<version>/`. Android has its own output directory and version in `tooling/config/android.json`. The scripts generate local files; publishing a GitHub release is a separate step.

The Android launcher uses the four signing environment variables above. When all are absent, it reads `%USERPROFILE%\.mod-finder\signing\android.json`, containing `store` (keystore path), `alias`, and `password` (shared keystore/key password). This is the private configuration created for the first public release. Back up this directory securely. Missing keys stop the build; the launcher never silently creates a new signing identity. It verifies the APK signature and alignment before copying the result.

The Android launcher disables persistent Gradle daemons for its build so that generated DEX files are released afterwards. If a previous build outside this launcher left a locked file, close that build's idle Gradle daemon before retrying.

`JAVA_HOME` and `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) override automatic discovery. The defaults use Android Studio's bundled JDK and the SDK under `%LOCALAPPDATA%\Android\Sdk`. Kotlin Android needs JDK 17+, SDK Platform 36 and Build Tools. Rust, C++ Build Tools and WebView2 are Windows requirements. The launchers do not install these tools. Windows publisher signing still requires a separately configured certificate.

Use `Build-Windows.bat --check` or `Build-Android.bat --check` to check paths and configuration without building. Use `Start-Web.bat --verify` to start and check local services, then stop only services it started. Set `CI=true` when invoking a build launcher from automation to omit the final pause.

## Website downloads

The web settings cards download through `/downloads/windows` and `/downloads/android` on the Worker. The Worker streams fixed, public GitHub release files and supplies attachment filenames; it supports HEAD and resumed downloads. It never forwards browser cookies or authorization headers to GitHub. File metadata and SHA-256 values are in `src/shared/app-downloads.ts`.

To publish rebuilt installers, upload the generated files and `SHA256SUMS.txt` to the intended GitHub release, update that metadata to match, then run the standard project release. Verify the full downloaded files against the generated checksums. GitHub stores the originals because the APK exceeds the [25 MiB Workers static asset limit](https://developers.cloudflare.com/workers/platform/limits/#static-assets).

## Local Android API

Use the production HTTPS API or an explicitly configured HTTPS test origin. Device tests inject a deterministic repository instead of weakening network security or connecting to a loopback API. No port mapping is needed.

## Rollback and observability

- Set `DISABLED_SOURCES` and restart the API to disable a failing connector without an app release.
- Search results are fetched live; there are no background index workers or persisted server snapshots.
- `/internal/*` is not exposed. Workers logs use sampled structured error events; invocation logs are disabled to avoid recording search URLs.
- Initial performance targets are first results p95 <=2 seconds and all source states <=5 seconds. Live smoke samples are not a substitute for a controlled load test.
- No automatic app updater is enabled. Publish new installers and use Play updates.
- Do not claim full coverage for a game whose sources are all external-only.
