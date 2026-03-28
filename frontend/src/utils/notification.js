import { ElMessage, ElNotification, ElMessageBox } from 'element-plus';
import { ipc } from '@/utils/ipcRenderer';

// 封装消息提示类
const Notification = {
    // 消息提示
    message({ message = '操作成功', type = 'success', duration = 2000, offset = 42 }) {
        ElMessage({
            message,
            type,
            duration,
            offset,
            customClass: 'global-notification',
        });
    },

    // 通知提示
    notify({ title = '提示', message = '操作成功', type = 'success', duration = 2000, offset = 42 }) {
        ElNotification({
            title,
            message,
            type,
            duration,
            offset,
            customClass: 'global-notification',
        });
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
