'use strict';

/**
 * 开发环境配置，覆盖 config.default.js
 */
module.exports = (appInfo) => {
  const config = {};

  /**
   * 开发者工具
   */
  config.openDevTools = {
    // mode: 'undocked'
    mode:'detach',
   activate: true
  };

  /**
   * 应用程序顶部菜单
   */
  config.openAppMenu =  true;

  /**
   * jobs
   */
  config.jobs = {
    messageLog: true
  };

  /**
   * 本地开发环境URL
   */
  // config.baseUrl = 'http://192.168.3.18:38080/box';

  return {
    ...config
  };
};
