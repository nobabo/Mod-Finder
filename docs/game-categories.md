# Game-specific mod categories

Checked on 2026-09-26. `shared/categories.ts` contains a curated set of native mod categories for each supported game. The Korean labels are translations; provider values remain unchanged. The game catalog's genres still apply only to the all-games view.

| Game | Reference |
| --- | --- |
| Minecraft Java | [Modrinth](https://modrinth.com/discover/mods), [category API](https://api.modrinth.com/v2/tag/category) |
| Stardew Valley | [Nexus categories](https://www.nexusmods.com/stardewvalley/mods/categories) |
| Skyrim SE | [Nexus categories](https://www.nexusmods.com/skyrimspecialedition/mods/categories) |
| Cyberpunk 2077 | [Nexus categories](https://www.nexusmods.com/cyberpunk2077/mods/categories) |
| Baldur's Gate 3 | [Nexus categories](https://www.nexusmods.com/baldursgate3/mods/categories) |
| Fallout 4 | [Nexus categories](https://www.nexusmods.com/fallout4/mods/categories) |
| Lethal Company | [Thunderstore categories](https://thunderstore.io/c/lethal-company/) |
| Valheim | [Thunderstore categories](https://thunderstore.io/c/valheim/) |
| Risk of Rain 2 | [Thunderstore categories](https://thunderstore.io/c/riskofrain2/) |
| RimWorld | [Steam Workshop](https://steamcommunity.com/workshop/browse/?appid=294100) |
| Terraria | [Steam Workshop](https://steamcommunity.com/workshop/browse/?appid=105600) |
| Project Zomboid | [Steam Workshop](https://steamcommunity.com/workshop/browse/?appid=108600) |
| Cities: Skylines | [Steam Workshop](https://steamcommunity.com/workshop/browse/?appid=255710) |
| Don't Starve Together | [Steam Workshop](https://steamcommunity.com/workshop/browse/?appid=322330) |

## Search behavior

- A selected category keeps the game, query, sort and compatibility filters. Changing games clears the previous category and compatibility filters.
- Categories are scoped to one provider. Selecting a Modrinth category searches Modrinth; clearing it restores all configured sources. No equivalence is guessed between different providers' taxonomies.
- Modrinth uses an AND category facet alongside loader/version/project-type facets. Nexus uses `categoryName` with `EQUALS` within the game filter. Thunderstore uses `included_categories` with the community's numeric ID preserved as a string. Steam uses `requiredtags` with the exact tag.
- Category-only browsing is allowed. Pagination retains the category and rejects cursors from a different filter. The server rejects categories outside the requested game/provider.
- Steam external links retain the selected tag when an API key is unavailable; those links do not become retrieved results. Terraria uses the configured vanilla Workshop's resource-pack/world categories, not tModLoader's separate catalog.
- The list is curated, not a live exhaustive mirror. Refresh source values against these pages before adding categories.

Verification: `npm run typecheck`, `npm test`, `npm run build`. Browser checks use Playwright CLI with `scripts/verify-game-categories.js`; captures go to `output/playwright/`.
