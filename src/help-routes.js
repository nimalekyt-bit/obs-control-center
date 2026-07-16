'use strict';

const HELP_ORIGIN = 'https://obs-control-center.pages.dev';
const HELP_HOME_PATH = '/docs/';

const HELP_ROUTES = Object.freeze({
  firstRun: '/docs/first-run/',
  workspace: '/docs/workspace/',
  widgets: '/docs/widgets/',
  obs: '/docs/obs-connection/',
  scenes: '/docs/scenes/',
  telemetry: '/docs/telemetry/',
  avTest: '/docs/av-test/',
  backups: '/docs/backups/'
});

function resolveHelpUrl(key) {
  const path = HELP_ROUTES[String(key)] || HELP_HOME_PATH;
  const url = new URL(path, HELP_ORIGIN);
  if (url.origin !== HELP_ORIGIN || url.protocol !== 'https:' || !url.pathname.startsWith(HELP_HOME_PATH)) {
    return `${HELP_ORIGIN}${HELP_HOME_PATH}`;
  }
  return url.toString();
}

module.exports = { HELP_HOME_PATH, HELP_ORIGIN, HELP_ROUTES, resolveHelpUrl };
