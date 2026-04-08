'use strict';

const { Controller } = require('ee-core');
const Log = require('ee-core/log');
const Addon = require('ee-core/addon');
const axios = require('axios');
const { app, BrowserWindow, WebContentsView ,session} = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const Storage = require('ee-core/storage');
const platforms = [
    { platform: 'Telegram', url: 'https://web.telegram.org/a/' },
    { platform: 'TelegramK', url: 'https://web.telegram.org/k/' },
    { platform: 'WhatsApp', url: 'https://web.whatsapp.com/' },
    // { platform: 'FaceBook', url: 'https://www.facebook.com/messages' },
    // { platform: 'Zalo', url: 'https://chat.zalo.me/' },
    // { platform: 'Telegram', url: 'https://www.browserscan.net/zh/' },
    // { platform: 'WhatsApp', url: 'https://ipcs.vip/' },
];
const { Service, Services } = require('ee-core');
const { fetchIpGeo: runFetchIpGeo } = require('../utils/NetGetIpGeo');
const FingerprintProfile = require('../utils/buildFingerprintProfile');
/**
 * 示例服务（service层为单例）
 * @class
 */
class WindowService extends Service {

    constructor(ctx) {
        super(ctx);
        app.platforms = app.platforms || platforms;
        this.isShrunk = false; // 记录侧边栏是否收缩
        this.isPlacedTop = false; // 记录侧边栏是否置顶
        this.rightOverlayWidth = 0;
    }

    async addCard(args, event) {
        const {cardId, platform, online, name, sessionId, accountId} = args;
        const url = platforms.find(item => item.platform.toLowerCase() === platform.toLowerCase())?.url;
        if (!url) return {message:'未找到对应平台的URL',status:false};
        // 检查是否已存在会话
        const cardCache = await app.sdb.selectOne('cards',{'card_id':cardId, 'account_id': accountId})
        if (cardCache) {
            return {status:false,message:'创建失败，已存在该窗口'};
        }
        //生成随机ua
        const userAgent = this._generateRandomDesktopUA();
        await app.sdb.insert('cards', {
            card_id: cardId,
            platform: platform,
            platform_url: url,
            active_status: 'false',
            online_status: online ? 'true' : 'false',
            show_badge: 'false',
            card_name: name || '',
            session_id: sessionId || '',
            account_id: accountId || ''
        })
        await app.sdb.insert('card_config', {
            card_id: cardId, 
            user_agent: userAgent,
            browser: 'Chrome随机版本',
            os: 'Windows'
        })
        Log.info('新窗口创建成功')
        return {status:true,message:"创建成功"};
    }

    async refreshCard(args, event) {
        const { platform, cardId, accountId } = args;
        const cardInfo = await app.sdb.selectOne('cards',{card_id:cardId, platform:platform, account_id: accountId})
        if (!cardInfo) {
            // 尝试不区分大小写匹配
            const allCards = await app.sdb.select('cards', {card_id: cardId});
            const matchedCard = allCards.find(c => c.platform.toLowerCase() === platform.toLowerCase());
            if (matchedCard) {
                return this.refreshCard({ ...args, platform: matchedCard.platform }, event);
            }
        }
        if (cardInfo) {
            try{
                // 销毁原有的 view
                this._destroyView(cardId);
                // 创建新会话视图
                const view = this._createWebView(cardId)
                app.viewsMap.set(cardId, view);
                const id = view.webContents.id
                await app.sdb.update('cards',{window_id:id},{card_id:cardId})
                await this._loadConfig(cardId);
                await view.webContents.loadURL(cardInfo.platform_url);
                if (cardInfo.active_status === 'true') {
                    this._addListener(view)
                }
                return {status:true,message:'刷新成功'};
            }catch(error){
                return {status:false,message:error.message};
            }
        }else {
            return {status:false,message:'找不到会话信息'};
        }
    }

    async deleteCard(args, event) {
        const { platform, cardId, accountId } = args;
        try {
            let count = await app.sdb.delete('cards',{card_id:cardId, platform:platform, account_id: accountId})
            if (count === 0) {
                 // 尝试不区分大小写匹配
                 const allCards = await app.sdb.select('cards', {card_id: cardId});
                 const matchedCard = allCards.find(c => c.platform.toLowerCase() === platform.toLowerCase());
                 if (matchedCard) {
                     count = await app.sdb.delete('cards', {card_id: cardId, platform: matchedCard.platform});
                 }
            }
            await app.sdb.delete('card_config',{card_id:cardId})
            await app.sdb.delete('number_record',{card_id:cardId,platform:platform})
            if (count >0) {
                this._destroyView(cardId);
                return {status:true,message:'删除会话成功'};
            }else return { status: false, message: '没有找到符合条件的会话' };
        } catch (err) {
            Log.error('删除数据时出错:', err);
            return {status:false,message:'删除会话时出错'};
        }
    }

    async selectCard(args, event) {
        const { cardId, platform, accountId } = args;
        Log.info('卡片切换：',args)
        const cardInfo = await app.sdb.selectOne('cards',{card_id:cardId, platform:platform, account_id: accountId});
        if (cardInfo) {
            const window = app.viewsMap.get(cardId);
            if (window && !window.webContents.isDestroyed()) {
                this._addListener(window)
                //先修改所有数据状态为false
                await app.sdb.update('cards',{active_status:"false"},{platform:platform})
                await app.sdb.update('cards',{active_status: "true",show_badge:'false'},{card_id:cardId,platform:platform})
                return {status:true,message:'切换会话成功'};
            }
            Log.info('创建新会话：',cardId)
            // 创建新会话视图
            const view = this._createWebView(cardId);
            app.viewsMap.set(cardId, view);
            const id = view.webContents.id
            await app.sdb.update('cards',{active_status: "false"},{platform:platform})
            await app.sdb.update('cards',{window_id:id,active_status:"true"},{card_id:cardId,platform:platform})
            await this._loadConfig(cardId);
            await view.webContents.loadURL(cardInfo.platform_url);
            this._addListener(view)
            return {status:true,message:'加载新会话成功'};
        }
        return {status:false,message:'没有找到该会话信息'};
    }
    //初始化卡片，不显示
    async initCard(args, event) {
        const { cardId, platform, accountId } = args;
        Log.info('初始化卡片会话：',args)
        const cardInfo = await app.sdb.selectOne('cards',{card_id:cardId, platform:platform, account_id: accountId});
        if (cardInfo) {
            const window = app.viewsMap.get(cardId);
            if (window && !window.webContents.isDestroyed()) {
                return {status:true,message:'启动会话成功'};
            }
            // 创建新会话视图
            const view = this._createWebView(cardId);
            app.viewsMap.set(cardId, view);
            const id = view.webContents.id
            await app.sdb.update('cards',{window_id:id},{card_id:cardId,platform:platform})
            await this._loadConfig(cardId);
            await view.webContents.loadURL(cardInfo.platform_url);
            return {status:true,message:'启动会话成功'};
        }
        return {status:false,message:'找不到该会话信息'};
    }
    async getCards(args, event) {
        const { platform, accountId } = args;
        return await app.sdb.select('cards', { platform: platform, account_id: accountId });
    }

