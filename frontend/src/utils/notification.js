import { ElMessage, ElNotification, ElMessageBox } from 'element-plus';
import { ipc } from '@/utils/ipcRenderer';

// ========== Electron 覆盖层通知（alwaysOnTop BrowserWindow）==========
// WebContentsView 是 OS 原生层，z-index 无法穿透。
// 最终方案：主进程创建一个独立的 alwaysOnTop 透明窗口，强制悬浮在所有视图之上。
async function _showOverlayNotification(message, type) {
    // 强制使用 ipc，优先保证能够调用成功
    let activeIpc = ipc;
    if (!activeIpc && window.electronAPI) activeIpc = window.electronAPI.ipcRenderer;
    if (!activeIpc && window.electron) activeIpc = window.electron.ipcRenderer;

    // 调试辅助：向主进程发送一个已知通畅的 log 通道，确认此函数被触发
    if (activeIpc && activeIpc.send) {
        activeIpc.send('renderer-log-error', { 
            type: 'DEBUG-NOTIF', 
            message: `Attempting show-overlay-notification: ${message}`,
            url: window.location.href 
        });
    }

    if (activeIpc && activeIpc.invoke) {
        try {
            await activeIpc.invoke('show-overlay-notification', { message, type });
        } catch (e) {
            console.error('[Notification] Overlay IPC failed:', e);
        }
    }
}

// 封装消息提示类
const Notification = {
    // 消息提示
    message({ message = '操作成功', type = 'success', duration = 2000, offset = 42 }) {
         console.error('window.electronAPI', window.electronAPI);
         _showOverlayNotification(message, type);
        // if (window.electronAPI) {
        //     _showOverlayNotification(message, type);
        // } else {
        //     ElMessage({
        //         message,
        //         type,
        //         duration,
        //         offset,
        //         customClass: 'global-notification',
        //     });
        // }
    },

    // 通知提示
    notify({ title = '提示', message = '操作成功', type = 'success', duration = 2000, offset = 42 }) {

        if (window.electronAPI) {
            _showOverlayNotification(message, type);
        } else {
            ElNotification({
                title,
                message,
                type,
                duration,
                offset,
                customClass: 'global-notification',
            });
        }
    },

    // 确认对话框
    confirm({ message = '确定要执行此操作吗？', title = '提示', type = 'warning' }) {
        ipc.invoke('controller.window.hideWindow');
        return ElMessageBox.confirm(
            message,
            title,
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type,
            }
        ).finally(() => {
            ipc.invoke('controller.window.restoreActiveViews');
        });
    },

    // 警告提示框
    alert({ message = '这是一个警告', title = '警告', type = 'warning' }) {
        ipc.invoke('controller.window.hideWindow');
        return ElMessageBox.alert(
            message,
            title,
            {
                confirmButtonText: '确定',
                type,
            }
        ).finally(() => {
            ipc.invoke('controller.window.restoreActiveViews');
        });
    },

    // 提示框
    prompt({ message = '请输入内容', title = '输入', type = 'info' }) {
        ipc.invoke('controller.window.hideWindow');
        return ElMessageBox.prompt(
            message,
            title,
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type,
            }
        ).finally(() => {
            ipc.invoke('controller.window.restoreActiveViews');
        });
    }
};

export default Notification;
