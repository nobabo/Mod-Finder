# API v1

Base URL: same origin on Workers; local Node default `http://127.0.0.1:4318`. No Mod Finder login. Responses are JSON and `Cache-Control: no-store`; search results are fetched live without a server cache. No endpoint accepts third-party user credentials.

## Routes

| Method | Route | Contract |
| --- | --- | --- |
| GET | `/health` | `ok`, `version` |
| GET | `/v1/games?query=스듀` | `games[]`; IDs/names/edition/aliases/source mappings |
| GET | `/v1/games/{id}/sources` | `sources[]` with status, supported filters/sorts, link and message |
| GET | `/v1/search` | One provider per request; client fans out in parallel |
| GET | `/v1/listings/{source}/{scope}/{id}` | `listing` or 404/502; source and game are validated |
| GET | `/v1/service-status` | Configured availability, not an upstream uptime guarantee |
| Any | `/internal/*` | Not exposed; returns 404 |

Search inputs:

```text
gameId=minecraft-java
source=modrinth|curseforge|thunderstore|nexus|steam
query=Sodium                 # optional, max 200 characters
version=1.21.1               # optional
loader=fabric|forge|neoforge|quilt
kind=mod|modpack|resourcepack|shader
sort=relevance|popular|updated
cursor=<opaque token from previous response>
```

Cursors are bound to the game, source, query, filters, and sort. They must not be reused after changes. Unknown input fields are rejected. Source identifiers are normalized lowercase names. Game IDs are returned by `/v1/games`.

## Response shape

```json
{
  "source": "modrinth",
  "status": "success",
  "items": [],
  "nextCursor": null,
  "total": null,
  "fetchedAt": "2026-09-23T00:00:00.000Z",
  "cached": false,
  "appliedFilters": { "loader": "fabric" },
  "unsupportedFilters": [],
  "externalUrl": "https://modrinth.com/mods?q=Sodium",
  "queryForwarded": true,
  "message": "검색 완료",
  "verifiedLinks": []
}
```

The shape example omits listing objects; actual success responses contain listings. `total` is a provider's reported count, not a deduplicated global count.

Listing fields are defined in `src/shared/types.ts`. Key identity is `source:scope:id`; uint64 values remain strings. `versions` means game versions, never package versions. Missing author/version/loader/date is null. `metrics` retains provider labels such as downloads or subscriptions. HTML is not rendered.

States: `success`, `empty`, `external`, `auth_required`, `unsupported`, `error`, `rate_limited`, `disabled`. Current Nexus mode is `external`; `auth_required` is reserved for the approved native implementation. A source failure is a successful HTTP response with its explicit source state, so other providers can still render. Malformed client inputs return 400, unknown games 404, API-level throttling 429.

## Cache / timeouts / controls

- Upstream metadata request deadline: 4 seconds, 4 MiB response limit.
- App request deadline: 5 seconds per source. Search changes invalidate the prior generation.
- No automatic retry on 401/403/429. Redirects are rejected without following them. Upstream clients track cooldowns for their lifetime; Workers creates a request-scoped client and does not share upstream cooldown state between requests.
- Each search queries the upstream provider; no search-result cache is used.
- Workers uses its native rate-limit binding (120 API requests per minute per IP at a Cloudflare location; approximate, not a global upstream quota). The optional Node server uses process-local throttling.
- `DISABLED_SOURCES` applies after server restart. The client reads live states without an app update.
- Detailed metadata is currently fetched live; no 15-minute detail cache is enabled.

## Language

Workers selects Korean for `request.cf.country === "KR"`, English otherwise (including missing country). An explicit `mf-language=ko|en` cookie overrides this. API requests may specify exactly `ko` or `en` in Accept-Language to match the UI. Messages are translated, not provider names/descriptions. Personalized HTML is private/no-store; assets remain normally cacheable.

## Verified project linking

The server returns `verifiedLinks: []`. No database of cross-source relations is maintained. Listings remain separate by source-scoped ID and are never merged by title alone.
