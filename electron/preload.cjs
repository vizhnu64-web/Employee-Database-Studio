const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openExcelFile: () => ipcRenderer.invoke('dialog:open-excel'),
  saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  revealFile: (filePath) => ipcRenderer.invoke('app:reveal-file', filePath),
  onMenuImport: (callback) => {
    ipcRenderer.on('menu:import-file', () => callback());
  },
  onMenuBackup: (callback) => {
    ipcRenderer.on('menu:export-backup', () => callback());
  },
  verifySmtp: (config) => ipcRenderer.invoke('email:verify-smtp', config),
  sendPayslipEmail: (params) => ipcRenderer.invoke('email:send-payslip', params),
  saveEmployeeDocument: (params) => ipcRenderer.invoke('docs:save', params),
  readEmployeeDocument: (storagePath) => ipcRenderer.invoke('docs:read', storagePath),
  deleteEmployeeDocument: (storagePath) => ipcRenderer.invoke('docs:delete', storagePath),
  openEmployeeDocument: (storagePath) => ipcRenderer.invoke('docs:open', storagePath)
});
