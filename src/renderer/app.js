const root = document.querySelector('#app');

let snapshot = null;
let route = { section: 'overview', widgetId: null, tab: 'overview' };
let notice = null;
let onboardingStep = 0;
let onboardingObsExpanded = false;
let logFilter = 'all';
let logQuery = '';
let selectedSceneName = null;
let selectedSceneItemId = null;
let scenePreview = null;
let scenePreviewLoading = false;
let sceneOverlayMode = 'occ';
let followProgramScene = true;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const timeAgo = ms => ms == null ? 'нет данных' : ms < 1000 ? 'только что' : ms < 60000 ? `${Math.round(ms / 1000)} сек. назад` : `${Math.round(ms / 60000)} мин. назад`;
const pluralRu = (value, one, few, many) => { const number = Math.abs(Number(value)); const form = number % 10 === 1 && number % 100 !== 11 ? one : [2,3,4].includes(number % 10) && ![12,13,14].includes(number % 100) ? few : many; return `${value} ${form}`; };
const getWidget = id => snapshot.widgets.find(item => item.id === id);
const appIconUrl = window.location.protocol === 'file:' ? '../../assets/icon.png' : '/assets/icon.png';
const appVersion = '0.13.0';

const iconPaths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9 20v-6h6v6"/>',
  scenes: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="m8 21 4-3 4 3"/><path d="M8 9h8M8 13h5"/>',
  widgets: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  obs: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7a5 5 0 1 0 5 5"/><circle cx="12" cy="12" r="1.5"/>',
  pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.1"/><path d="M12 17h.01"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  logs: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v4M12 17h.01"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  back: '<path d="M19 12H5M10 7l-5 5 5 5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.8-1L20 12M4 12l2.1 5a7 7 0 0 0 11.8-1"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  spark: '<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>'
  ,music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M18 10h.01M8 14h8"/>',
  banner: '<path d="M4 6h16v12H4z"/><path d="m8 14 2-2 2 2 3-4 3 4"/>',
  coffee: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  chat: '<path d="M4 5h16v12H8l-4 4z"/><path d="M8 9h8M8 13h5"/>',
  ending: '<circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M8.5 15h7"/>',
  speaker: '<path d="M5 10v4h4l5 4V6l-5 4z"/><path d="M18 9a4 4 0 0 1 0 6M20 6a8 8 0 0 1 0 12"/>',
  shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8.3 7 10 4.2-1.7 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bug: '<path d="M8 9h8v7a4 4 0 0 1-8 0z"/><path d="M12 5v4M9 5l2 2M15 5l-2 2M4 12h4M16 12h4M5 18l3-2M19 18l-3-2"/>',
  book: '<path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2z"/><path d="M20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2z"/>',
  rocket: '<path d="M14 5c2-2 4-2 5-2 0 1 0 3-2 5l-5 5-5-5z"/><path d="m9 10-4 1-2 3 6 1M14 15l-1 6-3-2 1-4"/><circle cx="15" cy="8" r="1"/>'
};

function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.widgets}</svg>`;
}

function statusMeta(state) {
  if (state === 'ready') return { tone: 'success', label: 'Готов' };
  if (state === 'external') return { tone: 'success', label: 'Работает извне' };
  if (state === 'starting') return { tone: 'warning', label: 'Запускается' };
  if (state === 'warning') return { tone: 'warning', label: 'Нужна проверка' };
  if (state === 'runtime-missing') return { tone: 'warning', label: 'Нет компонента' };
  if (state === 'crashed') return { tone: 'danger', label: 'Завершился с ошибкой' };
  if (state === 'workspace-missing') return { tone: 'warning', label: 'Нет рабочей папки' };
  if (state === 'restarting') return { tone: 'warning', label: 'Перезапускается' };
  if (state === 'restart-blocked') return { tone: 'danger', label: 'Перезапуск остановлен' };
  if (state === 'disabled') return { tone: 'muted', label: 'Отключён' };
  return { tone: 'muted', label: 'Не запущен' };
}

function badge(state) {
  const meta = statusMeta(state);
  return `<span class="status status--${meta.tone}"><i></i>${meta.label}</span>`;
}

function navItem(id, label, iconName) {
  const active = route.section === id && !route.widgetId;
  return `<button class="nav-item ${active ? 'is-active' : ''}" data-nav="${id}">${icon(iconName)}<span>${label}</span></button>`;
}

function render() {
  if (!snapshot) return;
  if (!snapshot.onboarding?.complete) {
    root.innerHTML = onboardingWizard();
    bindActions();
    return;
  }

  root.innerHTML = `${windowTitlebar()}<div class="app-frame">
    ${sidebar()}
    <main class="main-area">
      ${topbar()}
      <div class="page-stage">${workspaceAvailabilityBanner()}${serverAvailabilityBanner()}${route.widgetId ? widgetPage(getWidget(route.widgetId)) : page()}</div>
    </main>
    ${notice ? `<div class="toast toast--${notice.tone}">${icon(notice.tone === 'error' ? 'warning' : 'check')}<span>${esc(notice.text)}</span></div>` : ''}
  </div>`;
  bindActions();
}

function onboardingWizard() {
  const steps = ['Знакомство', 'Папка виджетов', 'Подключение OBS', 'Готовность'];
  return `${windowTitlebar()}<div class="welcome-shell"><div class="welcome-aurora"></div><div class="welcome-grid"></div><section class="welcome-window">
    <aside class="welcome-aside"><div class="welcome-brand"><img src="${appIconUrl}" alt=""><div><b>OBS Control Center</b><span>Персональная студия виджетов</span></div></div>
      <div class="welcome-steps">${steps.map((label, index) => `<div class="welcome-step ${index === onboardingStep ? 'is-active' : ''} ${index < onboardingStep ? 'is-done' : ''}"><i>${index < onboardingStep ? icon('check', 13) : index + 1}</i><div><b>${label}</b><span>${['Что умеет приложение','Где находятся файлы','Безопасная интеграция','Последняя проверка'][index]}</span></div></div>`).join('')}</div>
      <div class="welcome-local">${icon('shield')}<div><b>Без аккаунта и облака</b><span>Все данные остаются на этом компьютере.</span></div></div><button class="text-button welcome-help-link" data-help="${['firstRun', 'workspace', 'obs', 'firstRun'][onboardingStep] || 'firstRun'}">Открыть справку первого запуска${icon('external', 14)}</button>
    </aside><main class="welcome-content">${onboardingContent()}</main>
  </section></div>`;
}

function onboardingContent() {
  if (onboardingStep === 0) return `<div class="welcome-copy"><span class="welcome-eyebrow">ДОБРО ПОЖАЛОВАТЬ</span><h1>Ваши виджеты.<br><em>Один центр управления.</em></h1><p>Запускайте сервисы, подключайте Browser Source, следите за FPS и находите проблемы до выхода в эфир.</p><div class="welcome-feature-grid"><article>${icon('widgets')}<b>Библиотека</b><span>Каждый виджет с превью и инструкцией</span></article><article>${icon('pulse')}<b>Диагностика</b><span>Порты, задержки и ошибки в одном месте</span></article><article>${icon('obs')}<b>OBS WebSocket</b><span>Только локальное безопасное чтение</span></article></div></div><div class="welcome-actions"><span>Настройка займёт около двух минут</span><button class="button button--primary button--large" data-onboarding-next>Начать настройку${icon('arrow')}</button></div>`;
  if (onboardingStep === 1) return `<div class="welcome-copy workspace-onboarding"><span class="welcome-eyebrow">ШАГ 2 ИЗ 4 · РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>${snapshot.workspace?.ready ? 'Рабочая папка <em>подключена</em>' : 'Начните с нуля или <em>подключите своё</em>'}</h1><p>${snapshot.workspace?.ready ? 'Control Center проверил структуру и готов работать с ней.' : 'Готовая папка и музыка не обязательны. Можно создать пустую студию, подключить существующие виджеты или настроить всё позже.'}</p>${snapshot.workspace?.ready ? `<div class="workspace-selected">${icon('check',28)}<div><b>${esc(snapshot.workspace.name || 'Рабочее пространство')}</b><span>${esc(snapshot.workspace.path)}</span><small>${snapshot.workspace.mode === 'legacy' ? 'Подключено в режиме совместимости' : `Рабочее пространство · ${snapshot.widgets.length} виджетов`}</small></div><button class="button" data-workspace-select>Изменить</button></div>` : `<div class="workspace-choice-grid"><button data-workspace-create="default"><span class="workspace-choice-icon">${icon('spark',25)}</span><b>Создать автоматически</b><small>Папка в Документах и готовая безопасная структура</small><em>Рекомендуется</em></button><button data-workspace-create="custom"><span class="workspace-choice-icon">${icon('folder',25)}</span><b>Выбрать расположение</b><small>Создать пространство на другом диске или в своей папке</small></button><button data-workspace-select><span class="workspace-choice-icon">${icon('link',25)}</span><b>Подключить существующее</b><small>Выбрать ранее созданную папку виджетов</small></button></div>`}<div class="welcome-note">${icon('shield')}<span><b>Безопасно:</b> существующие файлы не удаляются и не перемещаются. Аккаунт и интернет не требуются.</span></div></div><div class="welcome-actions"><button class="text-button" data-onboarding-back>${icon('back')}Назад</button>${snapshot.workspace?.ready ? `<button class="button button--primary button--large" data-onboarding-next>Продолжить${icon('arrow')}</button>` : `<button class="text-button" data-workspace-skip>Настроить папку позже</button>`}</div>`;
  if (onboardingStep === 2) return `<div class="welcome-copy"><span class="welcome-eyebrow">ШАГ 3 ИЗ 4 · НЕОБЯЗАТЕЛЬНО</span><h1>Свяжем центр с <em>OBS Studio</em></h1><p>Подключение покажет реальные сцены и текущую сцену. Control Center работает в режиме чтения и не меняет источники.</p>${onboardingObsExpanded && !snapshot.obs.connected ? `<form id="obs-connect-form" class="onboarding-obs-form"><label>Адрес WebSocket<input name="url" value="${esc(snapshot.obs.url || 'ws://127.0.0.1:4455')}"></label><label>Пароль<input name="password" type="password" placeholder="Пароль из OBS" autocomplete="new-password"></label><button class="button button--primary" type="submit">${icon('link')}Подключить</button>${snapshot.obs.error ? `<p class="form-error">${icon('warning')}${esc(snapshot.obs.error)}</p>` : ''}</form>` : `<div class="onboarding-obs"><div class="obs-logo">${icon('obs', 30)}</div><div><b>${snapshot.obs.connected ? 'OBS подключён' : 'Можно подключить позже'}</b><span>${snapshot.obs.connected ? `${esc(snapshot.obs.version || 'OBS')} · ${snapshot.obs.scenes.length} сцен` : 'Понадобятся адрес и пароль WebSocket из OBS'}</span></div>${snapshot.obs.connected ? badge('ready') : `<button class="button" data-onboarding-obs>Настроить подключение</button>`}</div>`}<div class="welcome-note">${icon('shield')}<span>Пароль используется только для текущего подключения и не записывается на диск.</span></div></div><div class="welcome-actions"><button class="text-button" data-onboarding-back>${icon('back')}Назад</button><button class="button button--primary button--large" data-onboarding-next>${snapshot.obs.connected ? 'Продолжить' : 'Пропустить пока'}${icon('arrow')}</button></div>`;
  const healthy = snapshot.widgets.filter(item => item.state === 'ready').length;
  return `<div class="welcome-copy"><span class="welcome-eyebrow">ВСЁ ГОТОВО</span><div class="welcome-success">${icon('check', 34)}</div><h1>Центр управления <em>готов к работе</em></h1><p>Основная настройка завершена. Внутри вас встретят подсказки, подробные страницы виджетов и диагностика.</p><div class="welcome-summary"><article><span>Папка</span><b>${snapshot.workspace?.ready ? 'Подключена' : 'Не выбрана'}</b></article><article><span>Виджеты</span><b>${healthy}/${snapshot.widgets.length} готовы</b></article><article><span>OBS</span><b>${snapshot.obs.connected ? 'Подключён' : 'Подключить позже'}</b></article></div></div><div class="welcome-actions"><button class="text-button" data-onboarding-back>${icon('back')}Назад</button><button class="button button--primary button--large" data-onboarding-complete>Открыть центр управления${icon('rocket')}</button></div>`;
}

function windowTitlebar() {
  return `<div class="window-titlebar"><img src="${appIconUrl}" alt="" /><span>OBS Control Center</span><i></i><small>LOCAL WORKSPACE</small></div>`;
}

function sidebar() {
  const obsConnected = snapshot.obs?.connected;
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark brand-mark--image"><img src="${appIconUrl}" alt="" /></div><div><b>OBS Control</b><span>Center</span></div></div>
    <nav class="nav-group">
      <p class="nav-caption">Рабочая область</p>
      ${navItem('overview', 'Обзор', 'home')}${navItem('scenes', 'Сцены', 'scenes')}${navItem('widgets', 'Виджеты', 'widgets')}${navItem('obs', 'Подключение OBS', 'obs')}${navItem('diagnostics', 'Диагностика', 'pulse')}
      <p class="nav-caption nav-caption--spaced">Поддержка</p>
      ${navItem('help', 'Справка', 'help')}${navItem('logs', 'Журнал событий', 'logs')}${navItem('about', 'О приложении', 'about')}
    </nav>
    <div class="sidebar-footer">
      <div class="connection-mini"><i class="${obsConnected ? 'online' : ''}"></i><div><span>OBS WebSocket</span><b>${obsConnected ? 'Подключён' : 'Не подключён'}</b></div></div>
      <div class="server-mini ${snapshot.server?.status === 'error' ? 'has-error' : ''}"><span>Локальный сервер</span><code>${snapshot.serverPort ? `:${snapshot.serverPort}` : 'Ошибка'}</code></div>
    </div>
  </aside>`;
}

