export function nativeSecurityConfig(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)
    || !/^(?:[a-z\d.-]+|\[[a-f\d:]+\])$/i.test(url.hostname)
    || ['localhost', '0.0.0.0', '[::1]'].includes(url.hostname.toLowerCase()) || url.hostname.startsWith('127.') || url.hostname.endsWith('.localhost')) {
    throw new Error('Release builds require a public HTTPS API endpoint.');
  }
  return { app: { security: { csp: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' ipc: http://ipc.localhost ${url.origin}; object-src 'none'; base-uri 'self'; frame-src 'none'` } } };
}
