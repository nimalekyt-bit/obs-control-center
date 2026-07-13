const { app, BrowserWindow, ipcMain, shell, dialog, session } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const net = require('net');
const path = require('path');
const OBSWebSocket = require('obs-websocket-js').default;
const { autoUpdater } = require('electron-updater');
const { placementTransform } = require('./obs-layout');
const { TelemetryStore } = require('./telemetry-store');
const { restartDecision } = require('./service-recovery');
const { createStarterWidget, createWorkspace, importWidgetFolder, importWidgetZip, inspectWorkspaceSync, listWorkspaceBackups, migrateLegacyWorkspace, removeWidget, restoreWorkspaceBackup, updateWidget, MANIFEST_NAME } = require('./workspace');

const controlRoot = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(controlRoot, 'config', 'widgets.json'), 'utf8'));

function findWorkspaceRoot() {
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    process.env.OBS_WIDGETS_ROOT,
    process.env.PORTABLE_EXECUTABLE_DIR && path.resolve(process.env.PORTABLE_EXECUTABLE_DIR, '..', '..'),
    process.env.PORTABLE_EXECUTABLE_DIR && path.resolve(process.env.PORTABLE_EXECUTABLE_DIR, '..'),
    process.env.PORTABLE_EXECUTABLE_DIR,
    path.resolve(controlRoot, '..'),
    path.resolve(executableDir, '..'),
    path.resolve(executableDir, '..', '..'),
    path.resolve(executableDir, '..', '..', '..'),
    process.cwd()
  ].filter(Boolean);
  const root = candidates.find(candidate => inspectWorkspaceSync(candidate)?.mode === 'legacy');
  return root || null;
}

let workspaceRoot = findWorkspaceRoot();
let workspaceState = workspaceRoot ? { mode: 'legacy', name: 'Существующие виджеты', manifest: null } : { mode: 'none', name: null, manifest: null };
let activeConfig = workspaceRoot ? config : { server: config.server, widgets: [], services: [], profiles: { stream: [] } };
let widgetsById = new Map(activeConfig.widgets.map(widget => [widget.id, widget]));
let servicesById = new Map(activeConfig.services.map(service => [service.id, service]));
const processes = new Map();
const serviceRecoveries = new Map();
const telemetry = new Map();
const telemetryStore = new TelemetryStore();
const logs = [];
let mainWindow;
let logFile = null;
let settingsFile = null;
let settings = { onboardingComplete: false, workspaceRoot: null, workspaceSkipped: false, trustedServiceWorkspaces: [], recentWorkspaces: [], scenePresets: [], uiScale: 1, lastCleanExit: true };
let previousSessionCrashed = false;
let widgetServerPort = null;
let widgetServerState = { status: 'starting', port: null, error: null, attemptedPorts: [] };
let workspaceWatcher = null;
let workspaceReloadTimer = null;
let obsClient = null;
let obsReconnect = { desired: false, url: null, password: null, attempt: 0, timer: null, nextAttemptAt: null };
const obsUndoStack = [];
let runtimeState = [];
let updateState = { status: 'idle', version: null, percent: 0, error: null };
let obsState = { connected: false, mode: 'not-configured', managementEnabled: false, url: 'ws://127.0.0.1:4455', scenes: [], currentProgramSceneName: null, version: null, video: null, error: null };
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) app.quit();
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function addLog(level, source, message) {
  const entry = { id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), level, source, message };
  logs.unshift(entry);
  if (logs.length > 500) logs.length = 500;
  if (logFile) fsp.appendFile(logFile, `${JSON.stringify(entry)}\n`, 'utf8').catch(() => {});
}

function activateWorkspace(candidate) {
  const inspected = inspectWorkspaceSync(candidate);
  if (!inspected || inspected.mode === 'invalid') throw new Error(inspected?.error || `В папке нет ${MANIFEST_NAME} или legacy-конфигурации.`);
  workspaceRoot = inspected.root;
  workspaceState = { mode: inspected.mode, name: inspected.manifest?.name || 'Существующие виджеты', manifest: inspected.manifest };
  activeConfig = inspected.mode === 'legacy' ? config : { server: config.server, widgets: inspected.manifest.widgets, services: inspected.manifest.services, profiles: inspected.manifest.profiles };
  widgetsById = new Map(activeConfig.widgets.map(widget => [widget.id, widget]));
  servicesById = new Map(activeConfig.services.map(service => [service.id, service]));
  settings.workspaceRoot = workspaceRoot;
  settings.workspaceSkipped = false;
  settings.recentWorkspaces = [{ path: workspaceRoot, name: workspaceState.name, lastOpenedAt: new Date().toISOString() }, ...(settings.recentWorkspaces || []).filter(item => item.path !== workspaceRoot)].slice(0, 6);
  watchWorkspaceManifest();
}

function watchWorkspaceManifest() {
  workspaceWatcher?.close(); workspaceWatcher = null;
  if (!workspaceRoot || workspaceState.mode !== 'workspace') return;
  const manifestPath = path.join(workspaceRoot, MANIFEST_NAME);
  try {
    workspaceWatcher = fs.watch(manifestPath, { persistent: false }, () => {
      clearTimeout(workspaceReloadTimer);
      workspaceReloadTimer = setTimeout(() => {
        const inspected = inspectWorkspaceSync(workspaceRoot);
        if (!inspected || inspected.mode !== 'workspace') { addLog('error', 'Рабочее пространство', 'Манифест изменён, но не прошёл проверку. Используется последняя корректная версия.'); return; }
        workspaceState = { mode: inspected.mode, name: inspected.manifest.name, manifest: inspected.manifest };
        activeConfig = { server: config.server, widgets: inspected.manifest.widgets, services: inspected.manifest.services, profiles: inspected.manifest.profiles };
        widgetsById = new Map(activeConfig.widgets.map(widget => [widget.id, widget])); servicesById = new Map(activeConfig.services.map(service => [service.id, service]));
        for (const id of telemetry.keys()) if (!widgetsById.has(id)) telemetry.delete(id);
        addLog('info', 'Рабочее пространство', 'Изменения манифеста применены без перезапуска.');
        mainWindow?.webContents.send('workspace-changed');
        watchWorkspaceManifest();
      }, 350);
    });
  } catch (error) { addLog('warning', 'Рабочее пространство', `Автообновление недоступно: ${error.message}`); }
}

async function stopServicesForWorkspaceSwitch() {
  for (const id of serviceRecoveries.keys()) cancelServiceRecovery(id, true);
  const running = [...processes.values()].filter(record => !record.exited);
  if (!running.length) { processes.clear(); return; }
  await Promise.all(running.map(record => new Promise(resolve => {
    const timer = setTimeout(() => { if (!record.exited) execFile('taskkill', ['/pid', String(record.child.pid), '/t', '/f'], () => resolve()); else resolve(); }, 1800);
    record.child.once('exit', () => { clearTimeout(timer); record.exited = true; resolve(); });
    try { record.child.kill(); } catch { clearTimeout(timer); resolve(); }
  })));
  processes.clear();
}

