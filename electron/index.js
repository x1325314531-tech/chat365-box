const { Application } = require('ee-core');
const Log = require('ee-core/log');
const Services = require('ee-core/services');
const { app, BrowserWindow, WebContentsView,webContents ,ipcMain} = require('electron');
const request = require('./utils/request'); // 导入工具类
const path = require('path');
const fs = require('fs');
const {translateText,getLanguages,checkSensitiveContent,translateImage,translateVoice} = require('./api/index')
const Addon = require("ee-core/addon");
const Storage = require("ee-core/storage");
const Database = require('./utils/DatabaseUtils');
class Index extends Application {
  constructor() {
    super();
    app.sdb = new Database();
    app.viewsMap = new Map();
    this.initializeDatabase()
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
          port_scan_protection: 'TEXT',
          geolocation_latitude: 'TEXT',
          geolocation_longitude: 'TEXT',
          geolocation_accuracy: 'TEXT',
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
  }

  /**
   * main window have been loaded
   */
  async windowReady () {
    console.log('--- windowReady START ---');
    // 初始化翻译配置到内存
    app.translateConfig = Storage.connection('config.json').getItem('translateConfig');
    
    // do some things
    // 延迟加载，无白屏
    const winOpt = this.config.windowsOption;
    if (winOpt.show === false) {
      const win = this.electron.mainWindow;
      win.once('ready-to-show', () => {
        win.show();
      })
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
      const { content } = args;
      return checkSensitiveContent(content);
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
        
        // 如果是临时文件，删除它
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch(e) {}
        }

        return result;
      } catch (error) {
        Log.error('IPC translate-image error:', error);
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch(e) {}
        }
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
      const {online,platform,avatarUrl} = args;
      // 获取发送消息的渲染进程的 webContents 对象
      const senderWebContents = event.sender;
      const processId = senderWebContents.id;
      const mainId = Addon.get('window').getMWCid();
      const mainWin = BrowserWindow.fromId(mainId);
      if (mainWin && mainWin.webContents) {
        const card = await app.sdb.selectOne('cards',{window_id:processId})
        if (card) {
          const cardId = card.card_id;
          const onlineStatus = card.online_status;
          const result = (onlineStatus === String(online)); // 将 online 转换为字符串
          const status = String(online)
          if (!result) {
            await app.sdb.update('cards', { online_status: status, avatar_url: avatarUrl }, { platform: platform, card_id: cardId });
          mainWin.webContents.send('online-notify', { cardId: cardId, onlineStatus: online,avatarUrl:avatarUrl });
            Log.info(`登录状态发生改变已发送给渲染程序`);
          }
        }
        return {status:true,message:'状态修改成功！'}
      } else {
        return {status:false,message:'未找到的渲染进程！'};
      }
    });
    // 接收渲染进程发送的 IPC 消息，并执行 JS 操作
    ipcMain.on('execute-js-operation', async (event,url) => {
      const platforms = app.platforms ?? []
      try {
        // 获取发送该消息的渲染进程的 webContents
        const senderWebContents = event.sender;
        const fileName = platforms.find(item => item.url === url)?.platform;
        Log.info('fileName:', fileName,' url:',url);
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
    ipcMain.handle('new-message-notify', (event, data) => {
      const {platform} = data;
      // 获取发送消息的渲染进程的 webContents 对象
      const senderWebContents = event.sender;
      const processId = senderWebContents.id;
      const card = app.sdb.selectOne('cards',{window_id:processId,platform:platform})
      // 处理接收到的数据
      Log.info("收到新消息:", platform,processId);
      if (!card) return;
      Log.info('获取到对应卡片数据：',card)
      //修改数据库字段并发送通知给主进程
      app.sdb.update('cards',{show_badge:'true'},{card_id:card.card_id,active_status:"false"});
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