const headings = {
  overview: ['Центр управления', 'Всё важное перед эфиром — в одном месте.'],
  scenes: ['Сцены OBS', 'Реальные сцены, источники и безопасное размещение виджетов.'],
  widgets: ['Библиотека виджетов', 'Подключение, тесты и состояние каждого виджета.'],
  obs: ['Подключение OBS', 'Подключение, просмотр и защищённое управление OCC-источниками.'],
  diagnostics: ['Диагностика', 'Порты, процессы, задержки и стабильность.'],
  help: ['Справка', 'Понятные инструкции от первого запуска до эфира.'],
  logs: ['Журнал событий', 'История запусков, ошибок и восстановлений.'],
  about: ['О приложении', 'Назначение, состояние установки, разработчик и поддержка.']
};

function topbar() {
  const [title, subtitle] = headings[route.section] || headings.overview;
  const overallReady = snapshot.workspace?.ready && snapshot.widgets.length > 0 && snapshot.widgets.every(item => item.state === 'ready') && snapshot.services.every(item => ['ready', 'external'].includes(item.state));
  return `<header class="topbar"><div><p class="breadcrumbs">WORKSPACE <span>/</span> ${esc(title).toUpperCase()}</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="topbar-actions">
    <span class="readiness ${overallReady ? 'readiness--ready' : ''}"><i></i>${overallReady ? 'Система готова' : 'Есть замечания'}</span>
    <button class="icon-button" data-action="refresh" title="Обновить данные">${icon('refresh')}</button><button class="button button--context-help" data-help="${sectionHelpKey(route.section)}">${icon('book', 16)}Справка раздела</button>
    ${!snapshot.workspace?.ready ? `<button class="button button--primary" data-workspace-select>${icon('folder')}Подключить папку</button>` : snapshot.services.length ? `<button class="button button--primary" data-profile="stream">${icon('play')}Запустить сервисы</button>` : `<button class="button button--primary" data-nav="widgets">${icon('widgets')}Добавить виджет</button>`}
  </div></header>`;
}

function sectionHelpKey(section) {
  return ({ overview: 'firstRun', scenes: 'scenes', widgets: 'widgets', obs: 'obs', diagnostics: 'telemetry', help: 'firstRun', logs: 'firstRun', about: 'firstRun' })[section] || 'firstRun';
}

function page() {
  if (route.section === 'widgets') return widgetsPage();
  if (route.section === 'scenes') return scenesPage();
  if (route.section === 'obs') return obsPage();
  if (route.section === 'diagnostics') return diagnosticsPage();
  if (route.section === 'help') return helpPage();
  if (route.section === 'logs') return logsPage();
  if (route.section === 'about') return aboutPage();
  return overviewPage();
}

function overviewPage() {
  const readyWidgets = snapshot.widgets.filter(item => item.state === 'ready').length;
  const readyServices = snapshot.services.filter(item => ['ready', 'external'].includes(item.state)).length;
  const activeTelemetry = snapshot.widgets.filter(item => item.telemetry).length;
  const alerts = snapshot.widgets.filter(item => item.state !== 'ready');
  const totalComponents = snapshot.widgets.length + snapshot.services.length;
  const score = totalComponents ? Math.round(((readyWidgets + readyServices) / totalComponents) * 100) : 0;
  const missingServices = snapshot.services.length - readyServices;
  const next = !snapshot.workspace?.ready ? { icon: 'folder', title: 'Создайте рабочее пространство', text: 'Пустая папка подойдёт — готовые виджеты не требуются', action: 'widgets', label: 'Настроить пространство' } : snapshot.widgets.length === 0 ? { icon: 'widgets', title: 'Добавьте первый виджет', text: 'Рабочая папка готова и пока пуста', action: 'widgets', label: 'Открыть библиотеку' } : readyServices < snapshot.services.length ? { icon: 'pulse', title: 'Запустите нужные сервисы', text: `${pluralRu(missingServices, 'процесс', 'процесса', 'процессов')} пока ${missingServices === 1 ? 'не отвечает' : 'не отвечают'}`, action: 'diagnostics', label: 'Открыть диагностику' } : !snapshot.obs.connected ? { icon: 'obs', title: 'Подключите OBS Studio', text: 'Тогда здесь появятся реальные сцены', action: 'obs', label: 'Настроить OBS' } : activeTelemetry === 0 ? { icon: 'widgets', title: 'Откройте первый виджет', text: 'После превью появятся FPS и задержки', action: 'widgets', label: 'Выбрать виджет' } : { icon: 'check', title: 'Система выглядит готовой', text: 'Можно перейти к финальной проверке сцены', action: 'scenes', label: 'Проверить сцены' };
  return `${recoveryBanner()}<section class="hero-card">
    <div class="hero-copy"><span class="hero-chip">${icon('spark', 14)} РАБОЧАЯ СЕССИЯ</span><h2>${score === 100 ? 'Можно выходить в эфир' : 'Подготовим систему к эфиру'}</h2><p>${score === 100 ? 'Все виджеты и фоновые сервисы отвечают.' : `${readyWidgets} из ${snapshot.widgets.length} виджетов готовы. Я покажу, что требует действия перед эфиром.`}</p><div class="hero-actions"><button class="button button--light" data-action="checks">${icon('pulse')}Проверить систему</button><button class="button button--ghost-light" data-nav="widgets">Открыть библиотеку${icon('arrow')}</button></div></div>
    <div class="readiness-ring" style="--score:${score * 3.6}deg"><div><strong>${score}%</strong><span>готовность</span></div></div>
  </section>
  <section class="next-action"><div class="next-action-icon">${icon(next.icon, 24)}</div><div><span class="section-label">СЛЕДУЮЩИЙ ШАГ</span><h3>${esc(next.title)}</h3><p>${esc(next.text)}</p></div><button class="button" data-nav="${next.action}">${esc(next.label)}${icon('arrow')}</button><div class="preflight-mini"><span class="${readyServices === snapshot.services.length ? 'is-done' : ''}">${icon(readyServices === snapshot.services.length ? 'check' : 'clock')}Сервисы</span><span class="${snapshot.obs.connected ? 'is-done' : ''}">${icon(snapshot.obs.connected ? 'check' : 'clock')}OBS</span><span class="${activeTelemetry > 0 ? 'is-done' : ''}">${icon(activeTelemetry > 0 ? 'check' : 'clock')}Телеметрия</span></div></section>
  <section class="metric-grid">
    ${metricCard('widgets', `${readyWidgets}/${snapshot.widgets.length}`, 'Виджеты', 'готовы к работе', 'widgets')}
    ${metricCard('pulse', `${readyServices}/${snapshot.services.length}`, 'Сервисы', 'отвечают сейчас', 'services')}
    ${metricCard('obs', snapshot.obs.connected ? 'Online' : 'Offline', 'OBS WebSocket', snapshot.obs.connected ? snapshot.obs.currentProgramSceneName || 'подключён' : 'подключите для сцен', 'obs')}
    ${metricCard('pulse', String(activeTelemetry), 'Телеметрия', 'активных виджетов', 'telemetry')}
  </section>
  <section class="dashboard-grid"><div class="panel"><div class="panel-heading"><div><span class="section-label">СОСТОЯНИЕ</span><h3>${alerts.length ? 'Требует внимания' : 'Всё работает'}</h3></div><button class="text-button" data-nav="diagnostics">Диагностика${icon('arrow', 15)}</button></div>
    ${alerts.length ? `<div class="attention-list">${alerts.slice(0, 5).map(attentionRow).join('')}</div>` : `<div class="success-empty">${icon('check', 28)}<div><b>Проблем не обнаружено</b><span>Последняя проверка: только что</span></div></div>`}
  </div>${servicesPanel()}</section>`;
}

function recoveryBanner() {
  if (!snapshot.recovery?.previousSessionCrashed) return '';
  return `<section class="recovery-banner">${icon('warning',25)}<div><b>Предыдущая сессия завершилась неожиданно</b><span>Настройки и рабочее пространство сохранены. Проверьте журнал, если хотите узнать причину.</span></div><button class="button" data-nav="logs">Открыть журнал</button><button class="icon-button" data-dismiss-recovery title="Скрыть">×</button></section>`;
}

function workspaceAvailabilityBanner() {
  if (!snapshot.workspace?.issue) return '';
  return `<section class="workspace-alert">${icon('folder',26)}<div><span class="section-label">РАБОЧАЯ ПАПКА НЕДОСТУПНА</span><h3>Файлы виджетов больше не найдены</h3><p>${esc(snapshot.workspace.issue)}</p><code title="${esc(snapshot.workspace.path || '')}">${esc(snapshot.workspace.path || 'Путь не указан')}</code></div><button class="button button--primary" data-workspace-select>${icon('refresh')}Подключить папку заново</button></section>`;
}

function serverAvailabilityBanner() {
  if (snapshot.server?.status !== 'error') return '';
  return `<section class="server-alert">${icon('warning',24)}<div><span class="section-label">ЛОКАЛЬНЫЙ СЕРВЕР НЕ ЗАПУЩЕН</span><h3>Виджеты временно не смогут открыться в OBS</h3><p>${esc(snapshot.server.error || 'Не удалось занять локальный порт.')}</p></div><button class="button" data-nav="diagnostics">Открыть диагностику${icon('arrow')}</button></section>`;
}

function metricCard(iconName, value, label, caption, accent) {
  return `<article class="metric-card metric-card--${accent}"><div class="metric-icon">${icon(iconName)}</div><div><strong>${esc(value)}</strong><b>${esc(label)}</b><span>${esc(caption)}</span></div></article>`;
}

function attentionRow(item) {
  const failed = item.health.filter(check => !check.ok);
  return `<button class="attention-row" data-widget="${item.id}"><span class="attention-icon">${icon('warning')}</span><div><b>${esc(item.name)}</b><span>${esc(failed[0]?.label || 'Нет актуальных данных')}</span></div>${badge(item.state)}${icon('arrow', 16)}</button>`;
}

function servicesPanel() {
  if (!snapshot.services.length) return `<aside class="panel services-panel"><div class="panel-heading"><div><span class="section-label">ПРОЦЕССЫ</span><h3>Фоновые сервисы</h3></div></div><div class="service-empty">${icon('check',24)}<b>Сервисы пока не требуются</b><span>Они появятся вместе с виджетами, которым нужны фоновые процессы.</span></div></aside>`;
  return `<aside class="panel services-panel"><div class="panel-heading"><div><span class="section-label">ПРОЦЕССЫ</span><h3>Фоновые сервисы</h3></div></div><div class="service-list">${snapshot.services.map(service => {
    const recovering = service.state === 'restarting';
    const canStop = service.runningByControlCenter || recovering;
    const action = service.externallyRunning ? '<span class="external-label">Внешний</span>' : `<button class="service-action" data-service="${service.id}" data-service-action="${canStop ? 'stop' : 'start'}">${recovering ? 'Отменить' : canStop ? 'Стоп' : 'Запустить'}</button>`;
    const recoveryNote = recovering ? `<small class="service-recovery-note">Попытка ${service.restartAttempts}/3</small>` : service.state === 'restart-blocked' ? `<small class="service-recovery-note service-recovery-note--danger">Нужна ручная проверка</small>` : '';
    return `<div class="service-row"><div class="service-glyph">${icon(service.id.includes('music') ? 'pulse' : service.id.includes('hotkey') ? 'spark' : 'logs')}</div><div><b>${esc(service.name)}</b>${badge(service.state)}${recoveryNote}</div>${action}</div>`;
  }).join('')}</div></aside>`;
}

function widgetsPage() {
  const libraryWidgets = [...snapshot.widgets].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name, 'ru'));
  if (!snapshot.widgets.length) return `<section class="empty-library"><div class="empty-library-art"><span>${icon('widgets',38)}</span><i></i><i></i></div><span class="section-label">${snapshot.workspace?.ready ? 'ПУСТАЯ БИБЛИОТЕКА' : 'РАБОЧЕЕ ПРОСТРАНСТВО НЕ ВЫБРАНО'}</span><h2>${snapshot.workspace?.ready ? 'Здесь появятся ваши виджеты' : 'Создайте место для будущих виджетов'}</h2><p>${snapshot.workspace?.ready ? `Пространство «${esc(snapshot.workspace.name || 'Мои OBS-виджеты')}» готово. Можно создать новый виджет или импортировать существующий.` : 'Control Center может самостоятельно создать корректную структуру. Вы также можете подключить существующую папку или продолжить работу только с OBS.'}</p><div class="empty-library-actions">${snapshot.workspace?.mode === 'workspace' ? `<button class="button button--primary" data-starter-widget>${icon('spark')}Создать шаблон</button><button class="button" data-import-widget-folder>${icon('folder')}Импортировать папку</button><button class="button" data-import-widget-zip>${icon('copy')}Импортировать ZIP</button><button class="button" data-open-workspace>${icon('external')}Открыть Workspace</button>` : `<button class="button button--primary" data-workspace-create="default">${icon('spark')}Создать автоматически</button><button class="button" data-workspace-create="custom">${icon('folder')}Выбрать расположение</button><button class="button" data-workspace-select>${icon('link')}Подключить существующее</button>`}</div>${snapshot.workspace?.ready ? `<div class="workspace-path-line">${icon('folder')}<span>${esc(snapshot.workspace.path)}</span><b>${snapshot.workspace.mode === 'legacy' ? 'Совместимость' : 'Готово'}</b></div>` : ''}${recentWorkspaces()}</section>`;
  return `${snapshot.workspace?.mode === 'legacy' ? `<section class="migration-banner">${icon('shield',25)}<div><b>Папка работает в режиме совместимости</b><span>Её можно безопасно обновить до нового формата. Перед изменением приложение сохранит резервную копию.</span></div><button class="button" data-workspace-migrate>Обновить структуру</button></section>` : ''}${workspaceManagerBar()}<section class="library-intro"><div><span class="section-label">ВАША КОЛЛЕКЦИЯ</span><h2>${snapshot.widgets.length} виджетов для эфира</h2><p>Откройте карточку, чтобы увидеть живое превью, готовый URL, размеры и состояние зависимостей.</p></div><div class="library-legend"><span><i class="legend-ready"></i>Готов к OBS</span><span><i class="legend-warning"></i>Нужна настройка</span></div></section><div class="section-tools"><div class="search-box">${icon('search')}<input id="widget-search" type="search" placeholder="Название или категория…" autocomplete="off"></div><div class="filter-pills"><button class="is-active" data-filter="all">Все · ${snapshot.widgets.length}</button><button data-filter="favorites">Избранные · ${snapshot.widgets.filter(item => item.favorite).length}</button><button data-filter="ready">Готовы · ${snapshot.widgets.filter(item => item.state === 'ready').length}</button><button data-filter="attention">Проверить · ${snapshot.widgets.filter(item => item.state !== 'ready').length}</button></div></div>
  <div class="widget-grid">${libraryWidgets.map(widgetCard).join('')}</div>`;
}

