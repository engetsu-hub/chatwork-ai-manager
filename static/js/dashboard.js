// ChatWork AI Manager Dashboard JavaScript

class Dashboard {
    constructor() {
        console.log('🏗️ Dashboard constructor called');
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        console.log('🔧 Initializing Dashboard...');
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadInitialData();
        
        // 定期的にデータを更新（リアルタイム同期）
        this.startRealtimeSync();
    }
    
    startRealtimeSync() {
        // リアルタイム同期設定
        this.syncInterval = 15000; // 15秒間隔
        this.lastSyncTime = Date.now();
        this.syncTimer = null;
        
        // 初回同期後に定期同期を開始
        setTimeout(() => {
            this.startPeriodicSync();
        }, 5000);
        
        console.log('🔄 リアルタイム同期を開始しました (間隔: 15秒)');
    }
    
    startPeriodicSync() {
        // 既存のタイマーをクリア
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        // 定期同期を開始
        this.syncTimer = setInterval(async () => {
            await this.performSilentSync();
        }, this.syncInterval);
        
        console.log('⏰ 定期同期タイマーを開始');
    }
    
    async performSilentSync() {
        try {
            console.log('🔄 サイレント同期を実行中...');
            
            // チャットワーク側に何もログを残さない読み取り専用同期
            await this.silentRefreshData();
            
            this.lastSyncTime = Date.now();
            console.log('✅ サイレント同期完了');
            
        } catch (error) {
            console.error('❌ サイレント同期エラー:', error);
        }
    }
    
    async silentRefreshData() {
        try {
            // 現在表示中のタブに応じて更新
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            
            // 最新メッセージを取得（ChatWork側にログを残さない）
            if (activeTab === 'messages') {
                await this.silentLoadLatestMessages();
            }
            
            // 常にステータスを更新（サマリーカード用）
            await this.silentUpdateRoomStates();
            
            // アラート表示は現在のタブが alerts の場合のみ
            if (activeTab === 'alerts') {
                await this.silentLoadAlerts();
            }
            
        } catch (error) {
            console.error('サイレントデータ更新エラー:', error);
        }
    }
    
    async silentLoadLatestMessages() {
        try {
            const response = await fetch('/api/latest-messages?limit=20');
            if (response.ok) {
                const data = await response.json();
                
                // 新着メッセージがある場合のみUI更新
                const newMessages = this.filterNewMessages(data.messages);
                if (newMessages.length > 0) {
                    this.updateMessagesUI(newMessages, true); // silent = true
                    console.log(`📨 新着メッセージ ${newMessages.length}件を検出`);
                }
            }
        } catch (error) {
            console.error('最新メッセージの取得エラー:', error);
        }
    }
    
    async silentLoadAlerts() {
        try {
            const response = await fetch('/api/alerts');
            if (response.ok) {
                const data = await response.json();
                this.updateAlertsUI(data, true); // silent = true
            }
        } catch (error) {
            console.error('アラート更新エラー:', error);
        }
    }
    
