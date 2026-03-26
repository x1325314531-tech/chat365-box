<template>
  <div class="whatsapp-layout">
    <div class="main-content" :class="{ 'is-placed-top': isPlacedTop }">
      <div class="left-div">
        <AsideCard 
          ref="asideCardRef"
          :title="$t('whatsapp.title')" 
          @open-settings="handleOpenSettings"
          @layout-change="handleLayoutChange"
        ></AsideCard>
      </div>
      <div class="right-div">
        <SessionSettings 
          v-if="showSettings"
          :is-edit="isEditSettings"
          :card="currentSettingCard"
          :platform="$t('whatsapp.title')"
          @confirm="handleSettingsConfirm"
          @cancel="handleSettingsCancel"
        />
        <div v-else class="empty-box" >
           <el-empty  :description="$t('whatsapp.noSessions')" />
        </div>
      </div>
    </div>
    <div class="sidebar-div">
      <rightSidebar @open-drawer="handleOpenDrawer" />
    </div>

    <!-- AI 润色抽屉 -->
    <el-drawer
      v-model="aiDrawerVisible"
      title="AI 助手"
      direction="rtl"
      size="400px"
      :with-header="false"
      class="ai-polish-drawer"
    >
    {{ aiDrawerVisible }}
      <aiPolishing 
        v-if="aiDrawerVisible && currentChatId" 
        :chat-id="currentChatId"
        :initial-text="polishText"
      />
    </el-drawer>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AsideCard from "@/views/platform/AsideCard.vue";
import SessionSettings from "@/views/components/SessionSettings.vue";
import rightSidebar from "@/views/platform/rightSidebar.vue";
import aiPolishing from "@/views/drawerRight/aiPolishing/index.vue";
import { ipc } from '@/utils/ipcRenderer';

const { t } = useI18n();

const asideCardRef = ref(null);
const showSettings = ref(false);
const isEditSettings = ref(false);
const currentSettingCard = ref(null);
const isPlacedTop = ref(false);

// AI 抽屉相关
const aiDrawerVisible = ref(false);
const currentChatId = ref('');
const polishText = ref('');
const AI_DRAWER_WIDTH = 400;

const handleOpenDrawer = (id) => {
  if (id === 'ai') {
    aiDrawerVisible.value = true;
    polishText.value = ''; // 如果是侧边栏手动打开，清空待润色文本
  }
};

onMounted(() => {
  // 监听来自 WhatsApp.js 的打开请求
  ipc.on('open-ai-polish-drawer', (event, data) => {
    console.log('catid', data);
    
    currentChatId.value = data.chatId;
    polishText.value = data.text || '';
    aiDrawerVisible.value = true;
  });

  // 监听会话切换，同步 chatId
  ipc.on('chat-id-change', (event, data) => {
    currentChatId.value = data.chatId;
  });
});

watch(aiDrawerVisible, (visible) => {
  ipc.invoke('controller.window.setRightOverlayWidth', {
    width: visible ? AI_DRAWER_WIDTH : 0
  }).catch((error) => {
    console.error('sync right overlay width failed:', error);
  });
});

onUnmounted(() => {
  ipc.invoke('controller.window.setRightOverlayWidth', { width: 0 }).catch(() => {});
  ipc.removeAllListeners('open-ai-polish-drawer');
  ipc.removeAllListeners('chat-id-change');
});

const handleLayoutChange = (val) => {
  isPlacedTop.value = val;
};

const handleOpenSettings = (data) => {
  if (data) {
    isEditSettings.value = data.isEdit;
    currentSettingCard.value = data.card || null;
    showSettings.value = true;
    if (asideCardRef.value) {
      asideCardRef.value.hideWindow();
    }
  } else {
    showSettings.value = false;
    if (asideCardRef.value) {
      asideCardRef.value.setActiveStatus();
    }
  }
};

const handleSettingsConfirm = async (payload) => {
  showSettings.value = false;
  if (asideCardRef.value) {
    await asideCardRef.value.getAllSessions();
    if (payload && payload.isNew && payload.cardId) {
      asideCardRef.value.selectAndRefreshCard(payload.cardId);
    }
  }
};
const handleSettingsCancel = () => {
  showSettings.value = false;
  if (asideCardRef.value) {
    asideCardRef.value.setActiveStatus();
  }
};

// # 定义通信频道，即路由
const ipcApiRoute = {
  addSession: 'controller.window.addSession',
}
const receiveCardId = (card)=> {
  const args = {cardId:card.cardId,title:card.title,online:card.online,platform:t('whatsapp.title'),activeStatus:true}
  //初始化机器码
  ipc.invoke(ipcApiRoute.addSession, args).then(res => {
    // console.log('收到数据：',res)
  })
}

</script>
<style scoped>
.whatsapp-layout {
  display: flex;
  height: 100vh;
  width: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.main-content.is-placed-top {
  flex-direction: column;
}

.left-div {
  border-right: 1px solid #e0e0e0;
}

.is-placed-top .left-div {
  width: 100% !important;
  border-right: none;
  border-bottom: 1px solid #e0e0e0;
}

.right-div {
  flex-grow: 1;
  background-color: #f5f7fa;
  display: flex;
  overflow: hidden;
}

.empty-box {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}

.sidebar-div {
  width: 70px;
  height: 100%;
  background-color: #f8f9fa;
  border-left: 1px solid #e0e0e0;
  flex-shrink: 0;
}
</style>