function workspaceManagerBar() {
  if (!snapshot.workspace?.ready) return '';
  return `<section class="workspace-manager-bar"><div>${icon('folder',22)}<div><b>${esc(snapshot.workspace.name || 'Рабочее пространство')}</b><span title="${esc(snapshot.workspace.path)}">${esc(snapshot.workspace.path)}</span></div></div><div>${snapshot.workspace.mode === 'workspace' ? `<button data-starter-widget>${icon('spark')}Создать</button><button data-import-widget-folder>${icon('folder')}Импорт папки</button><button data-import-widget-zip>${icon('copy')}Импорт ZIP</button>` : ''}<button data-open-workspace>${icon('external')}Открыть папку</button><button data-workspace-select>${icon('refresh')}Сменить</button></div></section>${recentWorkspaces()}${workspaceBackups()}`;
}

function recentWorkspaces() {
  const recent = (snapshot.workspace?.recent || []).filter(item => item.path !== snapshot.workspace?.path);
  if (!recent.length) return '';
  return `<details class="recent-workspaces"><summary>${icon('clock')}Недавние рабочие пространства<span>${recent.length}</span></summary><div>${recent.map(item => `<button data-recent-workspace="${esc(item.path)}"><b>${esc(item.name || 'Рабочее пространство')}</b><span>${esc(item.path)}</span>${icon('arrow')}</button>`).join('')}</div></details>`;
}

function workspaceBackups() {
  const backups = snapshot.workspace?.backups || [];
  if (!backups.length) return '';
  return `<details class="recent-workspaces workspace-backups"><summary>${icon('shield')}Резервные копии<span>${backups.length}</span></summary><div>${backups.slice(0,6).map(item => `<button data-restore-backup="${esc(item.id)}"><b>${new Date(item.createdAt).toLocaleString('ru-RU')}</b><span>${pluralRu(item.widgetCount,'виджет','виджета','виджетов')}</span>${icon('refresh')}</button>`).join('')}</div></details>`;
}

const widgetVisuals = {
  music: { icon: 'music', tone: 'cyan', label: 'Now playing', description: 'Обложка, исполнитель, текст и прогресс трека.' },
  'top-bar': { icon: 'pulse', tone: 'purple', label: 'System HUD', description: 'Компактная системная статистика поверх эфира.' },
  'hotkey-tracker': { icon: 'keyboard', tone: 'amber', label: 'Input live', description: 'Показывает нажатия клавиш зрителям в реальном времени.' },
  'promo-banner': { icon: 'banner', tone: 'pink', label: 'Promotion', description: 'Полноэкранная промо-композиция для важных анонсов.' },
  'developer-fuel': { icon: 'coffee', tone: 'orange', label: 'Fuel meter', description: 'Небольшой интерактивный индикатор поддержки стрима.' },
  'todo-list': { icon: 'list', tone: 'green', label: 'Focus list', description: 'Список задач и целей текущей трансляции.' },
  'ide-chat': { icon: 'chat', tone: 'blue', label: 'IDE chat', description: 'Чат-компаньон для стримов о разработке.' },
  'stream-ending': { icon: 'ending', tone: 'violet', label: 'Final scene', description: 'Атмосферное завершение и прощание со зрителями.' },
  'showcase-audio-player': { icon: 'speaker', tone: 'red', label: 'Audio stage', description: 'Полноэкранная сцена для демонстрации аудио.' }
};

function widgetArt(item, compact = false) {
  const visual = widgetVisuals[item.id] || { icon: 'widgets', tone: 'cyan', label: item.category, description: 'Виджет для вашей трансляции.' };
  return `<div class="widget-art widget-art--${visual.tone} ${compact ? 'widget-art--compact' : ''}"><div class="art-grid"></div><span class="art-orbit art-orbit--one"></span><span class="art-orbit art-orbit--two"></span><div class="art-glyph">${icon(visual.icon, compact ? 28 : 38)}</div><span class="art-label">${esc(visual.label)}</span></div>`;
}

function widgetCard(item) {
  const healthy = item.health.filter(check => check.ok).length;
  const visual = widgetVisuals[item.id];
  const failures = item.health.length - healthy;
  return `<article class="widget-card" data-widget-card="${item.id}">${widgetArt(item)}<div class="widget-card-content"><div class="widget-card-top"><span class="category-label">${esc(item.category)}</span>${badge(item.state)}</div><div class="widget-card-body"><h3>${esc(item.name)}</h3><p>${esc(visual?.description || 'Виджет для вашей трансляции.')}</p></div><div class="widget-card-health"><span class="${item.telemetry ? 'is-live' : ''}">${icon('pulse')}<b>${item.telemetry ? `${item.telemetry.fps} FPS` : 'Нет телеметрии'}</b><small>${item.telemetry ? 'сигнал получен' : 'откройте превью'}</small></span><span class="${failures ? 'has-warning' : 'is-ready'}">${icon(failures ? 'warning' : 'check')}<b>${item.health.length ? failures ? `${failures} проблемы` : 'Проверки пройдены' : 'Автономный'}</b><small>${item.health.length ? `${healthy}/${item.health.length} зависимостей` : 'не требует сервисов'}</small></span></div><div class="widget-specs"><span>${item.width}×${item.height}</span><span>${item.fps} FPS</span><span>Browser Source</span></div><div class="widget-card-actions"><button title="Копировать URL" data-copy="${item.url}">${icon('copy')}URL</button><button class="widget-open" data-widget="${item.id}"><span>Подробнее</span>${icon('arrow')}</button></div></div></article>`;
}

function widgetPage(item) {
  if (!item) return `<div class="empty-panel"><h2>Виджет не найден</h2><button class="button" data-back>${icon('back')}Назад</button></div>`;
  const visual = widgetVisuals[item.id];
  return `<div class="detail-page"><button class="back-link" data-back>${icon('back')}Библиотека виджетов</button><section class="detail-hero detail-hero--visual">${widgetArt(item, true)}<div class="detail-copy"><div class="detail-status">${badge(item.state)}<span>${esc(item.category)}</span></div><h2>${esc(item.name)}</h2><p>${esc(visual?.description || 'Виджет для вашей трансляции.')}</p><div class="detail-chips"><span>${item.width} × ${item.height}</span><span>${item.fps} FPS</span><span>Browser Source</span></div></div><div class="detail-actions"><button class="button" data-open="${item.url}">${icon('external')}Открыть превью</button><button class="button button--primary" data-widget-tab="connect">${icon('link')}Подключить к OBS</button></div></section>
    <nav class="detail-tabs">${detailTab('overview', 'Обзор')}${detailTab('connect', 'Подключение')}${detailTab('monitoring', 'Метрики')}${detailTab('activity', 'События')}${snapshot.workspace?.mode === 'workspace' ? detailTab('settings', 'Настройки') : ''}</nav>${widgetTab(item)}</div>`;
}

function detailTab(id, label) { return `<button class="${route.tab === id ? 'is-active' : ''}" data-widget-tab="${id}">${esc(label)}</button>`; }
function widgetTab(item) { if (route.tab === 'connect') return connectTab(item); if (route.tab === 'monitoring') return monitoringTab(item); if (route.tab === 'activity') return activityTab(item); if (route.tab === 'settings') return widgetSettings(item); return widgetOverview(item); }

function widgetSettings(item) {
  return `<section class="widget-settings"><div><span class="section-label">НАСТРОЙКИ ВИДЖЕТА</span><h3>Отображение и параметры OBS</h3><p>ID и расположение файлов не меняются, чтобы существующие Browser Source продолжили работать.</p></div><form data-widget-settings="${item.id}"><label>Название<input name="name" value="${esc(item.name)}" required maxlength="80"></label><label>Категория<input name="category" value="${esc(item.category)}" maxlength="50"></label><div class="widget-setting-numbers"><label>Ширина<input name="width" type="number" min="8" max="7680" value="${item.width}"></label><label>Высота<input name="height" type="number" min="8" max="4320" value="${item.height}"></label><label>FPS<input name="fps" type="number" min="1" max="120" value="${item.fps}"></label></div><label class="setting-switch"><input name="disabled" type="checkbox" ${item.disabled ? 'checked' : ''}><span>Отключить виджет в текущем пространстве</span></label><div><button class="button button--primary" type="submit">${icon('check')}Сохранить изменения</button><button class="button button--danger" type="button" data-remove-widget="${item.id}">${icon('warning')}Убрать из библиотеки</button></div></form></section>`;
}

function widgetOverview(item) {
  const track = item.id === 'music' ? item.data : null;
  return `<section class="detail-layout"><div class="preview-card"><div class="preview-toolbar"><div><i></i><span>Живое превью</span></div><span>${item.width} × ${item.height}</span></div><div class="preview-viewport"><iframe title="Превью ${esc(item.name)}" src="${item.url}"></iframe></div></div><aside class="detail-sidebar">
    <div class="info-card"><span class="section-label">ТЕЛЕМЕТРИЯ</span><strong>${item.telemetry ? `${item.telemetry.fps} FPS` : 'Нет сигнала'}</strong><p>${item.telemetry ? `Обновлено ${timeAgo(Date.now() - item.telemetry.receivedAt)}` : 'Откройте превью или добавьте URL в OBS.'}</p></div>
    ${track ? `<div class="info-card now-playing"><span class="section-label">СЕЙЧАС ИГРАЕТ</span><b>${esc(track.title || 'Трек не определён')}</b><p>${esc(track.artist || '')}</p></div>` : ''}
    <div class="info-card"><span class="section-label">ЗАВИСИМОСТИ</span>${healthRows(item)}</div></aside></section>`;
}

function connectTab(item) {
  return `<section class="connect-choice-head"><div><span class="section-label">ДВА БЕЗОПАСНЫХ СПОСОБА</span><h3>Как добавить виджет в OBS</h3><p>Ручной способ оставляет всё под вашим контролем. Конструктор сцен ускоряет размещение и меняет только источники OCC.</p></div></section><section class="connect-grid"><article class="connect-primary"><div class="method-heading"><span>01</span><div><h3>Вручную через Browser Source</h3><p>Универсальный способ для любой версии OBS.</p></div></div><ol><li>Откройте нужную сцену в OBS.</li><li>Нажмите «+» в блоке источников.</li><li>Выберите «Источник браузера».</li><li>Вставьте URL и параметры ниже.</li></ol><label>Локальный URL виджета</label><div class="url-field"><code>${esc(item.url)}</code><button data-copy="${item.url}">${icon('copy')}Копировать</button></div><div class="dimension-grid"><span>Ширина<b>${item.width}</b></span><span>Высота<b>${item.height}</b></span><span>FPS<b>${item.fps}</b></span></div><div class="safe-callout">${icon('shield')}<span><b>Ручное подключение ничего не меняет автоматически.</b><br>Вы сами создаёте и подтверждаете источник в OBS.</span></div></article><article class="connect-secondary connect-secondary--composer"><div class="method-heading"><span>02</span><div><h3>Через конструктор сцен</h3><p>Добавление и расположение из Control Center.</p></div></div><div class="composer-benefits"><span>${icon('scenes')}Выбор реальной сцены</span><span>${icon('widgets')}Добавление Browser Source</span><span>${icon('banner')}Шесть пресетов расположения</span><span>${icon('shield')}Защита чужих источников</span></div><p>После подключения WebSocket включите управление на текущую сессию. Перед удалением приложение обязательно спросит подтверждение.</p><button class="button button--primary" data-nav="scenes">Открыть конструктор сцен${icon('arrow')}</button></article></section>`;
}

function monitoringTab(item) {
  const event = item.telemetry?.lastDataEvent;
  const sourceDelay = event?.sourceTimestamp ? Math.max(0, event.receivedAt - event.sourceTimestamp) : null;
  const renderDelay = event ? Math.max(0, event.renderedAt - event.receivedAt) : null;
  return `<section class="monitor-cards">${metricCard('pulse', item.telemetry ? `${item.telemetry.fps}` : '—', 'Фактический FPS', `цель ${item.fps}`, 'widgets')}${metricCard('warning', String(item.telemetry?.longFrames ?? '—'), 'Долгие кадры', 'за 2 секунды', 'services')}${metricCard('link', sourceDelay == null ? '—' : `${sourceDelay} мс`, 'Источник → виджет', event?.source || 'нет trace', 'obs')}${metricCard('spark', renderDelay == null ? '—' : `${renderDelay} мс`, 'Виджет → кадр', 'отрисовка', 'telemetry')}</section>${telemetryHistory(item)}<section class="panel health-detail"><div class="panel-heading"><div><span class="section-label">ПРОВЕРКИ</span><h3>Состояние виджета</h3></div></div>${healthRows(item)}${item.telemetry?.errors?.length ? `<div class="error-stack">${item.telemetry.errors.map(error => `<p>${icon('warning')}${esc(error)}</p>`).join('')}</div>` : '<div class="success-line">'+icon('check')+'Ошибок страницы не получено</div>'}</section>`;
}

function telemetryHistory(item) {
  const history = item.history || { samples: 0, points: [] };
  if (!history.samples) return `<section class="telemetry-history telemetry-history--empty">${icon('pulse',26)}<div><b>История появится во время работы виджета</b><span>Оставьте превью или Browser Source открытым — показатели сохраняются локально.</span></div></section>`;
  const target = Math.max(1, item.fps);
  return `<section class="telemetry-history"><div class="telemetry-history-head"><div><span class="section-label">ПОСЛЕДНИЕ 30 МИНУТ</span><h3>Стабильность отрисовки</h3></div><div><span>Средний FPS<b>${history.averageFps}</b></span><span>Минимальный<b>${history.minFps}</b></span><span>Долгие кадры<b>${history.longFrames}</b></span><span>p95 задержки<b>${history.p95FrameDelay == null ? '—' : `${history.p95FrameDelay} мс`}</b></span></div></div><div class="fps-chart" aria-label="История FPS">${history.points.map(point => `<i style="--height:${Math.max(5,Math.min(100,(point.fps/target)*100))}%" title="${point.fps} FPS"></i>`).join('')}</div><div class="chart-scale"><span>Начало окна</span><em>Цель: ${item.fps} FPS · ${history.samples} измерений</em><span>Сейчас</span></div></section>`;
}

