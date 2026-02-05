/**
 * 端口扫描保护模块
 * 用于阻止网站通过 WebSocket、fetch、XMLHttpRequest 等方式扫描本地端口
 */

/**
 * 生成端口扫描保护脚本
 * @param {boolean} enabled - 是否启用端口扫描保护
 * @param {Array<string>} allowedPorts - 允许访问的端口范围，例如 ['3000-4000', '8080']
 * @returns {string} 注入脚本代码
 */
function generatePortScanProtectionScript(enabled = true, allowedPorts = []) {
  if (!enabled) {
    return ''; // 如果未启用，返回空脚本
  }

  return `
(function() {
  'use strict';
  
  console.log('🛡️ 端口扫描保护已启用');
  
  // 解析允许的端口范围
  const allowedPortRanges = ${JSON.stringify(allowedPorts)}.map(range => {
    if (typeof range === 'string' && range.includes('-')) {
      const [start, end] = range.split('-').map(p => parseInt(p.trim()));
      return { start, end };
    }
    const port = parseInt(range);
    return { start: port, end: port };
  });
  
  // 检查端口是否在允许列表中
  function isPortAllowed(port) {
    if (allowedPortRanges.length === 0) return false;
    return allowedPortRanges.some(range => port >= range.start && port <= range.end);
  }
  
  // 检查 URL 是否为本地地址
  function isLocalURL(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // 检查是否为本地主机名
      const localHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'];
      if (localHostnames.includes(hostname)) return true;
      
      // 检查是否为私有 IP 地址
      if (hostname.startsWith('192.168.') || 
          hostname.startsWith('10.') || 
          hostname.match(/^172\\.(1[6-9]|2[0-9]|3[0-1])\\./)) {
        return true;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }
  
  // 检查 URL 是否应该被阻止
  function shouldBlockURL(url) {
    if (!isLocalURL(url)) return false;
    
    try {
      const urlObj = new URL(url);
      const port = urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
      
      // 如果端口在允许列表中，不阻止
      if (isPortAllowed(port)) return false;
      
      // 否则阻止
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // 保护 fetch API
  const originalFetch = window.fetch;
  window.fetch = function(resource, options) {
    const url = typeof resource === 'string' ? resource : resource.url;
    
    if (shouldBlockURL(url)) {
      console.warn('🛡️ 端口扫描保护: 已阻止对本地端口的访问:', url);
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    
    return originalFetch.apply(this, arguments);
  };
  
  // 保护 XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (shouldBlockURL(url)) {
      console.warn('🛡️ 端口扫描保护: 已阻止对本地端口的 XHR 请求:', url);
      throw new TypeError('Network request failed');
    }
    
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  // 保护 WebSocket
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (shouldBlockURL(url)) {
      console.warn('🛡️ 端口扫描保护: 已阻止对本地端口的 WebSocket 连接:', url);
      throw new DOMException('The operation is insecure.', 'SecurityError');
    }
    
    return new originalWebSocket(url, protocols);
  };
  
  // 保护 EventSource (Server-Sent Events)
  if (window.EventSource) {
    const originalEventSource = window.EventSource;
    window.EventSource = function(url, eventSourceInitDict) {
      if (shouldBlockURL(url)) {
        console.warn('🛡️ 端口扫描保护: 已阻止对本地端口的 EventSource 连接:', url);
        throw new DOMException('The operation is insecure.', 'SecurityError');
      }
      
      return new originalEventSource(url, eventSourceInitDict);
    };
  }
  
  // 保护动态创建的 iframe、img、script 等标签
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    const element = originalCreateElement.call(document, tagName, options);
    
    if (['iframe', 'img', 'script', 'link', 'embed', 'object'].includes(tagName.toLowerCase())) {
      const srcDescriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'src');
      const hrefDescriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'href');
      
      if (srcDescriptor && srcDescriptor.set) {
        const originalSrcSetter = srcDescriptor.set;
        Object.defineProperty(element, 'src', {
          set: function(value) {
            if (shouldBlockURL(value)) {
              console.warn(\`🛡️ 端口扫描保护: 已阻止 <\${tagName}> 标签访问本地端口:\`, value);
              return;
            }
            originalSrcSetter.call(this, value);
          },
          get: srcDescriptor.get
        });
      }
      
      if (hrefDescriptor && hrefDescriptor.set) {
        const originalHrefSetter = hrefDescriptor.set;
        Object.defineProperty(element, 'href', {
          set: function(value) {
            if (shouldBlockURL(value)) {
              console.warn(\`🛡️ 端口扫描保护: 已阻止 <\${tagName}> 标签访问本地端口:\`, value);
              return;
            }
            originalHrefSetter.call(this, value);
          },
          get: hrefDescriptor.get
        });
      }
    }
    
    return element;
  };
  
  console.log('🛡️ 端口扫描保护初始化完成');
  console.log('🛡️ 允许的端口范围:', ${JSON.stringify(allowedPorts)});
})();
`;
}

module.exports = {
  generatePortScanProtectionScript
};