    async silentUpdateRoomStates() {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const data = await response.json();
                this.updateStatusUI(data, true); // silent = true
            }
        } catch (error) {
            console.error('ステータス更新エラー:', error);
        }
    }
    
    filterNewMessages(messages) {
        // 前回同期時刻以降のメッセージのみをフィルタ
        const lastSyncTime = this.lastSyncTime;
        return messages.filter(msg => {
            // send_timeはUnixタイムスタンプ（秒）
            const messageTime = msg.send_time * 1000; // ミリ秒に変換
            return messageTime > lastSyncTime;
        });
    }
    
    updateMessagesUI(messages, silent = false) {
        // メッセージが配列かチェック
        if (!Array.isArray(messages)) {
            console.warn('メッセージが配列ではありません:', messages);
            return;
        }
        
        if (!silent) {
            console.log('💬 メッセージUI更新:', messages.length);
        }
        
        // 既存のdisplayLatestMessagesを再利用（サイレントモード付き）
        this.displayLatestMessages(messages, silent);
        
        // 未読数をバッジで表示
        this.updateNewMessageBadge(messages.length);
    }
    
    updateAlertsUI(data, silent = false) {
        if (!silent) {
            console.log('🚨 アラートUI更新');
        }
        
        // サマリーカードを更新
        this.updateAlertsSummaryCards(data.summary);
        
        // アクティブなタブがアラートの場合のみ詳細表示を更新
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'alerts' && data.pending_alerts) {
            this.updateAlertsDisplay(data.pending_alerts);
        }
    }
    
    updateStatusUI(data, silent = false) {
        if (!silent) {
            console.log('📊 ステータスUI更新');
        }
        
        // ステータス表示を更新（データ構造をそのまま渡す）
        this.updateStatusDisplay(data);
    }
    
    updateAlertsSummaryCards(summary) {
        // アラートサマリーカードを更新
        if (summary) {
            const pendingAlertsEl = document.getElementById('pendingAlerts');
            const highPriorityAlertsEl = document.getElementById('highPriorityAlerts');
            
            if (pendingAlertsEl) {
                pendingAlertsEl.textContent = summary.total || 0;
            }
            if (highPriorityAlertsEl) {
                highPriorityAlertsEl.textContent = summary.by_priority?.high || 0;
            }
        }
    }
    
    updateAlertsDisplay(pendingAlerts) {
        // アラートタブの詳細表示を更新
        if (!Array.isArray(pendingAlerts)) {
            console.warn('アラートが配列ではありません:', pendingAlerts);
            return;
        }
        
        const alertsList = document.getElementById('alertsList');
        const noAlerts = document.getElementById('noAlerts');
        
        if (!alertsList) return;
        
        // 既存のアラートをクリア
        alertsList.innerHTML = '';
        
        if (pendingAlerts.length === 0) {
            if (alertsList) alertsList.style.display = 'none';
            if (noAlerts) noAlerts.style.display = 'block';
            return;
        }
        
        if (alertsList) alertsList.style.display = 'block';
        if (noAlerts) noAlerts.style.display = 'none';
        
        // アラートアイテムを表示
        pendingAlerts.forEach(alert => {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert-item priority-${alert.priority}`;
            
            const time = this.formatUpdateTime(alert.added_at);
            
            alertDiv.innerHTML = `
                <div class="alert-header">
                    <span class="alert-priority">${this.translatePriority(alert.priority)}</span>
                    <span class="alert-time">${time}</span>
                </div>
                <div class="alert-sender">${this.escapeHtml(alert.sender)}</div>
                <div class="alert-body">${this.escapeHtml(alert.body)}</div>
                <div class="alert-actions">
                    <button class="btn btn-sm btn-outline" onclick="dashboard.markAsReplied('${alert.room_id}', '${alert.message_id}')">
                        返信済みにする
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="dashboard.showRoomChat('${alert.room_id}', 'ルーム')">
                        チャットを開く
                    </button>
                </div>
            `;
            
            alertsList.appendChild(alertDiv);
        });
    }
    
    translatePriority(priority) {
        const translations = {
            'high': '高優先度',
            'medium': '中優先度', 
            'low': '低優先度'
        };
        return translations[priority] || priority;
    }
    
    updateNewMessageBadge(count) {
        // メッセージタブにバッジ表示
        const messageTab = document.querySelector('.tab-btn[data-tab="messages"]');
        if (!messageTab) return;
        
        // 既存のバッジを探す
        let badge = messageTab.querySelector('.notification-badge');
        
        if (count > 0) {
            // バッジを作成または更新
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'notification-badge';
                messageTab.appendChild(badge);
            }
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            // カウントが0の場合はバッジを非表示
            if (badge) {
                badge.style.display = 'none';
            }
        }
    }
    
    stopRealtimeSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('⏹️ リアルタイム同期を停止');
        }
    }
    
    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // 更新ボタン
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });
        
        // 強制チェックボタン
        document.getElementById('forceCheckBtn').addEventListener('click', () => {
            this.forceCheckAlerts();
        });
        
        // 分析ボタン
        document.getElementById('analyzeBtn').addEventListener('click', () => {
            this.analyzeMessage();
        });
        
        // セレクトボックスのイベントリスナーを設定
        this.setupSelects();
        
        // 設定保存
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // 監視ルーム選択ボタン
        document.getElementById('selectAllRoomsBtn').addEventListener('click', () => {
            this.selectAllMonitoredRooms(true);
        });
        
        document.getElementById('deselectAllRoomsBtn').addEventListener('click', () => {
            this.selectAllMonitoredRooms(false);
        });
        
        // 削除ログ関連
        document.getElementById('refreshDeletedBtn').addEventListener('click', () => {
            this.loadDeletedMessages();
        });
        
        document.getElementById('clearDeletedBtn').addEventListener('click', () => {
            this.clearDeletedMessages();
        });
        
        // ルーム管理関連
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.showCreateRoomModal();
        });
        
        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNewRoom();
        });
        
        document.getElementById('memberSearchInput').addEventListener('input', (e) => {
            this.filterMembers(e.target.value);
        });
        
        document.getElementById('roomSearchInput').addEventListener('input', (e) => {
            this.filterRooms(e.target.value);
        });
        
        // ソート関連
        document.getElementById('roomSortSelect').addEventListener('change', () => {
            this.sortAndDisplayRooms();
        });
        
        // 新着メッセージ関連
        document.getElementById('messageRoomFilter').addEventListener('change', () => {
            this.filterMessages();
        });
        
        document.getElementById('messageSortOrder').addEventListener('change', () => {
            this.sortAndDisplayMessages();
        });
        
        document.getElementById('refreshMessagesBtn').addEventListener('click', () => {
            this.loadLatestMessages();
        });
        
        // チャット関連
        document.getElementById('sendMessageBtn').addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        document.getElementById('chatMessageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        
    }
    
    setupSelects() {
        console.log('🔧 setupSelects() called');
        
        // ルーム選択セレクトボックス
        const roomSelect = document.getElementById('roomSelect');
        if (roomSelect) {
            roomSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                console.log('🎯 Room selected:', value);
                
                if (value) {
                    // ルームが選択された場合、メッセージを読み込み
                    this.loadMessages(value);
                } else {
                    document.getElementById('messagesList').innerHTML = '<div class="empty-state"><p>ルームを選択してください</p></div>';
                }
            });
        }
        
        // 削除ログルーム選択セレクトボックス
        const deletedRoomSelect = document.getElementById('deletedRoomSelect');
        if (deletedRoomSelect) {
            deletedRoomSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                console.log('🗑️ Deleted room filter:', value);
                this.loadDeletedMessages();
            });
        }
    }
    
    createSelectOptions(selectElement, categories) {
        console.log('🔧 createSelectOptions called');
        console.log('🎯 selectElement:', selectElement);
        console.log('📊 categories:', categories);
        
        if (!selectElement) {
            console.error('❌ selectElement is null/undefined');
            return;
        }
        
        // 既存のオプションをクリア（最初のオプション以外）
        const firstOption = selectElement.options[0];
        selectElement.innerHTML = '';
        if (firstOption) {
            selectElement.appendChild(firstOption);
        }
        
        // カテゴリ絵文字マッピング
        const categoryEmojiMapping = {
            'monitored': '📍',
            'TO': '👤',
            'クライアント窓口': '🏢',
            'projects': '📁',
            'teams': '👥',
            'meetings': '💼',
            'development': '🔧',
            'announcements': '📢',
            'my_chat': '📝',
            'others': '📂'
        };
        
        // カテゴリ名表示マッピング
        const categoryNameMapping = {
            'monitored': '監視対象',
            'TO': 'TO',
            'クライアント窓口': 'クライアント窓口',
            'projects': 'プロジェクト',
            'teams': 'チーム',
            'meetings': '会議',
            'development': '開発',
            'announcements': '通知',
            'my_chat': 'マイチャット',
            'others': 'その他'
        };
        
        // ソート順を取得
        const sortOrder = document.getElementById('roomSortOrder')?.value || 'default';
        
        // カテゴリの表示順序を定義
        const categoryOrder = ['monitored', 'TO', 'クライアント窓口', 'projects', 'teams', 'meetings', 'development', 'announcements', 'my_chat', 'others'];
        
        // 全ルームを収集してソート
        let allRooms = [];
        for (const categoryKey of categoryOrder) {
            const rooms = categories[categoryKey] || [];
            rooms.forEach(room => {
                allRooms.push({
                    ...room,
                    category: categoryKey,
                    categoryName: categoryNameMapping[categoryKey],
                    categoryEmoji: categoryEmojiMapping[categoryKey]
                });
            });
        }
        
        // ソート処理
        allRooms = this.sortRooms(allRooms, sortOrder);
        
        // ソート順によって表示方法を変更
        if (sortOrder !== 'default') {
            // フラットリストで表示
            allRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                
                // ピン留めやステータスアイコンを追加
                let prefix = '';
                if (room.sticky) prefix += '📌 ';
                if (room.unread_count > 0) prefix += `(${room.unread_count}) `;
                
                option.textContent = prefix + room.name;
                option.title = `${room.categoryEmoji} ${room.categoryName} - ${room.name}`;
                selectElement.appendChild(option);
            });
        } else {
            // カテゴリごとにグループ化して表示
            let roomCount = 0;
            for (const categoryKey of categoryOrder) {
                const categoryRooms = allRooms.filter(room => room.category === categoryKey);
                
                if (categoryRooms.length > 0) {
                    const emoji = categoryEmojiMapping[categoryKey] || '💾';
                    const categoryName = categoryNameMapping[categoryKey] || categoryKey;
                    
                    // カテゴリヘッダーを作成（optgroup）
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = `${emoji} ${categoryName}`;
                    
                    // 各ルームをオプションとして追加
                    categoryRooms.forEach(room => {
                        const option = document.createElement('option');
                        option.value = room.room_id;
                        
                        // ピン留めや未読表示
                        let prefix = '';
                        if (room.sticky) prefix += '📌 ';
                        if (room.unread_count > 0) prefix += `(${room.unread_count}) `;
                        
                        option.textContent = prefix + room.name;
                        option.title = room.name;
                        optgroup.appendChild(option);
                        roomCount++;
                    });
                    
                    selectElement.appendChild(optgroup);
                }
            }
        }
        
        console.log(`🎯 Total rooms created: ${allRooms.length}`);
    }
    
    sortRooms(rooms, sortOrder) {
        const sortedRooms = [...rooms];
        
        switch (sortOrder) {
            case 'updated':
                // 最終更新時間でソート（新しい順）
                sortedRooms.sort((a, b) => {
                    const timeA = a.last_update_time || 0;
                    const timeB = b.last_update_time || 0;
                    return timeB - timeA;
                });
                break;
                
            case 'pinned':
                // ピン留め優先、その後更新時間でソート
                sortedRooms.sort((a, b) => {
                    // ピン留めステータスで比較
                    if (a.sticky && !b.sticky) return -1;
                    if (!a.sticky && b.sticky) return 1;
                    
                    // 両方ピン留めまたは両方非ピン留めの場合は更新時間で比較
                    const timeA = a.last_update_time || 0;
                    const timeB = b.last_update_time || 0;
                    return timeB - timeA;
                });
                break;
                
            case 'unread':
                // 未読メッセージ数でソート（多い順）
                sortedRooms.sort((a, b) => {
                    const unreadA = a.unread_count || 0;
                    const unreadB = b.unread_count || 0;
                    if (unreadA !== unreadB) {
                        return unreadB - unreadA;
                    }
                    // 未読数が同じ場合は更新時間でソート
                    const timeA = a.last_update_time || 0;
                    const timeB = b.last_update_time || 0;
                    return timeB - timeA;
                });
                break;
                
            case 'name':
            default:
                // 名前順（アルファベット順）
                sortedRooms.sort((a, b) => {
                    return a.name.localeCompare(b.name, 'ja');
                });
                break;
        }
        
        return sortedRooms;
    }
    
    connectWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus(true);
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connectWebSocket();
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'new_message':
                this.handleNewMessage(data.data);
                break;
            case 'status_update':
                this.updateStatus(data.data);
                break;
            case 'pong':
                // Keep-alive response
                break;
            default:
                console.log('Unknown WebSocket message:', data);
        }
    }
    
    handleNewMessage(messageData) {
        // 新しいメッセージの通知
        this.showToast(`新しいメッセージ: ${messageData.sender}`, 'info');
        
        // 現在開いているチャットルームのメッセージの場合は更新
        if (this.currentChatRoomId === messageData.room_id) {
            this.loadChatMessages(this.currentChatRoomId);
        }
        
        // メッセージタブがアクティブの場合は最新メッセージを更新
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'messages') {
            this.loadLatestMessages();
        }
        
        // ステータスを更新
        this.refreshData();
    }
    
    updateConnectionStatus(connected) {
        const indicator = document.getElementById('statusIndicator');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');
        
        if (connected) {
            dot.classList.remove('disconnected');
            text.textContent = '接続中';
        } else {
            dot.classList.add('disconnected');
            text.textContent = '切断';
        }
    }
    
    async loadInitialData() {
        console.log('🚀 Starting initial data load...');
        this.showLoading(true);
        
        try {
            console.log('📊 Loading status, rooms, and alerts...');
            
            console.log('1️⃣ Loading status...');
            await this.loadStatus();
            
            console.log('2️⃣ Loading rooms with categories...');
            await this.loadRoomsWithCategories();
            
            console.log('3️⃣ Loading alerts...');
            await this.loadAlerts();
            
            console.log('✅ All initial data loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.showToast('初期データの読み込みに失敗しました', 'error');
        }
        
        this.showLoading(false);
        console.log('🎯 Initial data load complete');
    }
    
    async loadRoomsWithCategories() {
        console.log('🔄 Loading rooms with categories...');
        try {
            const response = await fetch('/api/rooms/categories');
            const data = await response.json();
            
            console.log('📊 API Response status:', response.ok);
            console.log('📊 Categories data:', data.categories);
            
            if (response.ok) {
                // メッセージタブのルーム選択を更新
                const roomSelect = document.getElementById('roomSelect');
                console.log('🎯 Room select element found:', !!roomSelect);
                
                if (roomSelect) {
                    console.log('🔧 Creating select options for roomSelect...');
                    this.createSelectOptions(roomSelect, data.categories);
                    console.log('✅ Select options created for roomSelect');
                } else {
                    console.error('❌ roomSelect element not found!');
                }
                
                // 削除メッセージタブのルーム選択を更新
                const deletedRoomSelect = document.getElementById('deletedRoomSelect');
                console.log('🎯 Deleted room select element found:', !!deletedRoomSelect);
                
                if (deletedRoomSelect) {
                    console.log('🔧 Creating select options for deletedRoomSelect...');
                    this.createSelectOptions(deletedRoomSelect, data.categories);
                    console.log('✅ Select options created for deletedRoomSelect');
                } else {
                    console.error('❌ deletedRoomSelect element not found!');
                }
                
                // カスタムセレクトのイベントリスナーを再設定
                console.log('🔧 Re-initializing custom selects after creating options...');
                this.setupCustomSelects();
            } else {
                throw new Error(data.detail || 'Failed to load rooms with categories');
            }
        } catch (error) {
            console.error('❌ Failed to load rooms with categories:', error);
            this.showToast('ルーム情報の読み込みに失敗しました', 'error');
        }
    }
    
    async refreshData() {
        try {
            await Promise.all([
                this.loadStatus(),
                this.loadAlerts()
            ]);
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }
    
    async loadStatus() {
        console.log('📊 loadStatus() called');
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (response.ok) {
                console.log('✅ Status loaded successfully');
                this.updateStatusDisplay(data);
            } else {
                throw new Error(data.detail || 'Status load failed');
            }
        } catch (error) {
            console.error('❌ Failed to load status:', error);
        }
    }
    
    updateStatusDisplay(data) {
        // データ構造を確認してからサマリーカードを更新
        if (data && data.system) {
            const monitoredRoomsEl = document.getElementById('monitoredRooms');
            const processedMessagesEl = document.getElementById('processedMessages');
            const pendingAlertsEl = document.getElementById('pendingAlerts');
            const highPriorityAlertsEl = document.getElementById('highPriorityAlerts');
            
            if (monitoredRoomsEl) {
                monitoredRoomsEl.textContent = data.system.monitored_rooms || 0;
            }
            if (processedMessagesEl) {
                processedMessagesEl.textContent = data.system.processed_messages_count || 0;
            }
            if (pendingAlertsEl && data.alerts) {
                pendingAlertsEl.textContent = data.alerts.total || 0;
            }
            if (highPriorityAlertsEl && data.alerts) {
                highPriorityAlertsEl.textContent = data.alerts.by_priority?.high || 0;
            }
        }
    }
    
    async loadRooms() {
        try {
            const response = await fetch('/api/rooms');
            const data = await response.json();
            
            if (response.ok) {
                this.updateRoomsSelect(data.rooms);
            } else {
                throw new Error(data.detail || 'Rooms load failed');
            }
        } catch (error) {
            console.error('Failed to load rooms:', error);
        }
    }
    
    async loadRoomsWithCategories() {
        try {
            console.log('Loading room categories...');
            const response = await fetch('/api/rooms/categories');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Categories loaded:', data.categories);
            
            if (data.categories) {
                this.updateRoomsSelectWithCategories(data.categories);
            } else {
                throw new Error('No categories data received');
            }
        } catch (error) {
            console.error('Failed to load room categories:', error);
            this.showToast('カテゴリ読み込みに失敗、従来方式で表示します', 'warning');
            // フォールバックとして従来の方法でロード
            await this.loadRooms();
        }
    }
    
    updateRoomsSelectWithCategories(categories) {
        // 複数のselect要素を更新
        const selectIds = ['messageRoomFilter', 'deletedRoomSelect'];
        
        selectIds.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // 既存のオプションをクリア（デフォルトオプション以外）
            const options = select.querySelectorAll('option:not([value=""])');
            options.forEach(option => option.remove());
        });
        
        // 各select要素にルームオプションを追加
        this.populateRoomSelects(categories);
    }
    
    populateRoomSelects(categories) {
        const selectIds = ['messageRoomFilter', 'deletedRoomSelect'];
        
        selectIds.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // 全てのルームを追加
            for (const [categoryKey, rooms] of Object.entries(categories)) {
                rooms.forEach(room => {
                    const option = document.createElement('option');
                    option.value = room.room_id;
                    option.textContent = room.name;
                    select.appendChild(option);
                });
            }
        });
    }
    
    createCategoryOptgroups(select, categories) {
        // ChatWorkの実際のカテゴリ名に絵文字を追加するマッピング
        const categoryEmojiMapping = {
            'monitored': '📍',
            'TO': '👤',
            'クライアント窓口': '🏢',
            'projects': '📁',
            'teams': '👥',
            'meetings': '💼',
            'development': '🔧',
            'announcements': '📢',
            'my_chat': '📝',
            'others': '📂'
        };
        
        // 既存のオプショングループを削除（「ルームを選択...」は保持）
        const existingOptgroups = select.querySelectorAll('optgroup');
        existingOptgroups.forEach(optgroup => optgroup.remove());
        
        // カテゴリにルームがある場合のみオプショングループを作成
        for (const [categoryKey, rooms] of Object.entries(categories)) {
            if (rooms.length > 0) {
                // 絵文字を追加したラベルを作成
                const emoji = categoryEmojiMapping[categoryKey] || '💾';
                const categoryLabel = `${emoji} ${categoryKey}`;
                const optgroup = document.createElement('optgroup');
                optgroup.label = categoryLabel;
                select.appendChild(optgroup);
            }
        }
    }
    
    updateRoomsSelect(rooms) {
        // 複数のselect要素を更新
        const selectIds = ['messageRoomFilter', 'deletedRoomSelect'];
        
        selectIds.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // 既存のオプションをクリア（デフォルトオプション以外）
            const options = select.querySelectorAll('option:not([value=""])');
            options.forEach(option => option.remove());
            
            // 全てのルームを追加
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                option.textContent = room.name;
                select.appendChild(option);
            });
        });
    }
    
    categorizeRooms(rooms) {
        const monitoredRoomIds = ['402903381']; // 監視対象ルームID
        
        const categorized = {
            monitored: [],
            groups: [],
            direct: [],
            test: []
        };
        
        rooms.forEach(room => {
            // 監視対象ルーム
            if (monitoredRoomIds.includes(room.room_id.toString())) {
                categorized.monitored.push(room);
            }
            // テスト用ルーム（名前に「テスト」「test」「AI Manager」が含まれる）
            else if (room.name.match(/(テスト|test|AI Manager|ai manager)/i)) {
                categorized.test.push(room);
            }
            // ダイレクトメッセージ（typeがdirectまたは名前が人名っぽい）
            else if (room.type === 'direct' || room.name.match(/^[一-龯ぁ-ん\s\u3000]+$/)) {
                categorized.direct.push(room);
            }
            // その他はグループチャット
            else {
                categorized.groups.push(room);
            }
        });
        
        return categorized;
    }
    
    async loadAlerts() {
        console.log('🚨 loadAlerts() called');
        try {
            const response = await fetch('/api/alerts');
            const data = await response.json();
            
            if (response.ok) {
                console.log('✅ Alerts loaded successfully');
                this.updateAlertsDisplay(data);
            } else {
                throw new Error(data.detail || 'Alerts load failed');
            }
        } catch (error) {
            console.error('❌ Failed to load alerts:', error);
        }
    }
    
    updateAlertsDisplay(data) {
        const alertsList = document.getElementById('alertsList');
        const noAlerts = document.getElementById('noAlerts');
        
        if (data.pending_alerts.length === 0) {
            alertsList.style.display = 'none';
            noAlerts.style.display = 'block';
            return;
        }
        
        alertsList.style.display = 'block';
        noAlerts.style.display = 'none';
        
        // アラートリストをクリア
        alertsList.innerHTML = '';
        
        // アラートアイテムを生成
        data.pending_alerts.forEach(alert => {
            const alertElement = this.createAlertElement(alert);
            alertsList.appendChild(alertElement);
        });
    }
    
    createAlertElement(alert) {
        const div = document.createElement('div');
        div.className = `alert-item priority-${alert.priority}`;
        
        const timeElapsed = this.formatTimeElapsed(new Date(alert.added_at));
        
        div.innerHTML = `
            <div class="alert-header">
                <div>
                    <strong>${alert.sender}</strong>
                    <span class="priority-badge priority-${alert.priority}">${alert.priority}</span>
                </div>
                <div class="alert-meta">
                    <span>ルーム: ${alert.room_id}</span>
                    <span>経過: ${timeElapsed}</span>
                    <span>通知回数: ${alert.alerts_sent}</span>
                </div>
            </div>
            <div class="alert-body">${this.escapeHtml(alert.body)}</div>
            <div class="alert-actions">
                <button class="btn btn-success" onclick="dashboard.markAsReplied('${alert.room_id}', '${alert.message_id}')">
                    <i class="fas fa-check"></i> 返信済み
                </button>
                <button class="btn btn-outline" onclick="dashboard.viewMessage('${alert.room_id}', '${alert.message_id}')">
                    <i class="fas fa-eye"></i> 詳細
                </button>
            </div>
        `;
        
        return div;
    }
    
    async loadMessages(roomId) {
        console.log('Loading messages for room:', roomId);
        try {
            const response = await fetch(`/api/messages/${roomId}`);
            console.log('Response status:', response.status);
            const data = await response.json();
            
            if (response.ok) {
                this.updateMessagesDisplay(data.messages);
            } else {
                throw new Error(data.detail || 'Messages load failed');
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.showToast('メッセージの読み込みに失敗しました', 'error');
        }
    }
    
    updateMessagesDisplay(messages) {
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = '';
        
        if (messages.length === 0) {
            messagesList.innerHTML = '<div class="empty-state"><p>メッセージがありません</p></div>';
            return;
        }
        
        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesList.appendChild(messageElement);
        });
    }
    
    createMessageElement(message) {
        const div = document.createElement('div');
        div.className = 'message-item';
        
        const sendTime = new Date(message.send_time * 1000);
        const cleanBody = this.formatChatWorkMessage(message.body);
        
        div.innerHTML = `
            <div class="message-header">
                <span class="sender-name">${this.escapeHtml(message.account.name)}</span>
                <span class="message-time">${sendTime.toLocaleString()}</span>
            </div>
            <div class="message-body">${cleanBody}</div>
            <div class="message-actions">
                <button class="action-btn reply-btn" onclick="dashboard.showReplyForm('${message.message_id}', '${message.room_id}')" title="返信">
                    <i class="fas fa-reply"></i>
                </button>
                <button class="action-btn reaction-btn" onclick="dashboard.toggleReactionMenu('${message.message_id}', '${message.room_id}', this)" title="リアクション">
                    <i class="fas fa-heart"></i>
                </button>
                <button class="action-btn quote-btn" onclick="dashboard.showQuoteForm('${message.message_id}', '${message.room_id}', this)" title="引用">
                    <i class="fas fa-quote-right"></i>
                </button>
            </div>
            <div class="reply-form" id="reply-form-${message.message_id}" style="display: none;">
                <textarea placeholder="返信を入力..."></textarea>
                <div class="reply-actions">
                    <button class="btn btn-primary" onclick="dashboard.sendReply('${message.message_id}', '${message.room_id}')">送信</button>
                    <button class="btn btn-outline" onclick="dashboard.hideReplyForm('${message.message_id}')">キャンセル</button>
                </div>
            </div>
            <div class="reaction-menu" id="reaction-menu-${message.message_id}" style="display: none;">
                <div class="reaction-options">
                    <button class="reaction-option" onclick="dashboard.addReaction('${message.message_id}', '${message.room_id}', 'thumbsup')" title="👍">
                        <i class="fas fa-thumbs-up"></i>
                    </button>
                    <button class="reaction-option" onclick="dashboard.addReaction('${message.message_id}', '${message.room_id}', 'thumbsdown')" title="👎">
                        <i class="fas fa-thumbs-down"></i>
                    </button>
                    <button class="reaction-option" onclick="dashboard.addReaction('${message.message_id}', '${message.room_id}', 'clap')" title="👏">
                        <i class="fas fa-hands-clapping"></i>
                    </button>
                    <button class="reaction-option" onclick="dashboard.addReaction('${message.message_id}', '${message.room_id}', 'love')" title="❤️">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        `;
        
        return div;
    }
    
    formatChatWorkMessage(body) {
        if (!body) return '';
        
        let formatted = body;
        
        // ChatWorkの特殊マークアップを処理
        
        // [delete]タグの処理（削除済みメッセージ）
        if (formatted.includes('[delete]') || formatted.includes('[deleted]')) {
            formatted = formatted.replace(/\[delete(d)?\]/g, '<span class="deleted-tag-mark">🗑️ 削除済み</span>');
        }
        
        // [info]タグの処理（システムメッセージ）
        if (formatted.includes('[info]')) {
            // グループチャット作成メッセージ
            if (formatted.includes('[dtext:chatroom_groupchat_created]')) {
                const nameMatch = formatted.match(/\[dtext:chatroom_chatname_is\](.*?)\[dtext:chatroom_set\]/);
                const roomName = nameMatch ? nameMatch[1] : '';
                return `<div class="system-message">📝 グループチャット「${this.escapeHtml(roomName)}」が作成されました</div>`;
            }
            
            // その他のinfoタグは非表示
            if (formatted.match(/^\[info\].*\[\/info\]$/s)) {
                return '<div class="system-message">💬 システムメッセージ</div>';
            }
        }
        
        // [To:ID] メンション形式を変換
        formatted = formatted.replace(/\[To:(\d+)\]/g, '<span class="mention">@メンション</span>');
        
        // [task] タスク形式を変換
        formatted = formatted.replace(/\[task\](.*?)\[\/task\]/gs, '<div class="task-mention">📋 $1</div>');
        
        // [qt] 引用形式を変換
        formatted = formatted.replace(/\[qt\](.*?)\[\/qt\]/gs, '<blockquote>$1</blockquote>');
        
        // [code] コード形式を変換
        formatted = formatted.replace(/\[code\](.*?)\[\/code\]/gs, '<pre><code>$1</code></pre>');
        
        // URL形式を変換
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // 改行を<br>に変換
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 最終的にHTMLエスケープ（既存のタグは保持）
        return formatted;
    }
    
    // サマリーカード詳細表示機能
    async showMonitoredRooms() {
        try {
            const response = await fetch('/api/rooms');
            const data = await response.json();
            
            if (response.ok) {
                const monitoredRoomIds = ['402903381']; // 監視対象ルームID
                const monitoredRooms = data.rooms.filter(room => 
                    monitoredRoomIds.includes(room.room_id.toString())
                );
                
                let content = '<div class="detail-list">';
                monitoredRooms.forEach(room => {
                    content += `
                        <div class="detail-item">
                            <div class="detail-header">
                                <strong>${this.escapeHtml(room.name)}</strong>
                                <span class="room-id">ID: ${room.room_id}</span>
                            </div>
                            <div class="detail-info">
                                <span>メッセージ数: ${room.message_num}</span>
                                <span>未読: ${room.unread_num}</span>
                                <span>タスク: ${room.task_num}</span>
                            </div>
                        </div>
                    `;
                });
                content += '</div>';
                
                this.showModal('監視中ルーム一覧', content);
            }
        } catch (error) {
            this.showToast('監視ルーム情報の取得に失敗しました', 'error');
        }
    }
    
    async showProcessedMessages() {
        try {
            const response = await fetch('/api/processed-messages?limit=50');
            const data = await response.json();
            
            if (response.ok) {
                let content = '<div class="detail-list">';
                
                if (data.messages.length === 0) {
                    content += '<p>処理済みメッセージはまだありません。</p>';
                } else {
                    content += `<p>最新 ${data.messages.length} 件の処理済みメッセージ:</p>`;
                    
                    data.messages.forEach(msg => {
                        const processedTime = new Date(msg.processed_at);
                        const analysis = msg.analysis;
                        
                        content += `
                            <div class="detail-item" style="margin-bottom: 15px; padding: 15px; border: 1px solid #e1e4e8; border-radius: 8px;">
                                <div class="detail-header" style="margin-bottom: 10px;">
                                    <strong>${this.escapeHtml(msg.sender)}</strong>
                                    <span class="priority-badge priority-${analysis.priority}" style="margin-left: 10px;">${analysis.priority}</span>
                                    ${analysis.requires_reply ? '<span style="color: #ff6b6b; margin-left: 10px;"><i class="fas fa-reply"></i> 要返信</span>' : ''}
                                </div>
                                <div class="detail-body" style="margin-bottom: 10px;">
                                    <p style="margin: 5px 0;">${this.escapeHtml(msg.body)}</p>
                                </div>
                                <div class="detail-analysis" style="background: #f6f8fa; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                                    <small>
                                        ${analysis.tasks.length > 0 ? `<div><i class="fas fa-tasks"></i> タスク: ${analysis.tasks.map(t => t.description).join(', ')}</div>` : ''}
                                        ${analysis.questions.length > 0 ? `<div><i class="fas fa-question-circle"></i> 質問: ${analysis.questions.length}件</div>` : ''}
                                        ${analysis.mentions.length > 0 ? `<div><i class="fas fa-at"></i> メンション: ${analysis.mentions.length}件</div>` : ''}
                                        ${analysis.sentiment ? `<div><i class="fas fa-smile"></i> 感情: ${analysis.sentiment}</div>` : ''}
                                    </small>
                                </div>
                                <div class="detail-footer">
                                    <small class="text-muted">
                                        処理時刻: ${processedTime.toLocaleString('ja-JP')}
                                    </small>
                                </div>
                            </div>
                        `;
                    });
                }
                
                content += '</div>';
                this.showModal('処理済みメッセージ詳細', content);
            } else {
                throw new Error(data.detail || 'Failed to fetch processed messages');
            }
        } catch (error) {
            console.error('Failed to fetch processed messages:', error);
            this.showToast('処理済みメッセージの取得に失敗しました', 'error');
        }
    }
    
    async showPendingAlerts() {
        try {
            const response = await fetch('/api/alerts');
            const data = await response.json();
            
            if (response.ok) {
                let content = '<div class="detail-list">';
                
                if (data.pending_alerts.length === 0) {
                    content += '<p>未処理のアラートはありません。</p>';
                } else {
                    data.pending_alerts.forEach(alert => {
                        const timeElapsed = this.formatTimeElapsed(new Date(alert.added_at));
                        content += `
                            <div class="detail-item alert-item priority-${alert.priority}">
                                <div class="detail-header">
                                    <strong>${this.escapeHtml(alert.sender)}</strong>
                                    <span class="priority-badge priority-${alert.priority}">${alert.priority}</span>
                                </div>
                                <div class="detail-body">
                                    <p>${this.escapeHtml(alert.body.substring(0, 100))}${alert.body.length > 100 ? '...' : ''}</p>
                                </div>
                                <div class="detail-footer">
                                    <span>ルーム: ${alert.room_id}</span>
                                    <span>経過時間: ${timeElapsed}</span>
                                    <span>通知回数: ${alert.alerts_sent}</span>
                                </div>
                            </div>
                        `;
                    });
                }
                
                content += '</div>';
                this.showModal('未処理アラート一覧', content);
            }
        } catch (error) {
            this.showToast('アラート情報の取得に失敗しました', 'error');
        }
    }
    
    async showHighPriorityAlerts() {
        try {
            const response = await fetch('/api/alerts');
            const data = await response.json();
            
            if (response.ok) {
                const highPriorityAlerts = data.pending_alerts.filter(alert => alert.priority === 'high');
                
                let content = '<div class="detail-list">';
                
                if (highPriorityAlerts.length === 0) {
                    content += '<p>高優先度のアラートはありません。</p>';
                } else {
                    highPriorityAlerts.forEach(alert => {
                        const timeElapsed = this.formatTimeElapsed(new Date(alert.added_at));
                        content += `
                            <div class="detail-item alert-item priority-high">
                                <div class="detail-header">
                                    <strong>${this.escapeHtml(alert.sender)}</strong>
                                    <span class="priority-badge priority-high">🔥 高優先度</span>
                                </div>
                                <div class="detail-body">
                                    <p>${this.escapeHtml(alert.body.substring(0, 150))}${alert.body.length > 150 ? '...' : ''}</p>
                                </div>
                                <div class="detail-footer">
                                    <span>ルーム: ${alert.room_id}</span>
                                    <span>経過時間: ${timeElapsed}</span>
                                    <span>エスカレーション: Lv.${alert.escalation_level}</span>
                                </div>
                            </div>
                        `;
                    });
                }
                
                content += '</div>';
                this.showModal('高優先度アラート一覧', content);
            }
        } catch (error) {
            this.showToast('高優先度アラート情報の取得に失敗しました', 'error');
        }
    }
    
    showModal(title, content) {
        console.log('showModal called:', title);
        const modal = document.getElementById('detailModal');
        if (!modal) {
            console.error('Modal element not found');
            return;
        }
        
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        
        // インラインstyleを直接設定してCSSより優先させる
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.classList.add('show');
        
        console.log('Modal should be visible now');
        
        // モーダルコンテンツのクリックで閉じることを防ぐ
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.onclick = (e) => {
                e.stopPropagation();
            };
        }
        
        // 少し遅延してから背景クリックイベントを設定
        setTimeout(() => {
            modal.onclick = (e) => {
                console.log('Modal clicked, target:', e.target, 'modal:', modal);
                // 厳密に背景をクリックした場合のみ閉じる
                if (e.target === modal && !modal.querySelector('.modal-content').contains(e.target)) {
                    console.log('Closing modal due to background click');
                    this.closeModal();
                }
            };
        }, 300);
    }
    
    closeModal() {
        console.log('closeModal called');
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            modal.onclick = null; // イベントリスナーを削除
        }
    }
    
    // テスト用のシンプルな関数
    testModal() {
        console.log('Test modal called');
        this.showModal('テスト', '<p>モーダルのテストです。</p>');
    }
    
    async analyzeMessage() {
        const text = document.getElementById('analyzeText').value;
        const senderName = document.getElementById('senderName').value;
        
        if (!text.trim()) {
            this.showToast('分析するテキストを入力してください', 'warning');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: text,
                    account_name: senderName || 'テストユーザー'
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.displayAnalysisResult(data);
            } else {
                throw new Error(data.detail || 'Analysis failed');
            }
        } catch (error) {
            console.error('Failed to analyze message:', error);
            this.showToast('分析に失敗しました', 'error');
        }
        
        this.showLoading(false);
    }
    
    displayAnalysisResult(analysis) {
        const resultDiv = document.getElementById('analysisResult');
        
        resultDiv.innerHTML = `
            <div class="analysis-section">
                <h4><i class="fas fa-info-circle"></i> 基本情報</h4>
                <p><strong>返信必要:</strong> ${analysis.requires_reply ? 'はい' : 'いいえ'}</p>
                <p><strong>優先度:</strong> <span class="priority-badge priority-${analysis.priority}">${analysis.priority}</span></p>
                <p><strong>感情:</strong> ${analysis.sentiment}</p>
                <p><strong>信頼度:</strong> ${Math.round(analysis.confidence_score * 100)}%</p>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${analysis.confidence_score * 100}%"></div>
                </div>
            </div>
            
            ${analysis.tasks.length > 0 ? `
            <div class="analysis-section">
                <h4><i class="fas fa-tasks"></i> 抽出されたタスク (${analysis.tasks.length}件)</h4>
                <ul>
                    ${analysis.tasks.map(task => `<li>${this.escapeHtml(task.description)}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${analysis.questions.length > 0 ? `
            <div class="analysis-section">
                <h4><i class="fas fa-question-circle"></i> 検出された質問 (${analysis.questions.length}件)</h4>
                <ul>
                    ${analysis.questions.map(q => `<li>${this.escapeHtml(q)}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${analysis.mentions.length > 0 ? `
            <div class="analysis-section">
                <h4><i class="fas fa-at"></i> メンション (${analysis.mentions.length}件)</h4>
                <div class="analysis-tags">
                    ${analysis.mentions.map(id => `<span class="tag">@${id}</span>`).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="analysis-section">
                <h4><i class="fas fa-clipboard"></i> サマリー</h4>
                <p>${this.escapeHtml(analysis.summary)}</p>
            </div>
        `;
        
        resultDiv.style.display = 'block';
    }
    
    async forceCheckAlerts() {
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/alerts/force-check', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showToast(`${data.count}件のアラートをチェックしました`, 'success');
                await this.loadAlerts();
            } else {
                throw new Error(data.detail || 'Force check failed');
            }
        } catch (error) {
            console.error('Failed to force check alerts:', error);
            this.showToast('強制チェックに失敗しました', 'error');
        }
        
        this.showLoading(false);
    }
    
    async markAsReplied(roomId, messageId) {
        try {
            const response = await fetch('/api/alerts/mark-replied', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: roomId,
                    message_id: messageId
                })
            });
            
            if (response.ok) {
                this.showToast('返信済みとしてマークしました', 'success');
                await this.loadAlerts();
            } else {
                const data = await response.json();
                throw new Error(data.detail || 'Mark as replied failed');
            }
        } catch (error) {
            console.error('Failed to mark as replied:', error);
            this.showToast('返信済みマークに失敗しました', 'error');
        }
    }
    
    viewMessage(roomId, messageId) {
        // メッセージの詳細表示（実装は省略）
        this.showToast(`メッセージ ${messageId} の詳細表示`, 'info');
    }
    
    async loadDeletedRooms() {
        try {
            const response = await fetch('/api/rooms/categories');
            const data = await response.json();
            
            if (response.ok) {
                // 削除メッセージタブのルーム選択を更新
                const deletedRoomSelect = document.getElementById('deletedRoomSelect');
                this.createSelectOptions(deletedRoomSelect, data.categories);
            }
        } catch (error) {
            console.error('Failed to load rooms for deleted messages:', error);
            this.showToast('削除メッセージ用ルーム情報の読み込みに失敗しました', 'error');
        }
    }
    
    async loadDeletedMessages() {
        try {
            const deletedRoomSelect = document.getElementById('deletedRoomSelect');
            const roomId = deletedRoomSelect ? deletedRoomSelect.value : '';
            const url = roomId ? `/api/deleted-messages/${roomId}` : '/api/deleted-messages';
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (response.ok) {
                this.updateDeletedMessagesDisplay(data.deleted_messages);
            } else {
                throw new Error(data.detail || 'Failed to load deleted messages');
            }
        } catch (error) {
            console.error('Failed to load deleted messages:', error);
            this.showToast('削除メッセージの読み込みに失敗しました', 'error');
        }
    }
    
    updateDeletedMessagesDisplay(deletedMessages) {
        const deletedList = document.getElementById('deletedMessagesList');
        const noDeleted = document.getElementById('noDeletedMessages');
        
        if (deletedMessages.length === 0) {
            deletedList.style.display = 'none';
            noDeleted.style.display = 'block';
            return;
        }
        
        deletedList.style.display = 'block';
        noDeleted.style.display = 'none';
        
        // 削除メッセージリストをクリア
        deletedList.innerHTML = '';
        
        // 削除メッセージアイテムを生成
        deletedMessages.forEach(deletedMsg => {
            const element = this.createDeletedMessageElement(deletedMsg);
            deletedList.appendChild(element);
        });
    }
    
    createDeletedMessageElement(deletedMsg) {
        const div = document.createElement('div');
        div.className = 'deleted-message-item';
        
        const deletedTime = new Date(deletedMsg.deleted_at).toLocaleString();
        const sendTime = new Date(deletedMsg.send_time * 1000).toLocaleString();
        
        // 削除タイプによってバッジを変更
        const deletionBadge = deletedMsg.deletion_type === 'tag' 
            ? '<span class="deleted-badge tag-deletion">[delete]タグによる削除</span>'
            : '<span class="deleted-badge">削除済み</span>';
        
        div.innerHTML = `
            <div class="deleted-message-header">
                <div class="deleted-message-info">
                    <strong>${this.escapeHtml(deletedMsg.sender)}</strong>
                    ${deletionBadge}
                </div>
                <div class="deleted-message-meta">
                    <span>ルーム: ${this.escapeHtml(deletedMsg.room_name || `Room ${deletedMsg.room_id}`)}</span>
                    <span>送信: ${sendTime}</span>
                    <span>削除: ${deletedTime}</span>
                </div>
            </div>
            <div class="deleted-message-body">${this.formatChatWorkMessage(deletedMsg.body)}</div>
        `;
        
        return div;
    }
    
    async clearDeletedMessages() {
        const roomId = document.getElementById('deletedRoomSelect').value;
        const message = roomId ? '選択されたルームの削除ログをクリアしますか？' : '全ルームの削除ログをクリアしますか？';
        
        if (!confirm(message)) {
            return;
        }
        
        try {
            const url = roomId ? `/api/deleted-messages/${roomId}` : '/api/deleted-messages';
            const response = await fetch(url, { method: 'DELETE' });
            
            if (response.ok) {
                this.showToast('削除ログをクリアしました', 'success');
                this.loadDeletedMessages();
            } else {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to clear deleted messages');
            }
        } catch (error) {
            console.error('Failed to clear deleted messages:', error);
            this.showToast('削除ログのクリアに失敗しました', 'error');
        }
    }
    
    showReplyForm(messageId, roomId) {
        // 他の返信フォームを閉じる
        document.querySelectorAll('.reply-form').forEach(form => {
            if (form.id !== `reply-form-${messageId}`) {
                form.style.display = 'none';
            }
        });
        
        const replyForm = document.getElementById(`reply-form-${messageId}`);
        if (replyForm) {
            replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
            if (replyForm.style.display === 'block') {
                const textarea = replyForm.querySelector('textarea');
                textarea.focus();
            }
        }
    }
    
    hideReplyForm(messageId) {
        const replyForm = document.getElementById(`reply-form-${messageId}`);
        if (replyForm) {
            replyForm.style.display = 'none';
            replyForm.querySelector('textarea').value = '';
        }
    }
    
    async sendReply(messageId, roomId) {
        const replyForm = document.getElementById(`reply-form-${messageId}`);
        const textarea = replyForm.querySelector('textarea');
        const replyBody = textarea.value.trim();
        
        if (!replyBody) {
            this.showToast('返信内容を入力してください', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/messages/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_id: messageId,
                    room_id: roomId,
                    reply_body: replyBody,
                    original_sender: null  // 必要に応じて実装
                })
            });
            
            if (response.ok) {
                this.showToast('返信を送信しました', 'success');
                this.hideReplyForm(messageId);
                // メッセージリストを更新
                const currentRoom = document.getElementById('roomSelect').value;
                if (currentRoom === roomId) {
                    setTimeout(() => this.loadMessages(roomId), 1000);
                }
            } else {
                const data = await response.json();
                throw new Error(data.detail || 'Reply failed');
            }
        } catch (error) {
            console.error('Failed to send reply:', error);
            this.showToast('返信の送信に失敗しました', 'error');
        }
    }
    
    toggleReactionMenu(messageId, roomId, button) {
        // 他のリアクションメニューを閉じる
        document.querySelectorAll('.reaction-menu').forEach(menu => {
            if (menu.id !== `reaction-menu-${messageId}`) {
                menu.style.display = 'none';
            }
        });
        
        const reactionMenu = document.getElementById(`reaction-menu-${messageId}`);
        if (reactionMenu) {
            reactionMenu.style.display = reactionMenu.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    async addReaction(messageId, roomId, reaction) {
        try {
            const response = await fetch('/api/messages/reaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_id: messageId,
                    room_id: roomId,
                    reaction: reaction
                })
            });
            
            if (response.ok) {
                this.showToast('リアクションを追加しました', 'success');
                // リアクションメニューを閉じる
                document.getElementById(`reaction-menu-${messageId}`).style.display = 'none';
            } else {
                const data = await response.json();
                throw new Error(data.detail || 'Reaction failed');
            }
        } catch (error) {
            console.error('Failed to add reaction:', error);
            this.showToast('リアクションの追加に失敗しました', 'error');
        }
    }
    
    showQuoteForm(messageId, roomId, button) {
        // メッセージの内容を取得
        const messageItem = button.closest('.message-item');
        const messageBody = messageItem.querySelector('.message-body').textContent;
        
        const quoteComment = prompt('引用コメントを入力してください（空白でもOK）:', '');
        
        if (quoteComment !== null) { // キャンセルされなかった場合
            this.sendQuote(messageId, roomId, messageBody, quoteComment);
        }
    }
    
    async sendQuote(messageId, roomId, originalBody, quoteComment) {
        try {
            const response = await fetch('/api/messages/quote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message_id: messageId,
                    room_id: roomId,
                    original_body: originalBody,
                    quote_comment: quoteComment
                })
            });
            
            if (response.ok) {
                this.showToast('引用メッセージを送信しました', 'success');
                // メッセージリストを更新
                const roomSelect = document.getElementById('roomSelect');
                const currentRoom = roomSelect ? roomSelect.value : '';
                if (currentRoom === roomId) {
                    setTimeout(() => this.loadMessages(roomId), 1000);
                }
            } else {
                const data = await response.json();
                throw new Error(data.detail || 'Quote failed');
            }
        } catch (error) {
            console.error('Failed to send quote:', error);
            this.showToast('引用メッセージの送信に失敗しました', 'error');
        }
    }
    
    async loadMonitoredRoomsSettings() {
        try {
            // 現在の監視ルーム一覧を取得
            const monitoredResponse = await fetch('/api/monitored-rooms');
            const monitoredData = await monitoredResponse.json();
            const monitoredRoomIds = monitoredData.monitored_rooms || [];
            
            // すべてのルームを取得
            const roomsResponse = await fetch('/api/rooms/categories');
            const roomsData = await roomsResponse.json();
            
            if (roomsResponse.ok) {
                this.displayMonitoredRoomsCheckboxes(roomsData.categories, monitoredRoomIds);
            }
        } catch (error) {
            console.error('Failed to load monitored rooms settings:', error);
            this.showToast('監視ルーム設定の読み込みに失敗しました', 'error');
        }
    }
    
    displayMonitoredRoomsCheckboxes(categories, monitoredRoomIds) {
        const container = document.getElementById('monitoredRoomsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        // カテゴリ絵文字マッピング
        const categoryEmojiMapping = {
            'monitored': '📍',
            'TO': '👤',
            'クライアント窓口': '🏢',
            'projects': '📁',
            'teams': '👥',
            'meetings': '💼',
            'development': '🔧',
            'announcements': '📢',
            'my_chat': '📝',
            'others': '📂'
        };
        
        // カテゴリ名表示マッピング
        const categoryNameMapping = {
            'monitored': '監視対象',
            'TO': 'TO',
            'クライアント窓口': 'クライアント窓口',
            'projects': 'プロジェクト',
            'teams': 'チーム',
            'meetings': '会議',
            'development': '開発',
            'announcements': '通知',
            'my_chat': 'マイチャット',
            'others': 'その他'
        };
        
        // カテゴリの表示順序
        const categoryOrder = ['monitored', 'TO', 'クライアント窓口', 'projects', 'teams', 'meetings', 'development', 'announcements', 'my_chat', 'others'];
        
        categoryOrder.forEach(categoryKey => {
            const rooms = categories[categoryKey] || [];
            if (rooms.length === 0) return;
            
            const emoji = categoryEmojiMapping[categoryKey] || '💾';
            const categoryName = categoryNameMapping[categoryKey] || categoryKey;
            
            // カテゴリグループを作成
            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'room-category-group';
            
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'room-category-header';
            categoryHeader.innerHTML = `${emoji} ${categoryName}`;
            categoryGroup.appendChild(categoryHeader);
            
            // ルームチェックボックスを追加
            rooms.forEach(room => {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'room-checkbox-item';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `room-monitor-${room.room_id}`;
                checkbox.value = room.room_id;
                checkbox.checked = monitoredRoomIds.includes(room.room_id);
                
                const label = document.createElement('label');
                label.htmlFor = `room-monitor-${room.room_id}`;
                label.innerHTML = `${room.name} <span class="room-id">(${room.room_id})</span>`;
                
                checkboxItem.appendChild(checkbox);
                checkboxItem.appendChild(label);
                categoryGroup.appendChild(checkboxItem);
            });
            
            container.appendChild(categoryGroup);
        });
    }
    
    selectAllMonitoredRooms(select) {
        const checkboxes = document.querySelectorAll('#monitoredRoomsContainer input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = select;
        });
    }
    
    async saveSettings() {
        try {
            // 監視ルームの選択状態を取得
            const checkboxes = document.querySelectorAll('#monitoredRoomsContainer input[type="checkbox"]:checked');
            const monitoredRoomIds = Array.from(checkboxes).map(cb => cb.value);
            
            // 監視ルームを更新
            const response = await fetch('/api/monitored-rooms', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_ids: monitoredRoomIds
                })
            });
            
            if (response.ok) {
                this.showToast('設定を保存しました', 'success');
                // ステータスを更新
                await this.loadStatus();
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showToast('設定の保存に失敗しました', 'error');
        }
    }
    
    async loadRoomsManagement() {
        try {
            const response = await fetch('/api/rooms/categories');
            const data = await response.json();
            
            if (response.ok) {
                this.roomsData = data.categories; // データを保存
                this.displayRoomsManagement(data.categories);
                // カテゴリフィルターも更新
                this.updateRoomCategoryFilter(data.categories);
            }
        } catch (error) {
            console.error('Failed to load rooms for management:', error);
            this.showToast('ルーム一覧の読み込みに失敗しました', 'error');
        }
    }
    
    displayRoomsManagement(categories) {
        const container = document.getElementById('roomsManagementList');
        if (!container) return;
        
        container.innerHTML = '';
        
        // ソート順を取得
        const sortOrder = document.getElementById('roomSortSelect')?.value || 'name';
        
        // 全ルームを収集
        const categoryOrder = ['monitored', 'TO', 'クライアント窓口', 'projects', 'teams', 'meetings', 'development', 'announcements', 'my_chat', 'others'];
        let allRooms = [];
        
        categoryOrder.forEach(categoryKey => {
            const rooms = categories[categoryKey] || [];
            rooms.forEach(room => {
                allRooms.push({
                    ...room,
                    category: categoryKey
                });
            });
        });
        
        // メンバー数順ソートを追加
        if (sortOrder === 'members') {
            allRooms.sort((a, b) => {
                const membersA = a.member_count || 0;
                const membersB = b.member_count || 0;
                return membersB - membersA;
            });
        } else {
            allRooms = this.sortRooms(allRooms, sortOrder);
        }
        
        // ルームアイテムを表示
        allRooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-management-item';
            roomItem.dataset.roomId = room.room_id;
            roomItem.dataset.roomName = room.name.toLowerCase();
            roomItem.dataset.category = room.category;
            
            // ピン留めアイコンを追加
            let statusIcons = '';
            if (room.sticky) statusIcons += '<i class="fas fa-thumbtack" title="ピン留め"></i> ';
            if (room.unread_count > 0) statusIcons += `<span class="badge badge-primary">${room.unread_count}</span> `;
            
            roomItem.innerHTML = `
                <div class="room-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="room-info">
                    <h4>${statusIcons}${this.escapeHtml(room.name)}</h4>
                    <div class="room-meta">
                        <span><i class="fas fa-users"></i> ${room.member_count || 0} メンバー</span>
                        <span><i class="fas fa-folder"></i> ${this.getCategoryName(room.category)}</span>
                        <span><i class="fas fa-hashtag"></i> ${room.room_id}</span>
                        ${room.last_update_time ? `<span><i class="fas fa-clock"></i> ${this.formatUpdateTime(room.last_update_time)}</span>` : ''}
                    </div>
                </div>
                <div class="room-actions">
                    <button class="btn btn-primary btn-sm" onclick="dashboard.showRoomChat('${room.room_id}', '${this.escapeHtml(room.name).replace(/'/g, "\\'")}')">
                        <i class="fas fa-comments"></i> チャット
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="dashboard.showRoomDetails('${room.room_id}')">
                        <i class="fas fa-info-circle"></i> 詳細
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="dashboard.showRoomMembers('${room.room_id}')">
                        <i class="fas fa-user-friends"></i> メンバー
                    </button>
                </div>
            `;
            
            container.appendChild(roomItem);
        });
        
        if (allRooms.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>ルームがありません</p></div>';
        }
    }
    
    sortAndDisplayRooms() {
        if (this.roomsData) {
            this.displayRoomsManagement(this.roomsData);
        }
    }
    
    formatUpdateTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;
        
        // 1分未満
        if (diff < 60 * 1000) {
            return 'たった今';
        }
        // 1時間未満
        else if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `${minutes}分前`;
        }
        // 24時間未満
        else if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return `${hours}時間前`;
        }
        // 7日未満
        else if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `${days}日前`;
        }
        // それ以降
        else {
            return date.toLocaleDateString('ja-JP');
        }
    }
    
    getCategoryName(categoryKey) {
        const categoryNameMapping = {
            'monitored': '監視対象',
            'TO': 'TO',
            'クライアント窓口': 'クライアント窓口',
            'projects': 'プロジェクト',
            'teams': 'チーム',
            'meetings': '会議',
            'development': '開発',
            'announcements': '通知',
            'my_chat': 'マイチャット',
            'others': 'その他'
        };
        return categoryNameMapping[categoryKey] || categoryKey;
    }
    
    updateRoomCategoryFilter(categories) {
        const filter = document.getElementById('roomCategoryFilter');
        if (!filter) return;
        
        // 既存のオプションをクリア（最初以外）
        filter.innerHTML = '<option value="">すべてのカテゴリ</option>';
        
        const categoryOrder = ['monitored', 'TO', 'クライアント窓口', 'projects', 'teams', 'meetings', 'development', 'announcements', 'my_chat', 'others'];
        
        categoryOrder.forEach(categoryKey => {
            if (categories[categoryKey] && categories[categoryKey].length > 0) {
                const option = document.createElement('option');
                option.value = categoryKey;
                option.textContent = `${this.getCategoryName(categoryKey)} (${categories[categoryKey].length})`;
                filter.appendChild(option);
            }
        });
        
        filter.addEventListener('change', () => this.filterRooms());
    }
    
    filterRooms(searchText = '') {
        const searchInput = document.getElementById('roomSearchInput');
        const categoryFilter = document.getElementById('roomCategoryFilter');
        const search = searchText || (searchInput ? searchInput.value.toLowerCase() : '');
        const category = categoryFilter ? categoryFilter.value : '';
        
        const items = document.querySelectorAll('.room-management-item');
        items.forEach(item => {
            const roomName = item.dataset.roomName || '';
            const roomCategory = item.dataset.category || '';
            
            const matchesSearch = !search || roomName.includes(search);
            const matchesCategory = !category || roomCategory === category;
            
            item.style.display = matchesSearch && matchesCategory ? 'flex' : 'none';
        });
    }
    
    showCreateRoomModal() {
        const modal = document.getElementById('createRoomModal');
        modal.style.display = 'flex';
        
        // メンバーリストを読み込み
        this.loadMembersForSelection();
        
        // フォームをリセット
        document.getElementById('createRoomForm').reset();
        document.getElementById('selectedMembers').innerHTML = '<p class="empty-text">メンバーが選択されていません</p>';
        this.selectedMembers = new Set();
    }
    
    closeCreateRoomModal() {
        const modal = document.getElementById('createRoomModal');
        modal.style.display = 'none';
    }
    
    async loadMembersForSelection() {
        try {
            // コンタクト一覧を取得
            const response = await fetch('/api/contacts');
            const data = await response.json();
            
            if (response.ok) {
                this.displayMembersList(data.contacts || []);
            }
        } catch (error) {
            console.error('Failed to load members:', error);
            this.showToast('メンバー一覧の読み込みに失敗しました', 'error');
        }
    }
    
    displayMembersList(contacts) {
        const container = document.getElementById('membersList');
        if (!container) return;
        
        container.innerHTML = '';
        this.allMembers = contacts;
        
        contacts.forEach(contact => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item';
            memberItem.dataset.memberId = contact.account_id;
            memberItem.dataset.memberName = contact.name.toLowerCase();
            
            const initial = contact.name.charAt(0).toUpperCase();
            
            memberItem.innerHTML = `
                <input type="checkbox" id="member-${contact.account_id}" value="${contact.account_id}">
                <div class="member-avatar">${initial}</div>
                <label for="member-${contact.account_id}" class="member-name">${this.escapeHtml(contact.name)}</label>
                <span class="member-id">${contact.account_id}</span>
            `;
            
            memberItem.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = memberItem.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.toggleMemberSelection(contact);
            });
            
            container.appendChild(memberItem);
        });
    }
    
    filterMembers(searchText) {
        const items = document.querySelectorAll('.member-item');
        const search = searchText.toLowerCase();
        
        items.forEach(item => {
            const memberName = item.dataset.memberName || '';
            item.style.display = !search || memberName.includes(search) ? 'flex' : 'none';
        });
    }
    
    toggleMemberSelection(member) {
        if (!this.selectedMembers) {
            this.selectedMembers = new Set();
        }
        
        const checkbox = document.getElementById(`member-${member.account_id}`);
        const memberItem = checkbox.closest('.member-item');
        
        if (checkbox.checked) {
            this.selectedMembers.add(member);
            memberItem.classList.add('selected');
        } else {
            // Remove member by account_id
            this.selectedMembers.forEach(m => {
                if (m.account_id === member.account_id) {
                    this.selectedMembers.delete(m);
                }
            });
            memberItem.classList.remove('selected');
        }
        
        this.updateSelectedMembersDisplay();
    }
    
    updateSelectedMembersDisplay() {
        const container = document.getElementById('selectedMembers');
        if (!container) return;
        
        if (this.selectedMembers.size === 0) {
            container.innerHTML = '<p class="empty-text">メンバーが選択されていません</p>';
        } else {
            container.innerHTML = '';
            this.selectedMembers.forEach(member => {
                const chip = document.createElement('span');
                chip.className = 'selected-member-chip';
                chip.innerHTML = `
                    ${this.escapeHtml(member.name)}
                    <button type="button" onclick="dashboard.removeMemberSelection('${member.account_id}')">&times;</button>
                `;
                container.appendChild(chip);
            });
        }
    }
    
    removeMemberSelection(accountId) {
        const checkbox = document.getElementById(`member-${accountId}`);
        if (checkbox) {
            checkbox.checked = false;
            const memberItem = checkbox.closest('.member-item');
            if (memberItem) {
                memberItem.classList.remove('selected');
            }
        }
        
        // Remove from selectedMembers
        this.selectedMembers.forEach(member => {
            if (member.account_id === accountId) {
                this.selectedMembers.delete(member);
            }
        });
        
        this.updateSelectedMembersDisplay();
    }
    
    async createNewRoom() {
        const name = document.getElementById('roomName').value.trim();
        const description = document.getElementById('roomDescription').value.trim();
        
        if (!name) {
            this.showToast('ルーム名を入力してください', 'error');
            return;
        }
        
        const memberIds = Array.from(this.selectedMembers).map(m => m.account_id);
        
        if (memberIds.length === 0) {
            this.showToast('少なくとも1人のメンバーを選択してください', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/rooms/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    member_ids: memberIds
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.showToast('ルームを作成しました', 'success');
                this.closeCreateRoomModal();
                // ルーム一覧を更新
                await this.loadRoomsManagement();
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create room');
            }
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showToast('ルームの作成に失敗しました: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    async showRoomDetails(roomId) {
        // TODO: ルーム詳細表示の実装
        this.showToast(`ルーム詳細機能は開発中です (ID: ${roomId})`, 'info');
    }
    
    async showRoomMembers(roomId) {
        // TODO: ルームメンバー管理の実装
        this.showToast(`メンバー管理機能は開発中です (ID: ${roomId})`, 'info');
    }
    
    async showRoomChat(roomId, roomName) {
        console.log(`🎯 Opening chat for room: ${roomId} - ${roomName}`);
        
        // モーダルを表示
        const modal = document.getElementById('chatModal');
        const title = document.getElementById('chatModalTitle');
        title.innerHTML = `<i class="fas fa-comments"></i> ${this.escapeHtml(roomName)}`;
        
        // 現在のルームIDを保存
        this.currentChatRoomId = roomId;
        this.currentRoomName = roomName;
        
        // 初期化
        this.clearReply();
        this.clearFileAttachment();
        this.clearToSelection();
        
        modal.style.display = 'flex';
        
        // チャットメッセージとルームメンバーを並行して読み込み
        await Promise.all([
            this.loadChatMessages(roomId),
            this.loadRoomMembers(roomId)
        ]);
        
        // イベントリスナーを設定
        this.setupChatEventListeners();
    }
    
    closeChatModal() {
        const modal = document.getElementById('chatModal');
        modal.style.display = 'none';
        this.currentChatRoomId = null;
        this.currentRoomName = null;
        this.clearReply();
        this.clearFileAttachment();
        this.clearToSelection();
    }
    
    async loadRoomMembers(roomId) {
        try {
            const response = await fetch(`/api/rooms/${roomId}/members`);
            const data = await response.json();
            
            if (response.ok) {
                this.populateToSelect(data.members || []);
            } else {
                console.error('Failed to load room members:', data.detail);
            }
        } catch (error) {
            console.error('Error loading room members:', error);
        }
    }
    
    populateToSelect(members) {
        const toSelect = document.getElementById('toMemberSelect');
        if (!toSelect) return;
        
        toSelect.innerHTML = '';
        this.roomMembers = members; // メンバー情報を保存
        
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.account_id;
            option.textContent = member.name;
            toSelect.appendChild(option);
        });
    }
    
    setupChatEventListeners() {
        // 既存のリスナーをクリア
        this.removeChatEventListeners();
        
        // ファイル添付
        const attachBtn = document.getElementById('attachFileBtn');
        const fileInput = document.getElementById('fileInput');
        
        this.attachFileHandler = () => fileInput.click();
        this.fileChangeHandler = (e) => this.handleFileSelect(e);
        
        if (attachBtn) attachBtn.addEventListener('click', this.attachFileHandler);
        if (fileInput) fileInput.addEventListener('change', this.fileChangeHandler);
        
        // TO機能
        const toSelect = document.getElementById('toMemberSelect');
        const clearToBtn = document.getElementById('clearToBtn');
        
        this.toChangeHandler = () => this.updateMessageWithToMembers();
        this.clearToHandler = () => this.clearToSelection();
        
        if (toSelect) toSelect.addEventListener('change', this.toChangeHandler);
        if (clearToBtn) clearToBtn.addEventListener('click', this.clearToHandler);
        
        // 返信キャンセル
        const cancelReplyBtn = document.getElementById('cancelReplyBtn');
        this.cancelReplyHandler = () => this.clearReply();
        if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', this.cancelReplyHandler);
        
        // ファイル削除
        const removeFileBtn = document.getElementById('removeFileBtn');
        this.removeFileHandler = () => this.clearFileAttachment();
        if (removeFileBtn) removeFileBtn.addEventListener('click', this.removeFileHandler);
    }
    
    removeChatEventListeners() {
        const attachBtn = document.getElementById('attachFileBtn');
        const fileInput = document.getElementById('fileInput');
        const toSelect = document.getElementById('toMemberSelect');
        const clearToBtn = document.getElementById('clearToBtn');
        const cancelReplyBtn = document.getElementById('cancelReplyBtn');
        const removeFileBtn = document.getElementById('removeFileBtn');
        
        if (attachBtn && this.attachFileHandler) {
            attachBtn.removeEventListener('click', this.attachFileHandler);
        }
        if (fileInput && this.fileChangeHandler) {
            fileInput.removeEventListener('change', this.fileChangeHandler);
        }
        if (toSelect && this.toChangeHandler) {
            toSelect.removeEventListener('change', this.toChangeHandler);
        }
        if (clearToBtn && this.clearToHandler) {
            clearToBtn.removeEventListener('click', this.clearToHandler);
        }
        if (cancelReplyBtn && this.cancelReplyHandler) {
            cancelReplyBtn.removeEventListener('click', this.cancelReplyHandler);
        }
        if (removeFileBtn && this.removeFileHandler) {
            removeFileBtn.removeEventListener('click', this.removeFileHandler);
        }
    }
    
    // TO機能関連メソッド
    updateMessageWithToMembers() {
        const messageInput = document.getElementById('chatMessageInput');
        if (!messageInput) return;
        
        const selectedMembers = this.getSelectedToMembers();
        let currentValue = messageInput.value;
        
        // 既存のTO部分を削除（メッセージの先頭から）
        currentValue = currentValue.replace(/^(\[To:[^\]]+\]\s*)+/, '');
        
        // 新しいTO部分を構築
        let toPrefix = '';
        if (selectedMembers.length > 0) {
            selectedMembers.forEach(member => {
                toPrefix += `[To:${member.name}] `;
            });
        }
        
        // メッセージを更新
        messageInput.value = toPrefix + currentValue;
        messageInput.focus();
        
        // カーソルを最後に移動
        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
    }
    
    clearToSelection() {
        const toSelect = document.getElementById('toMemberSelect');
        if (toSelect) {
            Array.from(toSelect.options).forEach(option => option.selected = false);
        }
        // メッセージからTO部分も削除
        this.updateMessageWithToMembers();
    }
    
    getSelectedToMembers() {
        const toSelect = document.getElementById('toMemberSelect');
        if (!toSelect) return [];
        
        return Array.from(toSelect.selectedOptions).map(option => ({
            account_id: option.value,
            name: option.textContent
        }));
    }
    
    // 返信機能関連メソッド
    startReply(messageId, senderName, messageBody) {
        const replyingTo = document.getElementById('replyingTo');
        const replyToText = document.getElementById('replyToText');
        const replyPreview = document.getElementById('replyMessagePreview');
        const messageInput = document.getElementById('chatMessageInput');
        
        if (replyingTo && replyToText && replyPreview && messageInput) {
            this.replyingToMessage = {
                messageId: messageId,
                senderName: senderName,
                body: messageBody
            };
            
            replyToText.textContent = `${senderName} への返信`;
            replyPreview.textContent = messageBody.length > 100 ? 
                messageBody.substring(0, 100) + '...' : messageBody;
            
            replyingTo.style.display = 'block';
            
            // メッセージに[返信]プレフィックスを追加
            this.updateMessageWithReply();
            
            // メッセージ入力欄にフォーカス
            messageInput.focus();
        }
    }
    
    updateMessageWithReply() {
        const messageInput = document.getElementById('chatMessageInput');
        if (!messageInput || !this.replyingToMessage) return;
        
        let currentValue = messageInput.value;
        
        // 既存の[返信]部分を削除
        currentValue = currentValue.replace(/^\[返信\]\s*/, '');
        
        // 既存のTO部分を保持
        const toMatch = currentValue.match(/^(\[To:[^\]]+\]\s*)+/);
        let toPrefix = toMatch ? toMatch[0] : '';
        let messageContent = currentValue.replace(/^(\[To:[^\]]+\]\s*)+/, '');
        
        // [返信]プレフィックスを追加
        messageInput.value = toPrefix + '[返信] ' + messageContent;
        
        // カーソルを最後に移動
        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
    }
    
    clearReply() {
        const replyingTo = document.getElementById('replyingTo');
        const messageInput = document.getElementById('chatMessageInput');
        
        if (replyingTo) {
            replyingTo.style.display = 'none';
        }
        
        // メッセージから[返信]部分を削除
        if (messageInput) {
            let currentValue = messageInput.value;
            currentValue = currentValue.replace(/^\[返信\]\s*/, '');
            messageInput.value = currentValue;
        }
        
        this.replyingToMessage = null;
    }
    
    // ファイル添付関連メソッド
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 画像ファイルのみ許可
        if (!file.type.startsWith('image/')) {
            this.showToast('画像ファイルのみ添付できます', 'error');
            return;
        }
        
        // ファイルサイズチェック（10MB制限）
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('ファイルサイズは10MB以下にしてください', 'error');
            return;
        }
        
        this.attachedFile = file;
        this.showFilePreview(file);
    }
    
    showFilePreview(file) {
        const filePreview = document.getElementById('filePreview');
        const fileName = document.getElementById('fileName');
        
        if (filePreview && fileName) {
            fileName.textContent = file.name;
            filePreview.style.display = 'block';
        }
    }
    
    clearFileAttachment() {
        const filePreview = document.getElementById('filePreview');
        const fileInput = document.getElementById('fileInput');
        
        if (filePreview) {
            filePreview.style.display = 'none';
        }
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.attachedFile = null;
    }
    
    async loadChatMessages(roomId) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/rooms/${roomId}/messages`);
            const data = await response.json();
            
            if (response.ok) {
                this.displayChatMessages(data.messages || []);
            } else {
                throw new Error(data.detail || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Failed to load chat messages:', error);
            this.showToast('チャットメッセージの読み込みに失敗しました', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    displayChatMessages(messages) {
        const container = document.getElementById('chatMessagesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>メッセージがありません</p></div>';
            return;
        }
        
        // メッセージを時間順でソート（古い順）
        const sortedMessages = messages.sort((a, b) => a.send_time - b.send_time);
        
        sortedMessages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            
            const initial = message.account.name.charAt(0).toUpperCase();
            const time = new Date(message.send_time * 1000).toLocaleString('ja-JP');
            
            // メッセージボディを解析（TO、返信、画像などを処理）
            const parsedContent = this.parseMessageContent(message.body);
            
            messageDiv.innerHTML = `
                <div class="chat-message-avatar">${initial}</div>
                <div class="chat-message-content">
                    <div class="chat-message-header">
                        <span class="chat-message-sender">${this.escapeHtml(message.account.name)}</span>
                        <span class="chat-message-time">${time}</span>
                    </div>
                    ${parsedContent}
                    <div class="message-actions">
                        <button class="message-action-btn" onclick="dashboard.startReply('${message.message_id}', '${this.escapeHtml(message.account.name).replace(/'/g, "\\'")}', '${this.escapeHtml(message.body).replace(/'/g, "\\'")}')">
                            <i class="fas fa-reply"></i> 返信
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(messageDiv);
        });
        
        // 最新メッセージまでスクロール
        container.scrollTop = container.scrollHeight;
    }
    
    parseMessageContent(body) {
        let content = body;
        let parsedHtml = '';
        
        // TOタグの処理 [To:名前] または [To:123456]
        const toMatches = content.match(/\[To:[^\]]+\]/g);
        if (toMatches) {
            toMatches.forEach(match => {
                const toTarget = match.match(/\[To:([^\]]+)\]/)[1];
                parsedHtml += `<span class="message-to">TO: ${toTarget}</span>`;
                content = content.replace(match, '');
            });
        }
        
        // 返信タグの処理 [返信]
        const replyMatch = content.match(/\[返信\]/);
        if (replyMatch) {
            parsedHtml += `<span class="message-reply-tag">返信</span>`;
            content = content.replace(/\[返信\]\s*/, '');
        }
        
        // 引用タグの処理 [qt]...[/qt]
        const quoteMatch = content.match(/\[qt\](.*?)\[\/qt\]/s);
        if (quoteMatch) {
            parsedHtml += `
                <div class="message-reply">
                    <div class="message-reply-header">引用:</div>
                    <div class="message-reply-content">${this.escapeHtml(quoteMatch[1])}</div>
                </div>
            `;
            content = content.replace(quoteMatch[0], '');
        }
        
        // 残りのコンテンツをメッセージボディとして表示
        parsedHtml += `<div class="chat-message-body">${this.escapeHtml(content.trim())}</div>`;
        
        return parsedHtml;
    }
    
    async sendChatMessage() {
        const input = document.getElementById('chatMessageInput');
        let message = input.value.trim();
        
        if (!message && !this.attachedFile) {
            return;
        }
        
        if (!this.currentChatRoomId) {
            this.showToast('ルームが選択されていません', 'error');
            return;
        }
        
        try {
            // ChatWork形式のメッセージを構築（メッセージ入力欄の内容をそのまま使用）
            let formattedMessage = message;
            
            // 返信機能の処理（引用を追加）
            if (this.replyingToMessage) {
                const replyBody = this.replyingToMessage.body.length > 100 ? 
                    this.replyingToMessage.body.substring(0, 100) + '...' : 
                    this.replyingToMessage.body;
                
                // メッセージに引用を挿入
                const toAndReplyMatch = formattedMessage.match(/^((?:\[To:[^\]]+\]\s*)*\[返信\]\s*)/);
                if (toAndReplyMatch) {
                    // TO や [返信] の後に引用を挿入
                    const prefix = toAndReplyMatch[1];
                    const rest = formattedMessage.substring(prefix.length);
                    formattedMessage = prefix + `[qt]${replyBody}[/qt]\n` + rest;
                } else {
                    // 引用をメッセージの先頭に追加
                    formattedMessage = `[qt]${replyBody}[/qt]\n` + formattedMessage;
                }
            }
            
            // TO名前をIDに変換（API送信用）
            if (this.roomMembers) {
                this.roomMembers.forEach(member => {
                    const namePattern = new RegExp(`\\[To:${member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
                    formattedMessage = formattedMessage.replace(namePattern, `[To:${member.account_id}]`);
                });
            }
            
            // 画像添付の場合（実際のファイルアップロードは簡略化）
            if (this.attachedFile) {
                formattedMessage += `\n[添付画像: ${this.attachedFile.name}]`;
                this.showToast('画像添付は開発中です。ファイル名のみ送信されます。', 'info');
            }
            
            if (!formattedMessage.trim()) {
                this.showToast('メッセージまたはファイルを入力してください', 'error');
                return;
            }
            
            const response = await fetch(`/api/rooms/${this.currentChatRoomId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: formattedMessage
                })
            });
            
            if (response.ok) {
                // 送信成功時の処理
                input.value = '';
                this.clearReply();
                this.clearFileAttachment();
                this.clearToSelection();
                
                // メッセージを再読み込み
                await this.loadChatMessages(this.currentChatRoomId);
                this.showToast('メッセージを送信しました', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to send message');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showToast('メッセージの送信に失敗しました: ' + error.message, 'error');
        }
    }
    
    async loadLatestMessages() {
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/latest-messages');
            const data = await response.json();
            
            if (response.ok) {
                this.latestMessages = data.messages || [];
                this.displayLatestMessages();
            } else {
                throw new Error(data.detail || 'Failed to load latest messages');
            }
        } catch (error) {
            console.error('Failed to load latest messages:', error);
            this.showToast('新着メッセージの読み込みに失敗しました', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    displayLatestMessages(newMessages = null, silent = false) {
        const container = document.getElementById('messagesList');
        const noMessages = document.getElementById('noMessages');
        
        if (!container) return;
        
        // 新着メッセージが渡された場合はそれを使用、そうでなければ既存データをフィルタ
        let messages;
        if (newMessages) {
            messages = newMessages;
            if (!silent) {
                console.log('💫 新着メッセージを表示:', messages.length);
            }
        } else {
            messages = this.filterAndSortMessages();
        }
        
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.style.display = 'none';
            noMessages.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        noMessages.style.display = 'none';
        
        messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message-item ${message.unread ? 'unread' : ''}`;
            
            const time = this.formatUpdateTime(message.send_time);
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    <div class="message-room-info">
                        <span class="message-room-name">${this.escapeHtml(message.room_name)}</span>
                        <span class="message-sender">${this.escapeHtml(message.account.name)}</span>
                    </div>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-body">${this.escapeHtml(message.body.substring(0, 200))}${message.body.length > 200 ? '...' : ''}</div>
                <div class="message-actions">
                    <button class="btn btn-outline btn-sm" onclick="dashboard.showRoomChat('${message.room_id}', '${this.escapeHtml(message.room_name).replace(/'/g, "\\'")}')">
                        <i class="fas fa-comments"></i> チャットを開く
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="dashboard.replyToMessage('${message.message_id}', '${message.room_id}')">
                        <i class="fas fa-reply"></i> 返信
                    </button>
                </div>
            `;
            
            container.appendChild(messageDiv);
        });
    }
    
    filterAndSortMessages() {
        if (!this.latestMessages) return [];
        
        let messages = [...this.latestMessages];
        
        // ルームフィルター
        const roomFilter = document.getElementById('messageRoomFilter')?.value;
        if (roomFilter) {
            messages = messages.filter(msg => msg.room_id === roomFilter);
        }
        
        // ソート
        const sortOrder = document.getElementById('messageSortOrder')?.value || 'time';
        
        switch (sortOrder) {
            case 'room':
                messages.sort((a, b) => {
                    const roomCompare = a.room_name.localeCompare(b.room_name, 'ja');
                    if (roomCompare !== 0) return roomCompare;
                    return b.send_time - a.send_time;
                });
                break;
            case 'priority':
                messages.sort((a, b) => {
                    // 未読を優先、その後時間順
                    if (a.unread && !b.unread) return -1;
                    if (!a.unread && b.unread) return 1;
                    return b.send_time - a.send_time;
                });
                break;
            case 'unread':
                messages.sort((a, b) => {
                    if (a.unread && !b.unread) return -1;
                    if (!a.unread && b.unread) return 1;
                    return 0;
                });
                break;
            case 'time':
            default:
                messages.sort((a, b) => b.send_time - a.send_time);
                break;
        }
        
        return messages;
    }
    
    updateMessageRoomFilter() {
        const filter = document.getElementById('messageRoomFilter');
        if (!filter) return;
        
        // 既存のオプションをクリア（最初以外）
        filter.innerHTML = '<option value="">すべてのルーム</option>';
        
        if (this.latestMessages) {
            // ユニークなルームを取得
            const rooms = [...new Map(this.latestMessages.map(msg => [msg.room_id, msg])).values()];
            
            rooms.forEach(msg => {
                const option = document.createElement('option');
                option.value = msg.room_id;
                option.textContent = msg.room_name;
                filter.appendChild(option);
            });
        }
    }
    
    filterMessages() {
        this.displayLatestMessages();
    }
    
    sortAndDisplayMessages() {
        this.displayLatestMessages();
    }
    
    async replyToMessage(messageId, roomId) {
        // TODO: 返信機能の実装
        this.showToast(`返信機能は開発中です (Message: ${messageId})`, 'info');
    }
    
    switchTab(tabName) {
        // アクティブなタブを切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // タブボタンとパネルの存在チェック
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        const tabPanel = document.getElementById(tabName);
        
        if (tabButton) {
            tabButton.classList.add('active');
        }
        if (tabPanel) {
            tabPanel.classList.add('active');
        }
        
        // タブ固有の処理
        if (tabName === 'messages') {
            // 新着メッセージタブの処理
            this.loadLatestMessages();
            this.updateMessageRoomFilter();
        } else if (tabName === 'deleted') {
            // 削除ログタブでルーム一覧と削除メッセージを読み込み
            this.loadDeletedRooms();
            this.loadDeletedMessages();
        } else if (tabName === 'settings') {
            // 設定タブで監視ルーム一覧を読み込み
            this.loadMonitoredRoomsSettings();
        } else if (tabName === 'rooms') {
            // ルーム管理タブでルーム一覧を読み込み
            this.loadRoomsManagement();
        }
    }
    
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        container.appendChild(toast);
        
        // アニメーションで表示
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 5秒後に削除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 5000);
    }
    
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    formatTimeElapsed(startTime) {
        const now = new Date();
        const diff = now - startTime;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}日${hours % 24}時間`;
        } else if (hours > 0) {
            return `${hours}時間${minutes % 60}分`;
        } else {
            return `${minutes}分`;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// アプリケーション初期化
let dashboard;

// DOMContentLoadedを待って初期化
console.log('🎯 Document ready state:', document.readyState);

if (document.readyState === 'loading') {
    console.log('📝 Document still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 DOMContentLoaded event fired, initializing Dashboard...');
        dashboard = new Dashboard();
    });
} else {
    console.log('🚀 Document already loaded, initializing Dashboard immediately...');
    dashboard = new Dashboard();
}

// デバッグ用グローバル関数
window.debugDropdown = () => {
    console.log('🔍 Debug: Checking dropdown elements...');
    
    const roomSelect = document.getElementById('roomSelect');
    console.log('roomSelect found:', !!roomSelect);
    
    if (roomSelect) {
        const trigger = roomSelect.querySelector('.select-trigger');
        const options = roomSelect.querySelector('.select-options');
        
        console.log('  - trigger found:', !!trigger);
        console.log('  - options found:', !!options);
        console.log('  - current classes:', roomSelect.className);
        
        if (trigger) {
            console.log('🖱️ Simulating click...');
            trigger.click();
        }
    }
};

// エラーハンドリング強化
window.addEventListener('error', (event) => {
    // ブラウザ拡張機能関連のエラーを無視
    if (event.message && event.message.includes('message channel closed')) {
        event.preventDefault();
        console.warn('Browser extension error ignored:', event.message);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    // 非同期エラーのハンドリング
    if (event.reason && event.reason.message && event.reason.message.includes('message channel closed')) {
        event.preventDefault();
        console.warn('Browser extension async error ignored:', event.reason.message);
    }
});

// グローバル関数（HTMLから呼び出し可能）
function testModal() {
    if (dashboard) {
        console.log('Global testModal called');
        const modal = document.getElementById('detailModal');
        console.log('Modal element:', modal);
        dashboard.showModal('テスト', '<p>モーダルのテストです。クリックが動作しています！</p>');
    }
}

function showMonitoredRooms() {
    if (dashboard) {
        dashboard.showMonitoredRooms();
    }
}

function showProcessedMessages() {
    if (dashboard) {
        dashboard.showProcessedMessages();
    }
}

function showPendingAlerts() {
    if (dashboard) {
        dashboard.showPendingAlerts();
    }
}

function showHighPriorityAlerts() {
    if (dashboard) {
        dashboard.showHighPriorityAlerts();
    }
}

function closeModal() {
    if (dashboard) {
        dashboard.closeModal();
    }
}