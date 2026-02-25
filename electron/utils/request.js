// request.js
const axios = require('axios');
const Log = require('ee-core/log');
// 创建 axios 实例
const axiosInstance = axios.create({
      //手动配置
    // baseURL: 'http://192.168.3.13:39205',
    baseURL: 'http://192.168.3.18:38080/box', // 可以根据需要修改
    // baseURL:'https://chat365.cc/api/box',
    // baseURL:'http://18.143.17.49:38080/box', //生产环境
    //根据环境配置
    // baseURL: Conf.getValue('baseUrl'),
    timeout: 10000, // 请求超时时间（毫秒）
    headers: {
        'Content-Type': 'application/json'
    }
});

// 请求拦截器
axiosInstance.interceptors.request.use(
    (config) => {
        // 在这里可以添加请求头或其他自定义逻辑
        const { app } = require('electron'); // 获取 app 对象
        Log.info('获取 app 对象', app)
        if (app.boxToken) {
            config.headers['box-token'] = app.boxToken;
        }
        Log.info('请求头', config.headers)
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
    (response) => {
         Log.info('响应数据', response);
        // 检查业务状态码
        if (response.data && response.data.code === 401) {
            Log.warn('Token 过期或无效，需要重新登录');
            
            // 清除 token
            const { app, BrowserWindow } = require('electron');
            app.boxToken = null;
            
            // 通知主窗口跳转到登录页
            const Addon = require('ee-core/addon');
            const mainId = Addon.get('window').getMWCid();
            const mainWin = BrowserWindow.fromId(mainId);
            if (mainWin && mainWin.webContents) {
                mainWin.webContents.send('auth-expired', { code: 401, message: '登录已过期，请重新登录' });
            }
            
            return Promise.reject(new Error('登录已过期'));
        }
       Log.info('返回数据响应体', response.data);
       
        
        return response.data; // 返回响应数据
    },
    (error) => {
        // HTTP 状态码为 401 的情况
        if (error.response && error.response.status === 401) {
            Log.warn('HTTP 401 未授权');
            
            const { app, BrowserWindow } = require('electron');
            app.boxToken = null;
            
            const Addon = require('ee-core/addon');
            const mainId = Addon.get('window').getMWCid();
            const mainWin = BrowserWindow.fromId(mainId);
            if (mainWin && mainWin.webContents) {
                mainWin.webContents.send('auth-expired', { code: 401, message: '登录已过期，请重新登录' });
            }
        }
        
        return Promise.reject(error);
    }
);

// 导出请求方法
module.exports = {
    get: (url, config) => axiosInstance.get(url, config),
    post: (url, data, config) => axiosInstance.post(url, data, config),
    put: (url, data, config) => axiosInstance.put(url, data, config),
    delete: (url, config) => axiosInstance.delete(url, config),
    axiosInstance // 如果需要自定义使用实例
};