async function prepareWorkspaceSwitch(target) {
  if (!workspaceRoot || path.resolve(target) === path.resolve(workspaceRoot)) return true;
  const running = [...processes.values()].some(record => !record.exited);
  if (running) {
    const confirmation = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Сменить рабочее пространство?', message: 'Перед переключением нужно остановить запущенные фоновые сервисы.', detail: 'Виджеты и файлы текущего пространства не будут удалены.', buttons: ['Отмена', 'Остановить и переключить'], defaultId: 0, cancelId: 0 });
    if (confirmation.response !== 1) return false;
  }
  await stopServicesForWorkspaceSwitch();
  telemetry.clear();
  return true;
}

function clearWorkspace() {
  workspaceWatcher?.close(); workspaceWatcher = null;
  workspaceRoot = null;
  workspaceState = { mode: 'none', name: null, manifest: null };
  activeConfig = { server: config.server, widgets: [], services: [], profiles: { stream: [] } };
  widgetsById = new Map();
  servicesById = new Map();
  settings.workspaceRoot = null;
}

function servicesAreTrusted() {
  return workspaceState.mode === 'legacy' || !activeConfig.services.length || (settings.trustedServiceWorkspaces || []).includes(workspaceRoot);
}

async function initializeStorage() {
  const storageDir = path.join(app.getPath('userData'), 'data');
  await fsp.mkdir(storageDir, { recursive: true });
  logFile = path.join(storageDir, 'events.jsonl');
  settingsFile = path.join(storageDir, 'settings.json');
  await telemetryStore.initialize(path.join(storageDir, 'telemetry.jsonl'));
  try {
    settings = { ...settings, ...JSON.parse(await fsp.readFile(settingsFile, 'utf8')) };
    previousSessionCrashed = settings.lastCleanExit === false;
    if (settings.workspaceRoot) {
      try { activateWorkspace(settings.workspaceRoot); } catch { clearWorkspace(); }
    }
  } catch { /* First run. */ }
  settings.lastCleanExit = false;
  await saveSettings();
  try {
    const previous = (await fsp.readFile(logFile, 'utf8')).trim().split('\n').slice(-200).map(line => JSON.parse(line)).reverse();
    logs.push(...previous);
  } catch { /* First run or a partial previous log. */ }
}

function detectCommand(name, command, args) {
  return new Promise(resolve => {
    execFile(command, args, { windowsHide: true, timeout: 2500 }, (error, stdout, stderr) => resolve({ id: name, available: !error, version: !error ? String(stdout || stderr).trim().split(/\r?\n/)[0].slice(0, 80) : null }));
  });
}

async function detectRuntimes() {
  runtimeState = await Promise.all([detectCommand('node', 'node', ['--version']), detectCommand('python', 'python', ['--version']), detectCommand('dotnet', 'dotnet', ['--version']), detectCommand('powershell', 'powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'])]);
}

function isWorkspaceRoot(candidate) {
  return ['workspace', 'legacy'].includes(inspectWorkspaceSync(candidate)?.mode);
}

async function saveSettings() {
  if (settingsFile) await fsp.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
}

function isInside(base, target) {
  const relative = path.relative(base, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function mimeType(filePath) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' })[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function injectMonitor(html, widgetId) {
  const tag = `<script src="/control/widget-monitor.js?widgetId=${encodeURIComponent(widgetId)}"></script>`;
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : `${tag}${html}`;
}

function startWidgetServer() {
  const preferredPort = config.server.port;
  let port = preferredPort;
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${port}`;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, origin);
    if (req.method === 'POST' && url.pathname === '/api/telemetry') {
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { res.writeHead(415).end(); return; }
      const requestOrigin = String(req.headers.origin || '');
      if (requestOrigin && requestOrigin !== origin) { res.writeHead(403).end(); return; }
      let body = '';
      let tooLarge = false;
      req.on('data', chunk => { if (tooLarge) return; body += chunk; if (Buffer.byteLength(body) > 64 * 1024) { tooLarge = true; res.writeHead(413).end(); req.destroy(); } });
      req.on('end', () => {
        if (tooLarge) return;
        try {
          const report = JSON.parse(body);
          if (widgetsById.has(report.widgetId)) {
            const receivedAt = Date.now();
            telemetry.set(report.widgetId, { ...report, receivedAt });
            const event = report.lastDataEvent;
            telemetryStore.add({ widgetId: `${workspaceRoot || 'none'}::${report.widgetId}`, at: receivedAt, fps: report.fps, longFrames: report.longFrames, sourceDelay: event?.sourceTimestamp ? Math.max(0, event.receivedAt - event.sourceTimestamp) : null, renderDelay: event ? Math.max(0, event.renderedAt - event.receivedAt) : null });
          }
          res.writeHead(204).end();
        } catch { res.writeHead(400).end(); }
      });
      return;
    }
    if (url.pathname === '/control/widget-monitor.js') {
      const file = path.join(controlRoot, 'src', 'widget-monitor.js');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (url.pathname === '/tools/av-sync') {
      const file = path.join(controlRoot, 'src', 'calibration.html');
      if (!fs.existsSync(file)) { res.writeHead(503).end('Calibration tool is unavailable. Reinstall Control Center.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    const match = url.pathname.match(/^\/widgets\/([a-z0-9-]+)(?:\/(.*))?$/i);
    if (!match || !widgetsById.has(match[1])) { res.writeHead(404).end('Not found'); return; }
    const widget = widgetsById.get(match[1]);
    const requested = match[2] || widget.entry;
    if (!workspaceRoot) { res.writeHead(503).end('Widget folder is not configured.'); return; }
    const root = path.resolve(workspaceRoot, widget.folder);
    const filePath = path.resolve(root, requested);
    if (!isInside(root, filePath) && filePath !== root) { res.writeHead(403).end('Forbidden'); return; }
    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) throw new Error('Not a file');
      if (path.extname(filePath).toLowerCase() === '.html') {
        const html = await fsp.readFile(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(injectMonitor(html, widget.id));
      } else {
        res.writeHead(200, { 'Content-Type': mimeType(filePath) });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch { res.writeHead(404).end('Widget file not found'); }
  });
  const listen = () => { widgetServerState = { status: 'starting', port: null, error: null, attemptedPorts: [...new Set([...widgetServerState.attemptedPorts, port])] }; server.listen(port, '127.0.0.1'); };
  server.on('listening', () => {
    widgetServerPort = port;
    widgetServerState = { ...widgetServerState, status: 'ready', port, error: null };
    addLog('info', 'Сервер виджетов', `Доступен на ${port}`);
  });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && port < preferredPort + 10) {
      port += 1;
      addLog('warning', 'Сервер виджетов', `Порт занят, пробуем ${port}.`);
      listen();
      return;
    }
    widgetServerPort = null;
    widgetServerState = { ...widgetServerState, status: 'error', port: null, error: error.code === 'EADDRINUSE' ? `Порты ${preferredPort}–${preferredPort + 10} заняты другими приложениями.` : error.message };
    addLog('error', 'Сервер виджетов', error.message);
    mainWindow?.webContents.send('workspace-changed');
  });
  listen();
}

function checkPort(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(700);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function checkHealth(rule) {
  if (rule.type === 'port') return { ...rule, ok: await checkPort(rule.port) };
  if (rule.type === 'file') {
    if (!workspaceRoot) return { ...rule, ok: false, ageMs: null };
    try {
      const stat = await fsp.stat(path.join(workspaceRoot, rule.path));
      const ageMs = Date.now() - stat.mtimeMs;
      return { ...rule, ageMs, ok: ageMs <= rule.maxAgeMs };
    } catch { return { ...rule, ok: false, ageMs: null }; }
  }
  return { ...rule, ok: false };
}

async function widgetSnapshot(widget) {
  const health = await Promise.all((widget.health || []).map(checkHealth));
  const metric = telemetry.get(widget.id);
  const metricFresh = metric && Date.now() - metric.receivedAt < 5000;
  let data = null;
  if (widget.dataFile && workspaceRoot) {
    try { data = JSON.parse(await fsp.readFile(path.join(workspaceRoot, widget.dataFile), 'utf8').then(value => value.replace(/^\uFEFF/, ''))); } catch { /* no data yet */ }
  }
  return {
    ...widget,
    url: `http://127.0.0.1:${widgetServerPort || config.server.port}/widgets/${widget.id}/${widget.entry}`,
    health,
    state: widget.disabled ? 'disabled' : health.length && !health.every(item => item.ok) ? 'warning' : 'ready',
    telemetry: metricFresh ? metric : null,
    history: telemetryStore.summary(`${workspaceRoot || 'none'}::${widget.id}`),
    data
  };
}

