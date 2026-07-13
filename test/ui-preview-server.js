const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const widgets = JSON.parse(fs.readFileSync(path.join(root, 'config', 'widgets.json'), 'utf8')).widgets.map((widget, index) => ({
  ...widget,
  url: `http://127.0.0.1:4173/empty-widget.html`,
  state: index === 1 || index === 2 ? 'warning' : 'ready',
  health: (widget.health || []).map((rule, ruleIndex) => ({ ...rule, ok: !(index === 1 || index === 2) || ruleIndex > 0 })),
  telemetry: index === 0 ? { fps: 59, longFrames: 1, receivedAt: Date.now(), errors: [] } : null,
  history: index === 0 ? { samples: 4, averageFps: 58.5, minFps: 56, p95FrameDelay: 9, longFrames: 2, points: [56,59,60,59].map((fps, point) => ({ at: Date.now() - (3-point)*2000, fps, longFrames: point === 0 ? 1 : 0 })) } : { samples: 0, points: [], averageFps: null, minFps: null, p95FrameDelay: null, longFrames: 0 },
  data: index === 0 ? { title: 'On and on (When the Lights Go Down)', artist: 'Akcent', status: 'playing' } : null
}));

let snapshot = {
  appInfo: { version: '0.13.0', platform: 'win32', arch: 'x64' },
  serverPort: 3210,
  server: { status: 'ready', port: 3210, error: null, attemptedPorts: [3210] },
  workspace: { ready: true, path: 'E:\\obsvidget', mode: 'legacy', name: 'Существующие виджеты', skipped: false },
  onboarding: { complete: true },
  preferences: { uiScale: 1 },
  recovery: { previousSessionCrashed: false },
  update: { status: 'current', version: '0.13.0', percent: 0, error: null },
  obs: { connected: false, mode: 'not-configured', url: 'ws://127.0.0.1:4455', scenes: [], currentProgramSceneName: null, version: null, error: null },
  widgets,
  services: [
    { id: 'music-scrobbler', name: 'Музыкальный скробблер', state: 'external', externallyRunning: true, runningByControlCenter: false },
    { id: 'lyrics-service', name: 'Сервер текстов', state: 'ready', runningByControlCenter: true },
    { id: 'system-stats', name: 'Системная статистика', state: 'stopped', runningByControlCenter: false },
    { id: 'hotkey-listener', name: 'Горячие клавиши', state: 'stopped', runningByControlCenter: false }
  ],
  runtimes: [{ id: 'node', available: true, version: 'v22.0.0' }, { id: 'python', available: true, version: 'Python 3.12' }, { id: 'dotnet', available: false, version: null }, { id: 'powershell', available: true, version: '5.1' }],
  logs: [
    { at: new Date().toISOString(), level: 'info', source: 'Сервер виджетов', message: 'Доступен на 3210' },
    { at: new Date(Date.now() - 45000).toISOString(), level: 'warning', source: 'Верхняя панель', message: 'Нет свежих данных статистики' }
  ]
};

const connectedObsFixture = {
  connected: true,
  mode: 'read-only',
  managementEnabled: false,
  url: 'ws://127.0.0.1:4455',
  version: '31.0.0',
  currentProgramSceneName: 'Основная сцена',
  video: { baseWidth: 1920, baseHeight: 1080, fps: 60 },
  error: null,
  scenes: [
    { name: 'Основная сцена', index: 0, items: [{ id: 1, index: 0, name: 'Камера', kind: 'dshow_input', enabled: true, managed: false, transform: { positionX: 960, positionY: 540, scaleX: 1, scaleY: 1, rotation: 0 } }, { id: 2, index: 1, name: 'OCC • Музыка • Основная сцена', kind: 'browser_source', enabled: true, managed: true, transform: { positionX: 960, positionY: 540, scaleX: 1, scaleY: 1, rotation: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 } }] },
    { name: 'Разработка', index: 1, items: [{ id: 3, name: 'Захват экрана', kind: 'monitor_capture', enabled: true, managed: false, transform: { positionX: 960, positionY: 540 } }] },
    { name: 'Завершение', index: 2, items: [] }
  ]
};

const previewImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><defs><linearGradient id="g"><stop stop-color="#07101b"/><stop offset="1" stop-color="#16324b"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><circle cx="480" cy="230" r="95" fill="#62d8ff" opacity=".12"/><text x="480" y="250" text-anchor="middle" fill="#eef5ff" font-size="36" font-family="sans-serif">Основная сцена OBS</text><text x="480" y="292" text-anchor="middle" fill="#93a8bd" font-size="18" font-family="sans-serif">Реальный кадр приходит через GetSourceScreenshot</text></svg>')}`;
const apiFor = initial => `<script>window.controlCenter={snapshot:async()=>structuredClone(window.__snapshot),runProfile:async()=>structuredClone(window.__snapshot),runChecks:async()=>structuredClone(window.__snapshot),serviceAction:async()=>structuredClone(window.__snapshot),connectObs:async()=>{window.__snapshot.obs=${JSON.stringify(connectedObsFixture)};return structuredClone(window.__snapshot)},disconnectObs:async()=>structuredClone(window.__snapshot),enableObsManagement:async()=>{window.__snapshot.obs.managementEnabled=true;return structuredClone(window.__snapshot)},obsWidgetAction:async()=>structuredClone(window.__snapshot),obsScenePreview:async sceneName=>({sceneName,imageData:${JSON.stringify(previewImage)},receivedAt:Date.now()}),chooseWorkspace:async()=>structuredClone(window.__snapshot),createWorkspace:async()=>{window.__snapshot.workspace={ready:true,path:'C:\\\\Users\\\\Streamer\\\\Documents\\\\OBS Control Center\\\\Workspace',mode:'workspace',name:'Мои OBS-виджеты',skipped:false,recent:[],backups:[]};window.__snapshot.widgets=[];window.__snapshot.services=[];return structuredClone(window.__snapshot)},skipWorkspace:async()=>{window.__snapshot.workspace={ready:false,path:null,mode:'none',name:null,skipped:true,recent:[],backups:[]};window.__snapshot.widgets=[];window.__snapshot.services=[];return structuredClone(window.__snapshot)},migrateWorkspace:async()=>{window.__snapshot.workspace.mode='workspace';return structuredClone(window.__snapshot)},createStarterWidget:async()=>structuredClone(window.__snapshot),openWorkspace:async()=>{},openRecentWorkspace:async()=>structuredClone(window.__snapshot),importWidgetFolder:async()=>structuredClone(window.__snapshot),importWidgetZip:async()=>structuredClone(window.__snapshot),updateWidget:async()=>structuredClone(window.__snapshot),removeWidget:async()=>structuredClone(window.__snapshot),restoreWorkspaceBackup:async()=>structuredClone(window.__snapshot),setUiScale:async scale=>{window.__snapshot.preferences.uiScale=scale;return structuredClone(window.__snapshot)},dismissRecovery:async()=>{window.__snapshot.recovery.previousSessionCrashed=false;return structuredClone(window.__snapshot)},reportRendererError:async()=>{},onWorkspaceChanged:()=>{},completeOnboarding:async()=>{window.__snapshot.onboarding.complete=true;return structuredClone(window.__snapshot)},resetOnboarding:async()=>{window.__snapshot.onboarding.complete=false;return structuredClone(window.__snapshot)},diagnosticReport:async()=>"test report",openUrl:async()=>{}};window.__snapshot=${JSON.stringify(initial)};</script>`;

http.createServer((req, res) => {
  const requestUrl = new URL(req.url, 'http://127.0.0.1:4173');
  if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
    const initial = structuredClone(snapshot);
    if (requestUrl.searchParams.has('fresh')) { initial.onboarding.complete = false; initial.workspace = { ready: false, path: null, mode: 'none', name: null, skipped: false }; initial.widgets = []; initial.services = []; }
    if (requestUrl.searchParams.has('lost')) { initial.workspace.ready = false; initial.workspace.issue = 'Папка была перемещена, удалена или сейчас недоступна.'; initial.widgets = initial.widgets.map(widget => ({ ...widget, state: 'workspace-missing', telemetry: null })); initial.services = initial.services.map(service => ({ ...service, state: 'workspace-missing', runningByControlCenter: false, externallyRunning: false })); }
    if (requestUrl.searchParams.has('server-error')) { initial.serverPort = null; initial.server = { status: 'error', port: null, error: 'Порты 3210–3220 заняты другими приложениями.', attemptedPorts: Array.from({ length: 11 }, (_, index) => 3210 + index) }; }
    if (requestUrl.searchParams.has('reconnecting')) { initial.obs = { ...initial.obs, connected: false, mode: 'reconnecting', reconnectAttempt: 2, nextReconnectAt: new Date(Date.now() + 2000).toISOString(), error: 'Соединение потеряно. Переподключаемся автоматически.' }; }
    if (requestUrl.searchParams.has('service-restarting')) { initial.services[2] = { ...initial.services[2], state: 'restarting', restartAttempts: 2, nextRestartAt: new Date(Date.now() + 3000).toISOString(), runningByControlCenter: false, externallyRunning: false }; }
    const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8').replace("script-src 'self';", "script-src 'self' 'unsafe-inline';").replace('<script src="app.js"></script>', `${apiFor(initial)}<script src="app.js"></script>`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  if (req.url === '/empty-widget.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><style>body{margin:0;background:linear-gradient(135deg,#060910,#17243a);height:100vh;display:grid;place-items:center;color:#62d8ff;font:24px Segoe UI}</style><span>Widget preview</span>'); return; }
  if (req.url === '/assets/icon.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); fs.createReadStream(path.join(root, 'assets', 'icon.png')).pipe(res); return; }
  if (req.url.startsWith('/node_modules/@fontsource-variable/manrope/')) {
    const fontFile = path.join(root, req.url.replace(/^\//, ''));
    if (!fontFile.startsWith(path.join(root, 'node_modules', '@fontsource-variable', 'manrope')) || !fs.existsSync(fontFile)) { res.writeHead(404).end(); return; }
    const type = fontFile.endsWith('.woff2') ? 'font/woff2' : 'text/css';
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(fontFile).pipe(res); return;
  }
  const file = path.join(root, 'src', 'renderer', req.url.replace(/^\//, ''));
  if (!file.startsWith(path.join(root, 'src', 'renderer')) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const type = file.endsWith('.css') ? 'text/css' : 'text/javascript'; res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); fs.createReadStream(file).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('UI preview: http://127.0.0.1:4173'));
