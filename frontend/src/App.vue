<template>
  <div class="app-container">
    <TitleBar />
    <div class="main-content">
      <router-view/>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ipc } from '@/utils/ipcRenderer';
import TitleBar from '@/views/components/TitleBar.vue';
export default {
  name: 'App',
  components: {
    TitleBar
  },
  setup() {
    document.getElementById('loadingPage').remove();
    
    const router = useRouter();
    
    const ipcApiRoute = {
      saveAuthToken: 'controller.login.saveAuthToken',
      logout: 'controller.window.logout',
    };

    // 监听登录过期事件
    const handleAuthExpired = (event, data) => {
      console.warn('收到登录过期通知:', data);
      ipc.invoke(ipcApiRoute.logout, {}).then(() => {
        localStorage.removeItem('box-token');
        localStorage.removeItem('userInfo');
        // 跳转到登录页
        router.push('/login');
      })
    };
    
    onMounted(() => {
      // 启动时同步 Token 到主进程 (方案 A)
      const token = localStorage.getItem('box-token');
      if (token) {
        console.log('检测到本地存储的 Token，正在同步到主进程...');
        ipc.invoke(ipcApiRoute.saveAuthToken, { token }).then(() => {
          console.log('Token 同步成功');
        }).catch(err => {
          console.error('Token 同步失败:', err);
        });
      }

      // 添加 IPC 监听器
      if (window.ipcRenderer) {
        window.ipcRenderer.on('auth-expired', handleAuthExpired);
      }
    });
    
    onUnmounted(() => {
      // 移除监听器
      if (window.ipcRenderer) {
        window.ipcRenderer.removeListener('auth-expired', handleAuthExpired);
      }
    });
  }
}
</script>
<style lang="less">
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 全局提示语样式：居中显示，解决 WebContentsView 遮挡问题 */
.el-message.global-notification {
  left: 50% !important;
  right: auto !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  max-width: 480px !important;
  z-index: 9999 !important;
}

/* 全局通知样式：居中显示，解决 WebContentsView 遮挡问题 */
.el-notification.global-notification {
  left: 50% !important;
  right: auto !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  z-index: 9999 !important;
}
</style>