async function serviceSnapshot(service) {
  const health = await Promise.all((service.health || []).map(checkHealth));
  const process = processes.get(service.id);
  const runningByControlCenter = Boolean(process && !process.exited);
  const externallyRunning = !runningByControlCenter && health.length > 0 && health.every(item => item.ok);
  const runtimeId = requiredRuntime(service);
  const runtime = runtimeId ? runtimeState.find(item => item.id === runtimeId) : null;
  const recovery = serviceRecoveries.get(service.id);
  const crashed = Boolean(process?.exited && !process.stopRequested && process.lastExitCode !== 0);
  const state = runtime && !runtime.available ? 'runtime-missing' : runningByControlCenter ? (health.every(item => item.ok) ? 'ready' : 'starting') : recovery?.blocked ? 'restart-blocked' : recovery?.timer ? 'restarting' : crashed ? 'crashed' : (externallyRunning ? 'external' : 'stopped');
  return { ...service, runtime, runningByControlCenter, externallyRunning, health, lastExitAt: process?.lastExitAt || null, lastExitCode: process?.lastExitCode ?? null, restartAttempts: recovery?.attempts.length || 0, nextRestartAt: recovery?.nextRestartAt || null, state };
}

function recoveryFor(id) {
  if (!serviceRecoveries.has(id)) serviceRecoveries.set(id, { attempts: [], timer: null, nextRestartAt: null, blocked: false });
  return serviceRecoveries.get(id);
}

function cancelServiceRecovery(id, reset = false) {
  const recovery = serviceRecoveries.get(id);
  if (!recovery) return;
  clearTimeout(recovery.timer); recovery.timer = null; recovery.nextRestartAt = null;
  if (reset) serviceRecoveries.delete(id);
}

function scheduleServiceRestart(id) {
  const service = servicesById.get(id);
  if (!service || service.autoRestart === false || !workspaceRoot) return;
  const recovery = recoveryFor(id);
  const decision = restartDecision(recovery.attempts);
  recovery.attempts = decision.attempts;
  if (decision.blocked) {
    recovery.blocked = true;
    addLog('error', service.name, 'Автоперезапуск остановлен: сервис упал 3 раза за минуту. Проверьте журнал и запустите его вручную.');
    mainWindow?.webContents.send('workspace-changed');
    return;
  }
  const delay = decision.delay;
  recovery.blocked = false;
  recovery.nextRestartAt = new Date(Date.now() + delay).toISOString();
  addLog('warning', service.name, `Автоматический перезапуск через ${Math.round(delay / 1000)} сек. Попытка ${recovery.attempts.length}/3.`);
  recovery.timer = setTimeout(() => {
    recovery.timer = null; recovery.nextRestartAt = null;
    startService(id, { recovery: true }).catch(error => { addLog('error', service.name, `Автоперезапуск не выполнен: ${error.message}`); scheduleServiceRestart(id); });
  }, delay);
  mainWindow?.webContents.send('workspace-changed');
}

function requiredRuntime(service) {
  const command = path.basename(String(service.command || '')).toLowerCase();
  if (command === 'node' || command === 'node.exe') return 'node';
  if (command === 'python' || command === 'python.exe' || command === 'py.exe') return 'python';
  if (command === 'dotnet' || command === 'dotnet.exe') return 'dotnet';
  if (command === 'powershell' || command === 'powershell.exe' || command === 'pwsh.exe') return 'powershell';
  return null;
}

function commandExists(service) {
  if (!workspaceRoot) return false;
  if (service.command.includes('/') || service.command.includes('\\')) return fs.existsSync(path.join(workspaceRoot, service.command));
  return true;
}

