# Release operations

## Development and public release are different

The generated loopback Windows installer and debug Android APK are local-test artifacts. The API runs separately. Do not publicly ship them as a fully online service.

For the web service, follow [Workers deployment](WORKERS.md). No separate Node host, database or cache service is required.

For native apps or the optional standalone Node backend, before a public release:

1. Use the deployed Workers HTTPS API, or deploy `server/main.ts` on Node 22.12+ behind HTTPS. Use `HOST=0.0.0.0` only inside the intended service network; expose only through the gateway.
2. No server database or cache service is required. Thunderstore and Nexus search anonymously on demand.
3. Store operator keys as server secrets. Connect providers only after the integration ledger requirements are fulfilled.
4. Set allowed CORS origins to the app's actual origin and any intended browser deployment. Public proxies must block `/internal/*`, redact query strings and apply request/rate limits.
5. Set `VITE_API_BASE_URL` to the real HTTPS URL, run checks and rebuild both apps. Narrow native `connect-src` to that host for public release; loopback is for testing.
6. Supply publisher signing credentials for Windows and Android. No production signing keys are included in this repository.
7. Test on a Windows 11 device and an Android 10+ device, including favorites after restart, external browser return and offline behavior.
8. Distribute the signed Windows installer and submit the signed Android AAB to Google Play. Store forms, privacy declarations, screenshots, policy approval and review are operator tasks.

No scripts publish binaries, send platform registration requests, or launch Docker automatically.

## Android signing

The generated Android project is in `src-tauri/gen/android`. Keep keystores and `local.properties` out of source control. Gradle reads `MODFINDER_KEYSTORE_PATH`, `MODFINDER_KEYSTORE_PASSWORD`, `MODFINDER_KEY_ALIAS`, and `MODFINDER_KEY_PASSWORD` from the build environment. Supply all four together; a partial configuration fails without printing the values. With all unset, release output is unsigned and cannot be published. Debug builds use only the standard development identity. Release cleartext network traffic remains disabled.

For a locally served API on an attached device:

```powershell
adb reverse tcp:4318 tcp:4318
```

Remove the reverse connection when local testing is finished. No port mapping is needed for the production HTTPS API.

## Rollback and observability

- Set `DISABLED_SOURCES` and restart the API to disable a failing connector without an app release.
- Search results are fetched live; there are no background index workers or persisted server snapshots.
- `/internal/*` is not exposed. Workers logs use sampled structured error events; invocation logs are disabled to avoid recording search URLs.
- Initial performance targets are first results p95 <=2 seconds and all source states <=5 seconds. Live smoke samples are not a substitute for a controlled load test.
- No automatic app updater is enabled. Publish new installers and use Play updates.
- Do not claim full coverage for a game whose sources are all external-only.
