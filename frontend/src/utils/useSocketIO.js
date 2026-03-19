import { ref, onUnmounted } from 'vue';

/**
 * 原生 WebSocket 钩子函数 (替换 Socket.IO)
 * @param {string} url - 自定义服务器地址，如果为空则按环境判断
 * @param {object} options - 其他配置选项 (备用)
 */
export default function useSocketIO(url, options = {}) {
  const isConnected = ref(false);
  
  // 假定 ID 为 box-token，也可以从 localStorage 获取 userInfo.id
  const token = localStorage.getItem('box-token');
  
  if (!token) {
    console.warn('[WebSocket] 未找到 box-token，无法建立连接');
    return { socket: null, isConnected, emit: () => {}, on: () => {}, off: () => {} };
  }

  // 环境判断
  const isDev = import.meta.env.MODE === 'development';
  // 开发环境基地址 vs 生产环境基地址
  const defaultBaseUrl = isDev ? 'ws://192.168.3.18:38080/box' : 'wss://chat365.cc/api/box';
  const baseUrl = url || defaultBaseUrl;
  
  // 拼接路径：ws://.../ws/online/{token}
  const socketUrl = `${baseUrl}/ws/online/${token}`;
  console.log('[WebSocket] 正在连接:', socketUrl);

  let socket = null;
  let pingInterval = null;
  const listeners = {};

  try {
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      isConnected.value = true;
      console.log('[WebSocket] 已连接成功');
      startPing();
    };

    socket.onclose = (event) => {
      isConnected.value = false;
      stopPing();
      console.log('[WebSocket] 已断开连接:', event.reason || event.code);
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error);
    };

    socket.onmessage = (event) => {
      // 尝试将数据解析为 JSON
      let data = event.data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        // 如果不是 JSON 则保持原本字符串
      }
      
      // 触发表层的 'message' 事件
      if (listeners['message']) {
        listeners['message'].forEach(cb => cb(data));
      }
    };
  } catch (err) {
    console.error('[WebSocket] 创建连接异常:', err);
  }

  // 心跳机制
  const startPing = () => {
    // 建立连接后立刻发送一次 ping
    sendPing();
    // 之后每隔 30 秒发送一次
    pingInterval = setInterval(sendPing, 30000);
  };

  const stopPing = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  // 要求的心跳参数: { "type": 0, "message": "ping" }
  const sendPing = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const pingData = { type: 0, message: 'ping' };
      socket.send(JSON.stringify(pingData));
      // console.log('[WebSocket] 心跳已发送:', pingData);
    }
  };

  /**
   * 模拟的 emit / on / off 以保持组件层调用兼容（如有需要）
   */
  const emit = (event, data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event, data }));
    }
  };

  const on = (event, callback) => {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  };

  const off = (event, callback) => {
    if (!listeners[event]) return;
    if (callback) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    } else {
      listeners[event] = []; // 如果不传 callback，直接清空该事件的所有监听
    }
  };

  onUnmounted(() => {
    stopPing();
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
  });

  return {
    socket,
    isConnected,
    on,
    emit,
    off
  };
}