function activityTab(item) {
  const entries = snapshot.logs.filter(entry => entry.source.toLowerCase().includes(item.name.toLowerCase()));
  return entries.length ? `<div class="timeline">${entries.map(logRow).join('')}</div>` : `<div class="empty-panel">${icon('logs', 30)}<h3>Событий пока нет</h3><p>Запуски, ошибки и результаты тестов появятся здесь.</p></div>`;
}

function healthRows(item) {
  if (!item.health.length) return `<div class="health-row"><span class="health-icon health-icon--success">${icon('check')}</span><div><b>Внешних зависимостей нет</b><span>Виджет автономен</span></div></div>`;
  return item.health.map(check => `<div class="health-row"><span class="health-icon health-icon--${check.ok ? 'success' : 'warning'}">${icon(check.ok ? 'check' : 'warning')}</span><div><b>${esc(check.label || check.path || `Порт ${check.port}`)}</b><span>${check.ok ? 'Работает' : 'Нет ответа'}${check.ageMs != null ? ` · ${timeAgo(check.ageMs)}` : ''}</span></div></div>`).join('');
}

function scenesPage() {
  if (!snapshot.obs.connected) return emptyConnection('Сцены появятся после подключения OBS', 'Мы показываем только реальные сцены из запущенного OBS. Макеты и предполагаемые источники не используются.', 'Подключить OBS', 'obs');
  const scenes = snapshot.obs.scenes;
  if (followProgramScene && snapshot.obs.currentProgramSceneName) selectedSceneName = snapshot.obs.currentProgramSceneName;
  const selected = scenes.find(scene => scene.name === selectedSceneName) || scenes.find(scene => scene.name === snapshot.obs.currentProgramSceneName) || scenes[0];
  if (!selected) return `<div class="empty-panel">${icon('scenes', 32)}<h3>В OBS пока нет сцен</h3><p>Создайте сцену в OBS и обновите данные.</p></div>`;
  selectedSceneName = selected.name;
  const managedItems = selected.items.filter(item => item.managed);
  const selectedItem = managedItems.find(item => item.id === selectedSceneItemId) || managedItems[0] || null;
  selectedSceneItemId = selectedItem?.id || null;
  const management = snapshot.obs.managementEnabled;
  return `<section class="scene-studio-head"><div><span class="section-label">OBS SCENE COMPOSER</span><h2>Соберите сцену из ваших виджетов</h2><p>Выберите сцену, добавьте Browser Source и расположите его готовым пресетом. Существующие источники защищены.</p></div>${management ? `<span class="management-badge">${icon('shield')}Управление включено до закрытия приложения</span>` : `<button class="button button--primary" data-enable-obs-management>${icon('shield')}Включить безопасное управление</button>`}</section>
  ${!management ? `<section class="management-consent"><div>${icon('shield', 28)}<div><b>Сейчас включён режим просмотра</b><span>Для добавления виджетов подтвердите управление. Control Center сможет изменять только источники с меткой <code>OCC •</code>, созданные через эту страницу.</span></div></div><ul><li>${icon('check')}Не трогает камеры и микрофоны</li><li>${icon('check')}Не запускает эфир или запись</li><li>${icon('check')}Спрашивает перед удалением</li></ul></section>` : ''}
  <section class="scene-studio"><aside class="scene-browser"><div class="scene-pane-title"><span>Сцены OBS</span><b>${scenes.length}</b></div>${scenes.map(scene => `<button class="scene-select ${scene.name === selected.name ? 'is-active' : ''}" data-scene-select="${esc(scene.name)}"><span class="scene-select-icon">${icon('scenes')}</span><div><b>${esc(scene.name)}</b><span>${scene.items.length} источников · ${scene.items.filter(item => item.managed).length} от OCC</span></div>${scene.name === snapshot.obs.currentProgramSceneName ? '<i>LIVE</i>' : ''}</button>`).join('')}</aside>
    <div class="scene-workbench"><div class="scene-canvas-head"><div><span class="live-dot"></span><b>${esc(selected.name)}</b>${selected.name === snapshot.obs.currentProgramSceneName ? '<small>Сейчас в эфире</small>' : '<small>Предпросмотр сцены</small>'}</div><span>${snapshot.obs.video?.baseWidth || 1920} × ${snapshot.obs.video?.baseHeight || 1080}</span></div>
      <div class="scene-preview-tools"><div class="preview-modes"><button class="${sceneOverlayMode === 'none' ? 'is-active' : ''}" data-overlay-mode="none">Чистый кадр</button><button class="${sceneOverlayMode === 'occ' ? 'is-active' : ''}" data-overlay-mode="occ">Виджеты OCC</button><button class="${sceneOverlayMode === 'all' ? 'is-active' : ''}" data-overlay-mode="all">Все границы</button></div><div><button class="follow-live ${followProgramScene ? 'is-active' : ''}" data-follow-program>${icon('pulse',14)}${followProgramScene ? 'Следим за эфиром' : 'Вернуться к эфиру'}</button><button class="preview-refresh" data-scene-preview-refresh title="Обновить кадр">${icon('refresh',15)}</button></div></div>
      <div class="scene-canvas ${scenePreviewLoading ? 'is-loading' : ''}">${scenePreview?.sceneName === selected.name ? `<img class="scene-live-preview" src="${scenePreview.imageData}" alt="Кадр сцены ${esc(selected.name)}">` : `<div class="scene-preview-placeholder">${icon('scenes',32)}<b>Получаем реальный кадр из OBS</b><span>Здесь появится именно то, что формирует выбранная сцена.</span></div>`}<div class="scene-safe-area"></div>${selected.items.filter(item => sceneOverlayMode === 'all' || (sceneOverlayMode === 'occ' && item.managed)).map((item, index) => sceneCanvasItem(item, index, selectedItem)).join('')}<span class="preview-age">${scenePreview?.sceneName === selected.name ? `Кадр обновлён ${timeAgo(Date.now() - scenePreview.receivedAt)}` : 'Ожидание OBS'}</span></div>
      <div class="source-list-head"><span>Источники сцены</span><b>${selected.items.length}</b></div><div class="source-list">${selected.items.length ? selected.items.map(item => `<button class="source-row ${item.id === selectedItem?.id ? 'is-active' : ''}" data-scene-item="${item.id}"><span class="source-state ${item.enabled ? 'is-visible' : ''}">${icon(item.enabled ? 'check' : 'warning')}</span><div><b>${esc(item.name)}</b><span>${item.managed ? 'Можно управлять из Control Center' : 'Просмотр · защищён от изменений'}</span></div>${item.managed ? '<em>OCC</em>' : icon('shield', 15)}</button>`).join('') : '<p class="source-empty">Источников нет</p>'}</div></div>
    <aside class="widget-dock"><div class="scene-pane-title"><span>Добавить виджет</span><b>${snapshot.widgets.filter(widget => !widget.disabled).length}</b></div><p class="dock-hint">Нажмите «Добавить» — источник появится только в выбранной сцене.</p><div class="dock-widgets">${snapshot.widgets.filter(widget => !widget.disabled).map(widget => { const exists = selected.items.some(item => item.managed && item.name.includes(widget.name)); const visual = widgetVisuals[widget.id]; return `<article><span class="dock-widget-icon">${icon(visual?.icon || 'widgets')}</span><div><b>${esc(widget.name)}</b><span>${widget.width}×${widget.height} · ${widget.fps} FPS</span></div><button data-obs-widget-action="create" data-scene="${esc(selected.name)}" data-widget-id="${widget.id}" ${!management || exists ? 'disabled' : ''}>${exists ? 'Добавлен' : 'Добавить'}</button></article>`; }).join('')}</div></aside></section>
  ${selectedItem ? sceneInspector(selected, selectedItem, management) : ''}`;
}

function sceneInspector(scene, item, management) {
  const transform = item.transform || {};
  const actionData = `data-scene="${esc(scene.name)}" data-scene-item-id="${item.id}"`;
  return `<section class="scene-inspector scene-inspector--advanced"><div class="inspector-heading"><div><span class="section-label">ВЫБРАННЫЙ ИСТОЧНИК</span><h3>${esc(item.name)}</h3><p>${item.enabled ? 'Виден на сцене' : 'Сейчас скрыт'} · слой ${Number(item.index || 0) + 1} · ID ${item.id}</p></div><div class="inspector-quick-actions"><button data-obs-widget-action="undo" ${actionData} ${management ? '' : 'disabled'}>${icon('refresh')}Отменить</button><button data-obs-widget-action="duplicate" ${actionData} ${management ? '' : 'disabled'}>${icon('copy')}Дублировать</button><button data-obs-widget-action="layer" data-direction="backward" ${actionData} ${management ? '' : 'disabled'}>Слой ниже</button><button data-obs-widget-action="layer" data-direction="forward" ${actionData} ${management ? '' : 'disabled'}>Слой выше</button></div></div><div class="placement-presets"><span>Быстрое расположение</span>${[['top-left','↖'],['top-right','↗'],['center','●'],['bottom-left','↙'],['bottom-right','↘'],['fullscreen','▣']].map(([preset,label]) => `<button title="${preset}" data-obs-widget-action="position" data-preset="${preset}" ${actionData} ${management ? '' : 'disabled'}>${label}</button>`).join('')}</div><form class="transform-editor" data-scene-transform-form ${actionData}><div><label>X<input name="positionX" type="number" step="1" value="${Number(transform.positionX || 0).toFixed(0)}"></label><label>Y<input name="positionY" type="number" step="1" value="${Number(transform.positionY || 0).toFixed(0)}"></label><label>Масштаб X<input name="scaleX" type="number" min=".01" max="10" step=".01" value="${Number(transform.scaleX || 1).toFixed(2)}"></label><label>Масштаб Y<input name="scaleY" type="number" min=".01" max="10" step=".01" value="${Number(transform.scaleY || 1).toFixed(2)}"></label><label>Поворот<input name="rotation" type="number" step="1" value="${Number(transform.rotation || 0).toFixed(0)}"></label></div><details><summary>Обрезка источника${icon('arrow',14)}</summary><div><label>Слева<input name="cropLeft" type="number" min="0" value="${Number(transform.cropLeft || 0)}"></label><label>Справа<input name="cropRight" type="number" min="0" value="${Number(transform.cropRight || 0)}"></label><label>Сверху<input name="cropTop" type="number" min="0" value="${Number(transform.cropTop || 0)}"></label><label>Снизу<input name="cropBottom" type="number" min="0" value="${Number(transform.cropBottom || 0)}"></label></div></details><button class="button button--primary" type="submit" ${management ? '' : 'disabled'}>${icon('check')}Применить точно</button></form><div class="inspector-actions"><button class="button" data-obs-widget-action="toggle" ${actionData} ${management ? '' : 'disabled'}>${icon(item.enabled ? 'warning' : 'check')}${item.enabled ? 'Скрыть' : 'Показать'}</button><button class="button button--danger" data-obs-widget-action="remove" ${actionData} ${management ? '' : 'disabled'}>${icon('warning')}Удалить из сцены</button></div></section>`;
}

function sceneCanvasItem(item, index, selectedItem) {
  const canvas = snapshot.obs.video || { baseWidth: 1920, baseHeight: 1080 };
  const transform = item.transform || {};
  const widthPx = Math.abs(Number(transform.width) || Number(transform.boundsWidth) || 280);
  const heightPx = Math.abs(Number(transform.height) || Number(transform.boundsHeight) || 120);
  let leftPx = Number.isFinite(transform.positionX) ? transform.positionX : 120 + (index % 4) * 300;
  let topPx = Number.isFinite(transform.positionY) ? transform.positionY : 100 + Math.floor(index / 4) * 180;
  const alignment = Number(transform.alignment ?? 5);
  if (alignment & 2) leftPx -= widthPx; else if (!(alignment & 1)) leftPx -= widthPx / 2;
  if (alignment & 8) topPx -= heightPx; else if (!(alignment & 4)) topPx -= heightPx / 2;
  const left = Math.max(0, Math.min(98, (leftPx / canvas.baseWidth) * 100));
  const top = Math.max(0, Math.min(98, (topPx / canvas.baseHeight) * 100));
  const width = Math.max(4, Math.min(100 - left, (widthPx / canvas.baseWidth) * 100));
  const height = Math.max(4, Math.min(100 - top, (heightPx / canvas.baseHeight) * 100));
  return `<button class="canvas-source ${item.managed ? 'is-managed' : ''} ${item.enabled ? '' : 'is-hidden'} ${item.id === selectedItem?.id ? 'is-selected' : ''}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${width.toFixed(2)}%;height:${height.toFixed(2)}%" data-scene-item="${item.id}"><span>${item.managed ? icon('widgets', 15) : icon('shield', 15)}</span><b>${esc(item.name)}</b></button>`;
}

function emptyConnection(title, text, action, target) {
  return `<section class="empty-connection-new"><div class="empty-orbit">${icon('obs', 34)}</div><span class="section-label">НЕТ СОЕДИНЕНИЯ</span><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="button button--primary" data-nav="${target}">${icon('link')}${esc(action)}</button></section>`;
}

