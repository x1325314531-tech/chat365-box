'use strict';

const { Controller } = require('ee-core');
const Log = require('ee-core/log');
const Addon = require('ee-core/addon');
const axios = require('axios');
const { app, BrowserWindow, WebContentsView ,session} = require('electron');
const path = require('path');
const fs = require('fs');
const platforms = [
    { platform: 'Telegram', url: 'https://web.telegram.org/a/' },
    { platform: 'TelegramK', url: 'https://web.telegram.org/k/' },
    { platform: 'WhatsApp', url: 'https://web.whatsapp.com/' },
    // { platform: 'Telegram', url: 'https://www.browserscan.net/zh/' },
    // { platform: 'WhatsApp', url: 'https://ipcs.vip/' },
];
const { Service } = require('ee-core');
/**
 * 示例服务（service层为单例）
 * @class
 */
class WindowService extends Service {

    constructor(ctx) {
        super(ctx);
        app.platforms = app.platforms || platforms;
        this.isShrunk = false; // 记录侧边栏是否收缩
    }

    async addCard(args, event) {
        const {cardId, platform, online, name, sessionId} = args;
        const url = platforms.find(item => item.platform === platform)?.url;
        if (!url) return {message:'未找到对应平台的URL',status:false};
        // const mainId = Addon.get('window').getMWCid();
        // const mainWin = BrowserWindow.fromId(mainId);
        // 检查是否已存在会话
        const cardCache = await app.sdb.selectOne('cards',{'card_id':cardId})
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
            session_id: sessionId || ''
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
        const { platform, cardId } = args;
        const cardInfo = await app.sdb.selectOne('cards',{card_id:cardId,platform:platform})
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
        const { platform, cardId } = args;
        try {
            const count = await app.sdb.delete('cards',{card_id:cardId,platform:platform})
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
        const { cardId,platform } = args;
        Log.info('卡片切换：',args)
        const cardInfo = await app.sdb.selectOne('cards',{card_id:cardId,platform:platform});
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
        const { cardId,platform } = args;
        Log.info('初始化卡片会话：',args)
        const cardInfo = await app.sdb.selectOne('cards',{card_id:cardId,platform:platform});
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
        const { platform } = args;
        return await app.sdb.select('cards', {platform: platform});
    }

    async saveCardConfig(args, event) {
        const { card_id, name } = args;
        const config = await app.sdb.selectOne('card_config', { card_id: card_id })
        
        if (config) {
            // Create a copy of args to modify for card_config update
            const configArgs = { ...args };
            // Remove fields that don't belong to card_config table to avoid SQL errors
            delete configArgs.name;
            delete configArgs.card_id; // card_id is used in where clause, not set clause usually, or if it is, better to be safe if it's primary key

            const count = await app.sdb.update('card_config', configArgs, { card_id: card_id })
            
            // Update session name in cards table if provided
            if (name !== undefined && name !== '') {
                await app.sdb.update('cards', { card_name: name }, { card_id: card_id })
            }
            
            if (count > 0 || (name !== undefined && name !== '')) {
                return { status: true, message: '保存成功' }
            } else {
                return { status: false, message: '没有数据被修改' }
            }
        }
        return { status: false, message: '找不到对应配置数据' }
    }

    async getCardConfig(args, event) {
        const { cardId } = args;
        // 查找数据库中对应的平台和 cardId 的记录
        const data = await app.sdb.selectOne('card_config',{card_id:cardId})
        if (data) {
            return data;
        }else {
            return {}
        }
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
        Log.info('开始执行全局退出注销流程...');
        
        // 1. 获取所有卡片以确保能清除每个独立分区的存储
        const allCards = await app.sdb.select('cards', {});
        
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
                await cardSession.clearStorageData({
                    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage', 'serviceworkers', 'websql'],
                    quotas: ['persistent', 'temporary', 'syncable']
                });
                Log.info(`已彻底注销分区数据: ${partitionKey}`);
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
            mainWin.setTitle('setToolbox');
        }
        
        app.boxToken = null; 
        Log.info('✅ 全局退出完成，所有 WhatsApp 会话已注销。');
    }

    async changeSidebarWidth(isShrunk) {
        this.isShrunk = isShrunk;
        Log.info('侧边栏状态变更:', isShrunk ? '收缩' : '展开');
        
        // 获取当前活跃的 view
        const activeCard = await app.sdb.selectOne('cards', { active_status: 'true' });
        if (activeCard) {
            const view = app.viewsMap.get(activeCard.card_id);
            const mainId = Addon.get('window').getMWCid();
            const mainWin = BrowserWindow.fromId(mainId);
            if (view && mainWin) {
                this._resizeView(mainWin, view);
            }
        }
        return { status: true };
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

    _resizeView(mainWin, view) {
        if (mainWin && view) {
            const [width, height] = mainWin.getContentSize();
            // 左侧导航(50) + AsideCard(240/100) + border(1)
            const xOffset = this.isShrunk ? 151 : 291;
            view.setBounds({ x: xOffset, y: 0, width: width - xOffset + 2, height });
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
                proxyConfig = `https://${config.host}:${config.port}`;
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
            const [width, height] = mainWin.getContentSize();
            const xOffset = this.isShrunk ? 151 : 291;
            view.setBounds({ x: xOffset, y: 0, width: width - xOffset + 2, height });
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
            geolocationLatitude: dbConfig.geolocation_latitude || '',
            geolocationLongitude: dbConfig.geolocation_longitude || '',
            geolocationAccuracy: dbConfig.geolocation_accuracy || '1000'
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
            this._setCookies(view.webContents, config.cookie);
            Log.info('Cookies 已设置');
        }

        // 注入端口扫描保护脚本
        if (config.portScanProtection) {
            const PortScanProtection = require('../utils/PortScanProtection');
            const allowedPorts = []; // 可以从配置中读取允许的端口范围
            const protectionScript = PortScanProtection.generatePortScanProtectionScript(true, allowedPorts);
            
            view.webContents.on('did-finish-load', () => {
                view.webContents.executeJavaScript(protectionScript)
                    .then(() => {
                        Log.info('端口扫描保护脚本已注入');
                    })
                    .catch(err => {
                        Log.error('注入端口扫描保护脚本失败:', err);
                    });
            });
            
            Log.info('端口扫描保护已启用');
        } else {
            Log.info('端口扫描保护已禁用');
        }
    }

    // 示例 _setCookies 方法
    _setCookies(webContents, cookie) {
        const session = webContents.session;
        if (session && cookie) {
            session.cookies.set(cookie)
                .then(() => {
                    Log.info('Cookies 设置成功:', cookie);
                })
                .catch((error) => {
                    Log.error('设置 Cookies 时出错:', error);
                });
        }
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

}

WindowService.toString = () => '[class WindowService]';
module.exports = WindowService;
