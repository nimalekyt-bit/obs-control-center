import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const repository = {
  owner: 'nimalekyt-bit',
  name: 'obs-control-center',
  url: 'https://github.com/nimalekyt-bit/obs-control-center',
};

export const installerName = version => `OBS-Control-Center-Setup-${version}.exe`;
export const releaseTag = version => `v${version}`;

export function validateProductManifest(manifest, packageVersion) {
  const failures = [];
  if (manifest.schemaVersion !== 1) failures.push('schemaVersion должен быть 1');
  if (manifest.version !== packageVersion) failures.push('version должен совпадать с package.json');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) failures.push('version должен быть semver');
  if (!/^\d+\.\d+$/.test(manifest.docsVersion || '')) failures.push('docsVersion должен содержать major.minor');
  if (manifest.repository !== repository.url) failures.push('repository должен указывать на официальный репозиторий');
  if (!Array.isArray(manifest.limitations)) failures.push('limitations должен быть массивом');
  if (!manifest.docs || Object.values(manifest.docs).some(value => !/^\/docs\/[a-z0-9-]+\/$/.test(value))) failures.push('неверные маршруты документации');

  const release = manifest.release || {};
  if (release.published) {
    const tag = releaseTag(manifest.version);
    const asset = installerName(manifest.version);
    const prefix = `${repository.url}/releases/download/${tag}/`;
    if (release.tag !== tag) failures.push(`release.tag должен быть ${tag}`);
    if (release.assetName !== asset) failures.push(`release.assetName должен быть ${asset}`);
    if (release.pageUrl !== `${repository.url}/releases/tag/${tag}`) failures.push('release.pageUrl не соответствует версии');
    if (release.downloadUrl !== `${prefix}${asset}`) failures.push('release.downloadUrl не соответствует точному официальному asset');
    if (!Number.isSafeInteger(release.size) || release.size <= 0) failures.push('для релиза обязателен корректный размер');
    if (!/^[a-f0-9]{64}$/i.test(release.sha256 || '')) failures.push('для релиза обязателен SHA-256');
    if (!Number.isFinite(Date.parse(release.publishedAt || ''))) failures.push('для релиза обязательна корректная дата');
    if (!['unsigned', 'authenticode'].includes(release.signature)) failures.push('неверный статус подписи');
    if (!release.summary || !Array.isArray(release.changes) || release.changes.length === 0) failures.push('для релиза обязательны summary и changes');
  } else {
    const forbidden = ['tag', 'assetName', 'pageUrl', 'downloadUrl', 'size', 'sha256', 'publishedAt'];
    if (forbidden.some(key => release[key] !== null)) failures.push('неопубликованный релиз не может содержать публичные данные файла');
  }

  if (failures.length) throw new Error(`Некорректный product-manifest.json:\n- ${failures.join('\n- ')}`);
  return manifest;
}

export function releaseFromGithub(manifest, githubRelease) {
  const version = manifest.version;
  const tag = releaseTag(version);
  const assetName = installerName(version);
  if (githubRelease.draft) throw new Error(`GitHub Release ${tag} остаётся черновиком.`);
  if (githubRelease.tag_name !== tag) throw new Error(`Ожидался тег ${tag}, получен ${githubRelease.tag_name || 'пустой тег'}.`);
  if (!Number.isFinite(Date.parse(githubRelease.published_at || ''))) throw new Error('GitHub Release не содержит корректную дату публикации.');

  const matches = (githubRelease.assets || []).filter(asset => asset.name === assetName);
  if (matches.length !== 1) throw new Error(`В GitHub Release должен быть ровно один asset ${assetName}; найдено: ${matches.length}.`);
  const asset = matches[0];
  const expectedUrl = `${repository.url}/releases/download/${tag}/${assetName}`;
  if (asset.browser_download_url !== expectedUrl) throw new Error('URL установщика не совпадает с официальным ожидаемым адресом.');
  if (!Number.isSafeInteger(asset.size) || asset.size <= 0) throw new Error('GitHub не вернул корректный размер установщика.');
  const digest = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest || '');
  if (!digest) throw new Error('GitHub не вернул SHA-256 digest установщика; проверенный манифест оставлен без изменений.');

  return {
    ...manifest,
    release: {
      ...manifest.release,
      published: true,
      tag,
      assetName,
      pageUrl: `${repository.url}/releases/tag/${tag}`,
      downloadUrl: expectedUrl,
      size: asset.size,
      sha256: digest[1].toLowerCase(),
      publishedAt: githubRelease.published_at,
    },
    updatedAt: githubRelease.published_at.slice(0, 10),
  };
}

export async function sha256File(file) {
  const hash = createHash('sha256');
  hash.update(await readFile(file));
  return hash.digest('hex');
}

export async function verifyLocalInstaller(manifest, file) {
  const bytes = await readFile(file);
  if (bytes.byteLength !== manifest.release.size) throw new Error(`Размер локального установщика ${bytes.byteLength} не совпадает с manifest ${manifest.release.size}.`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== manifest.release.sha256) throw new Error('SHA-256 локального установщика не совпадает с manifest.');
  return true;
}
