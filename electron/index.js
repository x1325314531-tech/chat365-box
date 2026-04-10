const { Application } = require('ee-core');
const Log = require('ee-core/log');
const Services = require('ee-core/services');
const { app, BrowserWindow, WebContentsView,webContents ,ipcMain, shell} = require('electron');
const request = require('./utils/request'); // 导入工具类
const path = require('path');
const fs = require('fs');
const {translateText,getLanguages,checkSensitiveContent,translateImage,translateVoice,getTenantSetting, syncNewFan, batchAddFans, getHeavyFans, agentChat, agentChatTranslate, getDictData} = require('./api/index')
const Addon = require("ee-core/addon");
const Storage = require("ee-core/storage");
const Database = require('./utils/DatabaseUtils');

/**
 * 默认配置定义
 */
const DEFAULT_TRANSLATE_CONFIG = {
  sendAutoTranslate: true,
  sendChannel: 'Baidu',
  sendTargetLang: 'en',
  translatePreview: false,
  blockChineseMessage: false,
  blockChineseTranslation: true,
  receiveAutoTranslate: true,
  receiveChannel: 'Baidu',
  receiveTargetLang: 'zh',
  sendAutoNotTranslate: false,
  sendAutoNotSourceLang: 'en',
  sendAutoNotTargetLang: 'zh',
  sendColoseChannel: 'Baidu',
  sendVoiceSourceLang: 'zh',
  sendVoiceTargetLang: 'en',
  sendVoiceChannel: 'Baidu',
  receiveVoiceSourceLang: 'en',
  receiveVoiceTargetLang: 'zh',
  receiveVoiceChannel: 'Baidu',
  showTranslateConfig: true
};

const DEFAULT_AI_CONFIG = {
  whatsapp: {
    aiReplyToggle: false,
    model: 'Gemini',
    historyCount: 3,
    tone: 'default',
    theme: 'default',
    role: 'default',
    toneName: '默认',
    themeName: '默认',
    roleName: '默认',
  },
  telegram: {
    model: 'Gemini',
    historyCount: 3,
    tone: '默认',
    theme: '默认',
    role: '朋友'
  }
};

const DEFAULT_AI_TRANSLATE_CONFIG = {
  whatsapp: {
    aiTranslationToggle: false,
    aiTranslationPreview: false,
    model: 'Gemini',
    historyCountToggle: true,
    historyCount: 3,
    aiTranslationTargetLang: '',
    enTargetLang: '',
    validationLevel: 'rules'
  },
  telegram: {
    aiTranslationToggle: false,
    aiTranslationPreview: false,
    model: 'Gemini',
    historyCountToggle: true,
    historyCount: 3,
    aiTranslationTargetLang: '',
    enTargetLang: '',
    validationLevel: 'rules'
  }
};
class Index extends Application {
  constructor() {
    super();
    app.sdb = new Database();
    app.viewsMap = new Map();
    app.platforms = [
        { platform: 'Telegram', url: 'https://web.telegram.org/a/' },
        { platform: 'TelegramK', url: 'https://web.telegram.org/k/' },
        { platform: 'WhatsApp', url: 'https://web.whatsapp.com/' },
        { platform: 'Zalo', url: 'https://chat.zalo.me/' },
    ];
    this.initializeDatabase();

    // ========== 主进程全局异常捕获 ==========
    process.on('uncaughtException', (err) => {
      Log.error('[Main] Uncaught Exception:', err.stack || err);
    });

    process.on('unhandledRejection', (reason) => {
      Log.error('[Main] Unhandled Rejection:', reason instanceof Error ? reason.stack : reason);
    });

    // 启用 WebGPU 支持和忽略 GPU 黑名单
    app.commandLine.appendSwitch('enable-unsafe-webgpu');
    app.commandLine.appendSwitch('ignore-gpu-blocklist');
  }

