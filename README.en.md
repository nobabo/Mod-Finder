# Mod Finder

[한국어](README.md) · **English** · [Try the web app](https://mod-finder.yjh802637.workers.dev)

Find game mods on the web, Windows, and Android, then open their original pages. Mod Finder does not download or install mods.

## Features

- 14 games and 8 genres, with Modrinth, CurseForge, ATLauncher, Thunderstore, Nexus Mods, and Steam Workshop integrations
- Game, genre, version, and loader filters, modpacks-first display, sorting, and pagination — availability varies by source
- Dictionary-based Korean-to-English search terms, 7 UI languages, and 14 themes
- Favorites and search history stored locally: localStorage on the web, SQLite in native apps

React + TypeScript · Tauri · Cloudflare Workers. No separate server database or Docker required.

## Quick start

To browse without a keyword, leave the search box empty and submit. Results use the default download order; filters, sorting, and loading more results remain available.

Requires Node.js 22.12+ and an internet connection.

```sh
npm ci
npm run dev
```

App: [localhost:1420](http://localhost:1420) · API: `http://127.0.0.1:4318`

To run locally in the Workers runtime, use `npm run worker:dev`. It serves both the app and API at [localhost:8787](http://localhost:8787).

## Configuration and builds

If needed, copy `.env.example` to `.env`. Local API and Workers development use the same file. Keep existing settings intact.

- Modrinth, ATLauncher, Thunderstore, and Nexus searches need no key. Steam and CurseForge require server API keys.
- Never prefix API keys with `VITE_`. Links to unconnected sources are not counted as search results.
- Native releases require a production HTTPS API in `VITE_API_BASE_URL`. The API server is not bundled with the app.

| Task | Command |
| --- | --- |
| Windows development | `npm run dev:api` + `npm run desktop:dev` in a separate terminal |
| Android development | `npm run android:init`, then `npm run android:dev` |
| Native builds | `npm run desktop:build` / `npm run android:build` |
| Web deployment | `npm run worker:deploy` after Cloudflare login and account setup |
| Checks | `npm run typecheck` · `npm test` · `npm run build` |
| Workers checks | `npm run worker:verify` |

Windows development needs Rust, C++ Build Tools, and WebView2. Android needs Android Studio, JDK 17+, SDK 36, and the NDK.

## Documentation

[Workers setup](docs/WORKERS.md) · [Native releases](docs/RELEASE.md) · [Integrations](docs/INTEGRATIONS.md) · [API](docs/API.md) · [Games and translations](docs/CATALOG.md) · [Verification](docs/VERIFICATION.md)

Some guides are in Korean. Game images, logos, and mod content belong to their respective owners. This is an independent app, not an official product of any platform or game publisher.
