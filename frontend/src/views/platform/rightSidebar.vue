<script setup>
import { ipc } from '@/utils/ipcRenderer';
import Notification from "@/utils/notification";
import { useI18n } from 'vue-i18n';
import { User } from '@element-plus/icons-vue';

const { t } = useI18n();

const props = defineProps({
  aiVisible: {
    type: Boolean,
    default: false
  },
  personaVisible: {
    type: Boolean,
    default: false
  }
});

const emits = defineEmits(['open-drawer']);

const handleAiClick = async () => {
  let aiConfig = await ipc.invoke('get-ai-config');
  if (!aiConfig) {
    const localAiConfig = localStorage.getItem('aiConfig');
    if (localAiConfig) {
      aiConfig = JSON.parse(localAiConfig);
    }
  }

  if (aiConfig && aiConfig.whatsapp && aiConfig.whatsapp.aiReplyToggle === false) {
    Notification.message({
      message: t('settings.aiPolishNotEnabled'),
      type: 'warning'
    });
    return;
  }
  
  emits('open-drawer', 'ai');
};

const handlePersonaClick = () => {
  emits('open-drawer', 'persona');
};

</script>

<template>
  <div class="right-sidebar">
    <div class="menu-container">
      <!-- AI 润色按钮 -->
      <div
        class="menu-item ai-item"
        :class="{ active: props.aiVisible }"
        @click="handleAiClick"
      >
        <div class="icon-wrapper ai-icon-bg">
          <div class="ai-logo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.4L12 22l-2.4-7.2L2 12l7.6-2.4L12 2z"/>
            </svg>
          </div>
        </div>
        <span class="label">{{ $t('quickItems.aiPolish') }}</span>
      </div>

      <!-- 用户画像按钮 -->
      <div
        class="menu-item persona-item"
        :class="{ active: props.personaVisible }"
        @click="handlePersonaClick"
      >
        <div class="icon-wrapper persona-icon-bg">
          <el-icon :size="18"><User /></el-icon>
        </div>
        <span class="label">当前画像</span>
      </div>
    </div>
  </div>
</template>


<style scoped>
.right-sidebar {
  width: 100%;
  height: 100%;
  background: #f8f9fa;
  border-left: 1px solid #eee;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  user-select: none;
}

.menu-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #606266;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.menu-item:hover .icon-wrapper {
  background: #e4e7ed;
  color: #303133;
}

.label {
  font-size: 12px;
  color: #606266;
  text-align: center;
}

.ai-icon-bg {
  background: #28c05d !important;
  color: white !important;
  box-shadow: 0 4px 10px rgba(40, 192, 93, 0.2);
}

.ai-item:hover .icon-wrapper {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(40, 192, 93, 0.3);
}

.ai-item .label {
  color: #28c05d;
  font-weight: 500;
}

.persona-icon-bg {
  background: #409eff !important;
  color: white !important;
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.2);
}

.persona-item:hover .icon-wrapper {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(64, 158, 255, 0.3);
}

.persona-item .label {
  color: #409eff;
  font-weight: 500;
}

.ai-logo {
  display: flex;
  justify-content: center;
  align-items: center;
}

.menu-item.active .icon-wrapper {
  outline: 2px solid #28c05d;
  outline-offset: 2px;
}

.persona-item.active .icon-wrapper {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}
</style>
