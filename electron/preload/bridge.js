// 使用 CommonJS 语法
const { contextBridge, ipcRenderer } = require('electron');

console.log('🌉 [Chat365] Bridge loaded for:', window.location.href);

// ========== 核心：独立通知函数（preload 作用域内） ==========
// 此函数在 preload 作用域中定义，contextBridge 和 IPC 监听器都可以直接调用
// 解决了 contextIsolation 下 preload 无法访问 window.electronAPI 的问题
function _showNotification({ message = '默认通知', type = 'is-info', position = 'center' }) {
  const normalizedType = type.startsWith('is-') ? type : `is-${type}`;

  const types = {
    'is-info': { 
      bg: 'rgba(50, 152, 220, 0.9)', 
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    },
    'is-success': { 
      bg: 'rgba(72, 199, 142, 0.9)', 
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
    },
    'is-warning': { 
      bg: 'rgba(255, 221, 87, 0.95)', 
      color: '#3b3108',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    },
    'is-danger': { 
      bg: 'rgba(241, 70, 104, 0.9)', 
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
    }
  };

  const config = types[normalizedType] || types['is-info'];
  const isCenter = position === 'center';
  
  const notification = document.createElement('div');
  notification.id = 'system-notification-' + Date.now();
  
  Object.assign(notification.style, {
    position: 'fixed',
    top: isCenter ? '50%' : '32px',
    left: isCenter ? '50%' : 'auto',
    right: isCenter ? 'auto' : '32px',
    zIndex: '2147483647',
    width: '320px',
    minHeight: '56px',
    padding: '14px 18px',
    borderRadius: '14px',
    backgroundColor: config.bg,
    color: config.color || 'white',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(12px)',
    webkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    display: 'flex',
    alignItems: 'start',
    gap: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '1.4',
    opacity: '0',
    transform: isCenter ? 'translate(-50%, -50%) scale(0.95)' : 'translateX(60px)',
    transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    cursor: 'default',
    userSelect: 'none',
    pointerEvents: 'none'
  });

  notification.innerHTML = `
    <div style="flex-shrink: 0; width: 22px; height: 22px; margin-top: 1px; opacity: 0.95;">
      ${config.icon}
    </div>
    <div style="flex-grow: 1; word-break: break-word;">
      ${message}
    </div>
    <div style="flex-shrink: 0; cursor: pointer; opacity: 0.6; transition: opacity 0.2s; margin-left: 4px; pointer-events: auto;" 
         onmouseover="this.style.opacity='1'" 
         onmouseout="this.style.opacity='0.6'">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = isCenter ? 'translate(-50%, -50%) scale(1)' : 'translateX(0)';
  }, 10);

  let removeTimer;
  const closeHandler = () => {
    notification.style.opacity = '0';
    notification.style.transform = isCenter ? 'translate(-50%, -50%) scale(0.95)' : 'translateX(60px)';
    setTimeout(() => notification.remove(), 600);
  };

  notification.lastElementChild.onclick = closeHandler;
  const startTimer = (duration) => { removeTimer = setTimeout(closeHandler, duration); };
  startTimer(4500);
  notification.onmouseenter = () => clearTimeout(removeTimer);
  notification.onmouseleave = () => startTimer(2000);
}

// ========== IPC 监听：在 contextBridge 之前注册，直接调用 _showNotification ==========
// 不依赖 window.electronAPI，不依赖页面 load 事件，确保第一时间接收消息
ipcRenderer.on('show-notify', (_event, args) => {
  console.log('🌉 [Chat365] show-notify received (preload scope):', args);
  const { type, message, position = 'center' } = args || {};
  _showNotification({ message, type, position });
});

// ========== contextBridge：暴露 API 给渲染进程 ==========
contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => {
      if (typeof listener !== 'function') return;
      ipcRenderer.on(channel, (_event, ...args) => listener(undefined, ...args));
    },
    once: (channel, listener) => {
      if (typeof listener !== 'function') return;
      ipcRenderer.once(channel, (_event, ...args) => listener(undefined, ...args));
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
  sendFilterNotify: (data) => {
    ipcRenderer.send('filter-notify', data);
  },
  // 暴露给渲染进程的通知函数，内部调用同一个 _showNotification
  showNotification: (opts) => _showNotification(opts),
  languageList: () => {
    return ipcRenderer.invoke('language-list');
  },
  translateText: (args) => {
    return ipcRenderer.invoke('translate-text', args);
  },
  sendMsg: (args) => {
    return ipcRenderer.invoke('online-notify', args);
  },
  newMsgNotify: (args) => {
    return ipcRenderer.invoke('new-message-notify', args);
  },
  //打开用户画像弹窗
  showUserPortraitPanel: (args) => {
    return ipcRenderer.invoke('show-user-portrait-panel', args);
  },
  // 模拟键盘输入 - 用于绕过 Lexical 编辑器限制
  simulateTyping: (args) => {
    return ipcRenderer.invoke('simulate-typing', args);
  },
  //翻译配置
  getTranslateConfig: () => {
    return ipcRenderer.invoke('get-translate-config');
  },
  //租房配置
  getTenantConfig:()=> { 
    return ipcRenderer.invoke('get-tenant-config')
  },
  fetchTenantSetting: () => {
    return ipcRenderer.invoke('fetch-tenant-setting');
  },
  saveTenantConfig: (args) => {
    return ipcRenderer.invoke('save-tenant-config', args);
  },
  // AI配置
  getAiConfig: () => {
    return ipcRenderer.invoke('get-ai-config');
  },
  saveAiConfig: (args) => {
    return ipcRenderer.invoke('save-ai-config', args);
  },
  // AI翻译配置
  getAiTranslateConfig: () => {
    return ipcRenderer.invoke('get-ai-translate-config');
  },
  saveAiTranslateConfig: (args) => {
    return ipcRenderer.invoke('save-ai-translate-config', args);
  },
  // 敏感词检测
  checkSensitiveContent: (args) => {
    return ipcRenderer.invoke('check-sensitive-content', args);
  },
  // 图片翻译
  translateImage: (args) => {
    return ipcRenderer.invoke('translate-image', args);
  },
  getScriptContent: (scriptName) => {
    return ipcRenderer.invoke('get-script-content', scriptName);
  },
  translateVoice: (args) => {
    return ipcRenderer.invoke('translate-voice', args);
  },
  saveCapturedAudio: (args) => {
    return ipcRenderer.invoke('save-captured-audio', args);
  },
  syncNewFan: (args) => {
    return ipcRenderer.invoke('sync-new-fan', args);
  },
  syncWhatsAppContacts: (args) => {
    return ipcRenderer.invoke('sync-whatsapp-contacts', args);
  },
  getSessions: (args) => {
    return ipcRenderer.invoke('controller.window.getSessions', args);
  },
  getHeavyFans: (args) => {
    return ipcRenderer.invoke('get-heavy-fans', args);
  },
  agentChat: (args) => {
    return ipcRenderer.invoke('agent-chat', args);
  },
  getDictData: (dictType) => {
    return ipcRenderer.invoke('get-dict-data', dictType);
  }

});


// 在页面加载完成时发送消息，包括当前页面的 URL
window.addEventListener('load', () => {
  const currentURL = window.location.href;
  //执行对应平台的js代码
  ipcRenderer.send('execute-js-operation', currentURL);
});

// ========== 全局渲染进程错误上报 ==========
// 捕获未处理的同步错误（JS 运行时错误）
window.addEventListener('error', (event) => {
  ipcRenderer.send('renderer-log-error', {
    type: 'window-error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error ? event.error.stack : '',
    url: window.location.href,
  });
});

// 捕获未处理的 Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  ipcRenderer.send('renderer-log-error', {
    type: 'unhandled-rejection',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : '',
    url: window.location.href,
  });
});
