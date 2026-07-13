const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { createStarterWidget, createWorkspace, importWidgetFolder, importWidgetZip, inspectWorkspaceSync, listWorkspaceBackups, migrateLegacyWorkspace, removeWidget, restoreWorkspaceBackup, updateWidget, DIRECTORIES, MANIFEST_NAME } = require('../src/workspace');

test('a new empty workspace is valid and does not require music', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-workspace-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const result = await createWorkspace(root, 'Тестовая студия');
  assert.equal(result.mode, 'workspace');
  assert.equal(result.manifest.widgets.length, 0);
  assert.ok(fs.existsSync(path.join(root, MANIFEST_NAME)));
  for (const directory of DIRECTORIES) assert.ok(fs.statSync(path.join(root, directory)).isDirectory());
  assert.equal(fs.existsSync(path.join(root, 'music')), false);
});

test('legacy workspace needs only its legacy marker and is never rewritten', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-legacy-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.writeFile(path.join(root, 'widgets.config.json'), '{}');
  assert.equal(inspectWorkspaceSync(root).mode, 'legacy');
  assert.equal(fs.existsSync(path.join(root, MANIFEST_NAME)), false);
});

test('workspace rejects traversal in widget paths', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-invalid-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.writeFile(path.join(root, MANIFEST_NAME), JSON.stringify({ schemaVersion: 1, widgets: [{ id: 'unsafe', folder: '../outside' }] }));
  const result = inspectWorkspaceSync(root);
  assert.equal(result.mode, 'invalid');
  assert.match(result.error, /небезопасный путь/);
});

test('workspace rejects unknown service dependencies', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-dependency-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.writeFile(path.join(root, MANIFEST_NAME), JSON.stringify({ schemaVersion: 1, widgets: [{ id: 'sample', dependencies: ['missing-service'] }], services: [] }));
  const result = inspectWorkspaceSync(root);
  assert.equal(result.mode, 'invalid');
  assert.match(result.error, /неизвестный сервис/);
});

test('legacy migration keeps files and creates a backup before the manifest', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-migrate-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.writeFile(path.join(root, 'widgets.config.json'), '{"original":true}');
  await fsp.mkdir(path.join(root, 'music'));
  await fsp.writeFile(path.join(root, 'music', 'index.html'), '<h1>keep me</h1>');
  const result = await migrateLegacyWorkspace(root, { widgets: [{ id: 'music', name: 'Музыка', folder: 'music' }], services: [], profiles: { stream: [] } });
  assert.equal(result.mode, 'workspace');
  assert.equal(await fsp.readFile(path.join(root, 'music', 'index.html'), 'utf8'), '<h1>keep me</h1>');
  assert.equal(await fsp.readFile(path.join(result.backupDir, 'widgets.config.json'), 'utf8'), '{"original":true}');
});

test('starter widget is created inside an empty workspace and registered atomically', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-starter-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await createWorkspace(root);
  const result = await createStarterWidget(root);
  assert.equal(result.workspace.manifest.widgets.length, 1);
  assert.equal(result.widget.folder, 'widgets/first-widget');
  assert.ok(fs.existsSync(path.join(root, result.widget.folder, result.widget.entry)));
  assert.ok((await fsp.readdir(path.join(root, 'backups'))).some(file => file.includes(MANIFEST_NAME)));
});

test('widget folder can be imported, edited and reversibly removed', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-lifecycle-'));
  const source = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-source-'));
  t.after(() => Promise.all([fsp.rm(root, { recursive: true, force: true }), fsp.rm(source, { recursive: true, force: true })]));
  await createWorkspace(root);
  await fsp.writeFile(path.join(source, 'index.html'), '<h1>Imported</h1>');
  await fsp.writeFile(path.join(source, 'widget.json'), JSON.stringify({ id: 'imported-widget', name: 'Импортированный', width: 800, height: 450, fps: 30 }));
  let result = await importWidgetFolder(root, source);
  assert.equal(result.workspace.manifest.widgets[0].id, 'imported-widget');
  result = await updateWidget(root, 'imported-widget', { name: 'Новое имя', disabled: true });
  assert.equal(result.widget.name, 'Новое имя');
  assert.equal(result.widget.disabled, true);
  const removed = await removeWidget(root, 'imported-widget');
  assert.equal(removed.workspace.manifest.widgets.length, 0);
  assert.ok(fs.existsSync(removed.backupPath));
  const removalBackup = (await listWorkspaceBackups(root)).find(item => item.id.startsWith('removed-imported-widget-'));
  assert.ok(removalBackup);
  const restored = await restoreWorkspaceBackup(root, removalBackup.id);
  assert.equal(restored.manifest.widgets[0].id, 'imported-widget');
  assert.ok(fs.existsSync(path.join(root, 'widgets', 'imported-widget', 'index.html')));
});

test('ZIP import rejects traversal and imports a valid widget archive', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'occ-zip-workspace-'));
  const archive = path.join(os.tmpdir(), `occ-widget-${Date.now()}.zip`);
  t.after(() => Promise.all([fsp.rm(root, { recursive: true, force: true }), fsp.rm(archive, { force: true })]));
  await createWorkspace(root);
  const zip = new AdmZip();
  zip.addFile('sample/index.html', Buffer.from('<h1>ZIP</h1>'));
  zip.addFile('sample/widget.json', Buffer.from(JSON.stringify({ id: 'zip-widget', name: 'ZIP Widget' })));
  zip.writeZip(archive);
  const result = await importWidgetZip(root, archive);
  assert.equal(result.widget.id, 'zip-widget');
  assert.ok(fs.existsSync(path.join(root, 'widgets', 'zip-widget', 'index.html')));
});
