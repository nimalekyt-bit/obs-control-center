const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const AdmZip = require('adm-zip');

const MANIFEST_NAME = 'occ-workspace.json';
const SCHEMA_VERSION = 1;
const DIRECTORIES = ['widgets', 'data', 'logs', 'cache', 'backups'];
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const MAX_IMPORT_FILES = 5000;
const MAX_IMPORT_ARCHIVE_BYTES = 120 * 1024 * 1024;

function legacyWorkspace(candidate) {
  return Boolean(candidate && fs.existsSync(path.join(candidate, 'widgets.config.json')));
}

function normalizeWidget(widget) {
  if (!widget || !/^[a-z0-9][a-z0-9-]{1,63}$/i.test(String(widget.id || ''))) throw new Error('У виджета отсутствует корректный id.');
  const folder = String(widget.folder || `widgets/${widget.id}`).replace(/\\/g, '/');
  const entry = String(widget.entry || 'index.html').replace(/\\/g, '/');
  if (path.isAbsolute(folder) || folder.split('/').includes('..') || entry.split('/').includes('..')) throw new Error(`Виджет «${widget.id}» содержит небезопасный путь.`);
  return { ...widget, id: String(widget.id), name: String(widget.name || widget.id), folder, entry, width: Number(widget.width) || 1920, height: Number(widget.height) || 1080, fps: Number(widget.fps) || 30, category: String(widget.category || 'Без категории'), dependencies: Array.isArray(widget.dependencies) ? widget.dependencies : [], health: Array.isArray(widget.health) ? widget.health : [] };
}

function normalizeService(service) {
  if (!service || !/^[a-z0-9][a-z0-9-]{1,63}$/i.test(String(service.id || ''))) throw new Error('У фонового сервиса отсутствует корректный id.');
  if (!String(service.command || '').trim()) throw new Error(`У сервиса «${service.id}» не указана команда запуска.`);
  return { ...service, id: String(service.id), name: String(service.name || service.id), command: String(service.command), args: Array.isArray(service.args) ? service.args.map(String) : [], health: Array.isArray(service.health) ? service.health : [] };
}

function normalizeManifest(value, root) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION) throw new Error('Версия рабочего пространства не поддерживается.');
  const widgets = (Array.isArray(value.widgets) ? value.widgets : []).map(normalizeWidget);
  const services = (Array.isArray(value.services) ? value.services : []).map(normalizeService);
  const ids = new Set();
  for (const widget of widgets) {
    if (ids.has(widget.id)) throw new Error(`ID виджета «${widget.id}» повторяется.`);
    ids.add(widget.id);
  }
  const serviceIds = new Set();
  for (const service of services) {
    if (serviceIds.has(service.id)) throw new Error(`ID сервиса «${service.id}» повторяется.`);
    serviceIds.add(service.id);
  }
  for (const widget of widgets) for (const dependency of widget.dependencies) if (!serviceIds.has(dependency)) throw new Error(`Виджет «${widget.id}» ссылается на неизвестный сервис «${dependency}».`);
  const rawProfiles = value.profiles && typeof value.profiles === 'object' ? value.profiles : { stream: [] };
  const profiles = Object.fromEntries(Object.entries(rawProfiles).map(([profile, widgetIds]) => {
    if (!Array.isArray(widgetIds)) throw new Error(`Профиль «${profile}» должен содержать список виджетов.`);
    for (const widgetId of widgetIds) if (!ids.has(widgetId)) throw new Error(`Профиль «${profile}» ссылается на неизвестный виджет «${widgetId}».`);
    return [profile, widgetIds.map(String)];
  }));
  return { schemaVersion: SCHEMA_VERSION, name: String(value.name || path.basename(root)), createdBy: String(value.createdBy || 'OBS Control Center'), createdAt: value.createdAt || null, directories: { widgets: 'widgets', data: 'data', logs: 'logs', cache: 'cache', backups: 'backups', ...(value.directories || {}) }, widgets, services, profiles };
}

