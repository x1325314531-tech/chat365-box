import { post } from './request';

/**
 * 设置全局错误处理
 * @param {App} app Vue 实例
 */
export function setupErrorHandler(app) {
  // 仅在生产环境启用上报
  if (import.meta.env.MODE !== 'production') {
    return;
  }

  const reportError = (error, info = '') => {
    try {
      const logsContent = {
        message: error.message || error,
        stack: error.stack || '',
        info: info,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      post('/app/clientLogs', {
        logsType: 'ERROR',
        logsContent: JSON.stringify(logsContent)
      }).catch(err => {
        console.error('Failed to report error:', err);
      });
    } catch (e) {
      console.error('Error in error reporter:', e);
    }
  };

  // 1. 捕获 Vue 组件错误
  app.config.errorHandler = (err, instance, info) => {
    console.error('Vue Error:', err, info);
    reportError(err, `Vue info: ${info}`);
  };

  // 2. 捕获 JS 运行时错误
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global Error:', message, error);
    reportError(error || message, `Source: ${source}:${lineno}:${colno}`);
    return false;
  };

  // 3. 捕获未处理的 Promise 拒绝
  window.onunhandledrejection = (event) => {
    console.error('Unhandled Rejection:', event.reason);
    reportError(event.reason, 'Unhandled Promise Rejection');
  };
}