    async saveCardConfig(args, event) {
        const { card_id, name } = args;
        const config = await app.sdb.selectOne('card_config', { card_id: card_id });
        
        if (config) {
            // 获取数据库中 card_config 表的实际字段
            const existingColumns = app.sdb.getExistingColumns('card_config') || {};
            
            // 过滤 args，只保留数据库中存在的字段
            const configArgs = {};
            for (const key in args) {
                if (key in existingColumns && key !== 'card_id') {
                    configArgs[key] = args[key];
                }
            }

            // 执行更新
            const count = await app.sdb.update('card_config', configArgs, { card_id: card_id });
            
            // 更新 cards 表中的名称
            if (name !== undefined && name !== '') {
                await app.sdb.update('cards', { card_name: name }, { card_id: card_id });
            }
            
            if (count > 0 || (name !== undefined && name !== '')) {
                return { status: true, message: '保存成功' };
            } else {
                return { status: false, message: '没有数据被修改' };
            }
        }
        return { status: false, message: '找不到对应配置数据' };
    }

    async getCardConfig(args, event) {
        const { cardId } = args;
        // 查找数据库中对应的平台 and cardId 的记录
        const data = await app.sdb.selectOne('card_config',{card_id:cardId})
        if (data) {
            return data;
        }else {
            return {}
        }
    }

    async detectFingerprint(args, event) {
        Log.info('[Service] detectFingerprint starting for cardId:', args.cardId, 'URL:', args.url);
        const { cardId, url } = args;
        const dbConfig = await app.sdb.selectOne('card_config', { card_id: cardId });
            
        if (!dbConfig) {
            return { status: false, message: '未找到配置信息' };
        }

        const config = FingerprintProfile.mapConfig(dbConfig);
        const injectionScript = FingerprintProfile.generateInjectionScript({ ...config, fingerprintSwitch: true }); // 检测时强制开启指纹
      
        // 创建独立检测窗口
        const detectWin = new BrowserWindow({
            width: 1200,
            height: 800,
            title: '指纹检测 - Chat365',
            webPreferences: {
                partition: `persist:detect_${cardId}_${Date.now()}`, // 使用独立临时分区
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            }
        });

        // 应用 User-Agent
        if (config.userAgent) {
            detectWin.webContents.setUserAgent(config.userAgent);
        }

        // 应用代理设置
        if (config.proxyStatus === 'true' && config.proxyType && config.host && config.port) {
            await this._applyProxySettings(detectWin.webContents, config);
        }
         
        // 注入脚本
        if (injectionScript) {
            // 在文档开始加载前注入（尽可能早）
            // 改进：使用 executeJavaScript 会在页面加载过程中运行
            detectWin.webContents.on('dom-ready', () => {
                detectWin.webContents.executeJavaScript(injectionScript);
            });
        }

        detectWin.loadURL(url || 'https://amiunique.org/fingerprint');
        detectWin.show();

        return { status: true, message: '检测窗口已打开' };
    }

    async getIPInfo(args, event) {
        try {
            const response = await axios.get('https://ipapi.co/json/', { 
                timeout: 10000
            });
            console.log('返回', response.data);
            if (response.status === 200 && response.data) {
                if (response.data.error) {
                    return { status: false, message: response.data.reason || 'IP信息查询失败' };
                }
                
                // 格式化输出，确保与前端代码兼容
                const normalizedData = {
                    timezone: response.data.timezone,
                    latitude: response.data.latitude,
                    longitude: response.data.longitude,
                    country: response.data.country_name,
                    country_code: response.data.country_code,
                    city: response.data.city,
                    languages: response.data.languages,
                    ip: response.data.ip
                };
                return { status: true, data: normalizedData };
            }
            return { status: false, message: '请求失败' };
        } catch (error) {
            Log.error('Main process fetch IP info error:', error);
            return { status: false, message: error.message };
        }
    }

    async hideAllWindow() {
        app.viewsMap.forEach((view, key) => {
            if (view && !view.webContents.isDestroyed()) {
                view.setVisible(false);
            }
        });
    }
    async logOut(args, event) {
        const { accountId } = args;
        Log.info('开始执行全局退出注销流程...');
        
        // 1. 获取该账号下的所有卡片以确保能清除每个独立分区的存储
        const allCards = await app.sdb.select('cards', { account_id: accountId });
        
        // 2. 销毁所有活跃视图（WebContentsView）
        app.viewsMap.forEach((view, key) => {
            this._destroyView(key);
        });

        // 3. 彻底清除每个账户的分区数据（Cookies, LocalStorage, IndexedDB 等）
        // 这样可以确保下次登录时必须重新扫码
        for (const card of allCards) {
            const cardId = card.card_id;
            const partitionKey = `persist:${cardId}`;
            const cardSession = session.fromPartition(partitionKey);
            
            try {
                // 强化：为了保留翻译记录和历史原文，注销时不再清空 indexdb
                // 只要清除了 cookies 和 localstorage，WhatsApp 就会强制重新登录
                await cardSession.clearStorageData({
                    storages: ['cookies', 'localstorage', 'cachestorage', 'serviceworkers', 'websql'],
                    quotas: ['persistent', 'temporary', 'syncable']
                });
                Log.info(`已注销分区存储(保留IndexedDB): ${partitionKey}`);
            } catch (err) {
                Log.error(`注销分区数据失败 ${partitionKey}:`, err);
            }
        }

        // 4. 重置数据库中的在线状态和头像信息
        await app.sdb.update('cards', { show_badge: 'false', online_status: 'false', avatar_url: '' }, {});

        // 5. 重置主窗口标题及清除内存中的 Token
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (mainWin) {
            mainWin.setTitle('Chat365');
        }
        
        app.boxToken = null; 
        Log.info('✅ 全局退出完成，所有 WhatsApp 会话已注销。');
    }