function legacyObsPage() {
  const obs = snapshot.obs;
  if (obs.connected) return `<section class="obs-connected"><div class="obs-connected-hero"><div class="obs-logo">${icon('obs', 34)}</div><div><span class="status status--success"><i></i>Защищённое локальное соединение</span><h2>OBS Studio на связи</h2><p>Control Center получает состояние сцен в реальном времени.</p></div><button class="button" data-obs-disconnect>Отключить</button></div><div class="obs-facts"><span>Версия OBS<b>${esc(obs.version || 'Не определена')}</b></span><span>Текущая сцена<b>${esc(obs.currentProgramSceneName || 'Не определена')}</b></span><span>Найдено сцен<b>${obs.scenes.length}</b></span><span>Доступ<b>Только чтение</b></span></div><div class="obs-connected-actions"><button class="button button--primary" data-nav="scenes">Открыть реальные сцены${icon('arrow')}</button><span>${icon('shield')}Источники, запись и эфир не изменяются</span></div></section>`;
  return `<section class="obs-explainer"><div><span class="section-label">OBS WEBSOCKET v5</span><h2>Покажите приложению ваши реальные сцены</h2><p>После подключения раздел «Сцены» перестанет быть пустым, а Control Center сможет подтвердить, что OBS действительно запущен. Управление эфиром остаётся у вас.</p></div><div class="obs-permission-card"><span>${icon('check')}Читает список сцен</span><span>${icon('check')}Видит активную сцену</span><span class="is-denied">${icon('warning')}Не меняет источники</span></div></section><section class="obs-setup"><article class="obs-form-card"><div class="obs-form-head"><div class="obs-logo">${icon('obs', 30)}</div><div><span class="section-label">ШАГ 1 · ПОДКЛЮЧЕНИЕ</span><h2>Данные локального сервера</h2><p>Обычно адрес менять не требуется.</p></div></div><form id="obs-connect-form"><label>Адрес WebSocket<span>Стандартный адрес OBS на этом компьютере</span><input name="url" value="${esc(obs.url || 'ws://127.0.0.1:4455')}" autocomplete="off"></label><label>Пароль<span>Из окна настроек WebSocket в OBS</span><input name="password" type="password" autocomplete="new-password" placeholder="Введите пароль"></label>${obs.error ? `<div class="form-error">${icon('warning')}${esc(obs.error)}</div>` : ''}<button class="button button--primary button--large" type="submit">${icon('link')}Проверить и подключиться</button><p class="form-privacy">${icon('shield', 15)}Пароль живёт только в памяти до закрытия приложения.</p></form></article><article class="guide-card"><span class="section-label">ШАГ 2 · НАСТРОЙКА В OBS</span><h3>Включите сервер за минуту</h3><div class="guide-step"><i>1</i><div><b>OBS → Инструменты</b><span>Откройте «Настройки сервера WebSocket».</span></div></div><div class="guide-step"><i>2</i><div><b>Включить сервер</b><span>Оставьте стандартный порт <code>4455</code>.</span></div></div><div class="guide-step"><i>3</i><div><b>Создать пароль</b><span>Скопируйте его и вставьте в форму слева.</span></div></div><div class="guide-step"><i>4</i><div><b>Нажать «Подключиться»</b><span>Ваши сцены появятся только после успешной проверки.</span></div></div><div class="safe-callout">${icon('shield')}<span><b>Что будет с данными?</b><br>Ничего не удаляется и не загружается в интернет.</span></div></article></section><section class="obs-faq-row"><article>${icon('help')}<div><b>WebSocket выключен?</b><span>Приложение продолжит работать, но сцены будут скрыты.</span></div></article><article>${icon('shield')}<div><b>Это безопасно?</b><span>Разрешены только localhost и 127.0.0.1.</span></div></article><article>${icon('refresh')}<div><b>Можно отключить?</b><span>Да, в любой момент без изменений в OBS.</span></div></article></section>`;
}

function obsPage() {
  const obs = snapshot.obs;
  if (obs.mode === 'reconnecting') return `<section class="obs-reconnecting"><span class="obs-reconnecting__icon">${icon('refresh',32)}</span><div><span class="section-label">ВОССТАНОВЛЕНИЕ СОЕДИНЕНИЯ</span><h2>Ждём возвращения OBS Studio</h2><p>Попытка ${Number(obs.reconnectAttempt || 1)} выполняется автоматически. Сцены скрыты, пока OBS не подтвердит подключение.</p><span>${icon('shield')}Пароль хранится только в памяти текущего запуска.</span></div><button class="button" data-obs-disconnect>Отменить переподключение</button></section>`;
  if (!obs.connected) return legacyObsPage();
  return `<section class="obs-session-hero"><div class="obs-session-logo">${icon('obs',36)}<span></span></div><div><span class="status status--success"><i></i>Локальное соединение активно</span><h2>OBS Studio подключён</h2><p>${esc(obs.version || 'Версия не определена')} · ${obs.scenes.length} сцен · холст ${obs.video?.baseWidth || '—'}×${obs.video?.baseHeight || '—'}</p></div><div class="obs-session-mode"><span>Текущий доступ</span><b>${obs.managementEnabled ? 'Управление OCC-источниками' : 'Безопасный просмотр'}</b><small>${obs.managementEnabled ? 'до закрытия приложения' : 'изменения заблокированы'}</small></div><button class="button" data-obs-disconnect>Отключить</button></section><section class="obs-session-grid"><article><span class="section-label">АКТИВНАЯ СЦЕНА</span><h3>${esc(obs.currentProgramSceneName || 'Не определена')}</h3><p>Сцена, которая сейчас находится в программном выходе OBS.</p><button class="button" data-nav="scenes">Открыть конструктор${icon('arrow')}</button></article><article><span class="section-label">ВОЗМОЖНОСТИ</span><div class="obs-capabilities"><span>${icon('check')}Чтение сцен и источников</span><span>${icon('check')}Просмотр активной сцены</span><span class="${obs.managementEnabled ? 'is-enabled' : ''}">${icon(obs.managementEnabled ? 'check' : 'shield')}Добавление виджетов</span><span class="${obs.managementEnabled ? 'is-enabled' : ''}">${icon(obs.managementEnabled ? 'check' : 'shield')}Позиционирование и видимость</span></div></article><article><span class="section-label">ЗАЩИТА</span><h3>Остальные источники недоступны для изменений</h3><p>Камеры, микрофоны, захваты экрана и вручную созданные Browser Source отображаются только для информации.</p>${obs.managementEnabled ? `<span class="management-badge">${icon('shield')}Управление уже включено</span>` : `<button class="button button--primary" data-enable-obs-management>${icon('shield')}Разрешить управление OCC</button>`}</article></section><section class="obs-scene-overview"><div class="section-heading-large"><div><span class="section-label">СЦЕНЫ И ИСТОЧНИКИ</span><h3>Что найдено в текущей коллекции</h3><p>Здесь показаны только данные из подключённого OBS.</p></div></div><div>${obs.scenes.map(scene=>`<article><span class="scene-overview-icon">${icon('scenes')}</span><div><b>${esc(scene.name)}</b><small>${scene.items.length} источников · ${scene.items.filter(item=>item.managed).length} управляются OCC</small></div>${scene.name===obs.currentProgramSceneName?'<em>В ЭФИРЕ</em>':''}</article>`).join('')}</div><button class="button button--primary" data-nav="scenes">Перейти к размещению виджетов${icon('arrow')}</button></section>`;
}

function legacyDiagnosticsPage() {
  const checks = snapshot.widgets.flatMap(item => item.health.map(check => ({ item, check })));
  const passed = checks.filter(({ check }) => check.ok).length;
  const telemetryCount = snapshot.widgets.filter(item => item.telemetry).length;
  return `<section class="diagnostic-summary"><div><span class="section-label">СОСТОЯНИЕ СИСТЕМЫ</span><h2>${passed === checks.length ? 'Все проверки пройдены' : `${checks.length - passed} компонента требуют внимания`}</h2><p>Диагностика объясняет не только что сломалось, но и что сделать дальше.</p></div><button class="button button--primary" data-action="checks">${icon('refresh')}Запустить полную проверку</button></section><section class="diagnostic-metrics"><article>${icon('link')}<div><strong>${passed}/${checks.length}</strong><b>Зависимости</b><span>порты и файлы отвечают</span></div></article><article>${icon('pulse')}<div><strong>${telemetryCount}/${snapshot.widgets.length}</strong><b>Телеметрия</b><span>виджеты передают FPS</span></div></article><article>${icon('obs')}<div><strong>${snapshot.obs.connected ? 'Online' : 'Offline'}</strong><b>OBS Studio</b><span>${snapshot.obs.connected ? 'соединение активно' : 'проверяется отдельно'}</span></div></article></section><section class="diagnostic-hero"><div><span class="section-label">ИНСТРУМЕНТ СИНХРОНИЗАЦИИ</span><h2>Совпадают ли звук и изображение?</h2><p>Тест создаёт одновременную вспышку и звуковой импульс. Добавьте его как Browser Source, запишите 10 секунд и сравните дорожки.</p><div class="diagnostic-how"><span><i>1</i>Открыть тест</span><span><i>2</i>Добавить в OBS</span><span><i>3</i>Записать 10 секунд</span></div></div><button class="button button--light" data-open="http://127.0.0.1:${snapshot.serverPort}/tools/av-sync">${icon('play')}Открыть A/V тест</button></section><section class="diagnostic-layout"><div class="panel diagnostic-check-panel"><div class="panel-heading"><div><span class="section-label">ДЕТАЛЬНЫЙ ОТЧЁТ</span><h3>${passed}/${checks.length} проверок успешны</h3></div><span class="last-check">Обновляется по запросу</span></div><div class="check-list">${checks.map(({ item, check }) => `<div class="check-row"><span class="health-icon health-icon--${check.ok ? 'success' : 'warning'}">${icon(check.ok ? 'check' : 'warning')}</span><div><b>${esc(item.name)}</b><span>${esc(check.label || check.path || `Порт ${check.port}`)}</span></div><div class="check-result"><strong>${check.ok ? 'Работает' : 'Нет ответа'}</strong><span>${check.ok ? 'Действий не требуется' : 'Запустите связанный сервис справа'}</span></div></div>`).join('')}</div></div>${servicesPanel()}</section>`;
}

function legacyHelpPage() {
  return `<section class="help-intro"><div class="help-symbol">${icon('book', 30)}</div><div><span class="section-label">ЦЕНТР ПОМОЩИ</span><h2>Что вы хотите настроить?</h2><p>Начните с короткого маршрута или найдите ответ по теме. Все инструкции написаны без предположения, что вы уже знакомы с OBS.</p></div><div class="help-search">${icon('search')}<input id="help-search" type="search" placeholder="Например: музыка не появляется…"></div></section><section class="help-path"><div><span class="section-label">РЕКОМЕНДОВАННЫЙ МАРШРУТ</span><h3>Первый виджет за четыре шага</h3></div><div class="help-path-line">${helpStep('1', 'Диагностика', 'Проверьте файлы и сервисы.', 'diagnostics')}${helpStep('2', 'Библиотека', 'Выберите нужный виджет.', 'widgets')}${helpStep('3', 'Browser Source', 'Скопируйте URL и размеры.', 'widgets')}${helpStep('4', 'Проверка OBS', 'Убедитесь, что всё видно.', 'obs')}</div></section><section class="help-topics"><article data-help-topic><div class="topic-icon">${icon('widgets')}</div><div><span class="section-label">ВИДЖЕТЫ</span><h3>Подключение Browser Source</h3><p>Где взять URL, какие размеры указать и как обновить источник.</p><button data-nav="widgets">Открыть библиотеку${icon('arrow')}</button></div></article><article data-help-topic><div class="topic-icon">${icon('obs')}</div><div><span class="section-label">OBS STUDIO</span><h3>WebSocket и сцены</h3><p>Как включить сервер, где найти пароль и почему это безопасно.</p><button data-nav="obs">Открыть инструкцию${icon('arrow')}</button></div></article><article data-help-topic><div class="topic-icon">${icon('music')}</div><div><span class="section-label">МУЗЫКА</span><h3>Трек, обложка и текст</h3><p>Какие сервисы нужны музыкальному виджету и как их проверить.</p><button data-widget="music">Открыть музыку${icon('arrow')}</button></div></article><article data-help-topic><div class="topic-icon">${icon('pulse')}</div><div><span class="section-label">НЕПОЛАДКИ</span><h3>FPS, задержки и ошибки</h3><p>Как читать показатели и подготовить диагностический отчёт.</p><button data-nav="diagnostics">Открыть диагностику${icon('arrow')}</button></div></article></section><section class="faq-panel"><div class="panel-heading"><div><span class="section-label">ЧАСТЫЕ ВОПРОСЫ</span><h3>Ответы без технического жаргона</h3></div></div>${faq('Виджет не открывается в OBS', 'Control Center должен оставаться запущенным. Откройте страницу виджета, скопируйте актуальный URL и обновите Browser Source. Порт может отличаться от 3210, если он был занят.')}${faq('Музыка не отображается', 'На странице музыки откройте вкладку «Метрики». Скробблер и сервер текстов должны иметь статус «Работает». Если нет — запустите их в диагностике.')}${faq('OBS WebSocket не подключается', 'В OBS откройте «Инструменты → Настройки сервера WebSocket», включите сервер, оставьте порт 4455 и проверьте пароль. Разрешены только локальные адреса.')}${faq('Приложение может испортить сцену?', 'Нет. Интеграция работает в режиме чтения: видит названия сцен и активную сцену, но не создаёт, не удаляет и не перемещает источники.')}${faq('Что отправить при сообщении об ошибке?', 'Откройте «Журнал событий», выберите ошибки и скопируйте диагностический отчёт. В нём нет пароля OBS и других секретов.')}</section><section class="support-banner"><div>${icon('bug', 28)}<div><span class="section-label">НЕ НАШЛИ ОТВЕТ?</span><h3>Сообщите о проблеме разработчику</h3><p>Приложите диагностический отчёт и опишите, какой виджет вы открывали.</p></div></div><button class="button" data-open="https://github.com/nimalekyt-bit/obs-control-center/issues">Открыть GitHub Issues${icon('external')}</button></section>`;
}

