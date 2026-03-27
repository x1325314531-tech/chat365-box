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
 

    <!-- AI 润色抽屉 -->
    <div
      v-if="aiDrawerVisible && !rightSidebarCollapsed"
      class="ai-polish-drawer"
    >
      <aiPolishing
        v-if="currentCardId"
        :key="`${currentCardId}-${currentConversationId}`"
        :chat-id="currentCardId"
        :conversation-id="currentConversationId"
        :initial-text="polishText"
      />
  </div>
    <div class="sidebar-div" :class="{ 'is-collapsed': rightSidebarCollapsed }">
      <rightSidebar
        :collapsed="rightSidebarCollapsed"
        @toggle-collapse="handleToggleRightSidebar"
        @open-drawer="handleOpenDrawer"
      />
    </div>
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
const rightSidebarCollapsed = ref(false);

// AI 抽屉相关
const aiDrawerVisible = ref(false);
const currentCardId = ref('');
const currentConversationId = ref('');
const polishText = ref('');
const RIGHT_SIDEBAR_WIDTH = 70;
const AI_DRAWER_WIDTH = 330;

const syncActiveChatId = async () => {
  try {
    const res = await ipc.invoke('controller.window.getSessions', { platform: t('whatsapp.title') });
    const list = Array.isArray(res?.data) ? res.data : [];
    const active = list.find(item =>
      item.active_status === 'true' ||
      item.active_status === true ||
      item.activeStatus === 1 ||
      item.activeStatus === 'true'
    );
    const activeId = active?.card_id || active?.cardId || '';
    currentCardId.value = activeId ? String(activeId) : '';
  } catch (error) {
    console.error('sync active chat id failed:', error);
  }
};

const handleOpenDrawer = async (id) => {
  if (id === 'ai') {
    await syncActiveChatId();
    aiDrawerVisible.value = true;
    polishText.value = ''; // 如果是侧边栏手动打开，清空待润色文本
  }
};

onMounted(() => {
  // 监听来自 WhatsApp.js 的打开请求
  ipc.on('open-ai-polish-drawer', (event, data) => {
    currentCardId.value = data?.cardId || currentCardId.value;
    currentConversationId.value = data?.conversationId || data?.chatId || currentConversationId.value;
    polishText.value = data?.text || data?.originalText || '';
    aiDrawerVisible.value = true;
  });

  // 监听会话切换，同步 chatId
  ipc.on('chat-id-change', (event, data) => {
    currentCardId.value = data?.cardId || currentCardId.value;
    currentConversationId.value = data?.conversationId || data?.chatId || '';
  });

  syncActiveChatId();
});

watch([aiDrawerVisible, rightSidebarCollapsed], ([visible, collapsed]) => {
  const reservedWidth = visible && !collapsed
    ? AI_DRAWER_WIDTH + RIGHT_SIDEBAR_WIDTH
    : RIGHT_SIDEBAR_WIDTH;

  ipc.invoke('controller.window.setRightOverlayWidth', {
    width: reservedWidth
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

const handleToggleRightSidebar = () => {
  rightSidebarCollapsed.value = !rightSidebarCollapsed.value;
  if (rightSidebarCollapsed.value) {
    aiDrawerVisible.value = false;
  }
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
  transition: width 0.2s ease;
  position: relative;
  z-index: 3;
}

.sidebar-div.is-collapsed {
  width: 70px;
}

.ai-polish-drawer {
  width: 330px;
  height: 100%;
  flex-shrink: 0;
  background: #eef0ef;
  border-left: 1px solid #dfe3df;
  overflow: hidden;
  position: relative;
  z-index: 2;
}
</style>
