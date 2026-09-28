# Pages address

Production: https://modfinder.pages.dev

The `modfinder` Pages project forwards requests through the `MOD_FINDER` service
binding to the existing `mod-finder` Worker. The Worker continues to own assets,
API secrets, locale selection, security headers and rate limiting. Updating that
Worker updates the app served at both addresses. No browser redirect is used.

The Pages entry point is `src/pages/public/_worker.js`; configuration is
`tooling/config/wrangler.pages.jsonc`. To redeploy the entry point with a credential that has
Cloudflare Pages Edit permission, run from the repository root:

```sh
npx wrangler pages deploy --config tooling/config/wrangler.pages.jsonc --project-name modfinder --branch main
```

The initial deployment used the Cloudflare API because the local Wrangler OAuth
credential has Workers permissions but does not have Pages permission. Both
production and preview use `MOD_FINDER` bound to the production Worker, with
`fail_open: false`. Preview requests therefore reach the production API.

All requests pass through a Pages Function and are subject to its applicable
usage limits. Favorites saved on the old address remain in that browser origin;
they are not automatically transferred to the new address.

The original workers.dev address remains available, including for the submitted
CurseForge application. No kro.kr DNS changes were made by this deployment.
