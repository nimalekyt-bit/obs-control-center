const OFFICIAL_HOSTS = new Set([
  'github.com',
  'www.github.com',
  'obs-control-center.pages.dev',
  't.me'
]);

const OFFICIAL_GITHUB_PREFIX = '/nimalekyt-bit/obs-control-center';

function isLoopbackHost(hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
}

function isAllowedExternalUrl(value, { localPort } = {}) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;

  if (isLoopbackHost(url.hostname)) {
    if (url.protocol !== 'http:' || !Number.isInteger(localPort)) return false;
    return Number(url.port || 80) === localPort && url.pathname === '/tools/av-sync';
  }

  if (!OFFICIAL_HOSTS.has(url.hostname) || url.port) return false;
  if (url.hostname.endsWith('github.com')) return url.pathname === OFFICIAL_GITHUB_PREFIX || url.pathname.startsWith(`${OFFICIAL_GITHUB_PREFIX}/`);
  if (url.hostname === 'obs-control-center.pages.dev') return url.pathname === '/' || url.pathname.startsWith('/docs');
  if (url.hostname === 't.me') return url.pathname === '/woodskilla' || url.pathname === '/woodskilla/';
  return false;
}

module.exports = { isAllowedExternalUrl };
