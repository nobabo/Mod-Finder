# Search dictionaries and keyword relevance

`src/shared/locales/search.ko.json` maps common Korean topics to provider search terms. `search.games.ko.json` adds an object for each game ID; game entries override the common terms for that game. For example, Minecraft maps `소` to `cow`, while Stardew Valley maps `스마피` to `SMAPI`.

`mods.ko.json` contains reviewed titles, descriptions and aliases for individual source-scoped IDs. Its `searchTerm`, `sourceUrl` and `reviewedAt` fields record the English query and supporting project page. `mod-titles.ko.json` is a separate translated title catalog. `community-mods.json` and the community ranking data provide additional known project names. None of these dictionaries creates results or merges providers by title.

The Minecraft dictionary grew from 66 to 183 entries for 0.2.5, covering animals, husbandry, mobs, farming, construction, transport and storage. Other games retain their existing dictionaries. General topic coverage still needs a separate review for those games; many translated mod titles do not substitute for a topic dictionary.

`localized-search.ts` preserves exact mod aliases, then expands reviewed topics within each provider. Unknown single Korean syllables stay literal. Registered single-letter nouns use word boundaries so `소` does not expand to Sodium. Several recognized keywords, such as `소 돼지`, produce the combined English query and individual terms, bounded by the existing eight-query limit before singular/plural variants. Unknown phrases and established names remain literal.

`search-keywords.ts` groups aliases and singular/plural forms into distinct concepts. `ranking.ts` first compares the proportion of search concepts matched, then field strength: title 4, tags 2, description 1 per concept. Repeated words, tags and aliases cannot increase coverage or score within a field. Exact titles break remaining relevance ties before provider rank. Explicit download, update and popularity choices keep their own ordering.

Web and Tauri use these shared TypeScript rules. `prepare-android.ts` packages the same dictionaries and derived `keywordConcepts` in Android's generated `catalog.json`. Kotlin `Catalog.kt` and `Models.kt` use the same planning and scoring rules, including when a server search plan is unavailable. Both implementations run `tooling/data/search-relevance-cases.json` as regression cases.

Run `npm run typecheck`, `npm test` and `npm run build` for local checks. `node node_modules/tsx/dist/cli.mjs tooling/scripts/verify-minecraft-animal-search.ts https://modfinder.pages.dev` verifies the published plans and live results for 닭, 오리, 소, 돼지, 소 돼지 and 닭 오리. Add `--local-plan` to check current source rules against the live providers before deployment. Reports contain plans, counts and pass/fail evidence rather than persisted provider responses, and are saved under `output/deployment/`.