async function startService(id, options = {}) {
  if (!workspaceRoot) throw new Error('Сначала выберите папку виджетов.');
  const currentWorkspace = inspectWorkspaceSync(workspaceRoot);
  if (!currentWorkspace || currentWorkspace.mode === 'invalid') throw new Error('Рабочая папка недоступна или повреждена. Подключите её заново либо выберите другую папку.');
  if (!servicesAreTrusted()) throw new Error('Запуск команд этого рабочего пространства не подтверждён. Подключите папку заново и проверьте разрешение.');
  const service = servicesById.get(id);
  if (!service) throw new Error('Неизвестный сервис');
  if (!options.recovery) cancelServiceRecovery(id, true);
  const runtimeId = requiredRuntime(service);
  const runtime = runtimeId ? runtimeState.find(item => item.id === runtimeId) : null;
  if (runtime && !runtime.available) throw new Error(`Для сервиса «${service.name}» не найден ${runtimeId}. Установите компонент и перезапустите Control Center.`);
  const existing = processes.get(id);
  if (existing && !existing.exited) return;
  if (!commandExists(service)) throw new Error(`Не найден файл запуска: ${service.command}`);
  const health = await Promise.all((service.health || []).map(checkHealth));
  if (health.length && health.every(item => item.ok)) {
    addLog('info', service.name, 'Already running outside Control Center; duplicate launch skipped.');
    return;
  }
  const child = spawn(service.command, service.args || [], { cwd: workspaceRoot, windowsHide: true, shell: false });
  const record = { child, exited: false, stopRequested: false, recoveryScheduled: false, startedAt: new Date().toISOString(), lastExitAt: null, lastExitCode: null };
  processes.set(id, record);
  addLog('info', service.name, 'Запуск');
  child.stdout?.on('data', buffer => addLog('info', service.name, buffer.toString().trim().slice(0, 300)));
  child.stderr?.on('data', buffer => addLog('warning', service.name, buffer.toString().trim().slice(0, 300)));
  child.once('error', error => { record.exited = true; record.lastExitAt = new Date().toISOString(); record.lastExitCode = null; addLog('error', service.name, error.message); if (!record.stopRequested) { record.recoveryScheduled = true; scheduleServiceRestart(id); } mainWindow?.webContents.send('workspace-changed'); });
  child.once('exit', code => { record.exited = true; record.lastExitAt = new Date().toISOString(); record.lastExitCode = code; addLog(code === 0 ? 'info' : 'warning', service.name, `Завершён (код ${code ?? 'неизвестен'})`); if (!record.stopRequested && code !== 0 && !record.recoveryScheduled) { record.recoveryScheduled = true; scheduleServiceRestart(id); } mainWindow?.webContents.send('workspace-changed'); });
}

function stopService(id) {
  cancelServiceRecovery(id, true);
  const record = processes.get(id);
  if (!record || record.exited) return;
  const name = servicesById.get(id)?.name || id;
  record.stopRequested = true;
  addLog('info', name, 'Запрошено безопасное завершение.');
  try { record.child.kill(); } catch {}
  setTimeout(() => {
    if (!record.exited) {
      execFile('taskkill', ['/pid', String(record.child.pid), '/t', '/f'], () => {});
      record.exited = true;
      addLog('warning', name, 'Принудительно остановлен после тайм-аута.');
    }
  }, 5000);
}

async function getSnapshot() {
  const workspaceInspection = workspaceRoot ? inspectWorkspaceSync(workspaceRoot) : null;
  const workspaceAvailable = Boolean(workspaceRoot && workspaceInspection && workspaceInspection.mode !== 'invalid');
  const workspaceIssue = workspaceRoot && !workspaceAvailable ? (workspaceInspection?.error || 'Папка была перемещена, удалена или сейчас недоступна.') : null;
  const widgetSnapshots = await Promise.all(activeConfig.widgets.map(widgetSnapshot));
  const serviceSnapshots = await Promise.all(activeConfig.services.map(serviceSnapshot));
  const visibleWidgets = workspaceAvailable ? widgetSnapshots : widgetSnapshots.map(widget => ({ ...widget, state: 'workspace-missing', telemetry: null }));
  const visibleServices = workspaceAvailable ? serviceSnapshots : serviceSnapshots.map(service => ({ ...service, state: 'workspace-missing', runningByControlCenter: false, externallyRunning: false }));
  return {
    appInfo: { version: app.getVersion(), platform: process.platform, arch: process.arch },
    serverPort: widgetServerPort,
    server: widgetServerState,
    workspace: { ready: workspaceAvailable, path: workspaceRoot, mode: workspaceState.mode, name: workspaceState.name, issue: workspaceIssue, skipped: Boolean(settings.workspaceSkipped), servicesTrusted: servicesAreTrusted(), recent: (settings.recentWorkspaces || []).filter(item => isWorkspaceRoot(item.path)), backups: workspaceAvailable && workspaceState.mode === 'workspace' ? await listWorkspaceBackups(workspaceRoot) : [], manifest: workspaceState.mode === 'workspace' ? MANIFEST_NAME : null },
    onboarding: { complete: Boolean(settings.onboardingComplete) },
    preferences: { uiScale: settings.uiScale || 1 },
    recovery: { previousSessionCrashed },
    update: updateState,
    obs: obsState,
    scenePresets: settings.scenePresets || [],
    widgets: visibleWidgets,
    services: visibleServices,
    runtimes: runtimeState,
    logs: logs.slice(0, 80)
  };
}

async function createDiagnosticReport() {
  const snapshot = await getSnapshot();
  const redact = value => {
    let text = String(value ?? '');
    const privateRoots = [[workspaceRoot, '[Workspace]'], [app.getPath('home'), '[Домашняя папка]']];
    for (const [privatePath, replacement] of privateRoots) {
      if (!privatePath) continue;
      text = text.split(String(privatePath)).join(replacement);
      text = text.split(String(privatePath).replaceAll('\\', '/')).join(replacement);
    }
    return text;
  };
  const lines = [
    'OBS Control Center — диагностический отчёт',
    `Создан: ${new Date().toISOString()}`,
      `Версия приложения: ${app.getVersion()}`,
      `Система: ${process.platform} ${process.arch}`,
      `Сервер виджетов: 127.0.0.1:${snapshot.serverPort}`,
      `Workspace: ${snapshot.workspace.ready ? `${snapshot.workspace.name || 'выбран'} (${snapshot.workspace.mode})` : 'не выбран'}`,
      `OBS: ${snapshot.obs.connected ? `подключён (${snapshot.obs.version || 'версия неизвестна'})` : snapshot.obs.mode}`,
      'Безопасность: пароли и секреты не включены; домашняя папка и полный путь Workspace скрыты.',
      'Перед отправкой: просмотрите текст и удалите любые данные, которыми не хотите делиться.',
      '', 'Сервисы:'
  ];
  snapshot.services.forEach(service => lines.push(`- ${service.name}: ${service.state}`));
  lines.push('', 'Виджеты:');
  snapshot.widgets.forEach(widget => lines.push(`- ${widget.name}: ${widget.state}${widget.telemetry ? `, ${widget.telemetry.fps} FPS` : ''}`));
  lines.push('', 'Последние события:');
  snapshot.logs.slice(0, 30).forEach(entry => lines.push(`- ${entry.at} [${entry.level}] ${redact(entry.source)}: ${redact(entry.message)}`));
  return lines.join('\n');
}

async function refreshObsState() {
  if (!obsClient) return;
  const [{ scenes, currentProgramSceneName }, version, video] = await Promise.all([
    obsClient.call('GetSceneList'),
    obsClient.call('GetVersion'),
    obsClient.call('GetVideoSettings')
  ]);
  const sceneDetails = await Promise.all(scenes.map(async scene => {
    try {
      const { sceneItems } = await obsClient.call('GetSceneItemList', { sceneName: scene.sceneName });
      return {
        name: scene.sceneName,
        index: scene.sceneIndex,
        items: sceneItems.map(item => ({
          id: item.sceneItemId,
          index: item.sceneItemIndex,
          name: item.sourceName,
          kind: item.inputKind || item.sourceType,
          enabled: item.sceneItemEnabled,
          managed: String(item.sourceName || '').startsWith('OCC • '),
          transform: item.sceneItemTransform || null
        }))
      };
    } catch (error) {
      addLog('warning', 'OBS', `Не удалось прочитать источники сцены «${scene.sceneName}»: ${error.message}`);
      return { name: scene.sceneName, index: scene.sceneIndex, items: [] };
    }
  }));
  obsState = { ...obsState, connected: true, mode: obsState.managementEnabled ? 'managed' : 'read-only', scenes: sceneDetails, currentProgramSceneName, version: version.obsVersion, video: { baseWidth: video.baseWidth, baseHeight: video.baseHeight, fps: video.fpsNumerator / video.fpsDenominator }, error: null };
}