  /**
   * core app have been loaded
   */
  async ready () {
    // do some things
   

  }
  async initializeDatabase() {
    // 定义表结构
    const tables = {
      'cards': {
        columns: {
          card_id: 'TEXT PRIMARY KEY',
          platform: 'TEXT',
          platform_url: 'TEXT',
          card_name: 'TEXT',
          avatar_url: 'TEXT',
          window_id: 'INTEGER',
          active_status: 'TEXT',
          online_status: 'TEXT',
          show_badge: 'TEXT',
          session_id: 'TEXT',
          my_phone: 'TEXT',
          unread_count: 'INTEGER',
          account_id: 'TEXT',
        },
        constraints: []
      },
      'card_config': {
        columns: {
          card_id: 'TEXT PRIMARY KEY',
          name: 'TEXT',
          user_agent: 'TEXT',
          cookie: 'TEXT',
          proxy_status: 'TEXT',
          proxy_type: 'TEXT',
          proxy_host: 'TEXT',
          proxy_port: 'TEXT',
          proxy_username: 'TEXT',
          proxy_password: 'TEXT',
          fingerprint_switch: 'TEXT',
          browser: 'TEXT',
          os: 'TEXT',
          webgl_metadata: 'TEXT',
          webgl_vendor: 'TEXT',
          webgl_renderer: 'TEXT',
          webgpu: 'TEXT',
          webgl_image: 'TEXT',
          webrtc: 'TEXT',
          timezone: 'TEXT',
          geolocation: 'TEXT',
          geolocation_custom: 'TEXT',
          language: 'TEXT',
          language_custom: 'TEXT',
          resolution: 'TEXT',
          resolution_width: 'TEXT',
          resolution_height: 'TEXT',
          font: 'TEXT',
          font_custom: 'TEXT',
          canvas: 'TEXT',
          audio_context: 'TEXT',
          media_devices: 'TEXT',
          client_rects: 'TEXT',
          speech_voices: 'TEXT',
          cpu_cores: 'TEXT',
          cpu_cores_custom: 'TEXT',
          memory: 'TEXT',
          memory_custom: 'TEXT',
          do_not_track: 'TEXT',
          screen: 'TEXT',
          battery: 'TEXT',
          battery_custom: 'TEXT',
          port_scan_protection: 'TEXT',
          geolocation_latitude: 'TEXT',
          geolocation_longitude: 'TEXT',
          geolocation_accuracy: 'TEXT',
          bluetooth: 'TEXT',
          canvas_custom: 'TEXT',
          audio_context_custom: 'TEXT',
          media_devices_custom: 'TEXT',
          client_rects_custom: 'TEXT',
          speech_voices_custom: 'TEXT',
          webgl_image_custom: 'TEXT',
          webgpu_custom: 'TEXT',
          timezone_custom: 'TEXT',
          bluetooth_custom: 'TEXT',
          port_scan_protection_custom: 'TEXT',
          do_not_track_custom: 'TEXT',
          screen_custom: 'TEXT',
          webrtc_custom: 'TEXT'
        },
        constraints: []
      },
      'number_record': {
        columns: {
          card_id: 'TEXT',          // 会话ID
          platform: 'TEXT',          // 平台
          phone_number: 'TEXT',      // 号码
          phone_status: 'TEXT',      // 手机号码状态
          message: 'TEXT',           // 日志信息
          status: 'TEXT'             // 检测状态
        },
        constraints: [
          'PRIMARY KEY(phone_number)',               // 主键
          'UNIQUE(phone_number, platform)'           // 复合唯一约束
        ]
      },
      'user_portrait': {
        columns: {
          card_id: 'TEXT',          // 会话ID
          platform: 'TEXT',          // 平台
          nickname: 'TEXT',          // 昵称
          phone_number: 'TEXT',      // 手机号码
          country: 'TEXT',      // 国家
          gender: 'TEXT',           // 性别
          notes: 'TEXT'             // 备注
        },
        constraints: [
          'PRIMARY KEY(phone_number)',               // 主键
          'UNIQUE(phone_number, platform)'           // 复合唯一约束
        ]
      },
      'follow_up_record': {
        columns: {
          card_id: 'TEXT',          // 会话ID
          platform: 'TEXT',          // 平台
          phone_number: 'TEXT',      // 手机号码
          time: 'TEXT',      // 时间
          content: 'TEXT',           // 内容
        },
        constraints: [
          'PRIMARY KEY(phone_number)',               // 主键
          'UNIQUE(phone_number, platform)'           // 复合唯一约束
        ]
      }
    };

    // 同步每个表的结构
    for (const [tableName, { columns, constraints }] of Object.entries(tables)) {
      await app.sdb.syncTableStructure(tableName, columns, constraints);
    }

    console.log("所有表结构同步完成");
  }

