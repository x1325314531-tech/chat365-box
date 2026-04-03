<template>
  <transition name="local-fade">
    <div 
        v-if="visible" 
        class="local-message-tip" 
        :class="[`tip-${displayType}`]"
        :style="{ top: top }"
    >
      {{ content }}
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'success' // success, warning, error, info
  },
  duration: {
    type: Number,
    default: 2000
  },
  top: {
    type: String,
    default: '50%'
  }
});

const visible = ref(false);
const content = ref('');
const displayType = ref(props.type);
let timer = null;

const show = (msg, customType) => {
  if (timer) clearTimeout(timer);
  
  content.value = msg;
  displayType.value = customType || props.type;
  
  visible.value = true;
  
  timer = setTimeout(() => {
    visible.value = false;
    timer = null;
  }, props.duration);

  // 如果是在 Electron 环境，同步发送通知到 WebContentsView (如 WhatsApp)
  if (window.electronAPI) {
    const typeMap = {
      'error': 'is-danger',
      'success': 'is-success',
      'warning': 'is-warning',
      'info': 'is-info'
    };
    const electronType = (customType && typeMap[customType]) || typeMap[displayType.value] || 'is-info';
    
    // 异步加载 ipc 模块以避免潜在的循环依赖
    import('@/utils/ipcRenderer').then(({ ipc }) => {
      if (ipc) {
        ipc.invoke('controller.window.sendToWv', { 
          channel: 'show-notify', 
          args: [{ message: msg, type: electronType, position: 'center' }] 
        });
      }
    });
  }
};

// 暴露方法给父组件
defineExpose({
  show
});
</script>

<style scoped>
.local-message-tip {
  position: fixed;
  left: 50%;
  top: 50% !important;
  transform: translate(-50%, -50%);
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  pointer-events: none; /* 防止遮挡下层点击 */
}

/* Success style */
.tip-success {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

/* Warning style */
.tip-warning {
  background-color: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}

/* Error style */
.tip-error {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

/* Info style */
.tip-info {
  background-color: #f4f4f5;
  color: #909399;
  border: 1px solid #e9e9eb;
}

/* Transition animations */
.local-fade-enter-active, .local-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
}
.local-fade-enter-from, .local-fade-leave-to {
  opacity: 0;
  margin-top: -20px; /* 向上偏移 20px 进入 */
}
</style>
