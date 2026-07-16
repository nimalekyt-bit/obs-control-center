const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../product-manifest.json');
const { HELP_HOME_PATH, HELP_ORIGIN, HELP_ROUTES, resolveHelpUrl } = require('../src/help-routes');

test('help registry stays synchronized with the published product manifest', () => {
  assert.deepEqual(HELP_ROUTES, manifest.docs);
  for (const value of Object.values(HELP_ROUTES)) assert.match(value, /^\/docs\/[a-z0-9-]+\/$/);
});

test('help resolver returns only the official HTTPS documentation origin', () => {
  for (const key of Object.keys(HELP_ROUTES)) {
    const url = new URL(resolveHelpUrl(key));
    assert.equal(url.origin, HELP_ORIGIN);
    assert.equal(url.protocol, 'https:');
    assert.ok(url.pathname.startsWith(HELP_HOME_PATH));
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
  }
});

test('unknown, malformed and injection-like help keys fall back to the docs hub', () => {
  for (const key of ['', null, undefined, '../privacy', 'https://evil.example', 'obs?next=https://evil.example']) {
    assert.equal(resolveHelpUrl(key), `${HELP_ORIGIN}${HELP_HOME_PATH}`);
  }
});
