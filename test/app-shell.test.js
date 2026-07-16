const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(appRoot, file), 'utf8');

test('desktop shell includes the branded window and packaged icon', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  const stylesheet = read('src/renderer/style.css');
  const manifest = JSON.parse(read('package.json'));

  assert.match(main, /requestSingleInstanceLock\(\)/);
  assert.match(main, /titleBarStyle: 'hidden'/);
  assert.match(renderer, /windowTitlebar\(\)/);
  assert.match(stylesheet, /Manrope Variable/);
  assert.ok(fs.existsSync(path.join(appRoot, 'assets', 'icon.png')));
  assert.ok(fs.existsSync(path.join(appRoot, 'assets', 'icon.ico')));
  assert.equal(manifest.build.win.icon, 'assets/icon.ico');
});

test('scenes stay hidden until a real OBS connection exists', () => {
  const renderer = read('src/renderer/app.js');
  const scenesFunction = renderer.slice(renderer.indexOf('function scenesPage()'), renderer.indexOf('function sceneCanvasItem'));
  const scenesGuard = scenesFunction.indexOf("if (!snapshot.obs.connected) return emptyConnection('Сцены появятся после подключения OBS'");
  const scenesRender = scenesFunction.indexOf('const scenes = snapshot.obs.scenes');

  assert.ok(scenesGuard >= 0, 'Disconnected OBS guard is required');
  assert.ok(scenesRender > scenesGuard, 'Scene data must only render after the connection guard');
  assert.doesNotMatch(renderer, /mockScenes|fakeScenes|demoScenes/);
});

test('production UI has onboarding, help and safe diagnostic reporting', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');

  assert.match(renderer, /function helpPage\(\)/);
  assert.match(renderer, /data-onboarding-complete/);
  assert.match(renderer, /data-reset-onboarding/);
  assert.match(main, /ipcMain\.handle\('reset-onboarding'/);
  assert.match(renderer, /data-diagnostic-report/);
  assert.match(main, /пароли и секреты не включены/);
  const report = main.slice(main.indexOf('async function createDiagnosticReport()'), main.indexOf('async function refreshObsState()'));
  assert.match(report, /Версия приложения/);
  assert.match(report, /Система:/);
  assert.match(report, /\[Домашняя папка\]/);
  assert.match(report, /Перед отправкой: просмотрите текст/);
  assert.doesNotMatch(report, /snapshot\.workspace\.path/);
  assert.equal(JSON.parse(read('package.json')).version, '0.13.3');
});