function inspectWorkspaceSync(candidate) {
  if (!candidate) return null;
  const root = path.resolve(candidate);
  const manifestPath = path.join(root, MANIFEST_NAME);
  if (fs.existsSync(manifestPath)) {
    try { return { root, mode: 'workspace', manifest: normalizeManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')), root) }; }
    catch (error) { return { root, mode: 'invalid', error: error.message }; }
  }
  if (legacyWorkspace(root)) return { root, mode: 'legacy', manifest: null };
  return null;
}

async function createWorkspace(root, name = 'Мои OBS-виджеты') {
  const resolved = path.resolve(root);
  await fsp.mkdir(resolved, { recursive: true });
  for (const directory of DIRECTORIES) await fsp.mkdir(path.join(resolved, directory), { recursive: true });
  const manifestPath = path.join(resolved, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    const manifest = { schemaVersion: SCHEMA_VERSION, name, createdBy: 'OBS Control Center', createdAt: new Date().toISOString(), directories: Object.fromEntries(DIRECTORIES.map(item => [item, item])), widgets: [], services: [], profiles: { stream: [] } };
    await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  }
  const result = inspectWorkspaceSync(resolved);
  if (!result || result.mode !== 'workspace') throw new Error(result?.error || 'Не удалось создать рабочее пространство.');
  return result;
}

async function migrateLegacyWorkspace(root, legacyConfig) {
  const resolved = path.resolve(root);
  const current = inspectWorkspaceSync(resolved);
  if (!current || current.mode !== 'legacy') throw new Error('Эта папка не является старым рабочим пространством.');
  for (const directory of DIRECTORIES) await fsp.mkdir(path.join(resolved, directory), { recursive: true });
  const backupDir = path.join(resolved, 'backups', `migration-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fsp.mkdir(backupDir, { recursive: true });
  await fsp.copyFile(path.join(resolved, 'widgets.config.json'), path.join(backupDir, 'widgets.config.json'));
  const manifest = { schemaVersion: SCHEMA_VERSION, name: path.basename(resolved), createdBy: 'OBS Control Center migration', createdAt: new Date().toISOString(), migratedFrom: 'legacy', directories: Object.fromEntries(DIRECTORIES.map(item => [item, item])), widgets: legacyConfig.widgets || [], services: legacyConfig.services || [], profiles: legacyConfig.profiles || { stream: [] } };
  await fsp.writeFile(path.join(resolved, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  const result = inspectWorkspaceSync(resolved);
  if (!result || result.mode !== 'workspace') throw new Error(result?.error || 'Миграция не завершена.');
  return { ...result, backupDir };
}

async function createStarterWidget(root) {
  const current = inspectWorkspaceSync(root);
  if (!current || current.mode !== 'workspace') throw new Error('Сначала создайте рабочее пространство Workspace 1.');
  let suffix = 1;
  let id = 'first-widget';
  while (current.manifest.widgets.some(widget => widget.id === id) || fs.existsSync(path.join(current.root, 'widgets', id))) id = `first-widget-${++suffix}`;
  const folder = path.join(current.root, 'widgets', id);
  await fsp.mkdir(folder, { recursive: false });
  const widget = { id, name: suffix === 1 ? 'Мой первый виджет' : `Мой первый виджет ${suffix}`, folder: `widgets/${id}`, entry: 'index.html', width: 700, height: 260, fps: 30, category: 'Мои виджеты', dependencies: [], health: [] };
  const html = `<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${widget.name}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;font-family:Segoe UI,sans-serif}.card{box-sizing:border-box;width:100%;height:100%;display:grid;place-content:center;text-align:center;color:#f5f8ff;border:2px solid rgba(184,242,91,.7);border-radius:28px;background:linear-gradient(135deg,rgba(13,24,38,.96),rgba(19,37,32,.92));box-shadow:inset 0 0 60px rgba(98,216,255,.09)}b{font-size:34px}span{margin-top:10px;color:#b8f25b;font-size:16px}</style></head><body><main class="card"><b>${widget.name}</b><span>Рабочее пространство подключено</span></main></body></html>\n`;
  await Promise.all([fsp.writeFile(path.join(folder, 'index.html'), html, 'utf8'), fsp.writeFile(path.join(folder, 'widget.json'), `${JSON.stringify(widget, null, 2)}\n`, 'utf8')]);
  const manifestPath = path.join(current.root, MANIFEST_NAME);
  const backupPath = path.join(current.root, 'backups', `${MANIFEST_NAME}.${Date.now()}.bak`);
  await fsp.copyFile(manifestPath, backupPath);
  const next = { ...current.manifest, widgets: [...current.manifest.widgets, widget] };
  const temporary = `${manifestPath}.tmp`;
  await fsp.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fsp.rename(temporary, manifestPath);
  return { workspace: inspectWorkspaceSync(current.root), widget };
}

function widgetIdFromName(value) {
  const normalized = String(value || 'widget').normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return (normalized || `widget-${Date.now()}`).slice(0, 64);
}

async function backupManifest(current, reason) {
  const backupDir = path.join(current.root, 'backups', `${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fsp.mkdir(backupDir, { recursive: true });
  await fsp.copyFile(path.join(current.root, MANIFEST_NAME), path.join(backupDir, MANIFEST_NAME));
  return backupDir;
}

async function writeManifest(current, manifest, reason, skipBackup = false) {
  if (!skipBackup) await backupManifest(current, reason);
  const manifestPath = path.join(current.root, MANIFEST_NAME);
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  normalizeManifest(manifest, current.root);
  await fsp.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fsp.rename(temporary, manifestPath);
  return inspectWorkspaceSync(current.root);
}

async function scanImportDirectory(root) {
  let bytes = 0;
  let files = 0;
  const rootStat = await fsp.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Импорт допускает только обычную папку.');
  async function visit(directory) {
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Импорт не поддерживает символические ссылки.');
      if (entry.isFile()) { files += 1; if (files > MAX_IMPORT_FILES) throw new Error('В виджете слишком много файлов.'); }
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) { bytes += (await fsp.stat(full)).size; if (bytes > MAX_IMPORT_BYTES) throw new Error('Размер виджета превышает 100 МБ.'); }
    }
  }
  await visit(root);
}

async function descriptorFromFolder(source) {
  let descriptor = {};
  const descriptorPath = path.join(source, 'widget.json');
  if (fs.existsSync(descriptorPath)) descriptor = JSON.parse((await fsp.readFile(descriptorPath, 'utf8')).replace(/^\uFEFF/, ''));
  const htmlFiles = (await fsp.readdir(source)).filter(file => file.toLowerCase().endsWith('.html'));
  const entry = descriptor.entry || (htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0]);
  if (!entry || !fs.existsSync(path.join(source, entry))) throw new Error('В папке виджета не найден входной HTML-файл.');
  const id = widgetIdFromName(descriptor.id || path.basename(source));
  return normalizeWidget({ ...descriptor, id, name: descriptor.name || path.basename(source), entry, folder: `widgets/${id}` });
}

async function importWidgetFolder(root, source) {
  const current = inspectWorkspaceSync(root);
  if (!current || current.mode !== 'workspace') throw new Error('Импорт доступен только в рабочем пространстве нового формата.');
  await scanImportDirectory(source);
  const widget = await descriptorFromFolder(source);
  if (current.manifest.widgets.some(item => item.id === widget.id)) throw new Error(`Виджет с ID «${widget.id}» уже установлен.`);
  const staging = path.join(current.root, 'cache', `import-${widget.id}-${Date.now()}`);
  const destination = path.join(current.root, widget.folder);
  if (fs.existsSync(destination)) throw new Error('Папка назначения уже существует.');
  await fsp.cp(source, staging, { recursive: true, errorOnExist: true });
  if (!fs.existsSync(path.join(staging, widget.entry))) { await fsp.rm(staging, { recursive: true, force: true }); throw new Error('После копирования не найден входной HTML-файл.'); }
  await fsp.rename(staging, destination);
  try { await writeManifest(current, { ...current.manifest, widgets: [...current.manifest.widgets, widget] }, `before-import-${widget.id}`); }
  catch (error) { await fsp.rm(destination, { recursive: true, force: true }); throw error; }
  return { workspace: inspectWorkspaceSync(current.root), widget };
}

async function importWidgetZip(root, zipPath) {
  const archiveStat = await fsp.stat(zipPath);
  if (!archiveStat.isFile() || archiveStat.size > MAX_IMPORT_ARCHIVE_BYTES) throw new Error('Размер ZIP-архива превышает допустимый лимит.');
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  let bytes = 0;
  if (entries.length > MAX_IMPORT_FILES) throw new Error('В ZIP-архиве слишком много файлов.');
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, '/');
    if (Number(entry.header?.size || 0) > MAX_IMPORT_BYTES) throw new Error('Один файл в ZIP-архиве слишком большой.');
    if (normalized.startsWith('/') || normalized.includes(':') || normalized.split('/').includes('..')) throw new Error('Архив содержит небезопасные пути.');
    bytes += Number(entry.header?.size || 0);
    if (bytes > MAX_IMPORT_BYTES) throw new Error('Размер распакованных файлов превышает 100 МБ.');
  }
  const temporary = await fsp.mkdtemp(path.join(osTmp(), 'occ-widget-'));
  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const target = path.join(temporary, entry.entryName);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, entry.getData());
    }
    let source = temporary;
    const children = await fsp.readdir(temporary, { withFileTypes: true });
    if (children.length === 1 && children[0].isDirectory()) source = path.join(temporary, children[0].name);
    return await importWidgetFolder(root, source);
  } finally { await fsp.rm(temporary, { recursive: true, force: true }); }
}

function osTmp() { return require('node:os').tmpdir(); }

async function updateWidget(root, id, changes) {
  const current = inspectWorkspaceSync(root);
  if (!current || current.mode !== 'workspace') throw new Error('Редактирование недоступно для этой папки.');
  const index = current.manifest.widgets.findIndex(widget => widget.id === id);
  if (index < 0) throw new Error('Виджет не найден.');
  const original = current.manifest.widgets[index];
  const updated = normalizeWidget({ ...original, name: changes.name ?? original.name, category: changes.category ?? original.category, width: changes.width ?? original.width, height: changes.height ?? original.height, fps: changes.fps ?? original.fps, disabled: changes.disabled ?? original.disabled });
  const widgets = [...current.manifest.widgets]; widgets[index] = updated;
  return { workspace: await writeManifest(current, { ...current.manifest, widgets }, `before-edit-${id}`), widget: updated };
}

async function removeWidget(root, id) {
  const current = inspectWorkspaceSync(root);
  if (!current || current.mode !== 'workspace') throw new Error('Удаление недоступно для этой папки.');
  const widget = current.manifest.widgets.find(item => item.id === id);
  if (!widget) throw new Error('Виджет не найден.');
  const source = path.resolve(current.root, widget.folder);
  const removedDir = await backupManifest(current, `removed-${id}`);
  const moved = path.join(removedDir, path.basename(source));
  if (fs.existsSync(source)) await fsp.rename(source, moved);
  let workspace;
  try { workspace = await writeManifest(current, { ...current.manifest, widgets: current.manifest.widgets.filter(item => item.id !== id), profiles: Object.fromEntries(Object.entries(current.manifest.profiles).map(([name, ids]) => [name, ids.filter(widgetId => widgetId !== id)])) }, `before-remove-${id}`, true); }
  catch (error) { if (fs.existsSync(moved)) await fsp.rename(moved, source); throw error; }
  return { workspace, widget, backupPath: removedDir };
}

async function listWorkspaceBackups(root) {
  const current = inspectWorkspaceSync(root);
  if (!current || current.mode !== 'workspace') return [];
  const backupsRoot = path.join(current.root, 'backups');
  const results = [];
  for (const entry of await fsp.readdir(backupsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(backupsRoot, entry.name, MANIFEST_NAME);
    if (!fs.existsSync(manifestPath)) continue;
    const stat = await fsp.stat(manifestPath);
    try { const manifest = normalizeManifest(JSON.parse((await fsp.readFile(manifestPath, 'utf8')).replace(/^\uFEFF/, '')), current.root); results.push({ id: entry.name, name: manifest.name, widgetCount: manifest.widgets.length, createdAt: stat.mtime.toISOString() }); } catch { /* Ignore invalid backups. */ }
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
}

async function restoreWorkspaceBackup(root, backupId) {
  const current = inspectWorkspaceSync(root);
  if (!current || current.mode !== 'workspace') throw new Error('Восстановление недоступно для этой папки.');
  const backupDir = path.resolve(current.root, 'backups', String(backupId || ''));
  const backupsRoot = path.resolve(current.root, 'backups');
  if (!backupDir.startsWith(`${backupsRoot}${path.sep}`)) throw new Error('Некорректная резервная копия.');
  const manifestPath = path.join(backupDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) throw new Error('В резервной копии нет манифеста.');
  const manifest = normalizeManifest(JSON.parse((await fsp.readFile(manifestPath, 'utf8')).replace(/^\uFEFF/, '')), current.root);
  for (const widget of manifest.widgets) {
    const destination = path.resolve(current.root, widget.folder);
    if (fs.existsSync(destination)) continue;
    const source = path.join(backupDir, path.basename(widget.folder));
    if (fs.existsSync(source)) await fsp.cp(source, destination, { recursive: true, errorOnExist: true });
  }
  return writeManifest(current, manifest, `before-restore-${backupId}`);
}

module.exports = { MANIFEST_NAME, SCHEMA_VERSION, DIRECTORIES, createStarterWidget, createWorkspace, importWidgetFolder, importWidgetZip, inspectWorkspaceSync, listWorkspaceBackups, migrateLegacyWorkspace, normalizeManifest, removeWidget, restoreWorkspaceBackup, updateWidget };
