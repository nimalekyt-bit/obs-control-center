<p align="center">
  <img src="assets/icon.png" width="112" height="112" alt="OBS Control Center">
</p>

<h1 align="center">OBS Control Center</h1>

<p align="center">
  Локальный центр управления собственными OBS-виджетами: Workspace, Browser Source, сцены, телеметрия и диагностика в одном Windows-приложении.
</p>

<p align="center">
  <a href="https://github.com/nimalekyt-bit/obs-control-center/releases/tag/v0.13.0"><img alt="GitHub release" src="https://img.shields.io/github/v/release/nimalekyt-bit/obs-control-center?include_prereleases&style=flat-square&color=a8f34a"></a>
  <a href="https://github.com/nimalekyt-bit/obs-control-center/actions"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/nimalekyt-bit/obs-control-center/ci.yml?style=flat-square"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-54d6ff?style=flat-square"></a>
  <img alt="Windows 10/11 x64" src="https://img.shields.io/badge/Windows-10%20%2F%2011%20x64-7b8da9?style=flat-square">
</p>

> **Early Access:** публичная версия 0.13.0 предназначена для тестирования. Установщик не подписан Authenticode, поэтому Windows SmartScreen может показать предупреждение «Неизвестный издатель».

[Скачать Early Access](https://github.com/nimalekyt-bit/obs-control-center/releases/tag/v0.13.0) · [Сообщить об ошибке](https://github.com/nimalekyt-bit/obs-control-center/issues)

## Быстрый старт

1. Скачайте `OBS-Control-Center-Setup-0.13.0.exe` только из официального [GitHub Release](https://github.com/nimalekyt-bit/obs-control-center/releases/tag/v0.13.0).
2. Сверьте SHA-256, опубликованный в описании релиза и на странице загрузки.
3. Установите приложение. Из-за отсутствия коммерческой Authenticode-подписи SmartScreen может показать предупреждение.
4. Создайте пустой Workspace или подключите существующую папку виджетов.
5. При необходимости подключите локальный OBS WebSocket v5 — пароль хранится только в памяти текущего запуска.

## Возможности

- единый запуск фоновых сервисов и проверка зависимостей;
- стабильные локальные URL для OBS Browser Source;
- FPS, длинные кадры, ошибки страницы и trace-метрики задержки;
- подключение OBS WebSocket только к локальному OBS: просмотр по умолчанию и явное сессионное управление OCC-источниками;
- безопасный конструктор сцен: добавление, видимость и размещение созданных Control Center Browser Source;
- диагностика, журнал событий, первый запуск и встроенная справка;
- пошаговое знакомство, визуальная библиотека и отдельная страница каждого виджета;
- фильтры событий, поиск по справке и безопасный диагностический отчёт;
- тест синхронизации аудио и видео для записи OBS.
- создание пустого рабочего пространства без заранее подготовленных папок;
- импорт виджетов из папки или ZIP, редактирование параметров и обратимое удаление;
- безопасное переключение рабочих пространств, недавние папки и восстановление резервных копий.

## Разработка

Нужны Node.js, .NET для музыкального скробблера и Python для hotkey-трекера.

```powershell
npm install
npm test
npm start
```

Правила участия описаны в [CONTRIBUTING.md](CONTRIBUTING.md). Проект распространяется по лицензии [MIT](LICENSE).

Сборка portable-версии:

```powershell
npm run dist
```

## Архитектура

Новое рабочее пространство хранит реестр в `occ-workspace.json`. `config/widgets.json` используется только для совместимости с первоначальной структурой проекта. Не храните команды запуска и порты только в `.bat`: приложение должно видеть их, чтобы проверить конфликты и состояние до стрима.

OBS Browser Source должен использовать URL из карточки виджета. Через этот URL Control Center подключает монитор рендера и ошибок.

## Безопасность OBS

Control Center подключается только к `localhost` OBS WebSocket. Пароль используется только во время текущей сессии и не записывается на диск. По умолчанию действует режим чтения. Управление включается явно на одну сессию и допускает изменение только источников с префиксом `OCC •`, созданных самим приложением; трансляция и запись не запускаются.

## Статус совместимости

Целевая сборка — Windows 10/11 x64 и OBS WebSocket v5. Полная матрица чистой установки, нескольких OBS-профилей и длительной телеметрии ещё выполняется. Непроверенные комбинации не считаются официально поддерживаемыми.