  /**
   * electron app ready
   */
  async electronAppReady () {
    Log.info('Chat365 electronAppReady STARTing...');

    // ========== 覆盖层通知窗口处理程序 (前置注册) ==========
    ipcMain.handle('show-overlay-notification', async (event, opts = {}) => {
      try {
        const { message = '', type = 'is-info', duration = 4500 } = opts;
        Log.info(`[show-overlay-notification] received: type=${type}, message=${message}`);
        
        // 尝试多种方式获取主窗口
        let mainWin = this.electron.mainWindow;
        if (!mainWin || mainWin.isDestroyed()) {
           const mainId = Addon.get('window').getMWCid();
           mainWin = BrowserWindow.fromId(mainId);
        }
        if (!mainWin || mainWin.isDestroyed()) {
          mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.isVisible());
        }
        
        Log.info(`[show-overlay-notification] target mainWin resolved: ${!!mainWin}`);

        const typeStyles = {
          'success': { color: '#67c23a', bg: '#f0f9eb', border: '#e1f3d8', icon: '<svg viewBox="0 0 1024 1024" width="18" height="18" style="vertical-align: middle;"><path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm-55.808 536.384-99.52-99.584a38.4 38.4 0 1 0-54.336 54.336l126.72 126.72a38.4 38.4 0 0 0 54.336 0l262.4-262.464a38.4 38.4 0 1 0-54.272-54.336L456.192 600.384z"></path></svg>' },
          'warning': { color: '#e6a23c', bg: '#fdf6ec', border: '#faecd8', icon: '<svg viewBox="0 0 1024 1024" width="18" height="18" style="vertical-align: middle;"><path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 192a58.432 58.432 0 0 0-58.24 63.744l23.36 256.384a35.072 35.072 0 0 0 69.76 0l23.296-256.384A58.432 58.432 0 0 0 512 256zm0 512a51.2 51.2 0 1 0 0-102.4 51.2 51.2 0 0 0 0 102.4z"></path></svg>' },
          'info':    { color: '#909399', bg: '#f4f4f5', border: '#e9e9eb', icon: '<svg viewBox="0 0 1024 1024" width="18" height="18" style="vertical-align: middle;"><path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 480a48 48 0 0 0-48 48v160a48 48 0 1 0 96 0V592a48 48 0 0 0-48-48zm0-240a56 56 0 1 0 0 112 56 56 0 0 0 0-112z"></path></svg>' },
          'error':   { color: '#f56c6c', bg: '#fef0f0', border: '#fde2e2', icon: '<svg viewBox="0 0 1024 1024" width="18" height="18" style="vertical-align: middle;"><path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm165.12 497.12L622.848 512l54.272-54.272a38.4 38.4 0 1 0-54.336-54.336L568.512 457.664l-54.272-54.272a38.4 38.4 0 1 0-54.336 54.336L514.176 512l-54.272 54.272a38.4 38.4 0 1 0 54.336 54.336l54.272-54.272 54.272 54.272a38.4 38.4 0 1 0 54.336-54.336z"></path></svg>' },
        };
        // 映射旧的 is- 前缀类型
        typeStyles['is-success'] = typeStyles['success'];
        typeStyles['is-warning'] = typeStyles['warning'];
        typeStyles['is-info'] = typeStyles['info'];
        typeStyles['is-danger'] = typeStyles['error'];
        typeStyles['is-error'] = typeStyles['error'];

        const style = typeStyles[type] || typeStyles['info'];
        const textColor = style.color;

        const notifWin = new BrowserWindow({
          width: 420,
          height: 90,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          resizable: false,
          focusable: false,
          hasShadow: false,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          }
        });

        // 强力置顶
        if (process.platform === 'darwin') {
          notifWin.setAlwaysOnTop(true, 'floating');
        } else {
          notifWin.setAlwaysOnTop(true, 'screen-saver');
        }

        // 居中定位逻辑
        if (mainWin && !mainWin.isDestroyed()) {
          const bounds = mainWin.getNormalBounds ? mainWin.getNormalBounds() : mainWin.getBounds();
          const x = Math.round(bounds.x + (bounds.width - 420) / 2);
          const y = Math.round(bounds.y + 70); // 距离窗口顶部 70px
          notifWin.setPosition(x, y);
          Log.info(`[show-overlay-notification] set position: x=${x}, y=${y} (main bounds: ${JSON.stringify(bounds)})`);
        } else {
          notifWin.center();
          Log.info(`[show-overlay-notification] mainWin not found, using screen center`);
        }

        const safeMsg = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background: transparent; overflow: hidden; height: 100%; }
  .box {
    width: 420px; min-height: 48px;
    background: ${style.bg};
    border-radius: 4px;
    border: 1px solid ${style.border};
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
    display: flex; align-items: flex-start; gap: 12px;
    padding: 15px 15px 15px 20px;
    font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
    font-size: 14px; color: ${textColor};
    animation: slideDown 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    word-break: break-all;
    overflow: hidden;
  }
  .icon { 
    display: flex; align-items: center; justify-content: center;
    color: ${textColor}; flex-shrink: 0; margin-top: 1px;
  }
  .msg { flex: 1; line-height: 1.4; }
  @keyframes slideDown { 
    from { opacity:0; transform: translateY(-20px); } 
    to { opacity:1; transform: translateY(0); } 
  }
</style>
</head><body>
<div class="box">
  <div class="icon">${style.icon}</div>
  <div class="msg">${safeMsg}</div>
</div>
</body></html>`;

        await notifWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        
        notifWin.once('ready-to-show', () => {
          notifWin.showInactive();
        });

        // 自动关闭逻辑
        setTimeout(() => {
          if (!notifWin.isDestroyed()) {
            notifWin.webContents.executeJavaScript(
              `document.querySelector('.box').style.cssText += '; transition: opacity 0.5s, transform 0.5s; opacity:0; transform: translateY(-20px);'`
            ).catch(() => {});
            setTimeout(() => { if (!notifWin.isDestroyed()) notifWin.close(); }, 500);
          }
        }, duration);

        return { status: true };
      } catch (err) {
        Log.error('[show-overlay-notification] error:', err);
        return { status: false, message: err.message };
      }
    });

    // 在应用启动时就注册 simulate-typing 处理程序
    // 这样确保在任何 WebContents 加载之前就已准备好
    ipcMain.handle('simulate-typing', async (event, args) => {
      const { text, clearFirst } = args;
      const senderWebContents = event.sender;
      
      try {
        Log.info('开始模拟键盘输入:', text.substring(0, 20) + '...');
        
        // 如果需要先清空，发送 Ctrl+A 然后 Backspace
        if (clearFirst) {
          // Ctrl+A 选择全部
          senderWebContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
          senderWebContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
          
          // 等待一帧
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Backspace 删除
          senderWebContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
          senderWebContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 逐个字符输入
        for (const char of text) {
          senderWebContents.sendInputEvent({ type: 'char', keyCode: char });
          // 小延迟确保每个字符被处理
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        
        Log.info('键盘输入模拟完成');
        return { success: true };
        
      } catch (error) {
        Log.error('模拟键盘输入失败:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-ip-info-backend', async (event, args) => {
      Log.info('IPC handle get-ip-info-backend called');
      return await Services.get('window').getIPInfo(args);
    });

    // 翻译配置持久化
    ipcMain.handle('save-translate-config', async (event, args) => {
      try {
        Log.info('保存翻译配置到 config.json:', args);
        const configStorage = Storage.connection('config.json');
        configStorage.setItem('translateConfig', args);
        // 同时挂载到 app 对象上，方便后台脚本直接访问
        app.translateConfig = args;
        return { success: true };
      } catch (err) {
        Log.error('保存翻译配置失败:', err);
        return { success: false, error: err.message };
      }
    });
    //租房配置持久化
    ipcMain.handle('save-tenant-config', async (event, args) => {
      try {
        Log.info('保存租户配置到 config.json:', args);
        const configStorage = Storage.connection('config.json');
        configStorage.setItem('tenantConfig', args);
        // 同时挂载到 app 对象上，方便后台脚本直接访问
        app.tenantConfig = args;
        return { success: true };
      } catch (err) {
        Log.error('保存租户配置失败:', err);
        return { success: false, error: err.message };
      }
    });
    // 获取翻译配置
    ipcMain.handle('get-translate-config', async (event) => {
      try {
        const configStorage = Storage.connection('config.json');
        const config = configStorage.getItem('translateConfig');
        // 同步到内存中
        if (config) app.translateConfig = config;
        return config;
      } catch (err) {
        Log.error('读取翻译配置失败:', err);
        return null;
      }
    });

    // AI配置持久化
    ipcMain.handle('save-ai-config', async (event, args) => {
      try {
        Log.info('保存AI配置到 config.json:', args);
        const configStorage = Storage.connection('config.json');
        configStorage.setItem('aiConfig', args);
        // 同时挂载到 app 对象上，方便后台脚本直接访问
        app.aiConfig = args;
        return { success: true };
      } catch (err) {
        Log.error('保存AI配置失败:', err);
        return { success: false, error: err.message };
      }
    });

    // 获取AI配置
    ipcMain.handle('get-ai-config', async (event) => {
      try {
        const configStorage = Storage.connection('config.json');
        const config = configStorage.getItem('aiConfig');
        // 同步到内存中
         Log.info('取AI配置到 config.json:', config);
        if (config) app.aiConfig = config;
        return config;
      } catch (err) {
        Log.error('读取AI配置失败:', err);
        return null;
      }
    });
       // AI翻译配置持久化
    ipcMain.handle('save-ai-translate-config', async (event, args) => {
      try {
        Log.info('保存AI翻译配置到 config.json:', args);
        const configStorage = Storage.connection('config.json');
        configStorage.setItem('aiTranslateConfig', args);
        // 同时挂载到 app 对象上，方便后台脚本直接访问
        app.aiTranslateConfig = args;
        return { success: true };
      } catch (err) {
        Log.error('保存AI配置失败:', err);
        return { success: false, error: err.message };
      }
    });
    // 获取AI配置
    ipcMain.handle('get-ai-translate-config', async (event) => {
      try {
        const configStorage = Storage.connection('config.json');
        const config = configStorage.getItem('aiTranslateConfig');
        // 同步到内存中
         Log.info('取AI配置到 config.json:', config);
        if (config) app.aiTranslateConfig = config;
        return config;
      } catch (err) {
        Log.error('读取AI配置失败:', err);
        return null;
      }
    });
    // 获取租户配置
    ipcMain.handle('get-tenant-config', async (event) => {
      try {
        const configStorage = Storage.connection('config.json');
        const config = configStorage.getItem('tenantConfig');
        // 同步到内存中
        if (config) app.tenantConfig = config;
        return config;
      } catch (err) {
        Log.error('读取租户配置失败:', err);
        return null;
      }
    });


    // 接收渲染进程上报的错误日志
    ipcMain.on('renderer-log-error', (event, data) => {
      const { type, message, stack, url, filename, lineno, colno } = data || {};
      Log.error(`[Renderer][${type}] ${url || ''}`, {
        message,
        filename,
        lineno,
        colno,
        stack,
      });
    });

    // 打开外部 URL
    ipcMain.handle('open-external-url', async (event, url) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (err) {
        Log.error('打开外部URL失败:', err);
        return { success: false, error: err.message };
      }
    });
  }

  /**
   * main window have been loaded
   */
  async windowReady () {
    console.log('--- windowReady START ---');
    // 根据多开控制标题显示 托盘菜单功能列表
    const win = this.electron.mainWindow;
    // if (app.userId && parseInt(app.userId) > 1) {
    //   win.setTitle(`Chat365 用户 ${app.userId}`);
    // }
    // 初始化配置到内存 (如果不存在则取默认值)
    const configStorage = Storage.connection('config.json');
    
    app.translateConfig = configStorage.getItem('translateConfig');
    if (!app.translateConfig) {
      app.translateConfig = DEFAULT_TRANSLATE_CONFIG;
      configStorage.setItem('translateConfig', DEFAULT_TRANSLATE_CONFIG);
    }
    
    app.aiConfig = configStorage.getItem('aiConfig');
    if (!app.aiConfig) {
      app.aiConfig = DEFAULT_AI_CONFIG;
      configStorage.setItem('aiConfig', DEFAULT_AI_CONFIG);
    }

    app.aiTranslateConfig = configStorage.getItem('aiTranslateConfig');
    if (!app.aiTranslateConfig) {
      app.aiTranslateConfig = DEFAULT_AI_TRANSLATE_CONFIG;
      configStorage.setItem('aiTranslateConfig', DEFAULT_AI_TRANSLATE_CONFIG);
    }
    
    // do some things
    // 延迟加载，无白屏
    const winOpt = this.config.windowsOption;
    if (winOpt.show === false) {
      const win = this.electron.mainWindow;
      win.once('ready-to-show', () => {
        win.show();
      })
    }

    // 转发窗口最大化/还原事件给渲染进程
    const mainWin = this.electron.mainWindow;
    if (mainWin) {
      mainWin.on('maximize', () => {
        mainWin.webContents.send('window-maximize-change', { isMaximized: true });
      });
      mainWin.on('unmaximize', () => {
        mainWin.webContents.send('window-maximize-change', { isMaximized: false });
      });
      mainWin.on('enter-full-screen', () => {
        mainWin.webContents.send('window-maximize-change', { isMaximized: true });
      });
      mainWin.on('leave-full-screen', () => {
        mainWin.webContents.send('window-maximize-change', { isMaximized: false });
      });
    }

    //设置所有平台账号登录状态为false
    app.sdb.update('cards',{online_status:'false',avatar_url:'',show_badge:'false'},{})
    ipcMain.handle('language-list', async (event) => {
      return getLanguages()
    });
    ipcMain.handle('translate-text', async (event, args) => {
      const {text,local,target} = args
      return translateText(text,local,target)
    });
    ipcMain.handle('check-sensitive-content', async (event, args) => {
      const { content,tenantConfig } = args;
      return checkSensitiveContent(content, tenantConfig);
    });
    ipcMain.handle('agent-chat', async (event, args) => {
      return agentChat(args)
    });
    ipcMain.handle('agent-chat-translate', async (event, args) => {
      return agentChatTranslate(args)
    });
    ipcMain.handle('get-dict-data', async (event, dictType) => {
      return getDictData(dictType)
    });

    ipcMain.handle('translate-image', async (event, args) => {
      const { imagePath, imageData, from, target } = args;
      let finalPath = imagePath;
      let tempFile = null;

      try {
        if (imageData && imageData.startsWith('data:image')) {
          // base64 数据，保存到临时文件
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          const tempDir = path.join(app.getPath('temp'), 'chat365_temp');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
          tempFile = path.join(tempDir, `img_trans_${Date.now()}.png`);
          fs.writeFileSync(tempFile, buffer);
          finalPath = tempFile;
        }

        if (!finalPath) {
          return { success: false, msg: '未提供图片路径或数据' };
        }

        const result = await translateImage(finalPath, from, target);
        
        // [DEBUG] 临时文件不再删除，保留在 chat365_temp 中方便调试
        /*
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch(e) {}
        }
        */

        return result;
      } catch (error) {
        Log.error('IPC translate-image error:', error);
        /*
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch(e) {}
        }
        */
      }
    });

    ipcMain.handle('save-captured-audio', async (event, args) => {
      const { audioData, format } = args;
      try {
        if (!audioData) return { success: false, msg: '没有音频数据' };

        let base64Data = audioData;
        if (audioData.includes('base64,')) {
            base64Data = audioData.split('base64,')[1];
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const tempDir = path.join(app.getPath('temp'), 'chat365_temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const fileName = `voice_capture_${Date.now()}.${format || 'pcm'}`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, buffer);
        
        Log.info('🎤 自动捕获音频已保存:', filePath);
        return { success: true, path: filePath };
      } catch (err) {
        Log.error('❌ 保存捕获音频失败:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('translate-voice', async (event, args) => {
      const { voicePath, filePath, audioData, from, target, format } = args;
      let finalPath = voicePath || filePath;
      let tempFile = null;
      
      Log.info('🎤 translate-voice IPC 调用');
      Log.info('  原始参数:', { 
        hasVoicePath: !!voicePath, 
        hasFilePath: !!filePath,
        hasAudioData: !!audioData,
        audioDataType: typeof audioData,
        audioDataLength: audioData ? audioData.length : 0,
        from, 
        target, 
        format 
      });
      
      try {
        if (audioData) {
          Log.info('  处理 audioData...');
          // 处理 base64 数据
          let base64Data = audioData;
          if (audioData.includes('base64,')) {
            base64Data = audioData.split('base64,')[1];
            Log.info('  - 检查到 data-url 格式，已提取 base64 部分');
          } else if (audioData.includes(';base64,')) {
            base64Data = audioData.split(';base64,')[1];
            Log.info('  - 检查到 ;base64 格式，已提取 base64 部分');
          }
          
          if (base64Data && base64Data.length > 32) {
            const buffer = Buffer.from(base64Data, 'base64');
            const tempDir = path.join(app.getPath('temp'), 'chat365_temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            
            tempFile = path.join(tempDir, `voice_trans_${Date.now()}.${format || 'pcm'}`);
            fs.writeFileSync(tempFile, buffer);
            finalPath = tempFile;
            
            Log.info('  ✅ 语音临时文件已创建:', tempFile, '大小:', buffer.length);
          } else {
            Log.warn('  ⚠️ base64Data 为空或太短:', base64Data ? base64Data.length : 'null');
          }
        }

        if (!finalPath) {
          Log.error('❌ 未能确定语音路径（finalPath 为空）');
          return { success: false, msg: '未提供语音路径或数据' };
        }

        Log.info('📡 调用翻译服务:', { finalPath, from, target, format: format || 'wav' });
        const result = await translateVoice(finalPath, from, target, format || 'wav', args.rate);
        
        Log.info('📥 服务响应:', result.success ? '成功' : '失败');
        
        return result;
      } catch (error) {
        Log.error('❌ IPC translate-voice 异常:', error);
        return { success: false, msg: error.message };
      }
    });

    ipcMain.handle('get-script-content', async (event, scriptName) => {
      try {
        const scriptPath = path.join(__dirname, 'scripts', scriptName);
        if (fs.existsSync(scriptPath)) {
          return fs.readFileSync(scriptPath, 'utf-8');
        }
        return null;
      } catch (error) {
        Log.error('get-script-content error:', error);
        return null;
      }
    });

    ipcMain.handle('online-notify', async (event, args) => {
      const {online,platform,avatarUrl,myPhone, unreadCount} = args;
      // 获取发送消息的渲染进程的 webContents 对象
      const senderWebContents = event.sender;
      const processId = senderWebContents.id;
      const mainId = Addon.get('window').getMWCid();
      const mainWin = BrowserWindow.fromId(mainId);
      if (mainWin && mainWin.webContents) {
        let card = await app.sdb.selectOne('cards', { window_id: processId });
        
        // 如果没找到，尝试通过 active_status 兜底（处理初始化或刷新时 ID 未同步的情况）
        if (!card) {
          card = await app.sdb.selectOne('cards', { active_status: 'true', platform: platform });
          if (card) {
            Log.info(`[online-notify] 通过 active_status 找到匹配卡片: ${card.card_id}, 正同步 window_id 为 ${processId}`);
          }
        }

        if (card) {
          const cardId = card.card_id;
          const status = String(online);
          const needsUpdate = (card.online_status !== status) || 
                              (myPhone && card.my_phone !== myPhone) ||
                              (!card.my_phone && myPhone) ||
                              (unreadCount !== undefined && card.unread_count !== unreadCount);
          
          if (needsUpdate) {
            Log.info(`[online-notify] 更新卡片 ${cardId}: online=${status}, unreadCount=${unreadCount}`);
            const updateData = { 
              online_status: status, 
              avatar_url: avatarUrl, 
              my_phone: myPhone || card.my_phone, 
              window_id: processId 
            };
            if (unreadCount !== undefined) {
              updateData.unread_count = unreadCount;
            }

            const updateCount = await app.sdb.update('cards', 
              updateData, 
              { platform: platform, card_id: cardId }
            );
            Log.info(`[online-notify] 数据库更新完成，受影响行数: ${updateCount}`);
            
            mainWin.webContents.send('online-notify', { 
              cardId: cardId, 
              platform: platform,
              onlineStatus: online, 
              avatarUrl: avatarUrl, 
              myPhone: myPhone || card.my_phone,
              unreadCount: unreadCount
            });
            Log.info(`登录状态、号码或未读数发生改变已发送给渲染程序`);
          }
        } else {
          Log.warn(`[online-notify] 未找到与 processId ${processId} 匹配的卡片记录`);
        }
        return { status: true, message: '状态修改成功！' };
      } else {
        return { status: false, message: '未找到主窗口或渲染进程！' };
      }
    });
    // 接收渲染进程发送的 IPC 消息，并执行 JS 操作
    // Forward AI drawer open events from webview scripts to the main renderer.
    ipcMain.on('open-ai-drawer', async (event, payload) => {
      try {
        const senderWebContents = event.sender;
        const processId = senderWebContents?.id;
        const data = payload && typeof payload === 'object' ? payload : {};

        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (!mainWin || !mainWin.webContents) {
          Log.warn('[open-ai-drawer] main window not found');
          return;
        }

        let card = processId ? await app.sdb.selectOne('cards', { window_id: processId }) : null;
        if (!card) {
          card = await app.sdb.selectOne('cards', { active_status: 'true', platform: 'WhatsApp' });
          Log.info('[open-ai-drawer] Find card via active_status fallback');
        }
        const conversationId = String(data.chatId || data.conversationId || '');
        const resolvedCardId = String(card?.card_id || '');
        Log.info(`[open-ai-drawer] Resolved cardId: ${resolvedCardId} for processId: ${processId}, conversationId: ${conversationId}`);
        const rawText = data.originalText ?? data.text ?? '';
        const text = typeof rawText === 'string' ? rawText : String(rawText || '');

        mainWin.webContents.send('open-ai-polish-drawer', {
          conversationId,
          cardId: resolvedCardId,
          text,
          originalText: text,
        });

        if (resolvedCardId || conversationId) {
          mainWin.webContents.send('chat-id-change', {
            conversationId,
            cardId: resolvedCardId,
          });
        }
      } catch (error) {
        Log.error('[open-ai-drawer] forward failed:', error);
      }
    });

    // Forward contact switch events from WhatsApp webview to renderer.
    ipcMain.on('chat-id-change', async (event, payload) => {
      try {
        const senderWebContents = event.sender;
        const processId = senderWebContents?.id;
        const data = payload && typeof payload === 'object' ? payload : {};

        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (!mainWin || !mainWin.webContents) {
          return;
        }

        let card = processId ? await app.sdb.selectOne('cards', { window_id: processId }) : null;
        if (!card) {
          card = await app.sdb.selectOne('cards', { active_status: 'true', platform: 'WhatsApp' });
        }

        const resolvedCardId = String(card?.card_id || '');
        const conversationId = String(data.chatId || data.conversationId || '');

        mainWin.webContents.send('chat-id-change', {
          chatId: conversationId,
          conversationId,
          cardId: resolvedCardId,
        });
      } catch (error) {
        Log.error('[chat-id-change] forward failed:', error);
      }
    });

    ipcMain.on('execute-js-operation', async (event,url) => {
      const platforms = app.platforms ?? []
      try {
        // 获取发送该消息的渲染进程的 webContents
        const senderWebContents = event.sender;
        // 先精确匹配，再前缀匹配（兼容子路径 / 哈希路由），按 URL 长度从长到短优先
        const sortedPlatforms = [...platforms].sort((a, b) => b.url.length - a.url.length);
        const fileName = sortedPlatforms.find(item => url === item.url || url.startsWith(item.url))?.platform;
        Log.info(`[execute-js-operation] url: ${url}, identified platform: ${fileName}, total platforms: ${platforms.length}`);
        
        if (fileName) {
          // 获取要执行的 JavaScript 文件内容
          const scriptPath = path.join(__dirname, 'scripts', `${fileName}.js`);
          const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
          
          // 如果是 WhatsApp，额外注入 html2canvas
          if (fileName === 'WhatsApp') {
            const h2cPath = path.join(__dirname, 'scripts', 'html2canvas.min.js');
            if (fs.existsSync(h2cPath)) {
              Log.info('同步注入 html2canvas.min.js');
              const h2cContent = fs.readFileSync(h2cPath, 'utf-8');
              await senderWebContents.executeJavaScript(h2cContent);
            }
          }

          // 在发送该消息的渲染进程中执行 JavaScript
          Log.info(`🚀 [Chat365] 正向 ${url} 注入脚本: ${fileName}.js`);
          await senderWebContents.executeJavaScript(scriptContent);
          Log.info('脚本已成功在渲染进程中执行');
        }else {
          Log.error('没有找到该地址对应的js代码：',url)
        }
      } catch (error) {
        Log.error('执行脚本时出错:', error);
      }
    });
    ipcMain.on('message-notify', async (event,args) => {
      // 获取发送消息的渲染进程的 webContents 对象
      const senderWebContents = event.sender;
      const processId = senderWebContents.id;
    });
    // 监听来自渲染进程的 `号码过滤` 事件
    ipcMain.on('filter-notify', (event, data) => {
      // 处理接收到的数据
      Log.info("接收到的网页数据:", data);
      const {cardId,phoneNumber,platform,result:{ phone_status, message }} = data;
      // 写入数据库
      app.sdb.insert('number_record',{card_id:cardId,phone_number:phoneNumber,platform:platform,phone_status:phone_status,message:message,status:'true'});
      const mainId = Addon.get('window').getMWCid();
      const mainWin = BrowserWindow.fromId(mainId);
      if (mainWin && mainWin.webContents) {
        mainWin.webContents.send('number_filter-notify',data)
        Log.info('号码过滤消息推送成功：')
      }
    });
    ipcMain.handle('new-message-notify', async (event, data) => {
      const {platform, unreadCount} = data;
      // 获取发送消息的渲染进程的 webContents 对象
      const senderWebContents = event.sender;
      const processId = senderWebContents.id;
      // 优先匹配当前活跃的卡片，防止数据库中 stale 的 window_id 导致匹配到错误的旧记录
      let card = await app.sdb.selectOne('cards', { window_id: processId, platform: platform, active_status: 'true' });
      if (!card) {
          card = await app.sdb.selectOne('cards', { window_id: processId, platform: platform });
          Log.info('从非活跃卡片中找到匹配：', card?.card_id);
      }

      // 处理接收到的数据
      Log.info("收到新消息:", platform, processId, "未读数:", unreadCount);
      if (!card) return;
      Log.info('获取到对应卡片数据：', card)

      // 修改数据库字段并发送通知给主进程
      const updateData = { unread_count: unreadCount || 0 };
      // 仅在非活跃状态下标记 show_badge 为 true，保持 UI 逻辑一致（活跃卡片不显红点）
      if (card.active_status === 'false') {
          updateData.show_badge = 'true';
      }
      
      // 更新该卡片的未读数（即便是活跃卡片也更新数据库，以便切换时保留数字）
      await app.sdb.update('cards', updateData, { card_id: card.card_id });
      
      const mainId = Addon.get('window').getMWCid();
      const mainWin = BrowserWindow.fromId(mainId);
      if (mainWin && mainWin.webContents) {
        mainWin.webContents.send('new-message-notify', {cardId:card.card_id,platform:card.platform})
        Log.info('新消息提醒推送成功：')
      }
    });
    //用户画像按钮监听
    ipcMain.handle('show-user-portrait-panel', async (event, data) => {
      const {platform, phone_number} = data;
      if (phone_number==='' || phone_number===undefined) return;
      // 获取发送消息的渲染进程的 webContents 对象
      const senderWebContents = event.sender;
      const processId = senderWebContents.id;
      const card = app.sdb.selectOne('cards', {window_id: processId, platform: platform})
      if (!card) return;
      const mainId = Addon.get('window').getMWCid();
      const mainWin = BrowserWindow.fromId(mainId);
      if (mainWin && mainWin.webContents) {
        //构建数据
        const args = {card_id: card.card_id, platform: card.platform,phone_number:phone_number};
        const result = await Services.get('user').getUserPortrait(args)
        mainWin.webContents.send('open-user-portrait', result)
      }
    });

    // 从后端刷新并解析租户配置
    ipcMain.handle('fetch-tenant-setting', async (event) => {
      try {
        Log.info('📡 IPC: fetch-tenant-setting 被调用');
        const response = await getTenantSetting();
        if (response && response.code === 200) {
          const config = response.data;
          // 持久化到本地
          const configStorage = Storage.connection('config.json');
          configStorage.setItem('tenantConfig', config);
          app.tenantConfig = config;
          Log.info('✅ 租户配置已从后端获取并持久化');
          return { success: true, data: config };
        }
        Log.error('❌ 获取租户配置失败:', response?.msg);
        return { success: false, msg: response?.msg || '获取配置失败' };
      } catch (err) {
        Log.error('❌ fetch-tenant-setting 异常:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('sync-new-fan', async (event, args) => {
      return await syncNewFan(args);
    });

    // 接收 WhatsApp IndexedDB 联系人数据并转发给前端或直接同步后端
    ipcMain.handle('sync-whatsapp-contacts', async (event, args) => {
      const { platform, myPhone, contacts, totalCount, isBatchAdd } = args;
      
      // 如果明确是批量增加粉丝请求，则调用后端接口同步
      if (isBatchAdd) {
        Log.info(`🚀 [Contacts] 正在调用批量同步粉丝接口: ${myPhone}`);
        return await batchAddFans(args);
      }

      Log.info(`📇 [Contacts] 收到 ${totalCount} 条 WhatsApp 联系人, myPhone: ${myPhone}`);
      
      try {
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        if (mainWin && mainWin.webContents) {
          mainWin.webContents.send('whatsapp-contacts-update', {
            platform,
            myPhone,
            contacts,
            totalCount
          });
          Log.info('📇 [Contacts] 联系人数据已转发给前端渲染进程');
        }
        return { status: true, message: '联系人同步成功' };
      } catch (error) {
        Log.error('📇 [Contacts] 处理联系人数据出错:', error);
        return { status: false, message: error.message };
      }
    });

    ipcMain.handle('get-heavy-fans', async (event, args) => {
      try {
        Log.info('📡 IPC: get-heavy-fans 被调用', args);
        const response = await getHeavyFans(args);
        return response;
      } catch (err) {
        Log.error('❌ get-heavy-fans 异常:', err);
        return { success: false, error: err.message };
      }
    });
  }
  /**
   * before app close
   */
  async beforeClose () {
    // do some things

  }


}
Index.toString = () => '[class Index]';
module.exports = Index;
