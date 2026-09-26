// Keep the original URL, headers and Cloudflare metadata for locale, CORS and rate limits.
// The existing Worker owns the UI, API, secrets and security headers.
export default {
  fetch(request, env) {
    return env.MOD_FINDER.fetch(request);
  },
};