function diagnosticsPage() {
  const checks = snapshot.widgets.flatMap(item => item.health.map((check, index) => ({ item, check, serviceId: item.dependencies?.[index] })));
  const failed = checks.filter(({ check }) => !check.ok);
  const passed = checks.filter(({ check }) => check.ok);
  const telemetry = snapshot.widgets.filter(item => item.telemetry).length;
  return `<section class="diagnostic-command"><div class="diagnostic-command-icon ${failed.length ? 'is-warning' : 'is-ready'}">${icon(failed.length ? 'warning' : 'check', 32)}</div><div><span class="section-label">ПРЕДЭФИРНАЯ ПРОВЕРКА</span><h2>${failed.length ? `Нужно исправить: ${failed.length}` : 'Система отвечает нормально'}</h2><p>${failed.length ? 'Ниже показаны причина каждой проблемы и действие, которое стоит выполнить.' : 'Файлы и сетевые сервисы доступны. Откройте виджеты, чтобы проверить FPS.'}</p></div><button class="button button--primary button--large" data-action="checks">${icon('refresh')}Проверить ещё раз</button></section>
  <section class="diagnostic-kpis"><article><div class="kpi-ring ${failed.length ? 'is-warning' : 'is-ready'}"><strong>${passed.length}</strong><span>из ${checks.length}</span></div><div><b>Зависимости</b><p>Порты и обновляемые файлы</p></div></article><article><span class="kpi-icon">${icon('pulse', 25)}</span><div><strong>${telemetry}/${snapshot.widgets.length}</strong><b>Живая телеметрия</b><p>Появляется после открытия виджета</p></div></article><article><span class="kpi-icon">${icon('obs', 25)}</span><div><strong>${snapshot.obs.connected ? 'Подключён' : 'Не подключён'}</strong><b>OBS Studio</b><p>${snapshot.obs.connected ? `${snapshot.obs.scenes.length} реальных сцен` : 'Сцены и источники пока недоступны'}</p></div></article></section>${runtimePanel()}
  ${failed.length ? `<section class="issue-board"><div class="section-heading-large"><div><span class="section-label">ТРЕБУЕТ ДЕЙСТВИЯ</span><h3>Что именно не отвечает</h3><p>Проверяйте пункты сверху вниз — связанные виджеты восстановятся автоматически.</p></div><span class="issue-count">${failed.length}</span></div><div class="issue-cards">${failed.map(({ item, check, serviceId }, index) => `<article><span class="issue-number">${String(index + 1).padStart(2, '0')}</span><div class="issue-icon">${icon(check.type === 'port' ? 'link' : 'logs', 23)}</div><div><span class="issue-widget">${esc(item.name)}</span><h4>${esc(check.label || check.path || `Порт ${check.port}`)}</h4><p>${check.type === 'port' ? `Локальный порт ${check.port} не отвечает. Вероятно, связанный процесс не запущен.` : 'Файл данных отсутствует или давно не обновлялся.'}</p></div><div class="issue-action"><span>${icon('warning')}Нет ответа</span>${serviceId ? `<button class="button" data-service="${serviceId}" data-service-action="start">${icon('play')}Запустить сервис</button>` : `<button class="button" data-widget="${item.id}">Открыть виджет${icon('arrow')}</button>`}</div></article>`).join('')}</div></section>` : ''}
  ${passed.length ? `<details class="passed-checks"><summary><span>${icon('check')}Успешные проверки</span><b>${passed.length}</b>${icon('arrow')}</summary><div>${passed.map(({ item, check }) => `<span><i>${icon('check')}</i><b>${esc(item.name)}</b><small>${esc(check.label || check.path || `Порт ${check.port}`)}</small></span>`).join('')}</div></details>` : ''}
  <section class="sync-lab"><div class="sync-visual"><span class="sync-pulse"></span>${icon('speaker', 35)}</div><div><span class="section-label">ЛАБОРАТОРИЯ СИНХРОНИЗАЦИИ</span><h3>Проверьте задержку звука и изображения</h3><p>Тест одновременно показывает вспышку и воспроизводит импульс. Запишите 10 секунд в OBS и сравните момент на видео и аудиодорожке.</p><ol><li><i>1</i>Открыть тест</li><li><i>2</i>Добавить как Browser Source</li><li><i>3</i>Записать 10 секунд</li></ol></div><button class="button button--light button--large" data-open="http://127.0.0.1:${snapshot.serverPort}/tools/av-sync">${icon('play')}Открыть A/V тест</button></section>
  <section class="diagnostic-processes"><div class="section-heading-large"><div><span class="section-label">УПРАВЛЕНИЕ ПРОЦЕССАМИ</span><h3>Фоновые сервисы</h3><p>Запускайте только то, что требуется вашим виджетам.</p></div></div>${servicesPanel()}</section>`;
}

function runtimePanel() {
  const labels = { node: 'Node.js', python: 'Python', dotnet: '.NET', powershell: 'PowerShell' };
  return `<section class="runtime-panel"><div><span class="section-label">СРЕДА ВЫПОЛНЕНИЯ</span><h3>Компоненты этого компьютера</h3><p>Приложение проверяет их заранее, чтобы запуск сервиса не заканчивался непонятной ошибкой.</p></div><div>${(snapshot.runtimes || []).map(runtime => `<article class="${runtime.available ? 'is-available' : ''}"><span>${icon(runtime.available ? 'check' : 'warning')}</span><div><b>${labels[runtime.id] || runtime.id}</b><small>${runtime.available ? esc(runtime.version || 'Установлен') : 'Не найден в PATH'}</small></div><em>${runtime.available ? 'Готов' : 'Не найден'}</em></article>`).join('')}</div></section>`;
}

function helpPage() {
  return `<section class="help-hero-new"><div class="help-orb">${icon('book', 34)}</div><div><span class="section-label">БАЗА ЗНАНИЙ</span><h2>Разберёмся вместе</h2><p>Выберите задачу — приложение покажет точные шаги и объяснит, зачем каждый из них нужен.</p></div><label class="help-search-new">${icon('search')}<input id="help-search" type="search" placeholder="Найти ответ: OBS, музыка, задержка…"><kbd>Ctrl K</kbd></label></section>
  <section class="first-widget-guide" data-help-topic><div class="guide-navigation"><span class="section-label">БЫСТРЫЙ СТАРТ</span><h3>Первый виджет в OBS</h3><p>Маршрут без лишних переходов.</p>${[['1','Проверить систему','Убедимся, что сервисы отвечают','diagnostics'],['2','Выбрать виджет','Посмотрим превью и размеры','widgets'],['3','Добавить Browser Source','Вставим локальный URL','widgets'],['4','Проверить сцену','Убедимся, что источник виден','scenes']].map(([number,title,text,target],index)=>`<button class="guide-nav-step ${index===0?'is-active':''}" data-nav="${target}"><i>${number}</i><div><b>${title}</b><span>${text}</span></div>${icon('arrow')}</button>`).join('')}</div><article class="browser-source-recipe"><div class="recipe-preview"><div class="recipe-window"><span></span><span></span><span></span><div>${icon('widgets',32)}<b>Browser Source</b><small>Локальный виджет</small></div></div></div><div class="recipe-copy"><span class="section-label">ГЛАВНЫЙ РЕЦЕПТ</span><h3>Как добавить виджет вручную</h3><ol><li><i>1</i><div><b>Откройте страницу виджета</b><span>Нажмите «Подключение» и скопируйте URL.</span></div></li><li><i>2</i><div><b>В OBS нажмите «+» в источниках</b><span>Выберите «Источник браузера» и создайте новый.</span></div></li><li><i>3</i><div><b>Вставьте URL и размеры</b><span>Ширина, высота и FPS указаны рядом с адресом.</span></div></li><li><i>4</i><div><b>Проверьте прозрачность</b><span>Фон виджета должен совпасть с его назначением.</span></div></li></ol><button class="button button--primary" data-nav="widgets">Выбрать виджет${icon('arrow')}</button></div></article></section>
  <section class="help-catalog"><div class="section-heading-large"><div><span class="section-label">ИНСТРУКЦИИ ПО ТЕМАМ</span><h3>Что настраиваем?</h3></div></div><div class="help-catalog-grid"><article data-help-topic><span class="topic-art topic-art--cyan">${icon('widgets',28)}</span><div><small>ВИДЖЕТЫ</small><h3>URL, размеры и Browser Source</h3><p>Подключение вручную, обновление источника и проверка превью.</p><button data-nav="widgets">Открыть библиотеку${icon('arrow')}</button></div></article><article data-help-topic><span class="topic-art topic-art--purple">${icon('obs',28)}</span><div><small>OBS WEBSOCKET</small><h3>Сцены и безопасное управление</h3><p>Подключение, добавление виджетов и защита существующих источников.</p><button data-nav="obs">Настроить OBS${icon('arrow')}</button></div></article><article data-help-topic><span class="topic-art topic-art--green">${icon('folder',28)}</span><div><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><h3>Создание, импорт и резервные копии</h3><p>Как добавить папку или ZIP, изменить виджет и безопасно сменить Workspace.</p><button data-nav="widgets">Управлять виджетами${icon('arrow')}</button></div></article><article data-help-topic><span class="topic-art topic-art--amber">${icon('pulse',28)}</span><div><small>ДИАГНОСТИКА</small><h3>FPS, задержки и ошибки</h3><p>Что означают показатели и какое действие исправляет проблему.</p><button data-nav="diagnostics">Проверить систему${icon('arrow')}</button></div></article></div></section>
  <section class="faq-new" data-help-topic><div class="section-heading-large"><div><span class="section-label">ЧАСТЫЕ ВОПРОСЫ</span><h3>Короткие ответы на реальные проблемы</h3><p>Нажмите на вопрос, чтобы увидеть решение.</p></div></div><div class="faq-grid">${faqNew('Виджет не появляется в OBS','Убедитесь, что Control Center остаётся запущенным. Затем заново скопируйте URL со страницы виджета: порт может измениться, если 3210 был занят.','widgets')}${faqNew('Как добавить свой виджет?','Откройте библиотеку и выберите импорт папки или ZIP. В папке должен быть index.html либо widget.json с указанием входного файла.','folder')}${faqNew('OBS WebSocket не подключается','В OBS откройте «Инструменты → Настройки сервера WebSocket», включите сервер, оставьте порт 4455 и скопируйте пароль.','obs')}${faqNew('Можно ли повредить мою сцену?','В режиме просмотра — нет. В режиме управления Control Center изменяет только источники, которые сам создал с меткой OCC •, и спрашивает перед удалением.','shield')}${faqNew('Почему нет данных FPS?','Телеметрия начинается только когда страница виджета реально открыта в превью или в OBS. Отсутствие FPS до открытия — нормальное состояние.','pulse')}${faqNew('Что приложить к сообщению об ошибке?','В журнале событий нажмите «Скопировать безопасный отчёт». Пароль OBS и другие секреты в него не входят.','bug')}</div></section>
  <section class="support-banner"><div>${icon('bug',28)}<div><span class="section-label">НУЖНА ПОМОЩЬ РАЗРАБОТЧИКА</span><h3>Опишите проблему и приложите отчёт</h3><p>GitHub Issues — единое место для ошибок и предложений.</p></div></div><div><button class="button" data-diagnostic-report>${icon('copy')}Скопировать отчёт</button><button class="button button--primary" data-open="https://github.com/nimalekyt-bit/obs-control-center/issues">Создать обращение${icon('external')}</button></div></section>`;
}

function faqNew(question, answer, iconName) { return `<details><summary><span class="faq-icon">${icon(iconName)}</span><b>${esc(question)}</b><i>${icon('arrow')}</i></summary><p>${esc(answer)}</p></details>`; }

function helpStep(number, title, text, target) { return `<article class="step-card"><span>${number}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><button data-nav="${target}" aria-label="Перейти: ${esc(title)}">${icon('arrow', 15)}</button></article>`; }
function faq(question, answer) { return `<details><summary>${esc(question)}${icon('arrow', 15)}</summary><p>${esc(answer)}</p></details>`; }

function logsPage() {
  const query = logQuery.trim().toLowerCase();
  const visible = snapshot.logs.filter(entry => (logFilter === 'all' || entry.level === logFilter) && (!query || `${entry.source} ${entry.message}`.toLowerCase().includes(query)));
  const counts = { info: snapshot.logs.filter(e => e.level === 'info').length, warning: snapshot.logs.filter(e => e.level === 'warning').length, error: snapshot.logs.filter(e => e.level === 'error').length };
  return `<section class="logs-summary"><div><span class="section-label">ЛОКАЛЬНАЯ ИСТОРИЯ</span><h2>Всё, что происходило с приложением</h2><p>События сгруппированы по важности. Пароли и секреты сюда не записываются.</p></div><button class="button" data-diagnostic-report>${icon('copy')}Скопировать безопасный отчёт</button></section><div class="logs-layout"><aside class="log-filters"><span class="section-label">ПОКАЗАТЬ</span><button class="${logFilter === 'all' ? 'is-active' : ''}" data-log-filter="all">${icon('logs')}Все события<b>${snapshot.logs.length}</b></button><button class="${logFilter === 'error' ? 'is-active' : ''}" data-log-filter="error">${icon('warning')}Ошибки<b>${counts.error}</b></button><button class="${logFilter === 'warning' ? 'is-active' : ''}" data-log-filter="warning">${icon('warning')}Предупреждения<b>${counts.warning}</b></button><button class="${logFilter === 'info' ? 'is-active' : ''}" data-log-filter="info">${icon('check')}Информация<b>${counts.info}</b></button><div class="log-retention">${icon('clock')}<span>Хранятся последние 500 событий на этом компьютере.</span></div></aside><section class="log-stream"><div class="log-stream-head"><div><b>${logFilter === 'all' ? 'Все события' : logFilter === 'error' ? 'Ошибки' : logFilter === 'warning' ? 'Предупреждения' : 'Информация'}</b><span>${visible.length} записей</span></div><button class="icon-button" data-action="refresh" title="Обновить">${icon('refresh')}</button></div><div class="timeline">${visible.length ? visible.map(logRow).join('') : `<div class="empty-panel">${icon('check', 30)}<h3>Здесь пока пусто</h3><p>Для выбранного фильтра событий нет.</p></div>`}</div></section></div>`;
}

function logRow(entry) { return `<article class="timeline-row timeline-row--${entry.level}"><span>${icon(entry.level === 'error' ? 'warning' : entry.level === 'warning' ? 'warning' : 'check')}</span><div class="log-content"><div><b>${esc(entry.source)}</b><time>${new Date(entry.at).toLocaleString('ru-RU')}</time></div><p>${esc(entry.message)}</p></div><em>${entry.level === 'error' ? 'Ошибка' : entry.level === 'warning' ? 'Внимание' : 'Событие'}</em></article>`; }