function requireObsManagement() {
  if (!obsClient || !obsState.connected) throw new Error('Сначала подключите OBS WebSocket.');
  if (!obsState.managementEnabled) throw new Error('Включите режим управления сценой на текущую сессию.');
}

function getScene(sceneName) {
  const scene = obsState.scenes.find(item => item.name === sceneName);
  if (!scene) throw new Error('Сцена не найдена в текущей коллекции OBS.');
  return scene;
}

function getManagedItem(sceneName, sceneItemId) {
  const item = getScene(sceneName).items.find(candidate => candidate.id === Number(sceneItemId));
  if (!item) throw new Error('Источник больше не существует. Обновите список сцен.');
  if (!item.managed) throw new Error('Control Center управляет только созданными им источниками.');
  return item;
}

function widgetObsUrl(widget) {
  return `http://127.0.0.1:${widgetServerPort || config.server.port}/widgets/${widget.id}/${widget.entry}`;
}

function editableObsTransform(input = {}) {
  const keys = ['positionX','positionY','scaleX','scaleY','rotation','cropLeft','cropRight','cropTop','cropBottom','alignment','boundsType','boundsAlignment','boundsWidth','boundsHeight'];
  return Object.fromEntries(keys.filter(key => input[key] != null).map(key => [key, input[key]]));
}

