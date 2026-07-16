const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('controlCenter', {
  snapshot: () => ipcRenderer.invoke('snapshot'),
  runProfile: id => ipcRenderer.invoke('run-profile', id),
  serviceAction: (id, action) => ipcRenderer.invoke('service-action', { id, action }),
  runChecks: () => ipcRenderer.invoke('run-checks'),
  connectObs: settings => ipcRenderer.invoke('obs-connect', settings),
  disconnectObs: () => ipcRenderer.invoke('obs-disconnect'),
  enableObsManagement: () => ipcRenderer.invoke('obs-enable-management'),
  obsWidgetAction: payload => ipcRenderer.invoke('obs-widget-action', payload),
  obsScenePreview: sceneName => ipcRenderer.invoke('obs-scene-preview', sceneName),
  chooseWorkspace: () => ipcRenderer.invoke('choose-workspace'),
  createWorkspace: options => ipcRenderer.invoke('create-workspace', options),
  skipWorkspace: () => ipcRenderer.invoke('skip-workspace'),
  migrateWorkspace: () => ipcRenderer.invoke('migrate-workspace'),
  createStarterWidget: () => ipcRenderer.invoke('create-starter-widget'),
  openWorkspace: () => ipcRenderer.invoke('open-workspace'),
  openRecentWorkspace: workspacePath => ipcRenderer.invoke('open-recent-workspace', workspacePath),
  importWidgetFolder: () => ipcRenderer.invoke('import-widget-folder'),
  importWidgetZip: () => ipcRenderer.invoke('import-widget-zip'),
  updateWidget: (id, changes) => ipcRenderer.invoke('update-widget', { id, changes }),
  removeWidget: id => ipcRenderer.invoke('remove-widget', id),
  restoreWorkspaceBackup: id => ipcRenderer.invoke('restore-workspace-backup', id),
  completeOnboarding: () => ipcRenderer.invoke('complete-onboarding'),
  resetOnboarding: () => ipcRenderer.invoke('reset-onboarding'),
  diagnosticReport: () => ipcRenderer.invoke('diagnostic-report'),
  openHelp: key => ipcRenderer.invoke('open-help', key),
  openUrl: url => ipcRenderer.invoke('open-url', url)
  ,reportRendererError: value => ipcRenderer.invoke('renderer-error', value)
  ,setUiScale: value => ipcRenderer.invoke('set-ui-scale', value)
  ,dismissRecovery: () => ipcRenderer.invoke('dismiss-recovery')
  ,checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
  ,downloadUpdate: () => ipcRenderer.invoke('download-update')
  ,installUpdate: () => ipcRenderer.invoke('install-update')
  ,onUpdateChanged: callback => { ipcRenderer.removeAllListeners('update-changed'); ipcRenderer.on('update-changed', () => callback()); }
  ,onWorkspaceChanged: callback => { ipcRenderer.removeAllListeners('workspace-changed'); ipcRenderer.on('workspace-changed', () => callback()); }
});
