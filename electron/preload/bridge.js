// 使用 CommonJS 语法
const { contextBridge, ipcRenderer } = require('electron');

// 在 contextBridge 中暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: ipcRenderer,
  // 号码过滤通知
  sendFilterNotify: (data) => {
    ipcRenderer.send('filter-notify', data);
  },
  // 暴露通知函数，使用 Bulma 样式
  showNotification: ({ message = '默认通知', type = 'is-info' }) => {
    // Determine colors and icon based on type
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

    const config = types[type] || types['is-info'];
    
    // Create notification container
    const notification = document.createElement('div');
    notification.id = 'system-notification-' + Date.now();
    
    // Style the container
    Object.assign(notification.style, {
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: '2147483647',
      width: '320px',
      minHeight: '56px',
      padding: '14px 18px',
      borderRadius: '14px',
      backgroundColor: config.bg,
      color: config.color || 'white',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
      backdropFilter: 'blur(10px)',
      webkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      display: 'flex',
      alignItems: 'start',
      gap: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      lineHeight: '1.4',
      opacity: '0',
      transform: 'translateX(60px)',
      transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: 'default',
      userSelect: 'none'
    });

    notification.innerHTML = `
      <div style="flex-shrink: 0; width: 22px; height: 22px; margin-top: 1px; opacity: 0.95;">
        ${config.icon}
      </div>
      <div style="flex-grow: 1; word-break: break-word;">
        ${message}
      </div>
      <div style="flex-shrink: 0; cursor: pointer; opacity: 0.6; transition: opacity 0.2s; margin-left: 4px;" 
           onmouseover="this.style.opacity='1'" 
           onmouseout="this.style.opacity='0.6'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    `;

    document.body.appendChild(notification);

    // Show animation
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    let removeTimer;

    const closeHandler = () => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(60px)';
      setTimeout(() => notification.remove(), 600);
    };

    // Close button event
    notification.lastElementChild.onclick = closeHandler;

    const startTimer = (duration) => {
      removeTimer = setTimeout(closeHandler, duration);
    };

    // Auto remove
    startTimer(5000);
    
    // Pause timeout on hover
    notification.onmouseenter = () => clearTimeout(removeTimer);
    notification.onmouseleave = () => startTimer(2000);
  },
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
  saveTenantConfig: (args) => {
    return ipcRenderer.invoke('save-tenant-config', args);
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
  }

});

// 在页面加载完成时发送消息，包括当前页面的 URL
window.addEventListener('load', () => {
  const currentURL = window.location.href;
  //执行对应平台的js代码
  ipcRenderer.send('execute-js-operation', currentURL);
  // window.electron.ipcRenderer.on('show-notify', async (event, args) => {
  //   const {type,message} = args;
  //   window.electron.showNotification(message, 'is-'+type);
  // });
});