test('contextual documentation links use the dedicated safe IPC channel', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/app.js');

  assert.match(main, /require\('\.\/help-routes'\)/);
  assert.match(main, /ipcMain\.handle\('open-help'/);
  assert.match(preload, /openHelp: key => ipcRenderer\.invoke\('open-help', key\)/);
  assert.match(renderer, /data-help="\$\{sectionHelpKey\(route\.section\)\}"/);
  assert.match(renderer, /window\.controlCenter\.openHelp\(button\.dataset\.help\)/);
  assert.match(renderer, /data-help="\$\{\['firstRun', 'workspace', 'obs', 'firstRun'\]/);
});

test('product manifest matches the package and exposes only a verifiable release', () => {
  const manifest = JSON.parse(read('product-manifest.json'));
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.repository, 'https://github.com/nimalekyt-bit/obs-control-center');
  assert.equal(typeof manifest.release.published, 'boolean');
  if (manifest.release.published) {
    assert.equal(manifest.release.tag, `v${packageJson.version}`);
    assert.equal(manifest.release.assetName, `OBS-Control-Center-Setup-${packageJson.version}.exe`);
    assert.equal(manifest.release.pageUrl, `${manifest.repository}/releases/tag/v${packageJson.version}`);
    assert.equal(manifest.release.downloadUrl, `${manifest.repository}/releases/download/v${packageJson.version}/${manifest.release.assetName}`);
    assert.match(manifest.release.sha256, /^[a-f0-9]{64}$/);
    assert.ok(manifest.release.size > 0);
  } else {
    for (const key of ['tag', 'assetName', 'pageUrl', 'downloadUrl', 'size', 'sha256', 'publishedAt']) assert.equal(manifest.release[key], null);
  }
  assert.equal(manifest.release.signature, 'unsigned');
  assert.ok(manifest.release.summary);
  assert.ok(manifest.release.changes.length > 0);
  assert.match(manifest.docs.obs, /^\/docs\//);
});

test('OBS management is session-scoped and only touches OCC sources', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');

  assert.match(main, /managementEnabled: false/);
  assert.match(main, /startsWith\('OCC • '\)/);
  assert.match(main, /obsClient\.call\('CreateInput'/);
  assert.match(main, /obsClient\.call\('SetSceneItemTransform'/);
  assert.match(main, /obsClient\.call\('SetSceneItemEnabled'/);
  assert.match(main, /showMessageBox/);
  assert.match(main, /obsClient\.call\('RemoveSceneItem'/);
  assert.match(preload, /enableObsManagement/);
  assert.match(preload, /obsWidgetAction/);
});

test('scene monitoring uses real OBS screenshots and exposes no product mocks', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /obsClient\.call\('GetSourceScreenshot'/);
  assert.match(main, /ipcMain\.handle\('obs-scene-preview'/);
  assert.match(preload, /obsScenePreview/);
  assert.match(renderer, /scene-live-preview/);
  assert.match(renderer, /followProgramScene/);
  assert.doesNotMatch(renderer, /mockPreview|demoPreview|fakePreview/);
});

test('OBS editor supports precise transforms, layers, duplication and undo for managed items', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /SetSceneItemIndex/);
  assert.match(main, /DuplicateSceneItem/);
  assert.match(main, /payload\.action === 'transform'/);
  assert.match(main, /obsUndoStack/);
  assert.match(renderer, /data-scene-transform-form/);
  assert.match(renderer, /Обрезка источника/);
  assert.match(renderer, /function bindSceneDragging/);
  assert.match(main, /payload\.action === 'scene-visibility'/);
  assert.match(main, /entry\.type === 'scene-visibility'/);
  assert.match(renderer, /data-obs-scene-action/);
});

test('first run supports an empty workspace or no workspace at all', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /ipcMain\.handle\('create-workspace'/);
  assert.match(main, /ipcMain\.handle\('skip-workspace'/);
  assert.match(main, /ipcMain\.handle\('migrate-workspace'/);
  assert.match(preload, /createWorkspace/);
  assert.match(preload, /skipWorkspace/);
  assert.match(renderer, /data-workspace-create/);
  assert.match(renderer, /data-workspace-skip/);
  assert.doesNotMatch(main, /candidate.*'music'.*widgets\.config\.json/);
});

test('widget library supports persistent favorites, sorting and safe bulk actions', () => {
  const workspace = read('src/workspace.js');
  const renderer = read('src/renderer/app.js');
  assert.match(workspace, /favorite: Boolean\(widget\.favorite\)/);
  assert.match(workspace, /favorite: changes\.favorite/);
  assert.match(renderer, /data-widget-bulk/);
  assert.match(renderer, /data-widget-sort/);
  assert.match(renderer, /data-widget-select/);
  assert.match(renderer, /window\.controlCenter\.updateWidget/);
});

test('diagnostic checks expose a timestamp and actionable reason', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /checkedAt/);
  assert.match(main, /reason:/);
  assert.match(renderer, /check\.reason/);
  assert.match(renderer, /check\.checkedAt/);
});

test('workspace manager exposes safe widget lifecycle actions', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/app.js');
  for (const channel of ['import-widget-folder','import-widget-zip','update-widget','remove-widget','restore-workspace-backup','open-recent-workspace']) assert.match(main, new RegExp(`ipcMain\\.handle\\('${channel}'`));
  assert.match(preload, /importWidgetFolder/);
  assert.match(preload, /restoreWorkspaceBackup/);
  assert.match(renderer, /data-widget-settings/);
  assert.match(renderer, /data-import-widget-zip/);
});

