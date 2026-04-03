import axios from 'axios';
import Notification from '@/utils/notification';
import router from '@/router';

// 创建一个 axios 实例
const service = axios.create({
    baseURL: import.meta.env.VITE_BASE_API, // 使用 import.meta.env 访问 Vite 环境变量
    timeout: 5000, // 请求超时时间
});

// 请求拦截器
service.interceptors.request.use(
    (config) => {
        // 在发送请求之前做些什么，比如添加 token
        // const token = localStorage.getItem('token');
        // if (token) {
        //     config.headers['Authorization'] = `Bearer ${token}`; // 将 token 添加到请求头
        // }
        console.log('config', config);
        
        const token = localStorage.getItem('box-token');
        if (token && !config.skipToken) {
            config.headers['box-token'] = token;
        }
        return config;
    },
    (error) => {
        // 对请求错误做些什么
        Notification.message({ message: '请求发送失败，请检查网络或重试', type: 'error' });
        console.error('请求错误:', error);
        return Promise.reject(error);
    }
);

// 响应拦截器
service.interceptors.response.use(
    (response) => {
        // 对响应数据做点什么
        const res = response.data;
        // 可以根据返回状态码处理逻辑，比如判断是否请求成功
        if (res.code !== 200) {
            // Token 失效
            if (res.code === 401) {
                Notification.message({ message: '登录状态已过期，请重新登录', type: 'error' });
                localStorage.removeItem('box-token');
                localStorage.removeItem('userInfo');
                router.push('/login');
                return Promise.reject(new Error('Auth failed'));
            }
            const errorMsg = res.msg || '请求失败';
            Notification.message({ message: errorMsg, type: 'error' });
            console.error('请求失败:', errorMsg);
            const error = new Error(errorMsg);
            error.isHandled = true; // 标记已处理，避免外部再次处理
            return Promise.reject(error);
        }
        
        return res;
    },
    (error) => {
        console.log('异常', error, error.response);
         Notification.message({ message: error, type: 'error' });
        // 如果是已经在上面处理过的业务错误，直接 reject
        if (error.isHandled) {
            return Promise.reject(error);
        }

        // 对响应错误做点什么
        if (error.response) {
            // 根据响应状态码自定义错误提示
            const { status, data } = error.response;
            if (status === 401) {
                Notification.message({ message: '登录状态已过期，请重新登录', type: 'error' });
                localStorage.removeItem('box-token');
                localStorage.removeItem('userInfo');
                router.push('/login');
                return Promise.reject(error);
            }
            // 支持 msg 或 message 字段
            const errorMessage = data.msg || data.message || `请求失败，状态码: ${status}`;
            Notification.message({ message: errorMessage, type: 'error' });
        } else {
            // 排除取消请求或已处理的错误
            if (error.code !== 'ERR_CANCELED') {
                Notification.message({ message: '网络错误，请检查您的网络连接', type: 'error' });
            }
        }
        console.error('响应错误:', error);
        return Promise.reject(error);
    }
);
// 导出请求方法
export function get(url, config = {}) {
    return service.get(url, config);
}

export function post(url, data = {}) {
    return service.post(url, data);
}

export function put(url, data = {}) {
    return service.put(url, data);
}

export function del(url, params = {}) {
    return service.delete(url, { params });
}
