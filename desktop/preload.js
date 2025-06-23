const { contextBridge, ipcRenderer } = require('electron');

// セキュアなAPIをレンダラープロセスに公開
contextBridge.exposeInMainWorld('electronAPI', {
    // 設定関連
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    
    // バックエンド関連
    getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
    restartBackend: () => ipcRenderer.invoke('restart-backend'),
    
    // 通知関連
    showNotification: (options) => ipcRenderer.invoke('show-notification', options),
    
    // イベントリスナー
    onShowSettings: (callback) => {
        ipcRenderer.on('show-settings', callback);
    },
    
    // アプリ情報
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
});