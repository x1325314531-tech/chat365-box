<template>
  <div class="container">
    <div class="left-div">
      <AsideCard 
        ref="asideCardRef"
        title="Telegram"
        @open-settings="handleOpenSettings"
      ></AsideCard>
    </div>
    <div class="right-div">
      <SessionSettings 
        v-if="showSettings"
        :is-edit="isEditSettings"
        :card="currentSettingCard"
        platform="Telegram"
        @confirm="handleSettingsConfirm"
        @cancel="handleSettingsCancel"
      />
      <el-empty v-else description="没有打开任何会话" />
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import AsideCard from "@/views/platform/AsideCard.vue";
import SessionSettings from "@/views/components/SessionSettings.vue";
import { ipc } from '@/utils/ipcRenderer';

const asideCardRef = ref(null);
const showSettings = ref(false);
const isEditSettings = ref(false);
const currentSettingCard = ref(null);

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

const handleSettingsConfirm = () => {
  showSettings.value = false;
  if (asideCardRef.value) {
    asideCardRef.value.getAllSessions();
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
  const args = {cardId:card.cardId,title:card.title,online:card.online,platform:'Telegram',activeStatus:true}
  //初始化机器码
  ipc.invoke(ipcApiRoute.addSession, args).then(res => {
    // console.log('收到数据：',res)
  })
}

</script>
<style scoped>
.container {
  display: flex; /* 使用 flex 布局 */
  height: 100vh; /* 高度占满视口 */
}

.left-div {
  border-right: 1px solid #e0e0e0;
}

.right-div {
  height: 100vh;
  flex-grow: 1; /* 占据剩余空间 */
  background-color: #f5f7fa;
  display: flex; /* 使用 flex 布局 */
  align-items: center; /* 垂直方向居中 */
  justify-content: center; /* 水平方向居中 */
  overflow-y: auto;
}
/* 自定义滚动条样式 */
.right-div::-webkit-scrollbar {
  width: 0; /* 滚动条的宽度 */
}

</style>
