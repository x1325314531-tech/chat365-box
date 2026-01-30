<template>
  <router-view/>
</template>

<script>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ipc } from '@/utils/ipcRenderer';
export default {
  name: 'App',
  setup() {
    document.getElementById('loadingPage').remove();
    
    const router = useRouter();
    
    // 监听登录过期事件
    const handleAuthExpired = (event, data) => {
      console.warn('收到登录过期通知:', data);
       ipc.invoke(ipcApiRoute.logout,{}).then(()=>{
    localStorage.removeItem('box-token');
    localStorage.removeItem('userInfo');
     // 跳转到登录页
      router.push('/login');
    })
    
    };
    
    onMounted(() => {
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
}
</style>