test('desktop shell blocks untrusted navigation, permissions and oversized telemetry', () => {
  const main = read('src/main.js');
  const html = read('src/renderer/index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /64 \* 1024/);
  assert.match(main, /renderer-error/);
});

test('external links use an explicit allow-list', () => {
  const { isAllowedExternalUrl } = require('../src/url-policy');
  const local = { localPort: 3210 };
  assert.equal(isAllowedExternalUrl('http://127.0.0.1:3210/tools/av-sync', local), true);
  assert.equal(isAllowedExternalUrl('https://github.com/nimalekyt-bit/obs-control-center/issues', local), true);
  assert.equal(isAllowedExternalUrl('https://obs-control-center.pages.dev/docs/', local), true);
  assert.equal(isAllowedExternalUrl('https://t.me/woodskilla', local), true);
  assert.equal(isAllowedExternalUrl('https://example.com', local), false);
  assert.equal(isAllowedExternalUrl('https://github.com.evil.example/nimalekyt-bit/obs-control-center', local), false);
  assert.equal(isAllowedExternalUrl('https://nimalekyt-bit@github.com/nimalekyt-bit/obs-control-center', local), false);
  assert.equal(isAllowedExternalUrl('http://127.0.0.1:9999/tools/av-sync', local), false);
  assert.equal(isAllowedExternalUrl('file:///C:/Windows/System32/calc.exe', local), false);
});

test('diagnostics persist real telemetry and detect service runtimes', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /new TelemetryStore/);
  assert.match(main, /detectRuntimes/);
  assert.match(main, /requiredRuntime/);
  assert.match(renderer, /function telemetryHistory/);
  assert.match(renderer, /function runtimePanel/);
  assert.match(renderer, /data-diagnostic-help/);
  assert.match(renderer, /dataset\.help = 'telemetry'/);
});

test('reliability layer detects unclean exits and supports interface scaling', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  const html = read('src/renderer/index.html');
  assert.match(main, /lastCleanExit/);
  assert.match(main, /set-ui-scale/);
  assert.match(renderer, /function recoveryBanner/);
  assert.match(renderer, /data-ui-scale/);
  assert.match(html, /accessibility\.css/);
});

test('packaged releases support explicit update checks and safe restart installation', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /autoUpdater\.autoDownload = false/);
  assert.match(main, /ipcMain\.handle\('check-for-updates'/);
  assert.match(main, /ipcMain\.handle\('download-update'/);
  assert.match(main, /quitAndInstall/);
  assert.match(preload, /onUpdateChanged/);
  assert.match(renderer, /function updatePanel/);
  assert.match(renderer, /data-install-update/);
});

test('runtime failures expose a recoverable workspace alert and crashed service state', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  const html = read('src/renderer/index.html');
  assert.match(main, /workspaceInspection/);
  assert.match(main, /workspaceIssue/);
  assert.match(main, /stopRequested/);
  assert.match(main, /crashed \? 'crashed'/);
  assert.match(renderer, /function workspaceAvailabilityBanner/);
  assert.match(renderer, /Завершился с ошибкой/);
  assert.match(html, /resilience\.css/);
});

test('connection resilience reports server exhaustion and reconnects OBS only in memory', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /widgetServerState/);
  assert.match(main, /attemptedPorts/);
  assert.match(main, /scheduleObsReconnect/);
  assert.match(main, /nextReconnectAt/);
  assert.match(main, /obsReconnect\.password/);
  assert.match(renderer, /function serverAvailabilityBanner/);
  assert.match(renderer, /obs-reconnecting/);
});

test('service recovery is bounded, cancellable and visible to the user', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /scheduleServiceRestart/);
  assert.match(main, /cancelServiceRecovery/);
  assert.match(main, /restartDecision/);
  assert.match(main, /autoRestart === false/);
  assert.match(renderer, /restart-blocked/);
  assert.match(renderer, /service-recovery-note/);
});
