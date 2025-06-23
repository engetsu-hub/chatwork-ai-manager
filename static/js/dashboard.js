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
        
        // 定期的にデータを更新
        setInterval(() => this.refreshData(), 30000);
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
        
        // カスタムセレクトボックスのイベントリスナーを設定
        this.setupCustomSelects();
        
        // 設定保存
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // 削除ログ関連
        document.getElementById('refreshDeletedBtn').addEventListener('click', () => {
            this.loadDeletedMessages();
        });
        
        document.getElementById('clearDeletedBtn').addEventListener('click', () => {
            this.clearDeletedMessages();
        });
        
        // 外部クリックでドロップダウンを閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-select')) {
                document.querySelectorAll('.custom-select').forEach(select => {
                    select.classList.remove('open');
                    // サブメニューも閉じる
                    select.querySelectorAll('.select-category-items').forEach(items => {
                        items.style.display = 'none';
                        items.style.setProperty('display', 'none', 'important');
                    });
                });
            }
        });
    }
    
    setupCustomSelects() {
        console.log('🔧 setupCustomSelects() called');
        
        // カスタムセレクトボックスの初期化
        const customSelects = document.querySelectorAll('.custom-select');
        console.log(`📊 Found ${customSelects.length} custom select elements`);
        
        customSelects.forEach((select, index) => {
            console.log(`🎯 Processing select ${index}:`, select.id || 'no-id');
            
            const trigger = select.querySelector('.select-trigger');
            console.log(`  - Trigger found: ${!!trigger}`);
            
            if (!trigger) return; // トリガー要素がない場合はスキップ
            
            // 既存のイベントリスナーを削除（重複防止）
            const newTrigger = trigger.cloneNode(true);
            trigger.parentNode.replaceChild(newTrigger, trigger);
            
            newTrigger.addEventListener('click', (e) => {
                console.log('🖱️ Trigger clicked!', select.id);
                e.stopPropagation();
                
                // 他のセレクトを閉じる
                document.querySelectorAll('.custom-select').forEach(otherSelect => {
                    if (otherSelect !== select) {
                        otherSelect.classList.remove('open');
                        // サブメニューも閉じる
                        otherSelect.querySelectorAll('.select-category-items').forEach(items => {
                            items.style.display = 'none';
                            items.style.setProperty('display', 'none', 'important');
                        });
                    }
                });
                
                // 現在のセレクトをトグル
                const wasOpen = select.classList.contains('open');
                console.log(`  - Was open: ${wasOpen}`);
                
                select.classList.toggle('open');
                console.log(`  - Is now open: ${select.classList.contains('open')}`);
                console.log(`  - Classes after toggle:`, select.className);
                
                // 閉じる場合はサブメニューも閉じる
                if (wasOpen) {
                    select.querySelectorAll('.select-category-items').forEach(items => {
                        items.style.display = 'none';
                        items.style.setProperty('display', 'none', 'important');
                    });
                }
            });
        });
    }
    
    createCustomSelectOptions(selectElement, categories) {
        console.log('🔧 createCustomSelectOptions called');
        console.log('🎯 selectElement:', selectElement);
        console.log('📊 categories:', categories);
        
        if (!selectElement) {
            console.error('❌ selectElement is null/undefined');
            return;
        }
        
        const optionsContainer = selectElement.querySelector('.select-options');
        const triggerSpan = selectElement.querySelector('.select-trigger span');
        
        console.log('🎯 optionsContainer found:', !!optionsContainer);
        console.log('🎯 triggerSpan found:', !!triggerSpan);
        
        if (!optionsContainer) {
            console.error('❌ optionsContainer not found');
            return;
        }
        
        // 既存のオプションをクリア（「全ルーム」以外）
        const existingOptions = optionsContainer.querySelectorAll('.select-category, .select-category-items');
        existingOptions.forEach(option => option.remove());
        
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
        
        // カテゴリの表示順序を定義
        const categoryOrder = ['monitored', 'TO', 'クライアント窓口', 'projects', 'teams', 'meetings', 'development', 'announcements', 'my_chat', 'others'];
        
        // 定義された順序でカテゴリを処理
        console.log('🔄 Processing categories in order:', categoryOrder);
        
        let categoryCount = 0;
        for (const categoryKey of categoryOrder) {
            const rooms = categories[categoryKey] || [];
            console.log(`📁 Category "${categoryKey}": ${rooms.length} rooms`);
            
            if (rooms.length > 0) {
                categoryCount++;
                const emoji = categoryEmojiMapping[categoryKey] || '💾';
                const categoryName = categoryNameMapping[categoryKey] || categoryKey;
                
                console.log(`✅ Creating category header for "${categoryName}" with ${rooms.length} rooms`);
                
                // カテゴリヘッダーを作成
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'select-category';
                categoryHeader.dataset.category = categoryKey;
                
                categoryHeader.innerHTML = `
                    <span>${emoji} ${categoryName} (${rooms.length})</span>
                    <span class="category-arrow">▶</span>
                `;
                
                // カテゴリアイテムコンテナを作成（サブメニュー）
                const categoryItems = document.createElement('div');
                categoryItems.className = 'select-category-items';
                categoryItems.style.display = 'none'; // 初期状態は非表示
                
                // ルームオプションを追加
                rooms.forEach(room => {
                    const option = document.createElement('div');
                    option.className = 'select-option';
                    option.dataset.value = room.room_id;
                    option.textContent = room.name;
                    option.title = room.name; // ツールチップ
                    
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handleCustomSelectOption(selectElement, room.room_id, room.name);
                    });
                    
                    categoryItems.appendChild(option);
                });
                
                // カテゴリヘッダーにデータ属性でサブメニューを関連付け
                categoryHeader.dataset.submenuId = `submenu-${categoryKey}`; 
                categoryItems.id = `submenu-${categoryKey}`;
                
                // カテゴリヘッダーのホバーイベントで遅延表示
                let hoverTimeout;
                categoryHeader.addEventListener('mouseenter', () => {
                    // セレクトボックスが開いている場合のみ動作
                    if (selectElement.classList.contains('open')) {
                        clearTimeout(hoverTimeout);
                        // 他のサブメニューを閉じる
                        optionsContainer.querySelectorAll('.select-category-items').forEach(items => {
                            items.style.display = 'none';
                            items.style.setProperty('display', 'none', 'important');
                        });
                        // 現在のサブメニューを表示
                        hoverTimeout = setTimeout(() => {
                            // カテゴリヘッダーの位置を基準にサブメニューを配置
                            const headerRect = categoryHeader.getBoundingClientRect();
                            const containerRect = optionsContainer.getBoundingClientRect();
                            categoryItems.style.top = (headerRect.top - containerRect.top) + 'px';
                            categoryItems.style.display = 'block';
                            categoryItems.style.setProperty('display', 'block', 'important');
                        }, 100);
                    }
                });
                
                categoryHeader.addEventListener('mouseleave', (e) => {
                    clearTimeout(hoverTimeout);
                    // マウスがサブメニューに移動していない場合は閉じる
                    const relatedTarget = e.relatedTarget;
                    if (!categoryItems.contains(relatedTarget)) {
                        hoverTimeout = setTimeout(() => {
                            categoryItems.style.display = 'none';
                            categoryItems.style.setProperty('display', 'none', 'important');
                        }, 300);
                    }
                });
                
                // サブメニューのホバーイベント
                categoryItems.addEventListener('mouseenter', () => {
                    clearTimeout(hoverTimeout);
                    categoryItems.style.display = 'block';
                });
                
                categoryItems.addEventListener('mouseleave', () => {
                    hoverTimeout = setTimeout(() => {
                        categoryItems.style.display = 'none';
                        categoryItems.style.setProperty('display', 'none', 'important');
                    }, 300);
                });
                
                optionsContainer.appendChild(categoryHeader);
                optionsContainer.appendChild(categoryItems);
                console.log(`➕ Category "${categoryName}" added to container`);
            }
        }
        
        console.log(`🎯 Total categories created: ${categoryCount}`);
        console.log('🎯 Options container children count:', optionsContainer.children.length);
        console.log('🎯 Options container HTML:', optionsContainer.innerHTML.substring(0, 200) + '...');
    }
    
    handleCustomSelectOption(selectElement, value, text) {
        const triggerSpan = selectElement.querySelector('.select-trigger span');
        const options = selectElement.querySelectorAll('.select-option');
        
        // 選択状態を更新
        options.forEach(opt => opt.classList.remove('selected'));
        const selectedOption = selectElement.querySelector(`[data-value="${value}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // 表示テキストを更新
        triggerSpan.textContent = text || 'ルームを選択...';
        
        // ドロップダウンを閉じる
        selectElement.classList.remove('open');
        
        // すべてのサブメニューを閉じる
        selectElement.querySelectorAll('.select-category-items').forEach(items => {
            items.style.display = 'none';
            items.style.setProperty('display', 'none', 'important');
        });
        
        // セレクトのIDに応じた処理を実行
        if (selectElement.id === 'roomSelect') {
            if (value) {
                this.loadMessages(value);
            } else {
                document.getElementById('messagesList').innerHTML = '<div class="empty-state"><p>ルームを選択してください</p></div>';
            }
        } else if (selectElement.id === 'deletedRoomSelect') {
            this.loadDeletedMessages();
        }
        
        // カスタムイベントを発火（必要に応じて）
        selectElement.dispatchEvent(new CustomEvent('change', {
            detail: { value, text }
        }));
    }
    
    getCustomSelectValue(selectElement) {
        if (!selectElement) return '';
        const selectedOption = selectElement.querySelector('.select-option.selected');
        return selectedOption ? selectedOption.dataset.value : '';
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
        
        // 現在表示中のルームのメッセージの場合は更新
        const currentRoom = document.getElementById('roomSelect').value;
        if (currentRoom === messageData.room_id) {
            this.loadMessages(currentRoom);
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
                    console.log('🔧 Creating custom select options for roomSelect...');
                    this.createCustomSelectOptions(roomSelect, data.categories);
                    console.log('✅ Custom select options created for roomSelect');
                } else {
                    console.error('❌ roomSelect element not found!');
                }
                
                // 削除メッセージタブのルーム選択を更新
                const deletedRoomSelect = document.getElementById('deletedRoomSelect');
                console.log('🎯 Deleted room select element found:', !!deletedRoomSelect);
                
                if (deletedRoomSelect) {
                    console.log('🔧 Creating custom select options for deletedRoomSelect...');
                    this.createCustomSelectOptions(deletedRoomSelect, data.categories);
                    console.log('✅ Custom select options created for deletedRoomSelect');
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
        // サマリーカードを更新
        document.getElementById('monitoredRooms').textContent = data.system.monitored_rooms || 0;
        document.getElementById('processedMessages').textContent = data.system.processed_messages_count || 0;
        document.getElementById('pendingAlerts').textContent = data.alerts.total || 0;
        document.getElementById('highPriorityAlerts').textContent = data.alerts.by_priority?.high || 0;
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
        const select = document.getElementById('roomSelect');
        
        // 既存のオプショングループをクリア
        const optgroups = select.querySelectorAll('optgroup');
        optgroups.forEach(group => {
            group.innerHTML = '';
        });
        
        // 動的にオプショングループを作成・更新
        this.createCategoryOptgroups(select, categories);
        
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
        
        for (const [categoryKey, rooms] of Object.entries(categories)) {
            if (rooms.length > 0) {
                // 絵文字を追加したラベルを作成
                const emoji = categoryEmojiMapping[categoryKey] || '💾';
                const categoryLabel = `${emoji} ${categoryKey}`;
                const optgroup = select.querySelector(`optgroup[label="${categoryLabel}"]`);
                
                if (optgroup) {
                    rooms.forEach(room => {
                        const option = document.createElement('option');
                        option.value = room.room_id;
                        option.textContent = room.name;
                        optgroup.appendChild(option);
                    });
                }
            }
        }
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
        const select = document.getElementById('roomSelect');
        
        // 各オプショングループの中身をクリア
        const optgroups = select.querySelectorAll('optgroup');
        optgroups.forEach(group => {
            group.innerHTML = '';
        });
        
        // ルームを分類
        const categorized = this.categorizeRooms(rooms);
        
        // 監視対象ルーム
        const monitoredGroup = select.querySelector('optgroup[label="📍 監視対象ルーム"]');
        if (monitoredGroup) {
            categorized.monitored.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                option.textContent = room.name;
                monitoredGroup.appendChild(option);
            });
        }
        
        // グループチャット
        const groupGroup = select.querySelector('optgroup[label="👥 グループチャット"]');
        if (groupGroup) {
            categorized.groups.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                option.textContent = room.name;
                groupGroup.appendChild(option);
            });
        }
        
        // ダイレクトメッセージ
        const dmGroup = select.querySelector('optgroup[label="💬 ダイレクトメッセージ"]');
        if (dmGroup) {
            categorized.direct.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                option.textContent = room.name;
                dmGroup.appendChild(option);
            });
        }
        
        // テスト・その他
        const testGroup = select.querySelector('optgroup[label="🔧 テスト・その他"]');
        if (testGroup) {
            categorized.test.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                option.textContent = room.name;
                testGroup.appendChild(option);
            });
        }
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
                this.createCustomSelectOptions(deletedRoomSelect, data.categories);
            }
        } catch (error) {
            console.error('Failed to load rooms for deleted messages:', error);
            this.showToast('削除メッセージ用ルーム情報の読み込みに失敗しました', 'error');
        }
    }
    
    async loadDeletedMessages() {
        try {
            const deletedRoomSelect = document.getElementById('deletedRoomSelect');
            const roomId = this.getCustomSelectValue(deletedRoomSelect);
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
                const currentRoom = this.getCustomSelectValue(roomSelect);
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
    
    saveSettings() {
        // 設定保存（実装は省略）
        this.showToast('設定を保存しました', 'success');
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
            const roomSelect = document.getElementById('roomSelect');
            if (roomSelect) {
                const currentValue = this.getCustomSelectValue(roomSelect);
                
                if (!currentValue) {
                    // カスタムセレクトで最初の有効なルームを選択
                    const firstOption = roomSelect.querySelector('.select-option[data-value]:not([data-value=""])');
                    if (firstOption && firstOption.dataset.value) {
                        this.handleCustomSelectOption(roomSelect, firstOption.dataset.value, firstOption.textContent);
                    } else {
                        // 有効なルームがない場合はメッセージ表示をクリア
                        const messagesList = document.getElementById('messagesList');
                        if (messagesList) {
                            messagesList.innerHTML = '<div class="empty-state"><p>ルームを選択してください</p></div>';
                        }
                    }
                }
            }
        } else if (tabName === 'deleted') {
            // 削除ログタブでルーム一覧と削除メッセージを読み込み
            this.loadDeletedRooms();
            this.loadDeletedMessages();
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