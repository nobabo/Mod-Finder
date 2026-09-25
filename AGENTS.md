# Project instructions

- Keep the UI minimal: do not add unsolicited captions, counters, explanatory panels, decorative labels, background game titles, or playback controls. Add only controls and content needed for the user's requested flow.
- Game and settings navigation use a single horizontal row of large icon/logo cards with concise labels. Preserve the search placeholder and game icon when opening settings. Theme colors must remain visible on panel outlines.

- Use `npm run typecheck`, `npm test`, and `npm run build` for TypeScript changes.
- API keys belong in server-only environment variables. Never add keys to `VITE_*`, fixtures, logs, or app packages.
- Never treat external links as retrieved search results. Preserve null for unavailable compatibility/metrics.
- Preserve source-scoped IDs as strings. Never merge mods by title alone.
- Thunderstore persistence and shared caches are opt-in policy gates. Use complete, atomic snapshots.
- Do not start, stop, reset, or reconfigure Docker Desktop for this project. Use existing services only if explicitly provided. Optional Compose files are documentation, not authorization to launch Docker.
- Browser verification uses the Playwright CLI; put captures in `output/playwright/`.
- Release binaries require a configured HTTPS API endpoint. Loopback builds are local-test artifacts only.
