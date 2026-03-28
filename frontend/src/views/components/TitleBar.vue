<template>
  <div class="title-bar">
    <div class="drag-area">
      <div class="app-info">
        <span class="app-name">Chat 365</span>
        <span class="app-version">{{ appVersion || '1.0.4' }}</span>
      </div>
    </div>
    <div class="window-controls">
      <div class="control-btn" @click="handleMinimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
        </svg>
      </div>
      <div class="control-btn" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
          <rect x="2.5" y="2.5" width="7" height="7" stroke="currentColor" fill="none" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect x="3.5" y="1.5" width="6" height="6" stroke="currentColor" fill="none" />
          <path d="M1.5 3.5 h6 v6 h-6 z" stroke="currentColor" fill="#ebf3f9" />
        </svg>
      </div>
      <div class="control-btn close-btn" @click="handleClose" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ipc } from '@/utils/ipcRenderer';

const isMaximized = ref(false);
const appVersion = ref('');

const ipcApiRoute = {
  minimize: 'controller.window.handleMinimize',
  maximize: 'controller.window.handleMaximize',
  close: 'controller.window.handleClose',
  getStatus: 'controller.window.getWindowStatus',
  getAppInfo: 'controller.updater.appInfo',
};

const handleMinimize = () => {
  ipc.invoke(ipcApiRoute.minimize);
};

const handleMaximize = () => {
  ipc.invoke(ipcApiRoute.maximize).then(() => {
    updateStatus();
  });
};

const handleClose = () => {
  ipc.invoke(ipcApiRoute.close);
};

const updateStatus = () => {
  ipc.invoke(ipcApiRoute.getStatus).then(res => {
    if (res) {
      isMaximized.value = res.isMaximized;
    }
  });
};

const getVersion = () => {
  ipc.invoke(ipcApiRoute.getAppInfo).then(res => {
    if (res && res.currentVersion) {
      appVersion.value = res.currentVersion;
    }
  });
};

onMounted(() => {
  updateStatus();
  getVersion();
  // 监听窗口大小变化
  window.addEventListener('resize', updateStatus);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateStatus);
});
</script>

<style scoped>
.title-bar {
  height: 32px;
  background-color: #ebf3f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.drag-area {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 12px;
  -webkit-app-region: drag;
}

.app-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.app-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.app-version {
  font-size: 11px;
  color: #666;
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  transition: all 0.2s;
  cursor: pointer;
}

.control-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.close-btn:hover {
  background-color: #e81123 !important;
  color: white !important;
}
</style>
