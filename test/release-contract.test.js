const { test } = require('node:test');
const assert = require('node:assert/strict');

const manifest = {
  schemaVersion: 1,
  version: '0.13.0',
  docsVersion: '0.13',
  repository: 'https://github.com/nimalekyt-bit/obs-control-center',
  channel: 'early-access',
  limitations: [],
  docs: { firstRun: '/docs/first-run/' },
  release: {
    published: true,
    tag: 'v0.13.0',
    assetName: 'OBS-Control-Center-Setup-0.13.0.exe',
    pageUrl: 'https://github.com/nimalekyt-bit/obs-control-center/releases/tag/v0.13.0',
    downloadUrl: 'https://github.com/nimalekyt-bit/obs-control-center/releases/download/v0.13.0/OBS-Control-Center-Setup-0.13.0.exe',
    size: 100,
    sha256: 'a'.repeat(64),
    publishedAt: '2026-07-13T04:32:43Z',
    signature: 'unsigned',
    summary: 'Проверяемый выпуск',
    changes: [{ kind: 'new', text: 'Новая возможность' }],
  },
};

test('release contract accepts only the exact official asset and GitHub digest', async () => {
  const { releaseFromGithub, validateProductManifest } = await import('../scripts/release-contract.mjs');
  validateProductManifest(manifest, '0.13.0');
  const next = releaseFromGithub(manifest, {
    tag_name: 'v0.13.0', draft: false, published_at: '2026-07-14T01:02:03Z',
    assets: [{ name: 'OBS-Control-Center-Setup-0.13.0.exe', size: 123, digest: `sha256:${'b'.repeat(64)}`, browser_download_url: manifest.release.downloadUrl }],
  });
  assert.equal(next.release.size, 123);
  assert.equal(next.release.sha256, 'b'.repeat(64));
  assert.equal(next.updatedAt, '2026-07-14');
});

test('release contract rejects ambiguous, renamed and unverifiable assets', async () => {
  const { releaseFromGithub } = await import('../scripts/release-contract.mjs');
  const base = { tag_name: 'v0.13.0', draft: false, published_at: '2026-07-13T04:32:43Z' };
  assert.throws(() => releaseFromGithub(manifest, { ...base, assets: [] }), /ровно один asset/);
  assert.throws(() => releaseFromGithub(manifest, { ...base, assets: [{ name: manifest.release.assetName, size: 100, browser_download_url: manifest.release.downloadUrl }] }), /digest/);
  assert.throws(() => releaseFromGithub(manifest, { ...base, tag_name: 'v0.14.0', assets: [] }), /Ожидался тег/);
});
