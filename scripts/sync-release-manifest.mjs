import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { releaseFromGithub, releaseTag, repository, validateProductManifest, verifyLocalInstaller } from './release-contract.mjs';

const args = new Set(process.argv.slice(2));
const valueAfter = flag => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
};
const manifestFile = path.resolve(valueAfter('--manifest') || 'product-manifest.json');
const packageFile = path.resolve('package.json');
const fixtureFile = valueAfter('--release-json');
const installerFile = valueAfter('--asset-path');
const write = args.has('--write');

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const manifest = await readJson(manifestFile);
const packageJson = await readJson(packageFile);
validateProductManifest(manifest, packageJson.version);

let githubRelease;
if (fixtureFile) {
  githubRelease = await readJson(path.resolve(fixtureFile));
} else {
  const endpoint = `https://api.github.com/repos/${repository.owner}/${repository.name}/releases/tags/${releaseTag(manifest.version)}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'obs-control-center-release-contract', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`GitHub Release API вернул ${response.status}; проверенный манифест оставлен без изменений.`);
  githubRelease = await response.json();
}

const next = releaseFromGithub(manifest, githubRelease);
validateProductManifest(next, packageJson.version);
if (installerFile) await verifyLocalInstaller(next, path.resolve(installerFile));

const before = `${JSON.stringify(manifest, null, 2)}\n`;
const after = `${JSON.stringify(next, null, 2)}\n`;
if (before === after) {
  console.log(`Release contract ${next.release.tag} уже синхронизирован.`);
  process.exit(0);
}
if (!write) throw new Error('Release contract расходится с GitHub. Повторите команду с --write после проверки результата.');

const temporary = `${manifestFile}.${process.pid}.tmp`;
await writeFile(temporary, after, 'utf8');
await rename(temporary, manifestFile);
console.log(`Release contract ${next.release.tag} обновлён атомарно: ${next.release.assetName}.`);