function aboutPage() {
  const readyWidgets = snapshot.widgets.filter(item => item.state === 'ready').length;
  const readyServices = snapshot.services.filter(item => ['ready','external'].includes(item.state)).length;
  return `<section class="about-product-hero"><div class="about-product-brand"><img src="${appIconUrl}" alt=""><div><span class="section-label">OBS CONTROL CENTER · ${appVersion}</span><h2>Рабочая среда для<br><em>живых виджетов</em></h2><p>Приложение связывает локальные виджеты, фоновые сервисы и OBS Studio в одном понятном интерфейсе.</p><div class="about-hero-actions"><button class="button button--primary" data-nav="widgets">Открыть библиотеку${icon('arrow')}</button><button class="button" data-nav="help">Прочитать справку${icon('book')}</button></div></div></div><div class="about-build-card"><span>Установленная версия</span><strong>${appVersion}</strong><b>Предварительная версия</b><small>${snapshot.appInfo?.platform || 'win32'} · ${snapshot.appInfo?.arch || 'x64'}</small></div></section>
  <section class="runtime-passport"><div class="section-heading-large"><div><span class="section-label">ЭТОТ КОМПЬЮТЕР</span><h3>Состояние текущей установки</h3><p>Данные ниже получены сейчас, а не являются примером.</p></div><button class="icon-button" data-action="refresh" title="Обновить">${icon('refresh')}</button></div><div class="runtime-grid"><article><span class="runtime-icon">${icon('folder')}</span><div><small>ПАПКА ВИДЖЕТОВ</small><b>${snapshot.workspace?.ready ? 'Подключена' : 'Не выбрана'}</b><p title="${esc(snapshot.workspace?.path || '')}">${esc(snapshot.workspace?.path || 'Выберите папку при повторной настройке')}</p></div></article><article><span class="runtime-icon">${icon('link')}</span><div><small>ЛОКАЛЬНЫЙ СЕРВЕР</small><b>127.0.0.1:${snapshot.serverPort}</b><p>URL виджетов доступны только на этом компьютере</p></div></article><article><span class="runtime-icon">${icon('obs')}</span><div><small>OBS STUDIO</small><b>${snapshot.obs.connected ? 'Подключён' : 'Не подключён'}</b><p>${snapshot.obs.connected ? `${snapshot.obs.scenes.length} сцен · ${snapshot.obs.managementEnabled ? 'управление включено' : 'режим просмотра'}` : 'Подключение можно настроить позже'}</p></div></article><article><span class="runtime-icon">${icon('pulse')}</span><div><small>ГОТОВНОСТЬ</small><b>${readyWidgets}/${snapshot.widgets.length} виджетов</b><p>${readyServices}/${snapshot.services.length} фоновых сервисов отвечают</p></div></article></div></section>
  <section class="product-principles"><article><span class="principle-number">01</span><div><span class="section-label">НАЗНАЧЕНИЕ</span><h3>Меньше ручных запусков перед эфиром</h3><p>Control Center заменяет простой BAT-файл: показывает процессы, зависимости, URL, FPS и события в одном интерфейсе.</p></div></article><article><span class="principle-number">02</span><div><span class="section-label">ЧЕСТНЫЕ ДАННЫЕ</span><h3>Никаких выдуманных сцен и метрик</h3><p>Сцены появляются только от OBS, а FPS — только когда реальная страница виджета передаёт телеметрию.</p></div></article><article><span class="principle-number">03</span><div><span class="section-label">БЕЗОПАСНОСТЬ</span><h3>Управление только своими источниками</h3><p>Конструктор OBS меняет лишь источники с меткой OCC •. Перед удалением требуется отдельное подтверждение.</p></div></article></section>
  <section class="developer-profile"><div class="developer-avatar-large">NW<span></span></div><div class="developer-profile-copy"><span class="section-label">АВТОР И РАЗРАБОТЧИК</span><h3>Woodskilla · nimalekyt-bit</h3><p>OBS Control Center развивается как самостоятельный инструмент для управления локальными виджетами. Предложения, ошибки и технические обсуждения принимаются через GitHub.</p><div class="developer-links"><button data-open="https://github.com/nimalekyt-bit">${icon('external')}Профиль GitHub</button><button data-open="https://github.com/nimalekyt-bit/obs-control-center">${icon('external')}Исходный код</button><button data-open="https://github.com/nimalekyt-bit/obs-control-center/issues">${icon('bug')}Ошибки и предложения</button></div></div><div class="developer-tech"><span class="section-label">СТЕК</span><div class="tech-cloud"><span>Electron</span><span>Node.js</span><span>OBS WebSocket v5</span><span>.NET 8</span><span>PowerShell</span><span>Python</span></div></div></section>
  <section class="about-utility-grid"><article><span class="utility-icon">${icon('shield',27)}</span><div><span class="section-label">ПРИВАТНОСТЬ</span><h3>Что хранится локально</h3><ul><li>${icon('check')}Путь к папке виджетов</li><li>${icon('check')}Журнал последних событий</li><li>${icon('check')}Состояние первого запуска</li><li>${icon('warning')}Пароль OBS не сохраняется</li></ul></div></article><article><span class="utility-icon">${icon('bug',27)}</span><div><span class="section-label">ПОДДЕРЖКА</span><h3>Как сообщить об ошибке</h3><ol><li>Повторите проблему</li><li>Откройте журнал событий</li><li>Скопируйте безопасный отчёт</li><li>Создайте GitHub Issue</li></ol><div><button class="button" data-diagnostic-report>${icon('copy')}Скопировать отчёт</button><button class="button" data-open="https://github.com/nimalekyt-bit/obs-control-center/issues">Открыть Issues${icon('external')}</button></div></div></article><article><span class="utility-icon">${icon('rocket',27)}</span><div><span class="section-label">УПРАВЛЕНИЕ</span><h3>Полезные действия</h3><p>Повторите знакомство, если хотите заново пройти настройку папки и OBS.</p><button class="button" data-reset-onboarding>${icon('refresh')}Повторить приветствие</button></div></article></section>
  ${updatePanel()}<section class="interface-preferences"><div><span class="section-label">ИНТЕРФЕЙС</span><h3>Масштаб приложения</h3><p>Выберите размер, при котором текст и элементы управления удобно читать на вашем мониторе.</p></div><div>${[[.9,'90%'],[1,'100%'],[1.1,'110%'],[1.25,'125%']].map(([scale,label]) => `<button class="${snapshot.preferences?.uiScale === scale ? 'is-active' : ''}" data-ui-scale="${scale}">${label}</button>`).join('')}</div></section><section class="release-note"><div><span class="section-label">ВОЗМОЖНОСТИ</span><h3>Доступно в этой версии</h3></div><div><span>${icon('check')}Управление рабочими пространствами</span><span>${icon('check')}Импорт и резервные копии</span><span>${icon('check')}Конструктор OBS-сцен</span><span>${icon('check')}Метрики и диагностика</span></div></section>`;
}

function updatePanel() {
  const update = snapshot.update || { status: 'idle', version: null, percent: 0, error: null };
  const states = {
    idle: ['Обновления приложения', 'Проверьте, доступна ли новая версия OBS Control Center.'],
    checking: ['Ищем обновление…', 'Подключаемся к официальному каналу выпусков.'],
    current: ['Установлена актуальная версия', `Версия ${appVersion} не требует обновления.`],
    development: ['Локальная версия для разработки', 'Автоматическая проверка доступна в установленной сборке.'],
    available: [`Доступна версия ${esc(update.version || '')}`, 'Можно загрузить её сейчас и установить, когда вам будет удобно.'],
    downloading: [`Загрузка обновления · ${Number(update.percent || 0)}%`, 'Не закрывайте приложение до завершения загрузки.'],
    downloaded: [`Версия ${esc(update.version || '')} готова`, 'Приложение перезапустится и завершит установку.'],
    error: ['Не удалось проверить обновления', esc(update.error || 'Проверьте интернет-соединение и повторите попытку.')]
  };
  const [title, description] = states[update.status] || states.idle;
  const action = update.status === 'available'
    ? `<button class="button button--primary" data-download-update>${icon('download')}Загрузить</button>`
    : update.status === 'downloaded'
      ? `<button class="button button--primary" data-install-update>${icon('refresh')}Установить и перезапустить</button>`
      : `<button class="button" data-check-updates ${['checking','downloading'].includes(update.status) ? 'disabled' : ''}>${icon('refresh')}${update.status === 'checking' ? 'Проверяем…' : 'Проверить обновления'}</button>`;
  const progress = update.status === 'downloading' ? `<div class="update-progress" aria-label="Загрузка ${Number(update.percent || 0)} процентов"><i style="width:${Math.max(0, Math.min(100, Number(update.percent || 0)))}%"></i></div>` : '';
  return `<section class="update-panel update-panel--${esc(update.status)}"><span class="update-panel__icon">${icon(update.status === 'error' ? 'warning' : update.status === 'current' ? 'check' : 'rocket', 26)}</span><div><span class="section-label">ВЕРСИЯ И ОБНОВЛЕНИЯ</span><h3>${title}</h3><p>${description}</p>${progress}</div><div class="update-panel__action">${action}<small>Обновления загружаются только из GitHub-репозитория проекта.</small></div></section>`;
}

function showNotice(text, tone = 'success') { notice = { text, tone }; render(); setTimeout(() => { notice = null; render(); }, 1800); }

