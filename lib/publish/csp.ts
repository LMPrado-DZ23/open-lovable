/**
 * Edge-safe (no Node APIs): shared by the published-page route and the
 * middleware, which sets the final Content-Security-Policy header. A published
 * site may load public images, fonts and APIs over HTTPS, and always runs
 * sandboxed in an opaque origin so its scripts never share the Studio origin.
 */
export const PUBLIC_SITE_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; connect-src https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action https:";
export const PUBLISHED_PAGE_CSP = `sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads; ${PUBLIC_SITE_CSP}; frame-ancestors 'none'`;
export const PUBLISHED_PAGE_PREFIX = '/p/';
