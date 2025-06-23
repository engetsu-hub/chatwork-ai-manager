const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');
const { spawn } = require('child_process');

// 設定ストア
const store = new Store();

class ChatWorkAIManagerApp {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.pythonProcess = null;
        this.isQuitting = false;
        
        this.init();
    }
    
    init() {
        // アプリケーションイベント
        app.whenReady().then(() => {
            this.createWindow();
            this.createTray();
            this.startPythonBackend();
            this.setupAutoUpdater();
        });
        
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                this.isQuitting = true;
                app.quit();
            }
        });
        
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });
        
        app.on('before-quit', () => {
            this.isQuitting = true;
            this.stopPythonBackend();
        });
        
        // IPCハンドラー
        this.setupIpcHandlers();
    }
    
    createWindow() {
        // メインウィンドウの設定を復元
        const windowState = store.get('windowState', {
            width: 1200,
            height: 800,
            x: undefined,
            y: undefined
        });
        
        this.mainWindow = new BrowserWindow({
            width: windowState.width,
            height: windowState.height,
            x: windowState.x,
            y: windowState.y,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            icon: path.join(__dirname, 'assets', 'icon.png'),
            title: 'ChatWork AI Manager',
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            show: false // 初期化完了まで非表示
        });
        
        // ウィンドウの状態を保存
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting && process.platform === 'darwin') {
                event.preventDefault();
                this.mainWindow.hide();
                return;
            }
            
            // ウィンドウの位置とサイズを保存
            const bounds = this.mainWindow.getBounds();
            store.set('windowState', bounds);
        });
        
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
        
        // ウィンドウが準備できたら表示
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            // 開発モードの場合はDevToolsを開く
            if (process.argv.includes('--dev')) {
                this.mainWindow.webContents.openDevTools();
            }
        });
        
        // メニューを設定
        this.createMenu();
        
        // 最初はローカルのHTMLを読み込み
        this.mainWindow.loadFile('index.html');
        
        // バックエンドが起動したらWebサーバーに接続
        setTimeout(() => {
            this.connectToBackend();
        }, 3000);
    }
    
    createTray() {
        const iconPath = path.join(__dirname, 'assets', 'icon-tray.png');
        this.tray = new Tray(iconPath);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'ChatWork AI Manager を表示',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                    } else {
                        this.createWindow();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'バックエンドを再起動',
                click: () => {
                    this.restartPythonBackend();
                }
            },
            {
                label: '設定',
                click: () => {
                    this.showSettings();
                }
            },
            { type: 'separator' },
            {
                label: '終了',
                click: () => {
                    this.isQuitting = true;
                    app.quit();
                }
            }
        ]);
        
        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip('ChatWork AI Manager');
        
        this.tray.on('double-click', () => {
            if (this.mainWindow) {
                this.mainWindow.show();
                this.mainWindow.focus();
            }
        });
    }
    
    createMenu() {
        const template = [
            {
                label: 'アプリケーション',
                submenu: [
                    {
                        label: 'ChatWork AI Manager について',
                        click: () => {
                            this.showAbout();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '設定...',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => {
                            this.showSettings();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '終了',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            this.isQuitting = true;
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: '表示',
                submenu: [
                    {
                        label: '再読み込み',
                        accelerator: 'CmdOrCtrl+R',
                        click: () => {
                            this.mainWindow.reload();
                        }
                    },
                    {
                        label: '開発者ツール',
                        accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                        click: () => {
                            this.mainWindow.webContents.openDevTools();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '実際のサイズ',
                        accelerator: 'CmdOrCtrl+0',
                        click: () => {
                            this.mainWindow.webContents.setZoomLevel(0);
                        }
                    },
                    {
                        label: '拡大',
                        accelerator: 'CmdOrCtrl+Plus',
                        click: () => {
                            const currentZoom = this.mainWindow.webContents.getZoomLevel();
                            this.mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
                        }
                    },
                    {
                        label: '縮小',
                        accelerator: 'CmdOrCtrl+-',
                        click: () => {
                            const currentZoom = this.mainWindow.webContents.getZoomLevel();
                            this.mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
                        }
                    }
                ]
            },
            {
                label: 'ヘルプ',
                submenu: [
                    {
                        label: 'ドキュメント',
                        click: () => {
                            shell.openExternal('https://github.com/chatwork-ai-manager/docs');
                        }
                    },
                    {
                        label: '問題を報告',
                        click: () => {
                            shell.openExternal('https://github.com/chatwork-ai-manager/issues');
                        }
                    }
                ]
            }
        ];
        
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }
    
    setupIpcHandlers() {
        // 設定の取得
        ipcMain.handle('get-settings', () => {
            return store.get('settings', {});
        });
        
        // 設定の保存
        ipcMain.handle('save-settings', (event, settings) => {
            store.set('settings', settings);
            return true;
        });
        
        // バックエンドの状態取得
        ipcMain.handle('get-backend-status', () => {
            return {
                running: this.pythonProcess !== null,
                pid: this.pythonProcess?.pid || null
            };
        });
        
        // バックエンドの再起動
        ipcMain.handle('restart-backend', () => {
            this.restartPythonBackend();
            return true;
        });
        
        // 通知の表示
        ipcMain.handle('show-notification', (event, options) => {
            const { Notification } = require('electron');
            
            if (Notification.isSupported()) {
                new Notification({
                    title: options.title || 'ChatWork AI Manager',
                    body: options.body,
                    icon: path.join(__dirname, 'assets', 'icon.png')
                }).show();
            }
            
            return true;
        });
    }
    
    startPythonBackend() {
        const pythonPath = store.get('settings.pythonPath', 'python');
        const scriptPath = path.join(__dirname, '..', 'web', 'api_server.py');
        
        try {
            this.pythonProcess = spawn(pythonPath, [scriptPath], {
                cwd: path.join(__dirname, '..'),
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            this.pythonProcess.stdout.on('data', (data) => {
                console.log(`Backend stdout: ${data}`);
            });
            
            this.pythonProcess.stderr.on('data', (data) => {
                console.error(`Backend stderr: ${data}`);
            });
            
            this.pythonProcess.on('close', (code) => {
                console.log(`Backend process exited with code ${code}`);
                this.pythonProcess = null;
                
                // 予期しない終了の場合は再起動を試行
                if (!this.isQuitting && code !== 0) {
                    setTimeout(() => {
                        this.startPythonBackend();
                    }, 5000);
                }
            });
            
            console.log('Python backend started');
            
        } catch (error) {
            console.error('Failed to start Python backend:', error);
            this.showBackendError();
        }
    }
    
    stopPythonBackend() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
            console.log('Python backend stopped');
        }
    }
    
    restartPythonBackend() {
        this.stopPythonBackend();
        setTimeout(() => {
            this.startPythonBackend();
        }, 1000);
    }
    
    connectToBackend() {
        const backendUrl = 'http://127.0.0.1:8000';
        
        // バックエンドが起動しているかチェック
        fetch(`${backendUrl}/api/status`)
            .then(response => {
                if (response.ok) {
                    // バックエンドに接続
                    this.mainWindow.loadURL(backendUrl);
                } else {
                    throw new Error('Backend not ready');
                }
            })
            .catch(error => {
                console.log('Backend not ready, retrying...');
                setTimeout(() => {
                    this.connectToBackend();
                }, 2000);
            });
    }
    
    showAbout() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'ChatWork AI Manager について',
            message: 'ChatWork AI Manager',
            detail: `バージョン: 1.0.0\\nChatWork APIと連携したAI駆動のメッセージ監視・タスク管理システム`,
            buttons: ['OK']
        });
    }
    
    showSettings() {
        // 設定画面を表示（実装省略）
        this.mainWindow.webContents.send('show-settings');
    }
    
    showBackendError() {
        dialog.showErrorBox(
            'バックエンドエラー',
            'Pythonバックエンドの起動に失敗しました。Pythonがインストールされているか確認してください。'
        );
    }
    
    setupAutoUpdater() {
        // 自動更新の設定
        autoUpdater.checkForUpdatesAndNotify();
        
        autoUpdater.on('update-available', () => {
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'アップデート利用可能',
                message: '新しいバージョンが利用可能です。ダウンロードしますか？',
                buttons: ['はい', 'いいえ']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.downloadUpdate();
                }
            });
        });
        
        autoUpdater.on('update-downloaded', () => {
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'アップデート準備完了',
                message: 'アップデートがダウンロードされました。アプリケーションを再起動しますか？',
                buttons: ['再起動', '後で']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
    }
}

// セキュリティ設定
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// アプリケーション開始
new ChatWorkAIManagerApp();