async function obsWidgetAction(payload) {
  requireObsManagement();
  const sceneName = String(payload.sceneName || '');
  const scene = getScene(sceneName);
  if (payload.action === 'create') {
    const widget = widgetsById.get(payload.widgetId);
    if (!widget) throw new Error('Неизвестный виджет.');
    if (widget.disabled) throw new Error('Виджет отключён в настройках рабочего пространства.');
    const inputName = `OCC • ${widget.name} • ${sceneName}`.slice(0, 120);
    if (scene.items.some(item => item.name === inputName)) throw new Error('Этот виджет уже добавлен в выбранную сцену.');
    const result = await obsClient.call('CreateInput', { sceneName, inputName, inputKind: 'browser_source', inputSettings: { url: widgetObsUrl(widget), width: widget.width, height: widget.height, fps: widget.fps, reroute_audio: false, shutdown: false }, sceneItemEnabled: true });
    await obsClient.call('SetSceneItemTransform', { sceneName, sceneItemId: result.sceneItemId, sceneItemTransform: placementTransform(payload.preset || (widget.width >= 1500 ? 'fullscreen' : 'bottom-right'), widget, obsState.video) });
    addLog('info', 'OBS', `Виджет «${widget.name}» добавлен в сцену «${sceneName}».`);
  } else {
    const item = getManagedItem(sceneName, payload.sceneItemId);
    if (payload.action === 'toggle') {
      await obsClient.call('SetSceneItemEnabled', { sceneName, sceneItemId: item.id, sceneItemEnabled: !item.enabled });
      addLog('info', 'OBS', `${item.enabled ? 'Скрыт' : 'Показан'} источник «${item.name}».`);
    } else if (payload.action === 'position') {
      const widget = activeConfig.widgets.find(candidate => item.name.includes(candidate.name));
      obsUndoStack.push({ sceneName, sceneItemId: item.id, transform: editableObsTransform(item.transform) });
      await obsClient.call('SetSceneItemTransform', { sceneName, sceneItemId: item.id, sceneItemTransform: placementTransform(payload.preset, widget, obsState.video) });
      addLog('info', 'OBS', `Источник «${item.name}» перемещён: ${payload.preset}.`);
    } else if (payload.action === 'transform') {
      const input = payload.transform || {};
      const ranges = { positionX: [-16384,16384], positionY: [-16384,16384], scaleX: [.01,10], scaleY: [.01,10], rotation: [-3600,3600], cropLeft: [0,8192], cropRight: [0,8192], cropTop: [0,8192], cropBottom: [0,8192] };
      const transform = {};
      for (const [key, [min,max]] of Object.entries(ranges)) if (input[key] != null) { const value = Number(input[key]); if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Некорректное значение ${key}.`); transform[key] = value; }
      obsUndoStack.push({ sceneName, sceneItemId: item.id, transform: editableObsTransform(item.transform) });
      if (obsUndoStack.length > 30) obsUndoStack.shift();
      await obsClient.call('SetSceneItemTransform', { sceneName, sceneItemId: item.id, sceneItemTransform: transform });
      addLog('info', 'OBS', `Трансформация источника «${item.name}» обновлена.`);
    } else if (payload.action === 'layer') {
      const nextIndex = Math.max(0, Math.min(scene.items.length - 1, Number(item.index || 0) + (payload.direction === 'forward' ? 1 : -1)));
      await obsClient.call('SetSceneItemIndex', { sceneName, sceneItemId: item.id, sceneItemIndex: nextIndex });
      addLog('info', 'OBS', `Порядок слоя «${item.name}» изменён.`);
    } else if (payload.action === 'duplicate') {
      await obsClient.call('DuplicateSceneItem', { sceneName, sceneItemId: item.id, destinationSceneName: sceneName });
      addLog('info', 'OBS', `Источник «${item.name}» продублирован.`);
    } else if (payload.action === 'savePreset') {
      const name = String(payload.presetName || '').trim().slice(0, 40);
      if (!name) throw new Error('Введите название пресета.');
      const preset = { id: `preset-${Date.now()}`, name, transform: editableObsTransform(item.transform) };
      settings.scenePresets = [preset, ...(settings.scenePresets || []).filter(existing => existing.name.toLowerCase() !== name.toLowerCase())].slice(0, 12);
      await saveSettings();
      addLog('info', 'OBS', `Сохранён пресет расположения «${name}».`);
    } else if (payload.action === 'applyPreset') {
      const preset = (settings.scenePresets || []).find(existing => existing.id === payload.presetName);
      if (!preset) throw new Error('Пресет больше не существует.');
      obsUndoStack.push({ sceneName, sceneItemId: item.id, transform: editableObsTransform(item.transform) });
      await obsClient.call('SetSceneItemTransform', { sceneName, sceneItemId: item.id, sceneItemTransform: preset.transform });
      addLog('info', 'OBS', `Применён пресет «${preset.name}».`);
    } else if (payload.action === 'undo') {
      const undoIndex = obsUndoStack.map(entry => entry.sceneName === sceneName && entry.sceneItemId === item.id).lastIndexOf(true);
      if (undoIndex < 0) throw new Error('Для этого источника пока нет действия для отмены.');
      const [undo] = obsUndoStack.splice(undoIndex, 1);
      await obsClient.call('SetSceneItemTransform', { sceneName, sceneItemId: item.id, sceneItemTransform: undo.transform });
      addLog('info', 'OBS', `Последнее перемещение «${item.name}» отменено.`);
    } else if (payload.action === 'remove') {
      const confirmation = await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Удалить источник из сцены?', message: `Источник «${item.name}» будет удалён только из сцены «${sceneName}».`, detail: 'Другие источники и сцены не изменятся.', buttons: ['Отмена', 'Удалить'], defaultId: 0, cancelId: 0 });
      if (confirmation.response !== 1) return getSnapshot();
      await obsClient.call('RemoveSceneItem', { sceneName, sceneItemId: item.id });
      addLog('warning', 'OBS', `Источник «${item.name}» удалён из сцены «${sceneName}».`);
    } else throw new Error('Неизвестное действие OBS.');
  }
  await refreshObsState();
  return getSnapshot();
}

function scheduleObsReconnect() {
  if (!obsReconnect.desired || obsReconnect.timer) return;
  const delays = [1000, 2000, 5000, 10000, 30000];
  const delay = delays[Math.min(obsReconnect.attempt, delays.length - 1)];
  obsReconnect.attempt += 1;
  obsReconnect.nextAttemptAt = new Date(Date.now() + delay).toISOString();
  obsState = { ...obsState, connected: false, mode: 'reconnecting', managementEnabled: false, scenes: [], currentProgramSceneName: null, video: null, reconnectAttempt: obsReconnect.attempt, nextReconnectAt: obsReconnect.nextAttemptAt, error: 'Соединение потеряно. Переподключаемся автоматически.' };
  mainWindow?.webContents.send('workspace-changed');
  obsReconnect.timer = setTimeout(() => {
    obsReconnect.timer = null;
    connectObs({ url: obsReconnect.url, password: obsReconnect.password }, { reconnect: true }).catch(() => {});
  }, delay);
}

async function connectObs({ url, password }, options = {}) {
  const endpoint = String(url || 'ws://127.0.0.1:4455').trim();
  if (!/^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(endpoint)) throw new Error('Разрешено только локальное подключение OBS: ws://127.0.0.1:4455');
  if (!options.reconnect) {
    clearTimeout(obsReconnect.timer); obsReconnect.timer = null;
    obsReconnect = { desired: true, url: endpoint, password: password || undefined, attempt: 0, timer: null, nextAttemptAt: null };
  }
  if (obsClient) { const previous = obsClient; obsClient = null; try { await previous.disconnect(); } catch {} }
  const client = new OBSWebSocket();
  try {
    await client.connect(endpoint, password || undefined);
    obsClient = client;
    obsReconnect.attempt = 0; obsReconnect.nextAttemptAt = null;
    obsState = { ...obsState, connected: true, mode: 'read-only', managementEnabled: false, url: endpoint, reconnectAttempt: 0, nextReconnectAt: null, error: null };
    client.on('ConnectionClosed', () => { if (client !== obsClient) return; obsClient = null; addLog('warning', 'OBS', 'Соединение потеряно. Запланировано автоматическое переподключение.'); scheduleObsReconnect(); });
    client.on('CurrentProgramSceneChanged', event => { obsState = { ...obsState, currentProgramSceneName: event.sceneName }; });
    for (const eventName of ['SceneItemCreated', 'SceneItemRemoved', 'SceneItemEnableStateChanged']) client.on(eventName, () => refreshObsState().catch(() => {}));
    await refreshObsState();
    addLog('info', 'OBS', `Подключено в режиме чтения: ${endpoint}`);
  } catch (error) {
    if (obsClient === client) obsClient = null;
    obsState = { ...obsState, connected: false, mode: options.reconnect ? 'reconnecting' : 'error', managementEnabled: false, url: endpoint, scenes: [], currentProgramSceneName: null, video: null, error: error.message };
    addLog('error', 'OBS', `Не удалось подключиться: ${error.message}`);
    if (options.reconnect) scheduleObsReconnect();
    throw new Error(`OBS не подключён: ${error.message}`);
  }
}

async function disconnectObs() {
  obsReconnect.desired = false; clearTimeout(obsReconnect.timer); obsReconnect.timer = null; obsReconnect.nextAttemptAt = null; obsReconnect.password = null; obsReconnect.url = null; obsReconnect.attempt = 0;
  if (obsClient) { const previous = obsClient; obsClient = null; try { await previous.disconnect(); } catch {} }
  obsClient = null;
  obsState = { ...obsState, connected: false, mode: 'not-configured', managementEnabled: false, scenes: [], currentProgramSceneName: null, video: null, reconnectAttempt: 0, nextReconnectAt: null, error: null };
  addLog('info', 'OBS', 'Отключено пользователем');
}

ipcMain.handle('snapshot', getSnapshot);
ipcMain.handle('run-profile', async (_, id) => {
  const widgetIds = (activeConfig.profiles[id] || []).filter(widgetId => !widgetsById.get(widgetId)?.disabled);
  const dependencies = new Set(widgetIds.flatMap(widgetId => widgetsById.get(widgetId)?.dependencies || []));
  for (const serviceId of dependencies) await startService(serviceId);
  addLog('info', 'Профиль', `Запущен профиль: ${id}`);
  return getSnapshot();
});
ipcMain.handle('service-action', async (_, { id, action }) => { action === 'start' ? await startService(id) : stopService(id); return getSnapshot(); });
ipcMain.handle('run-checks', async () => {
  for (const service of activeConfig.services) if (!commandExists(service)) addLog('error', 'Проверка', `Не найден файл: ${service.command}`);
  addLog('info', 'Проверка', 'Проверка конфигурации и доступности компонентов завершена');
  return getSnapshot();
});
ipcMain.handle('obs-connect', async (_, settings) => { await connectObs(settings || {}); return getSnapshot(); });
ipcMain.handle('obs-disconnect', async () => { await disconnectObs(); return getSnapshot(); });
ipcMain.handle('obs-enable-management', async () => {
  if (!obsClient || !obsState.connected) throw new Error('Сначала подключите OBS WebSocket.');
  obsState = { ...obsState, managementEnabled: true, mode: 'managed' };
  addLog('warning', 'OBS', 'Режим управления источниками включён на текущую сессию.');
  return getSnapshot();
});
ipcMain.handle('obs-widget-action', (_, payload) => obsWidgetAction(payload || {}));
ipcMain.handle('obs-scene-preview', async (_, value) => {
  if (!obsClient || !obsState.connected) throw new Error('Сначала подключите OBS WebSocket.');
  const sceneName = String(value || '');
  getScene(sceneName);
  const result = await obsClient.call('GetSourceScreenshot', { sourceName: sceneName, imageFormat: 'jpg', imageWidth: 960, imageHeight: 540, imageCompressionQuality: 72 });
  if (!String(result.imageData || '').startsWith('data:image/')) throw new Error('OBS вернул некорректное изображение сцены.');
  return { sceneName, imageData: result.imageData, receivedAt: Date.now() };
});
ipcMain.handle('choose-workspace', async () => {
  const result = await dialog.showOpenDialog({ title: 'Подключить рабочее пространство или старую папку виджетов', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return getSnapshot();
  const selected = result.filePaths[0];
  const inspected = inspectWorkspaceSync(selected);
  if (!inspected || inspected.mode === 'invalid') throw new Error(inspected?.error || `В выбранной папке нет ${MANIFEST_NAME} или legacy-конфигурации.`);
  if (!await prepareWorkspaceSwitch(selected)) return getSnapshot();
  if (inspected.mode === 'workspace' && inspected.manifest.services.length && !(settings.trustedServiceWorkspaces || []).includes(inspected.root)) {
    const permission = await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Разрешить запуск фоновых сервисов?', message: `Пространство «${inspected.manifest.name}» содержит ${inspected.manifest.services.length} фоновых сервисов.`, detail: 'Сервисы могут запускать локальные команды. Разрешайте это только для папки, содержимому которой доверяете. Виджеты и OBS можно использовать без этого разрешения.', buttons: ['Подключить без запуска сервисов', 'Доверять и разрешить'], defaultId: 0, cancelId: 0 });
    if (permission.response === 1) settings.trustedServiceWorkspaces = [...new Set([...(settings.trustedServiceWorkspaces || []), inspected.root])];
  }
  activateWorkspace(selected);
  await saveSettings();
  addLog('info', 'Рабочее пространство', `Подключено: ${selected}`);
  return getSnapshot();
});
ipcMain.handle('create-workspace', async (_, options = {}) => {
  let selected;
  if (options.useDefault) selected = path.join(app.getPath('documents'), 'OBS Control Center', 'Workspace');
  else {
    const result = await dialog.showOpenDialog({ title: 'Выберите папку для рабочего пространства', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return getSnapshot();
    selected = result.filePaths[0];
  }
  if (!await prepareWorkspaceSwitch(selected)) return getSnapshot();
  const existing = inspectWorkspaceSync(selected);
  if (existing?.mode === 'invalid') throw new Error(`Рабочее пространство повреждено: ${existing.error}`);
  if (!existing && fs.existsSync(selected) && (await fsp.readdir(selected)).length) {
    const confirmation = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Создать рабочее пространство здесь?', message: 'Выбранная папка уже содержит файлы.', detail: `Control Center добавит только ${MANIFEST_NAME} и служебные каталоги. Существующие файлы не будут удалены или перемещены.`, buttons: ['Выбрать другую папку', 'Создать здесь'], defaultId: 0, cancelId: 0 });
    if (confirmation.response !== 1) return getSnapshot();
  }
  if (existing) activateWorkspace(selected);
  else { await createWorkspace(selected, options.name || 'Мои OBS-виджеты'); activateWorkspace(selected); }
  await saveSettings();
  addLog('info', 'Рабочее пространство', `Создано: ${selected}`);
  return getSnapshot();
});
ipcMain.handle('skip-workspace', async () => {
  if (workspaceRoot && !await prepareWorkspaceSwitch(path.join(workspaceRoot, '__none__'))) return getSnapshot();
  clearWorkspace();
  settings.workspaceSkipped = true;
  await saveSettings();
  addLog('info', 'Рабочее пространство', 'Пользователь продолжил без папки виджетов.');
  return getSnapshot();
});
ipcMain.handle('open-recent-workspace', async (_, value) => {
  const selected = path.resolve(String(value || ''));
  if (!(settings.recentWorkspaces || []).some(item => path.resolve(item.path) === selected)) throw new Error('Эта папка отсутствует в списке недавних.');
  if (!await prepareWorkspaceSwitch(selected)) return getSnapshot();
  activateWorkspace(selected);
  await saveSettings();
  addLog('info', 'Рабочее пространство', `Открыто: ${selected}`);
  return getSnapshot();
});
ipcMain.handle('import-widget-folder', async () => {
  if (!workspaceRoot || workspaceState.mode !== 'workspace') throw new Error('Сначала создайте или обновите рабочее пространство.');
  const result = await dialog.showOpenDialog({ title: 'Выберите папку виджета', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return getSnapshot();
  const imported = await importWidgetFolder(workspaceRoot, result.filePaths[0]);
  activateWorkspace(imported.workspace.root); await saveSettings();
  addLog('info', 'Библиотека', `Импортирован виджет «${imported.widget.name}».`);
  return getSnapshot();
});
ipcMain.handle('import-widget-zip', async () => {
  if (!workspaceRoot || workspaceState.mode !== 'workspace') throw new Error('Сначала создайте или обновите рабочее пространство.');
  const result = await dialog.showOpenDialog({ title: 'Выберите ZIP-архив виджета', properties: ['openFile'], filters: [{ name: 'Архив виджета', extensions: ['zip'] }] });
  if (result.canceled || !result.filePaths[0]) return getSnapshot();
  const imported = await importWidgetZip(workspaceRoot, result.filePaths[0]);
  activateWorkspace(imported.workspace.root); await saveSettings();
  addLog('info', 'Библиотека', `Импортирован виджет «${imported.widget.name}» из ZIP.`);
  return getSnapshot();
});
ipcMain.handle('update-widget', async (_, payload = {}) => {
  if (!workspaceRoot) throw new Error('Рабочее пространство не выбрано.');
  const result = await updateWidget(workspaceRoot, String(payload.id || ''), payload.changes || {});
  activateWorkspace(result.workspace.root); await saveSettings();
  addLog('info', 'Библиотека', `Настройки виджета «${result.widget.name}» обновлены.`);
  return getSnapshot();
});
ipcMain.handle('remove-widget', async (_, value) => {
  if (!workspaceRoot) throw new Error('Рабочее пространство не выбрано.');
  const widget = widgetsById.get(String(value || ''));
  if (!widget) throw new Error('Виджет не найден.');
  const confirmation = await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Убрать виджет из библиотеки?', message: `«${widget.name}» будет перемещён в резервные копии.`, detail: 'Виджет можно будет восстановить вручную из папки backups. Источники в OBS не удаляются.', buttons: ['Отмена', 'Переместить в резервные копии'], defaultId: 0, cancelId: 0 });
  if (confirmation.response !== 1) return getSnapshot();
  const result = await removeWidget(workspaceRoot, widget.id);
  telemetry.delete(widget.id); telemetryStore.clear(`${workspaceRoot}::${widget.id}`); activateWorkspace(result.workspace.root); await saveSettings();
  addLog('warning', 'Библиотека', `Виджет «${widget.name}» перемещён в резервные копии.`);
  return getSnapshot();
});
ipcMain.handle('restore-workspace-backup', async (_, value) => {
  if (!workspaceRoot || workspaceState.mode !== 'workspace') throw new Error('Рабочее пространство не поддерживает восстановление.');
  const backup = (await listWorkspaceBackups(workspaceRoot)).find(item => item.id === String(value || ''));
  if (!backup) throw new Error('Резервная копия не найдена.');
  const confirmation = await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Восстановить рабочее пространство?', message: `Будет восстановлено состояние на ${new Date(backup.createdAt).toLocaleString('ru-RU')}.`, detail: 'Перед восстановлением текущее состояние также будет сохранено. OBS-сцены не изменяются.', buttons: ['Отмена', 'Восстановить'], defaultId: 0, cancelId: 0 });
  if (confirmation.response !== 1) return getSnapshot();
  const restored = await restoreWorkspaceBackup(workspaceRoot, backup.id);
  activateWorkspace(restored.root); await saveSettings();
  addLog('warning', 'Рабочее пространство', `Восстановлена резервная копия ${backup.id}.`);
  return getSnapshot();
});
ipcMain.handle('migrate-workspace', async () => {
  if (!workspaceRoot || workspaceState.mode !== 'legacy') throw new Error('Миграция для этой папки не требуется.');
  const confirmation = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Обновить структуру рабочего пространства?', message: 'Control Center добавит новый манифест и служебные папки.', detail: 'Файлы виджетов останутся на месте. Перед изменением widgets.config.json будет скопирован в backups.', buttons: ['Отмена', 'Создать резервную копию и обновить'], defaultId: 0, cancelId: 0 });
  if (confirmation.response !== 1) return getSnapshot();
  const result = await migrateLegacyWorkspace(workspaceRoot, config);
  activateWorkspace(result.root);
  settings.trustedServiceWorkspaces = [...new Set([...(settings.trustedServiceWorkspaces || []), result.root])];
  await saveSettings();
  addLog('info', 'Рабочее пространство', `Legacy-структура обновлена. Резервная копия: ${result.backupDir}`);
  return getSnapshot();
});
ipcMain.handle('create-starter-widget', async () => {
  if (!workspaceRoot || workspaceState.mode !== 'workspace') throw new Error('Сначала создайте новое рабочее пространство.');
  const result = await createStarterWidget(workspaceRoot);
  activateWorkspace(result.workspace.root);
  await saveSettings();
  addLog('info', 'Библиотека', `Создан стартовый виджет «${result.widget.name}».`);
  return getSnapshot();
});
ipcMain.handle('open-workspace', async () => {
  if (!workspaceRoot) throw new Error('Рабочее пространство не выбрано.');
  const error = await shell.openPath(workspaceRoot);
  if (error) throw new Error(error);
});
ipcMain.handle('complete-onboarding', async () => {
  settings.onboardingComplete = true;
  await saveSettings();
  return getSnapshot();
});
ipcMain.handle('reset-onboarding', async () => {
  settings.onboardingComplete = false;
  await saveSettings();
  return getSnapshot();
});
ipcMain.handle('diagnostic-report', createDiagnosticReport);
ipcMain.handle('open-url', (_, value) => {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Разрешены только безопасные HTTP-ссылки.');
  return shell.openExternal(url.toString());
});
ipcMain.handle('renderer-error', (_, value = {}) => {
  const message = String(value.message || 'Неизвестная ошибка интерфейса').slice(0, 500);
  addLog('error', 'Интерфейс', message);
});
ipcMain.handle('set-ui-scale', async (_, value) => {
  const scale = Number(value);
  if (![.9,1,1.1,1.25].includes(scale)) throw new Error('Недопустимый масштаб интерфейса.');
  settings.uiScale = scale; await saveSettings(); mainWindow?.webContents.setZoomFactor(scale); return getSnapshot();
});
ipcMain.handle('dismiss-recovery', async () => { previousSessionCrashed = false; return getSnapshot(); });
ipcMain.handle('check-for-updates', async () => { if (!app.isPackaged) { updateState = { status: 'development', version: app.getVersion(), percent: 0, error: null }; return updateState; } updateState = { status: 'checking', version: null, percent: 0, error: null }; await autoUpdater.checkForUpdates(); return updateState; });
ipcMain.handle('download-update', async () => { if (updateState.status !== 'available') throw new Error('Обновление пока недоступно.'); await autoUpdater.downloadUpdate(); return updateState; });
ipcMain.handle('install-update', () => { if (updateState.status !== 'downloaded') throw new Error('Обновление ещё не загружено.'); autoUpdater.quitAndInstall(false, true); });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#070a12',
    icon: path.join(controlRoot, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#090d16', symbolColor: '#8e9bb0', height: 38 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, target) => { if (!target.startsWith('file:')) event.preventDefault(); });
  mainWindow.webContents.once('did-finish-load', () => mainWindow.webContents.setZoomFactor(settings.uiScale || 1));
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

autoUpdater.autoDownload = false;
autoUpdater.on('update-available', info => { updateState = { status: 'available', version: info.version, percent: 0, error: null }; mainWindow?.webContents.send('update-changed'); });
autoUpdater.on('update-not-available', () => { updateState = { status: 'current', version: app.getVersion(), percent: 0, error: null }; mainWindow?.webContents.send('update-changed'); });
autoUpdater.on('download-progress', progress => { updateState = { ...updateState, status: 'downloading', percent: Math.round(progress.percent) }; mainWindow?.webContents.send('update-changed'); });
autoUpdater.on('update-downloaded', info => { updateState = { status: 'downloaded', version: info.version, percent: 100, error: null }; mainWindow?.webContents.send('update-changed'); });
autoUpdater.on('error', error => { updateState = { status: 'error', version: null, percent: 0, error: error.message }; addLog('warning', 'Обновления', error.message); mainWindow?.webContents.send('update-changed'); });
process.on('unhandledRejection', error => addLog('error', 'Приложение', `Необработанная ошибка: ${error?.message || error}`));
process.on('uncaughtExceptionMonitor', error => addLog('error', 'Приложение', `Критическая ошибка: ${error?.message || error}`));
app.whenReady().then(async () => { session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false)); await initializeStorage(); await detectRuntimes(); startWidgetServer(); createWindow(); if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000); });
app.on('before-quit', () => { obsReconnect.desired = false; clearTimeout(obsReconnect.timer); obsReconnect.password = null; for (const id of serviceRecoveries.keys()) cancelServiceRecovery(id, true); try { if (settingsFile) { settings.lastCleanExit = true; fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8'); } } catch {} });
app.on('window-all-closed', () => { for (const id of processes.keys()) stopService(id); if (process.platform !== 'darwin') app.quit(); });