    async changeSidebarWidth(isShrunk) {
        this.isShrunk = isShrunk;
        Log.info('侧边栏状态变更:', isShrunk ? '收缩' : '展开');
        
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);

        // 通知所有渲染进程侧边栏状态变更
        mainWin.webContents.send('sidebar-state-change', {
            isShrunk: this.isShrunk,
            isPlacedTop: this.isPlacedTop
        });
        
        // 遍历所有视图，同步缩放
        app.viewsMap.forEach((view, key) => {
            if (view && !view.webContents.isDestroyed()) {
                this._resizeView(mainWin, view);
            }
        });
        
        return { status: true };
    }

    async changeSidebarLayout(isPlacedTop) {
        this.isPlacedTop = isPlacedTop;
        Log.info('侧边栏布局变更:', isPlacedTop ? '顶部' : '侧边');
        
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);

        // 通知所有渲染进程侧边栏状态变更
        mainWin.webContents.send('sidebar-state-change', {
            isShrunk: this.isShrunk,
            isPlacedTop: this.isPlacedTop
        });

        // 遍历所有视图，同步缩放
        app.viewsMap.forEach((view, key) => {
            if (view && !view.webContents.isDestroyed()) {
                this._resizeView(mainWin, view);
            }
        });
        
        return { status: true };
    }

    async getSidebarState() {
        return {
            isShrunk: this.isShrunk,
            isPlacedTop: this.isPlacedTop
        };
    }

    async getSessionConfig(chatId) {
        if (!chatId) return null;
        const configStorage = Storage.connection('config.json');
        const allSessionConfig = configStorage.getItem('aiSessionConfig') || {};
        return allSessionConfig[chatId] || null;
    }

    async saveSessionConfig(args = {}) {
        const { chatId, config } = args;
        if (!chatId || !config) {
            return { status: false, message: 'chatId and config are required' };
        }

        const configStorage = Storage.connection('config.json');
        const allSessionConfig = configStorage.getItem('aiSessionConfig') || {};
        allSessionConfig[chatId] = config;
        configStorage.setItem('aiSessionConfig', allSessionConfig);

        return { status: true };
    }

    async getChatHistory(args = {}) {
        const chatId = typeof args === 'string' ? args : args?.chatId;
        const countRaw = typeof args === 'object' ? args?.count : undefined;
        const count = Number.isFinite(Number(countRaw)) ? Math.max(1, Math.min(50, Number(countRaw))) : 3;

        if (!chatId) {
            return [];
        }

        Log.info(`[getChatHistory] Attempting lookup for identifier: ${chatId}`);
        let targetId = chatId;
        let view = app.viewsMap.get(targetId);

        // Fallback 1: Check if chatId matches a row but viewsMap is keyed differently
        if (!view) {
            Log.info(`[getChatHistory] Direct lookup failed for ${chatId}, checking DB for correct service id...`);
            const card = await app.sdb.selectOne('cards', { card_id: chatId });
            if (card && card.card_id && app.viewsMap.has(card.card_id)) {
                targetId = card.card_id;
                view = app.viewsMap.get(targetId);
                Log.info(`[getChatHistory] Found view via DB resolution: ${targetId}`);
            }
        }

        // Fallback 2: Try ANY active card if still not found (as last resort)
        if (!view) {
            Log.info(`[getChatHistory] DB resolution failed, trying last resort (active card)...`);
            const activeCard = await app.sdb.selectOne('cards', { active_status: 'true' });
            if (activeCard && activeCard.card_id && app.viewsMap.has(activeCard.card_id)) {
                targetId = activeCard.card_id;
                view = app.viewsMap.get(targetId);
                Log.info(`[getChatHistory] Found view via active card fallback: ${targetId}`);
            }
        }

        // Fallback 3: If only ONE view exists in viewsMap, use it as the absolute last resort
        if (!view && app.viewsMap.size === 1) {
            const onlyKey = Array.from(app.viewsMap.keys())[0];
            targetId = String(onlyKey);
            view = app.viewsMap.get(targetId);
            Log.info(`[getChatHistory] Only one active view found in runtime, using it as last resort: ${targetId}`);
        }

        if (!view || !view.webContents || view.webContents.isDestroyed()) {
            const availableKeys = Array.from(app.viewsMap.keys());
            Log.warn(`[getChatHistory] View not found for targetId: ${targetId}. Available keys in viewsMap:`, availableKeys);
            return [];
        }

        const script = `
          (() => {
            const limit = ${count};
            
            // === 诊断探测：找出 WhatsApp 实际使用的消息容器选择器 ===
            const probes = {
              '.message-in': document.querySelectorAll('.message-in').length,
              '.message-out': document.querySelectorAll('.message-out').length,
              '[data-testid="msg-container"]': document.querySelectorAll('[data-testid="msg-container"]').length,
              '[role="row"]': document.querySelectorAll('[role="row"]').length,
              '[data-testid="selectable-text"]': document.querySelectorAll('[data-testid="selectable-text"]').length,
              '[data-testid="copyable-text"]': document.querySelectorAll('[data-testid="copyable-text"]').length,
              '.copyable-text': document.querySelectorAll('.copyable-text').length,
              '[data-testid="conversation-panel-messages"]': document.querySelectorAll('[data-testid="conversation-panel-messages"]').length,
              '[data-testid="msg-text"]': document.querySelectorAll('[data-testid="msg-text"]').length,
              '[class*="message"]': document.querySelectorAll('[class*="message"]').length,
            };
            
            // 找到聊天面板，抓取前5个子元素的信息
            const panel = document.querySelector('[data-testid="conversation-panel-messages"]') || 
                          document.querySelector('[role="application"]');
            let panelChildInfo = [];
            if (panel) {
              const children = panel.children;
              for (let i = 0; i < Math.min(children.length, 8); i++) {
                const c = children[i];
                panelChildInfo.push({
                  tag: c.tagName,
                  classes: c.className ? c.className.substring(0, 100) : '',
                  testid: c.getAttribute('data-testid') || '',
                  role: c.getAttribute('role') || '',
                  childCount: c.children.length
                });
              }
            }
            
            // === 正常抓取逻辑（使用多组选择器逐级尝试） ===
            let messages = [];
            const selectorGroups = [
              '.message-in, .message-out',
              '[data-testid="msg-container"]',
              '[role="row"]',
              '.copyable-text'
            ];
            for (const sel of selectorGroups) {
              messages = Array.from(document.querySelectorAll(sel));
              if (messages.length > 0) break;
            }
            
            messages = messages.filter(m => m.innerText && m.innerText.length > 3);

            const results = messages.slice(-limit).map((msg) => {
              const isOut = msg.classList.contains('message-out') || 
                            !!msg.closest('.message-out') ||
                            msg.querySelector('.message-out') !== null;
              
              // 直接获取 selectable-text 的 innerText（无任何清洗）
              const selText = msg.querySelector('[data-testid="selectable-text"]');
              const rawSelText = selText ? selText.innerText : null;
              
              // 直接获取 copyable-text 的 innerText
              const copyText = msg.querySelector('.copyable-text');
              const rawCopyText = copyText ? copyText.innerText : null;
              
              // 直接获取整个消息的 innerText 的前100字符
              const rawMsgText = (msg.innerText || '').substring(0, 100);
              
              // 使用最简单的方式提取
              let content = rawSelText || rawCopyText || rawMsgText || '';
              content = content.trim();
              
              return {
                type: isOut ? 'assistant' : 'user',
                content: content,
                // _debug: {
                //   hasSelText: !!selText,
                //   rawSelText: rawSelText ? rawSelText.substring(0, 80) : null,
                //   hasCopyText: !!copyText,
                //   rawCopyText: rawCopyText ? rawCopyText.substring(0, 80) : null,
                //   rawMsgText: rawMsgText.substring(0, 80),
                //   msgClasses: msg.className ? msg.className.substring(0, 100) : '',
                //   msgTag: msg.tagName
                // }
              };
            }).filter(item => item.content && item.content.length > 0);
            
            return { probes, panelChildInfo, results };
          })();
        `;

        try {
            const raw = await view.webContents.executeJavaScript(script, true);
            // 输出诊断信息
            Log.error(`[getChatHistory] DOM probes for ${chatId}:`, raw?.probes);
            Log.error(`[getChatHistory] Panel children:`, raw?.panelChildInfo);
            Log.error(`[getChatHistory] Results:`, raw?.results);
            const history = raw?.results || [];
            return Array.isArray(history) ? history : [];
        } catch (error) {
            Log.error(`[getChatHistory] execute script failed for ${chatId}:`, error);
            return [];
        }
    }

    async sendToWv(args = {}) {
        const chatIdRaw = args?.chatId || args?.cardId || '';
        const channel = args?.channel;
        const argsList = Array.isArray(args?.args)
            ? args.args
            : (args?.payload !== undefined ? [args.payload] : []);

        if (!channel) {
            return { status: false, message: 'channel is required' };
        }

        let targetChatId = chatIdRaw ? String(chatIdRaw) : '';
        let view = targetChatId ? app.viewsMap.get(targetChatId) : null;

        if (!view || !view.webContents || view.webContents.isDestroyed()) {
            try {
                // 优先查找 WhatsApp 活跃卡片
                const activeCard = await app.sdb.selectOne('cards', { active_status: 'true', platform: 'WhatsApp' });
                if (activeCard?.card_id) {
                    targetChatId = String(activeCard.card_id);
                    view = app.viewsMap.get(targetChatId);
                }
                // 若 WhatsApp 活跃卡片未找到，查找任意平台的活跃卡片
                if (!view || !view.webContents || view.webContents.isDestroyed()) {
                    const anyActiveCard = await app.sdb.selectOne('cards', { active_status: 'true' });
                    if (anyActiveCard?.card_id) {
                        targetChatId = String(anyActiveCard.card_id);
                        view = app.viewsMap.get(targetChatId);
                    }
                }
                // 最终兜底：取 viewsMap 中第一个可用视图
                if (!view || !view.webContents || view.webContents.isDestroyed()) {
                    for (const [key, v] of app.viewsMap) {
                        if (v && !v.webContents.isDestroyed()) {
                            targetChatId = key;
                            view = v;
                            break;
                        }
                    }
                }
            } catch (error) {
                Log.error('[sendToWv] resolve active card failed:', error);
            }
        }

        if (!view || !view.webContents || view.webContents.isDestroyed()) {
            Log.warn(`[sendToWv] target webview not found. chatId=${chatIdRaw}`);
            return { status: false, message: 'target webview not found' };
        }

        try {
            view.webContents.send(channel, ...argsList);
            return { status: true, chatId: targetChatId };
        } catch (error) {
            Log.error(`[sendToWv] send failed. chatId=${targetChatId}, channel=${channel}:`, error);
            return { status: false, message: error.message || 'send failed' };
        }
    }

    async setRightOverlayWidth(width = 0) {
        const normalizedWidth = Number.isFinite(Number(width)) ? Math.max(0, Number(width)) : 0;
        const previousWidth = this.rightOverlayWidth || 0;
        this.rightOverlayWidth = normalizedWidth;
        Log.info('rightOverlayWidth changed:', previousWidth, '->', normalizedWidth);

        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (!mainWin) {
            return { status: false, message: 'main window not found' };
        }

        // 非全屏/非最大化时，自动调整窗口宽度
        if (!mainWin.isMaximized() && !mainWin.isFullScreen()) {
            const delta = normalizedWidth - previousWidth;
            if (delta !== 0) {
                const bounds = mainWin.getBounds();
                const newWidth = Math.max(bounds.width + delta, 800); // 最小宽度保护
                mainWin.setBounds({
                    x: bounds.x,
                    y: bounds.y,
                    width: newWidth,
                    height: bounds.height
                });
                Log.info('Window resized by delta:', delta, '-> new width:', newWidth);
            }
        }

        app.viewsMap.forEach((view) => {
            if (view && !view.webContents.isDestroyed()) {
                this._resizeView(mainWin, view);
            }
        });

        return { status: true };
    }

    async getRunningSessionsCount(args, event) {
        try {
            let count = 0;
            if (app.viewsMap) {
                app.viewsMap.forEach((view, key) => {
                    if (view && !view.webContents.isDestroyed()) {
                        count++;
                    }
                });
            }
            return count;
        } catch (error) {
            Log.error('获取运行中会话数量出错:', error);
            return 0;
        }
    }

    async restoreActiveViews(args, event) {
        try {
            const activeCards = await app.sdb.select('cards', { active_status: 'true' });
            for (const card of activeCards) {
                const existing = app.viewsMap && app.viewsMap.get(card.card_id);
                if (!existing || existing.webContents.isDestroyed()) {
                    await this.initCard({ cardId: card.card_id, platform: card.platform });
                }
            }
            return { status: true };
        } catch (error) {
            Log.error('恢复活跃视图出错:', error);
            return { status: false };
        }
    }

    async filterNumber(args, event) {
        const { platform, cardId, phoneNumber } = args;
        //查询手机号码是否存在检测记录
        const record = app.sdb.selectOne('number_record',{platform:platform,phone_number:phoneNumber})
        if (record) {
            const data = {platform:platform,cardId:record.card_id,phoneNumber:phoneNumber,phoneStatus:record.phone_status,status:record.status}
            return {status:true,message:'检测成功，存在检测记录',data:data};
        }
        const url = platforms.find(item => item.platform === platform)?.url;
        const view = app.viewsMap.get(cardId);
        // const scriptPath = path.join(__dirname, '../scripts/WhatsAppNumberFilter.js');
        // const scriptCode = fs.readFileSync(scriptPath, 'utf8');
        // 将参数插入到 scriptCode 中
        const scriptCode = `
          (function() {
            const cardId = "${cardId}";
            const phoneNumber = "${phoneNumber}";
            const platform = "${platform}";
        
            // 延时 5 秒执行
            setTimeout(() => {
              // 这里可以执行您的代码，并使用 phoneNumber 和 platform 变量
              const node = document.querySelector("div.x12lqup9.x1o1kx08");
              const result = { phone_status: '', message: '' };
        
              if (node) {
                  result.phone_status = 'false';
                  result.message = node.textContent;
              } else {
                  result.phone_status = 'true';
                  result.message = '号码存在存入数据成功';
              }
        
              // 通过 window.electronAPI 发送结果到主进程
              window.electronAPI.sendFilterNotify({
                cardId: cardId,
                phoneNumber: phoneNumber,
                platform: platform,
                result: result
              });
            }, 5000); // 延迟 5000 毫秒（5 秒）
          })();
        `;
        // 监听网页加载完成事件
        view.webContents.once('did-finish-load', () => {
            view.webContents.executeJavaScript(scriptCode)
        });
        try{
            // 加载目标 URL
            await view.webContents.loadURL(url + `send?phone=${phoneNumber}`);
            return {status:true,message:'加载成功'};
        }catch(e){
            return {status:false,message:`加载地址出现错误：${e.message}`};
        }


    }
    async getPhoneNumberList(args, event) {
        const { platform, cardId } = args;
        try{
            const data = await app.sdb.select('number_record',{platform:platform})
            return {status:true,message:'查询成功',data:data};
        }catch(e){
            return {status:false,message:'查询出错',data:[]}
        }
    }
    async deletePhoneNumber(args, event) {
        const {platform, phoneNumber } = args;
        try{
            await app.sdb.delete('number_record',{platform:platform,phone_number:phoneNumber})
            return {status:true,message:'删除成功'};
        }catch(e){
            return {status:false,message:'删除出错'}
        }
    }
    async sendMessage(args, event) {
        const { platform, cardId, phoneNumber } = args;
        const url = platforms.find(item => item.platform === platform)?.url;
        const view = app.viewsMap.get(cardId);
        try{
            // 加载目标 URL
            await view.webContents.loadURL(url + `send?phone=${phoneNumber}`);
            return {status:true,message:'加载成功'};
        }catch(e){
            return {status:false,message:`加载地址出现错误：${e.message}`};
        }
    }

    async handleMinimize() {
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (mainWin) mainWin.minimize();
    }

    async handleMaximize() {
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (mainWin) {
            if (mainWin.isMaximized()) {
                mainWin.unmaximize();
            } else {
                mainWin.maximize();
            }
        }
    }

    async handleClose() {
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (mainWin) mainWin.close();
    }

    async getWindowStatus() {
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        return {
            isMaximized: mainWin ? mainWin.isMaximized() : false
        };
    }
    
    _resizeView(mainWin, view) {
        if (mainWin && view) {
            const [width, height] = mainWin.getContentSize();
            const reservedRightWidth = this.rightOverlayWidth > 0 ? this.rightOverlayWidth : 70;
            const titleBarHeight = 32; // 自定义顶部栏高度
            if (this.isPlacedTop) {
                // 顶部模式：左侧导航栏(75) + 顶部栏高度(60+32)
                const xOffset = 76;
                const topSidebarHeight = 86;
                const yOffset = topSidebarHeight + titleBarHeight;
                const viewWidth = Math.max(0, width - xOffset - reservedRightWidth + 2);
                view.setBounds({ x: xOffset, y: yOffset, width: viewWidth, height: height - yOffset });
            } else {
                // 侧边模式：左侧导航(75) + AsideCard(265/100) + border(1) + 顶部栏高度(32)
                const xOffset = this.isShrunk ? 176 : 341;
                const yOffset = titleBarHeight;
                const viewWidth = Math.max(0, width - xOffset - reservedRightWidth + 2);
                view.setBounds({ x: xOffset, y: yOffset, width: viewWidth, height: height - yOffset });
            }
        }
    }
    async _applyProxySettings(webContents, config) {
        if (!webContents) {
            Log.error('webContents 是必须的');
            return;
        }
        // 如果没有传入 config，删除现有的代理设置
        if (!config) {
            Log.info('当前会话未提供代理config，删除现有的代理设置');
            webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
            webContents.session.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "zh-CN")
            await webContents.session.setProxy({proxyRules: '',mode: 'system'}, () => {
                Log.info('代理设置已删除');
            });
            return;
        }

        // 检查 config 中的必要属性是否为空字符串或未定义
        const requiredFields = ['proxyType', 'host', 'port'];
        for (const field of requiredFields) {
            if (!config[field] || config[field].trim() === '') {
                Log.warn(`代理配置缺失或无效: ${field} 是必须的`);
                // 删除原有的代理设置
                webContents.session.setProxy({proxyRules: ''}, () => {
                    Log.info('代理设置已删除');
                });
                return;
            }
        }

        let proxyConfig = '';
        // 根据代理模式构建代理配置
        switch (config.proxyType) {
            case 'noProxy':
                proxyConfig = 'direct://';
                return;
            case 'http':
                proxyConfig = `http://${config.host}:${config.port}`;
                break;
            case 'https':
                proxyConfig = `http://${config.host}:${config.port}`;
                break;
            case 'socks4':
                proxyConfig = `socks4://${config.host}:${config.port}`;
                break;
            case 'socks5':
                proxyConfig = `socks5://${config.host}:${config.port}`;
                break;
            default:
                Log.warn('未知的代理类型，使用直接连接');
                proxyConfig = 'direct://';
                break;
        }

        Log.info('配置代理：', proxyConfig);

        // 将代理设置到 webContents 的 session 中
        await webContents.session.setProxy({proxyRules: proxyConfig}, () => {
            Log.info(`代理设置为: ${proxyConfig}`);
        });

        // 监听登录事件以处理代理身份验证
        if (config.username && config.password) {
            webContents.on('login', (event, request, authInfo, callback) => {
                event.preventDefault();
                if (authInfo.isProxy && authInfo.host === config.host && authInfo.port === Number(config.port)) {
                    Log.info('提供代理凭据');
                    callback(config.username, config.password);
                }
            });
        } else {
            Log.info('代理配置中没有提供用户名和密码，跳过身份验证配置');
        }
    }
    _addListener(view) {
        this.hideAllWindow()
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (view && !view.webContents.isDestroyed()) {
            this._resizeView(mainWin, view);
            mainWin.contentView.addChildView(view);
            mainWin.removeAllListeners('resize');
            mainWin.on('resize', () => this._resizeView(mainWin, view));
            this._resizeView(mainWin, view);
            view.setVisible(true);
            if (!app.isPackaged) {
                view.webContents.openDevTools()
            }
        }
    }
    _createWebView(cardId) {
        const view = new WebContentsView({
            webPreferences: {
                sandbox: true,
                devTools: true,
                partition: `persist:${cardId}`,
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/bridge.js') // 指定 preload 脚本路径
            },
        });
        // const mySession = session.fromPartition(`persist:${cardId}`);
        // mySession.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
        //     Log.info('请求 URL:', details.url);
        //     Log.info('请求方法:', details.method);
        //     Log.info('服务器 IP:', details.ip);
        //     Log.info('请求时间戳:', details.timestamp);
        //     Log.info('请求资源类型:', details.resourceType);
        // });
        return view;
    }
    _generateRandomDesktopUA() {
        const browsers = [
            {
                name: 'Chrome',
                versions: Array.from({ length: 31 }, (_, i) => 100 + i), // 生成版本号 100 到 130
                userAgentTemplate: 'Mozilla/5.0 ({os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36'
            }
        ];

        const operatingSystems = [
            'Windows NT 10.0; Win64; x64',
            'Windows NT 6.1; Win64; x64', // Windows 7
        ];

        // 随机选择浏览器
        const browser = browsers[Math.floor(Math.random() * browsers.length)];
        // 随机选择版本号
        const version = browser.versions[Math.floor(Math.random() * browser.versions.length)];
        // 随机选择操作系统
        const os = operatingSystems[Math.floor(Math.random() * operatingSystems.length)];

        // 使用模板生成 UA 字符串
        return browser.userAgentTemplate.replace('{version}', version).replace('{os}', os);
    }

    async _loadConfig(cardId) {
        const view = app.viewsMap.get(cardId);

        // 检查 view 是否存在
        if (!view || !view.webContents) {
            Log.error('无效的 view 对象，无法加载配置');
            return; // 提前返回，避免后续操作
        }
        // 查询配置信息
        const dbConfig = await app.sdb.selectOne('card_config', { card_id: cardId });

        if (!dbConfig) {
            Log.warn('未找到配置，未进行任何设置');
            return; // 配置未找到，提前返回
        }

        // 将数据库字段映射为代码中使用的字段名
        const config = {
            userAgent: dbConfig.user_agent || null,
            cookie: dbConfig.cookie || null,
            proxyType: dbConfig.proxy_type || null,
            proxyStatus: dbConfig.proxy_status || null,
            host: dbConfig.proxy_host || null,
            port: dbConfig.proxy_port || null,
            username: dbConfig.proxy_username || null,
            password: dbConfig.proxy_password || null,
            fingerprintSwitch: dbConfig.fingerprint_switch === 'true',
            browser: dbConfig.browser || null,
            os: dbConfig.os || null,
            webglMetadata: dbConfig.webgl_metadata || null,
            webglVendor: dbConfig.webgl_vendor || null,
            webglRenderer: dbConfig.webgl_renderer || null,
            webgpu: dbConfig.webgpu || null,
            webglImage: dbConfig.webgl_image || null,
            webrtc: dbConfig.webrtc || null,
            timezone: dbConfig.timezone || null,
            geolocation: dbConfig.geolocation || null,
            geolocationCustom: dbConfig.geolocation_custom === 'true',
            language: dbConfig.language || null,
            resolution: dbConfig.resolution || null,
            resolutionWidth: dbConfig.resolution_width || null,
            resolutionHeight: dbConfig.resolution_height || null,
            font: dbConfig.font || null,
            fontCustom: dbConfig.font_custom || null,
            canvas: dbConfig.canvas || null,
            audioContext: dbConfig.audio_context || null,
            mediaDevices: dbConfig.media_devices || null,
            clientRects: dbConfig.client_rects || null,
            speechVoices: dbConfig.speech_voices || null,
            cpuCores: dbConfig.cpu_cores || null,
            cpuCoresCustom: dbConfig.cpu_cores_custom || null,
            memory: dbConfig.memory || null,
            memoryCustom: dbConfig.memory_custom || null,
            doNotTrack: dbConfig.do_not_track === 'true',
            screen: dbConfig.screen || null,
            battery: dbConfig.battery || null,
            portScanProtection: dbConfig.port_scan_protection === 'true',
            portScanProtectionCustom: dbConfig.port_Scan_Protection_Custom || null,
            geolocationLatitude: dbConfig.geolocation_latitude || '',
            geolocationLongitude: dbConfig.geolocation_longitude || '',
            geolocationAccuracy: dbConfig.geolocation_accuracy || '1000',
            canvasCustom: dbConfig.canvas_custom || null,
            audioContextCustom: dbConfig.audio_context_custom || null,
            mediaDevicesCustom: dbConfig.media_devices_custom || null,
            clientRectsCustom: dbConfig.client_rects_custom || null,
            speechVoicesCustom: dbConfig.speech_voices_custom || null,
            webglImageCustom: dbConfig.webgl_image_custom || null,
            webgpuCustom: dbConfig.webgpu_custom || null,
            timezoneCustom: dbConfig.timezone_custom || null,
            bluetoothCustom: dbConfig.bluetooth_custom || null
        };

        // 设置 User-Agent
        if (config.userAgent) {
            view.webContents.setUserAgent(config.userAgent);
            Log.info('User-Agent 已设置:', config.userAgent);
        }

        // 设置代理（仅在代理信息完整时）
        if (config.proxyStatus === 'true' && config.proxyType && config.host && config.port) {
            await this._applyProxySettings(view.webContents, config);
            Log.info('代理配置已应用:', { proxyType: config.proxyType, host: config.host, port: config.port, username: config.username });
        } else {
            // 如果没有代理信息，则清除代理设置
            await this._applyProxySettings(view.webContents, null);
            Log.info('代理配置已清除');
        }

        // 设置 Cookies
        if (config.cookie) {
            // 获取卡片对应的平台 URL
            let platformUrl = '';
            try {
                const card = await app.sdb.selectOne('cards', { card_id: cardId });
                if (card && card.platform) {
                    const platformInfo = app.platforms.find(p => p.platform === card.platform);
                    if (platformInfo) platformUrl = platformInfo.url;
                }
            } catch (_) {}
            await this._setCookies(view.webContents, config.cookie, platformUrl);
            Log.info('Cookies 已设置');
        }

        // 注入指纹保护脚本
        if (config.fingerprintSwitch) {
            const injectionScript = FingerprintProfile.generateInjectionScript(config);
            if (injectionScript) {
                // 清理旧的监听器，防止多次重复注入
                view.webContents.removeAllListeners('did-start-navigation');
                view.webContents.removeAllListeners('dom-ready');

                // 在主框架完成导航后注入，确保尽早生效
                view.webContents.on('did-start-navigation', () => {
                    view.webContents.executeJavaScript(injectionScript)
                        .then(() => Log.info('会话指纹脚本已注入 (did-start-navigation)'))
                        .catch(err => Log.error('指纹脚本注入失败:', err));
                });
                
                // 兜底注入：确保在 DOM 就绪时也运行一次
                view.webContents.on('dom-ready', () => {
                    view.webContents.executeJavaScript(injectionScript)
                        .then(() => Log.info('会话指纹脚本已确认 (dom-ready)'))
                        .catch(err => Log.error('指纹脚本确认失败:', err));
                });

                // 如果已经有页面加载，也立即执行一次
                if (!view.webContents.isLoading()) {
                    view.webContents.executeJavaScript(injectionScript).catch(() => {});
                }
            }
            Log.info('会话指纹保护已启用');
        }

        // 注入端口扫描保护脚本 (PortScanProtection)
        if (config.portScanProtection) {
            const PortScanProtection = require('../utils/PortScanProtection');
            const protectionScript = PortScanProtection.generatePortScanProtectionScript(true, []);
            
            view.webContents.removeAllListeners('did-finish-load');
            view.webContents.on('did-finish-load', () => {
                view.webContents.executeJavaScript(protectionScript)
                    .then(() => Log.info('端口扫描保护脚本已注入'))
                    .catch(err => Log.error('注入端口扫描保护脚本失败:', err));
            });
            Log.info('端口扫描保护已启用');
        }
    }

    /**
     * 解析并设置 Cookies
     * 支持两种格式：
     *   1. 标准 Cookie 字符串: "name1=val1; name2=val2"
     *   2. JSON 数组: [{ url, name, value, domain?, path?, secure?, httpOnly? }]
     * @param {Electron.WebContents} webContents
     * @param {string} cookie - cookie 字符串或 JSON 字符串
     * @param {string} [targetUrl] - 目标站点 URL（用于推断 domain）
     */
    async _setCookies(webContents, cookie, targetUrl) {
        const session = webContents.session;
        if (!session || !cookie) return;

        let cookieItems = [];

        // 尝试解析为 JSON 数组（高级格式）
        const trimmed = cookie.trim();
        if (trimmed.startsWith('[')) {
            try {
                cookieItems = JSON.parse(trimmed);
                if (!Array.isArray(cookieItems)) cookieItems = [];
            } catch (e) {
                Log.warn('Cookie JSON 解析失败，将按字符串格式处理:', e.message);
                cookieItems = [];
            }
        }

        // 如果不是 JSON 数组，按 "name=value; name2=value2" 格式解析
        if (cookieItems.length === 0 && trimmed.length > 0 && !trimmed.startsWith('[')) {
            const pairs = trimmed.split(';').map(s => s.trim()).filter(s => s);
            for (const pair of pairs) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx > 0) {
                    const name = pair.substring(0, eqIdx).trim();
                    const value = pair.substring(eqIdx + 1).trim();
                    cookieItems.push({ name, value });
                }
            }
        }

        if (cookieItems.length === 0) {
            Log.warn('Cookie 解析结果为空，未设置任何 cookie');
            return;
        }

        // 推断默认 URL：优先使用传入的 targetUrl，否则尝试从 webContents 获取
        let defaultUrl = targetUrl || '';
        if (!defaultUrl) {
            try {
                const currentUrl = webContents.getURL();
                if (currentUrl && currentUrl.startsWith('http')) {
                    defaultUrl = currentUrl;
                }
            } catch (_) {}
        }
        // 兜底：使用通用的 HTTPS 域
        if (!defaultUrl) {
            defaultUrl = 'https://web.whatsapp.com';
        }

        let successCount = 0;
        for (const item of cookieItems) {
            try {
                const cookieDetail = {
                    url: item.url || defaultUrl,
                    name: item.name || '',
                    value: item.value || '',
                };
                if (item.domain) cookieDetail.domain = item.domain;
                if (item.path) cookieDetail.path = item.path;
                if (item.secure !== undefined) cookieDetail.secure = item.secure;
                if (item.httpOnly !== undefined) cookieDetail.httpOnly = item.httpOnly;
                if (item.expirationDate) cookieDetail.expirationDate = item.expirationDate;

                if (!cookieDetail.name) continue;

                await session.cookies.set(cookieDetail);
                successCount++;
            } catch (error) {
                Log.error(`设置 Cookie [${item.name}] 时出错:`, error.message);
            }
        }
        Log.info(`Cookies 设置完成: 成功 ${successCount}/${cookieItems.length}`);
    }

    _destroyView(cardId) {
        try {
            // 从 app.viewsMap 获取 WebContentsView
            const view = app.viewsMap.get(cardId);
            // 检查 view 是否存在且未销毁
            if (view && !view.webContents.isDestroyed()) {
                view.setVisible(false)
                const mainId = Addon.get('window').getMWCid();
                const mainWindow = BrowserWindow.fromId(mainId);
                Log.info('mainId:', mainId);
                if (mainWindow) {
                    // 销毁 WebContents 以释放资源
                    view.webContents.destroy()
                    mainWindow.contentView.removeChildView(view);
                    // 从 app.viewsMap 中删除该视图的引用
                    app.viewsMap.delete(cardId);
                }
            } else {
                console.warn(`未找到 cardId 为 ${cardId} 的有效视图或视图已被销毁`);
            }
        } catch (error) {
            console.error(`销毁 WebContentsView 时出错: ${error.message}`);
        }
    }

    _getSystemLanguage() {
        // 使用环境变量 `LANG` 来获取系统语言（在 Linux 和 macOS 上适用）
        if (process.env.LANG) {
            return process.env.LANG.split('.')[0]; // `LANG` 格式可能是 `en_US.UTF-8`
        }

        // 使用 `Intl.DateTimeFormat` 获取系统区域设置（适用于跨平台）
        return Intl.DateTimeFormat().resolvedOptions().locale;
    }
    
    async getBluetoothInfo(args, event) {
        try {
            const si = require('systeminformation');
            let bluetoothInfo = {
                available: false,
                devices: [],
                features: 0,
                hash: ''
            };

            // Windows 特色：使用 PowerShell 获取更准确的硬件名称
            if (process.platform === 'win32') {
                try {
                    // 过滤掉枚举器，只保留实际硬件
                    const { stdout } = await execPromise('powershell -Command "Get-PnpDevice -Class Bluetooth | Where-Object { $_.Status -eq \'OK\' -and $_.FriendlyName -notlike \'*Enumerator*\' -and $_.FriendlyName -notlike \'*枚举器*\' } | Select-Object -ExpandProperty FriendlyName"');
                    if (stdout && stdout.trim()) {
                        const devs = stdout.trim().split(/\r?\n/).map(s => s.trim()).filter(s => s);
                        bluetoothInfo.devices = devs;
                        bluetoothInfo.available = devs.length > 0;
                    }
                } catch (err) {
                    Log.error('PowerShell get bluetooth failed:', err);
                }
            }

            // 如果 PowerShell 没拿到或非 Windows，尝试 systeminformation
            if (bluetoothInfo.devices.length === 0) {
                const siDevs = await si.bluetoothDevices();
                if (siDevs && siDevs.length > 0) {
                    bluetoothInfo.devices = siDevs.map(d => d.name || d.deviceName || 'Unknown Device');
                    bluetoothInfo.available = true;
                }
            }

            // 进一步检测功能特征（模拟 Web API 环境）
            bluetoothInfo.features = 4; // 默认支持程度

            // 生成简易哈希
            const hashSource = bluetoothInfo.devices.join(',') + process.platform;
            let hash = 0;
            for (let i = 0; i < hashSource.length; i++) {
                hash = ((hash << 5) - hash) + hashSource.charCodeAt(i);
                hash |= 0;
            }
            bluetoothInfo.hash = Math.abs(hash).toString(16).substring(0, 8);

            return { status: true, data: bluetoothInfo };
        } catch (error) {
            Log.error('getBluetoothInfo error:', error);
            return { status: false, message: error.message };
        }
    }

    async runFetchIpGeoByService(args) {
        const {
            proxyStatus,
            proxy: proxyType,
            host,
            port,
            username,
            password,
            forceDirect,
            forceProxy,
        } = args || {};
        const base = {
            raceCount: 2,
            timeoutMs: 20000,
        };
        if (forceDirect === true) {
            return runFetchIpGeo({ ...base, useProxy: false });
        }
        if (forceProxy === true) {
            const pType = String(proxyType || 'noProxy').toLowerCase();
            if (pType === 'noproxy') {
                return {
                    status: false,
                    message: '多线路检测须选择 HTTP/HTTPS/SOCKS5 代理协议',
                    elapsedSec: '0.0',
                    elapsedMs: 0,
                };
            }
            const h = String(host || '').trim();
            const pt = parseInt(String(port || '').trim(), 10);
            if (!h || Number.isNaN(pt)) {
                return {
                    status: false,
                    message: '请先填写主机与端口',
                    elapsedSec: '0.0',
                    elapsedMs: 0,
                };
            }
            return runFetchIpGeo({
                ...base,
                useProxy: true,
                proxyType: pType,
                host: h,
                port: pt,
                username,
                password,
            });
        }
        const useProxy = proxyStatus === 'true' || proxyStatus === true;
        const pType = String(proxyType || 'noProxy').toLowerCase();
        if (!useProxy || pType === 'noproxy') {
            return runFetchIpGeo({ ...base, useProxy: false });
        }
        const h = String(host || '').trim();
        const pt = parseInt(String(port || '').trim(), 10);
        if (!h || Number.isNaN(pt)) {
            return {
                status: false,
                message: '请先填写主机与端口',
                elapsedSec: '0.0',
                elapsedMs: 0,
            };
        }
        return runFetchIpGeo({
            ...base,
            useProxy: true,
            proxyType: pType,
            host: h,
            port: pt,
            username,
            password,
        });
    }

}

WindowService.toString = () => '[class WindowService]';
module.exports = WindowService;
