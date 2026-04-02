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

    <div class="sidebar-div" :style="{ order: 2 }">
      <rightSidebar
        :ai-visible="aiDrawerVisible"
        :persona-visible="personaDrawerVisible"
        @open-drawer="handleOpenDrawer"
      />
    </div>

    <!-- User Persona drawer -->
    <!-- 全屏/最大化时 order:1 → 在 sidebar 左边 -->
    <!-- 非全屏/非最大化时 order:3 → 在 sidebar 右边 -->
    <div
      v-if="personaDrawerVisible"
      class="persona-drawer-container"
      :style="{ order: isMaximized ? 1 : 3 }"
    >
      <UserPersona
        v-if="currentCardId"
        :chat-id="currentCardId"
        :conversation-id="currentConversationId"
        @close="personaDrawerVisible = false"
      />
    </div>

    <!-- AI polish drawer -->
    <!-- 全屏/最大化时 order:1 → 在 sidebar 左边 -->
    <!-- 非全屏/非最大化时 order:3 → 在 sidebar 右边 -->
    <div
      v-if="aiDrawerVisible"
      class="ai-polish-drawer-container"
      :style="{ order: isMaximized ? 1 : 3 }"
    >
      <aiPolishing
        v-if="currentCardId"
        :key="`${currentCardId}-${currentConversationId}`"
        :chat-id="currentCardId"
        :conversation-id="currentConversationId"
        :initial-text="polishText"
        @close="aiDrawerVisible = false"
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
import UserPersona from "@/views/drawerRight/UserPersona/index.vue";
import { ipc } from '@/utils/ipcRenderer';

const { t } = useI18n();

const asideCardRef = ref(null);
const showSettings = ref(false);
const isEditSettings = ref(false);
const currentSettingCard = ref(null);
const isPlacedTop = ref(false);

// AI drawer state
const aiDrawerVisible = ref(false);
const personaDrawerVisible = ref(false);
const currentCardId = ref('');
const currentConversationId = ref('');
const polishText = ref('');
const RIGHT_SIDEBAR_WIDTH = 70;
const DRAWER_WIDTH = 330;

// 窗口最大化状态追踪
const isMaximized = ref(false);

const syncActiveChatId = async () => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const accountId = userInfo.accountId;
    const res = await ipc.invoke('controller.window.getSessions', { platform: t('whatsapp.title') , accountId: accountId });
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
    const nextVisible = !aiDrawerVisible.value;
    if (nextVisible) {
      await syncActiveChatId();
      polishText.value = ''; 
      personaDrawerVisible.value = false; // Mutually exclusive
    }
    aiDrawerVisible.value = nextVisible;
  } else if (id === 'persona') {
    const nextVisible = !personaDrawerVisible.value;
    if (nextVisible) {
      await syncActiveChatId();
      aiDrawerVisible.value = false; // Mutually exclusive
    }
    personaDrawerVisible.value = nextVisible;
  }
};

onMounted(async () => {
  // 初始查询窗口最大化状态
  try {
    const status = await ipc.invoke('controller.window.getWindowStatus');
    isMaximized.value = !!status?.isMaximized;
  } catch (e) {
    console.warn('failed to get initial window status:', e);
  }

  // 监听窗口最大化/还原事件
  ipc.on('window-maximize-change', (event, data) => {
    isMaximized.value = !!data?.isMaximized;
  });

  // Listen for open requests from WhatsApp.js
  ipc.on('open-ai-polish-drawer', (event, data) => {
    console.log('📥 [IPC] 收到打开 AI 润色面板请求:', data);
    // 立即同步会话 ID，防止后续 chat-id-change 触发清空
    const nextCardId = data?.cardId || currentCardId.value;
    const nextConversationId = data?.conversationId || currentConversationId.value;
    
    currentCardId.value = String(nextCardId || '');
    currentConversationId.value = String(nextConversationId || '');
    
    polishText.value = data?.text || data?.originalText || '';
    aiDrawerVisible.value = true;
  });

  // Listen for conversation switch and sync chat id
  ipc.on('chat-id-change', (event, data) => {
    const nextCardId = data?.cardId || currentCardId.value;
    const nextConversationId = data?.conversationId || '';
    const hasConversationChanged =
      String(nextCardId || '') !== String(currentCardId.value || '') ||
      String(nextConversationId || '') !== String(currentConversationId.value || '');

    currentCardId.value = String(nextCardId || '');
    currentConversationId.value = String(nextConversationId || '');

    // Reset polish content when conversation changes to avoid stale text.
    if (hasConversationChanged) {
      polishText.value = '';
    }
  });

  syncActiveChatId();
});

watch([aiDrawerVisible, personaDrawerVisible], ([aiVis, personaVis]) => {
  const isAnyDrawerOpen = aiVis || personaVis;
  const reservedWidth = isAnyDrawerOpen
    ? DRAWER_WIDTH + RIGHT_SIDEBAR_WIDTH
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
  ipc.removeAllListeners('window-maximize-change');
});

const handleLayoutChange = (val) => {
  isPlacedTop.value = val;
};


const handleOpenSettings = (data) => {
  console.log('设置', data);
  
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

// # Define IPC route
const ipcApiRoute = {
  addSession: 'controller.window.addSession',
}
const receiveCardId = (card)=> {
  const args = {cardId:card.cardId,title:card.title,online:card.online,platform:t('whatsapp.title'),activeStatus:true}
  // Initialize session
  ipc.invoke(ipcApiRoute.addSession, args).then(res => {
    // console.log('received data:', res)
  })
}

</script>
<style scoped>
.whatsapp-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
  order: 0;
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

.persona-drawer-container,
.ai-polish-drawer-container {
  width: 330px;
  height: 100%;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #eee;
  overflow: hidden;
  position: relative;
  z-index: 2;
}

.ai-polish-drawer-container {
  background: #eef0ef;
  border-left: 1px solid #dfe3df;
}
</style>