function bindActions() {
  if (!window.__occShortcutsBound) {
    window.__occShortcutsBound = true;
    window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); route = { section: 'help', widgetId: null, tab: 'overview' }; render(); setTimeout(() => root.querySelector('#help-search')?.focus(), 0); } });
  }
  root.querySelectorAll('[data-widget-card]').forEach(card => { const item = getWidget(card.dataset.widgetCard); const failures = item ? item.health.filter(check => !check.ok).length : 0; const label = card.querySelector('.widget-card-health .has-warning b'); if (label) label.textContent = pluralRu(failures, 'проблема', 'проблемы', 'проблем'); });
  if (route.section === 'obs' && snapshot.obs.connected) {
    const sessionSummary = root.querySelector('.obs-session-hero p');
    if (sessionSummary) sessionSummary.textContent = `${snapshot.obs.version || 'Версия не определена'} · ${pluralRu(snapshot.obs.scenes.length, 'сцена', 'сцены', 'сцен')} · холст ${snapshot.obs.video?.baseWidth || '—'}×${snapshot.obs.video?.baseHeight || '—'}`;
    root.querySelectorAll('.obs-scene-overview article').forEach((card, index) => { const scene = snapshot.obs.scenes[index]; const managed = scene?.items.filter(item => item.managed).length || 0; const label = card.querySelector('small'); if (label && scene) label.textContent = `${pluralRu(scene.items.length, 'источник', 'источника', 'источников')} · ${pluralRu(managed, 'источник OCC', 'источника OCC', 'источников OCC')}`; });
  }
  if (route.section === 'scenes' && snapshot.obs.connected) root.querySelectorAll('.scene-select').forEach(button => { const scene = snapshot.obs.scenes.find(item => item.name === button.dataset.sceneSelect); const label = button.querySelector('div > span'); if (label && scene) label.textContent = `${pluralRu(scene.items.length, 'источник', 'источника', 'источников')} · ${pluralRu(scene.items.filter(item => item.managed).length, 'источник OCC', 'источника OCC', 'источников OCC')}`; });
  const versionLabel = root.querySelector('.about-hero .section-label');
  const versionNumber = root.querySelector('.about-version b');
  if (versionLabel) versionLabel.textContent = `OBS CONTROL CENTER · ${appVersion}`;
  if (versionNumber) versionNumber.textContent = appVersion;
  root.querySelectorAll('[data-onboarding-next]').forEach(button => button.addEventListener('click', () => { onboardingStep = Math.min(3, onboardingStep + 1); render(); }));
  root.querySelectorAll('[data-onboarding-back]').forEach(button => button.addEventListener('click', () => { onboardingStep = Math.max(0, onboardingStep - 1); render(); }));
  root.querySelector('[data-onboarding-obs]')?.addEventListener('click', () => { onboardingObsExpanded = true; render(); });
  root.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', () => { route = { section: button.dataset.nav, widgetId: null, tab: 'overview' }; render(); window.scrollTo(0, 0); }));
  root.querySelectorAll('[data-widget]').forEach(button => button.addEventListener('click', () => { route = { section: 'widgets', widgetId: button.dataset.widget, tab: 'overview' }; render(); window.scrollTo(0, 0); }));
  root.querySelector('[data-back]')?.addEventListener('click', () => { route = { section: 'widgets', widgetId: null, tab: 'overview' }; render(); window.scrollTo(0, 0); });
  root.querySelectorAll('[data-widget-tab]').forEach(button => button.addEventListener('click', () => { route.tab = button.dataset.widgetTab; render(); }));
  root.querySelectorAll('[data-profile]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.runProfile(button.dataset.profile); showNotice(snapshot.services.length ? 'Профиль стрима запущен' : 'Для этого пространства сервисы не требуются'); } catch (error) { showNotice(error.message || 'Не удалось запустить сервисы', 'error'); } }));
  root.querySelectorAll('[data-action="checks"]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; snapshot = await window.controlCenter.runChecks(); showNotice('Проверка завершена'); }));
  root.querySelector('[data-action="refresh"]')?.addEventListener('click', () => refresh(true));
  root.querySelectorAll('.issue-action').forEach(action => {
    if (action.querySelector('[data-diagnostic-help]')) return;
    const button = document.createElement('button');
    button.className = 'button';
    button.dataset.help = 'telemetry';
    button.dataset.diagnosticHelp = 'true';
    button.innerHTML = `${icon('book')}Справка по проверке`;
    action.appendChild(button);
  });
  root.querySelectorAll('[data-help]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await window.controlCenter.openHelp(button.dataset.help); } catch (error) { showNotice(error.message || 'Не удалось открыть справку', 'error'); }
    finally { button.disabled = false; }
  }));
  root.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => window.controlCenter.openUrl(button.dataset.open)));
  root.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.copy); showNotice('URL скопирован'); }));
  root.querySelectorAll('[data-service]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.serviceAction(button.dataset.service, button.dataset.serviceAction); render(); } catch (error) { showNotice(error.message || 'Сервис не запущен', 'error'); } }));
  root.querySelector('#obs-connect-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { snapshot = await window.controlCenter.connectObs({ url: form.get('url'), password: form.get('password') }); showNotice('OBS подключён'); } catch { snapshot = await window.controlCenter.snapshot(); render(); } });
  root.querySelector('[data-obs-disconnect]')?.addEventListener('click', async () => { snapshot = await window.controlCenter.disconnectObs(); render(); });
  root.querySelector('[data-enable-obs-management]')?.addEventListener('click', async button => {
    button.currentTarget.disabled = true;
    try { snapshot = await window.controlCenter.enableObsManagement(); showNotice('Безопасное управление сценами включено'); } catch (error) { showNotice(error.message || 'Не удалось включить управление', 'error'); }
  });
  root.querySelectorAll('[data-scene-select]').forEach(button => button.addEventListener('click', () => { selectedSceneName = button.dataset.sceneSelect; selectedSceneItemId = null; followProgramScene = false; scenePreview = null; render(); loadScenePreview(true); }));
  root.querySelectorAll('[data-scene-item]').forEach(button => button.addEventListener('click', () => { selectedSceneItemId = Number(button.dataset.sceneItem); render(); }));
  bindSceneDragging();
  root.querySelectorAll('[data-overlay-mode]').forEach(button => button.addEventListener('click', () => { sceneOverlayMode = button.dataset.overlayMode; render(); }));
  root.querySelector('[data-follow-program]')?.addEventListener('click', () => { followProgramScene = true; selectedSceneName = snapshot.obs.currentProgramSceneName; scenePreview = null; render(); loadScenePreview(true); });
  root.querySelector('[data-scene-preview-refresh]')?.addEventListener('click', () => loadScenePreview(true));
  root.querySelectorAll('[data-obs-widget-action]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      snapshot = await window.controlCenter.obsWidgetAction({ action: button.dataset.obsWidgetAction, sceneName: button.dataset.scene, sceneItemId: button.dataset.sceneItemId ? Number(button.dataset.sceneItemId) : undefined, widgetId: button.dataset.widgetId, preset: button.dataset.preset, direction: button.dataset.direction });
      render();
      loadScenePreview(true);
    } catch (error) { showNotice(error.message || 'OBS не выполнил действие', 'error'); }
  }));
  root.querySelector('[data-scene-transform-form]')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const transform = Object.fromEntries(['positionX','positionY','scaleX','scaleY','rotation','cropLeft','cropRight','cropTop','cropBottom'].map(key => [key, Number(form.get(key))])); try { snapshot = await window.controlCenter.obsWidgetAction({ action: 'transform', sceneName: event.currentTarget.dataset.scene, sceneItemId: Number(event.currentTarget.dataset.sceneItemId), transform }); render(); loadScenePreview(true); showNotice('Положение источника обновлено'); } catch (error) { showNotice(error.message || 'Трансформация не применена', 'error'); } });
  root.querySelectorAll('[data-workspace-select]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.chooseWorkspace(); render(); } catch (error) { showNotice(error.message || 'Папка не подходит', 'error'); } }));
  root.querySelectorAll('[data-workspace-create]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.createWorkspace({ useDefault: button.dataset.workspaceCreate === 'default' }); render(); if (snapshot.workspace?.ready && snapshot.onboarding?.complete) showNotice('Рабочее пространство готово'); } catch (error) { showNotice(error.message || 'Не удалось создать рабочее пространство', 'error'); } }));
  root.querySelector('[data-workspace-skip]')?.addEventListener('click', async button => { button.currentTarget.disabled = true; snapshot = await window.controlCenter.skipWorkspace(); onboardingStep = 2; render(); });
  root.querySelector('[data-workspace-migrate]')?.addEventListener('click', async button => { button.currentTarget.disabled = true; try { snapshot = await window.controlCenter.migrateWorkspace(); render(); if (snapshot.workspace?.mode === 'workspace') showNotice('Структура обновлена, резервная копия создана'); } catch (error) { showNotice(error.message || 'Миграция не выполнена', 'error'); } });
  root.querySelector('[data-starter-widget]')?.addEventListener('click', async button => { button.currentTarget.disabled = true; try { snapshot = await window.controlCenter.createStarterWidget(); render(); showNotice('Первый виджет создан'); } catch (error) { showNotice(error.message || 'Не удалось создать виджет', 'error'); } });
  root.querySelector('[data-open-workspace]')?.addEventListener('click', () => window.controlCenter.openWorkspace());
  root.querySelectorAll('[data-import-widget-folder]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.importWidgetFolder(); render(); showNotice('Виджет добавлен в библиотеку'); } catch (error) { showNotice(error.message || 'Импорт не выполнен', 'error'); } }));
  root.querySelectorAll('[data-import-widget-zip]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.importWidgetZip(); render(); showNotice('Архив виджета импортирован'); } catch (error) { showNotice(error.message || 'Архив не импортирован', 'error'); } }));
  root.querySelectorAll('[data-recent-workspace]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.openRecentWorkspace(button.dataset.recentWorkspace); route = { section: 'widgets', widgetId: null, tab: 'overview' }; render(); showNotice('Рабочее пространство открыто'); } catch (error) { showNotice(error.message || 'Не удалось открыть папку', 'error'); } }));
  root.querySelectorAll('[data-restore-backup]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { snapshot = await window.controlCenter.restoreWorkspaceBackup(button.dataset.restoreBackup); route = { section: 'widgets', widgetId: null, tab: 'overview' }; render(); showNotice('Резервная копия восстановлена'); } catch (error) { showNotice(error.message || 'Восстановление не выполнено', 'error'); } }));
  root.querySelector('[data-widget-settings]')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const id = event.currentTarget.dataset.widgetSettings; try { snapshot = await window.controlCenter.updateWidget(id, { name: form.get('name'), category: form.get('category'), width: Number(form.get('width')), height: Number(form.get('height')), fps: Number(form.get('fps')), disabled: form.get('disabled') === 'on' }); render(); showNotice('Настройки сохранены'); } catch (error) { showNotice(error.message || 'Настройки не сохранены', 'error'); } });
  root.querySelector('[data-remove-widget]')?.addEventListener('click', async button => { button.disabled = true; try { snapshot = await window.controlCenter.removeWidget(button.dataset.removeWidget); route = { section: 'widgets', widgetId: null, tab: 'overview' }; render(); showNotice('Виджет перемещён в резервные копии'); } catch (error) { showNotice(error.message || 'Виджет не удалён', 'error'); } });
  root.querySelector('[data-onboarding-complete]')?.addEventListener('click', async () => { snapshot = await window.controlCenter.completeOnboarding(); onboardingStep = 0; showNotice('Добро пожаловать в Control Center'); });
  root.querySelector('[data-reset-onboarding]')?.addEventListener('click', async () => { snapshot = await window.controlCenter.resetOnboarding(); onboardingStep = 0; render(); });
  root.querySelectorAll('[data-diagnostic-report]').forEach(button => button.addEventListener('click', async () => { const report = await window.controlCenter.diagnosticReport(); await navigator.clipboard.writeText(report); showNotice('Диагностический отчёт скопирован'); }));
  root.querySelectorAll('[data-ui-scale]').forEach(button => button.addEventListener('click', async () => { try { snapshot = await window.controlCenter.setUiScale(Number(button.dataset.uiScale)); render(); } catch (error) { showNotice(error.message || 'Масштаб не изменён', 'error'); } }));
  root.querySelector('[data-dismiss-recovery]')?.addEventListener('click', async () => { snapshot = await window.controlCenter.dismissRecovery(); render(); });
  root.querySelector('[data-check-updates]')?.addEventListener('click', async button => { button.disabled = true; try { await window.controlCenter.checkForUpdates(); snapshot = await window.controlCenter.snapshot(); render(); } catch (error) { snapshot = await window.controlCenter.snapshot(); render(); showNotice(error.message || 'Не удалось проверить обновления', 'error'); } });
  root.querySelector('[data-download-update]')?.addEventListener('click', async button => { button.disabled = true; try { await window.controlCenter.downloadUpdate(); } catch (error) { snapshot = await window.controlCenter.snapshot(); render(); showNotice(error.message || 'Не удалось загрузить обновление', 'error'); } });
  root.querySelector('[data-install-update]')?.addEventListener('click', async button => { button.disabled = true; try { await window.controlCenter.installUpdate(); } catch (error) { button.disabled = false; showNotice(error.message || 'Не удалось установить обновление', 'error'); } });
  if (route.section === 'widgets' && !route.widgetId) {
    root.querySelectorAll('[data-widget-card]').forEach(card => {
      const item = getWidget(card.dataset.widgetCard);
      if (!item || card.querySelector('[data-widget-favorite]')) return;
      const button = document.createElement('button');
      button.className = `widget-favorite-button${item.favorite ? ' is-active' : ''}`;
      button.dataset.widgetFavorite = item.id;
      button.type = 'button';
      button.title = item.favorite ? 'Убрать из избранного' : 'Добавить в избранное';
      button.setAttribute('aria-label', button.title);
      button.textContent = item.favorite ? '★' : '☆';
      card.querySelector('.widget-card-top')?.append(button);
    });
    root.querySelectorAll('[data-widget-favorite]').forEach(button => button.addEventListener('click', async event => {
      event.stopPropagation();
      button.disabled = true;
      const item = getWidget(button.dataset.widgetFavorite);
      try { snapshot = await window.controlCenter.updateWidget(item.id, { favorite: !item.favorite }); render(); showNotice(item.favorite ? 'Виджет убран из избранного' : 'Виджет добавлен в избранное'); }
      catch (error) { button.disabled = false; showNotice(error.message || 'Не удалось изменить избранное', 'error'); }
    }));
  }
  root.querySelector('#widget-search')?.addEventListener('input', event => { const query = event.target.value.trim().toLowerCase(); root.querySelectorAll('[data-widget-card]').forEach(card => { const item = getWidget(card.dataset.widgetCard); card.hidden = !item.name.toLowerCase().includes(query) && !item.category.toLowerCase().includes(query); }); });
  root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { root.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('is-active', item === button)); root.querySelectorAll('[data-widget-card]').forEach(card => { const item = getWidget(card.dataset.widgetCard); card.hidden = button.dataset.filter === 'favorites' ? !item.favorite : button.dataset.filter === 'ready' ? item.state !== 'ready' : button.dataset.filter === 'attention' ? item.state === 'ready' : false; }); }));
  if (route.section === 'logs') {
    const heading = root.querySelector('.log-stream-head');
    if (heading && !heading.querySelector('[data-log-search]')) {
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'log-search-input';
      input.placeholder = 'Найти в журнале…';
      input.value = logQuery;
      input.dataset.logSearch = 'true';
      input.setAttribute('aria-label', 'Поиск по журналу событий');
      input.addEventListener('change', () => { logQuery = input.value; render(); });
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { logQuery = input.value; render(); } });
      heading.insertBefore(input, heading.querySelector('[data-action="refresh"]'));
    }
  }
  root.querySelectorAll('[data-log-filter]').forEach(button => button.addEventListener('click', () => { logFilter = button.dataset.logFilter; render(); }));
  root.querySelector('#help-search')?.addEventListener('input', event => { const query = event.target.value.trim().toLowerCase(); root.querySelectorAll('[data-help-topic]').forEach(card => { card.hidden = query && !card.textContent.toLowerCase().includes(query); }); });
  if (route.section === 'scenes' && snapshot.obs.connected && (!scenePreview || scenePreview.sceneName !== selectedSceneName)) setTimeout(() => loadScenePreview(false), 0);
}

function bindSceneDragging() {
  if (route.section !== 'scenes' || !snapshot.obs.managementEnabled) return;
  const scene = snapshot.obs.scenes.find(item => item.name === selectedSceneName);
  const canvas = root.querySelector('.scene-canvas');
  if (!scene || !canvas) return;
  root.querySelectorAll('.canvas-source.is-managed').forEach(element => element.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const item = scene.items.find(candidate => candidate.id === Number(element.dataset.sceneItem));
    if (!item) return;
    const bounds = canvas.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY; const originX = Number(item.transform?.positionX || 0); const originY = Number(item.transform?.positionY || 0); let moved = false;
    element.setPointerCapture(event.pointerId); element.classList.add('is-dragging');
    const move = moveEvent => { const dx = moveEvent.clientX - startX; const dy = moveEvent.clientY - startY; moved ||= Math.abs(dx) + Math.abs(dy) > 3; element.style.translate = `${dx}px ${dy}px`; };
    const finish = async upEvent => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', finish); element.classList.remove('is-dragging'); element.style.translate = ''; if (!moved) return; const positionX = originX + ((upEvent.clientX - startX) / bounds.width) * (snapshot.obs.video?.baseWidth || 1920); const positionY = originY + ((upEvent.clientY - startY) / bounds.height) * (snapshot.obs.video?.baseHeight || 1080); try { snapshot = await window.controlCenter.obsWidgetAction({ action: 'transform', sceneName: scene.name, sceneItemId: item.id, transform: { positionX, positionY } }); render(); loadScenePreview(true); } catch (error) { showNotice(error.message || 'Источник не перемещён', 'error'); } };
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', finish);
  }));
}

async function loadScenePreview(force = false) {
  if (document.hidden || scenePreviewLoading || route.section !== 'scenes' || !snapshot?.obs.connected || !selectedSceneName) return;
  if (!force && scenePreview?.sceneName === selectedSceneName && Date.now() - scenePreview.receivedAt < 2800) return;
  const requestedScene = selectedSceneName;
  scenePreviewLoading = true;
  root.querySelector('.scene-canvas')?.classList.add('is-loading');
  try {
    const result = await window.controlCenter.obsScenePreview(requestedScene);
    scenePreviewLoading = false;
    if (route.section === 'scenes' && selectedSceneName === requestedScene) { scenePreview = result; render(); }
  } catch (error) {
    if (force) showNotice(error.message || 'Не удалось получить кадр из OBS', 'error');
  } finally { scenePreviewLoading = false; root.querySelector('.scene-canvas')?.classList.remove('is-loading'); }
}

async function refresh(forceRender = false) {
  const next = await window.controlCenter.snapshot();
  snapshot = next;
  const autoPages = ['overview', 'diagnostics', 'logs', 'scenes'];
  if (forceRender || !root.firstElementChild || autoPages.includes(route.section)) {
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
  }
}

window.addEventListener('error', event => window.controlCenter.reportRendererError?.({ message: event.message }));
window.addEventListener('unhandledrejection', event => window.controlCenter.reportRendererError?.({ message: event.reason?.message || String(event.reason) }));
refresh(true);
window.controlCenter.onWorkspaceChanged?.(() => refresh(true));
window.controlCenter.onUpdateChanged?.(() => refresh(true));
setInterval(() => refresh(false), 4000);
setInterval(() => loadScenePreview(false), 3000);
