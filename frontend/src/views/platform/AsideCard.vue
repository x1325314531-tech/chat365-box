<script setup>
import {onMounted, onUnmounted, reactive, ref, watch} from 'vue';
import { Refresh, Close,Delete,Setting ,Plus,User, Edit, SwitchButton,Select} from '@element-plus/icons-vue';
import importSvg from '@/assets/svgs/import.svg';
import userportrait from '@/assets/svgs/userportrait.svg';
import { nanoid } from 'nanoid'; // 用于生成唯一 ID
import { ipc } from '@/utils/ipcRenderer';
import ContactImporter from '../components/ContactImporter.vue';
import UserPortrait from '../components/UserPortrait.vue';
import {post,get, del} from "@/utils/request";
import Notification from "@/utils/notification";
const addLoading = ref(false)
const activeButtonLoading = ref(false)
const jsCode = ref('')
const executeCode = (card)=>{
  const args = {cardId:card.cardId,code:jsCode.value};
  ipc.invoke(ipcApiRoute.executeJavaScript, args).then(res => {
    console.log(res)
  })
}
const emits = defineEmits(['open-settings', 'refresh']);
const importPanel = ref(false)
const userPortraitPanel = ref(false)
const userPortraitPanelData = ref({})
const importPanelData = ref({})
// 接收父组件传入的标题
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
});

// 存储会话列表和当前选中的卡片索引
const conversations = reactive([]);
const selectedCardIndex = ref(null);
// 定义通信频道，即路由
const ipcApiRoute = {
  getSessions: 'controller.window.getSessions',
  addSession: 'controller.window.addSession',
  deleteSession: 'controller.window.deleteSession',
  refreshSession: 'controller.window.refreshSession',
  selectSession: 'controller.window.selectSession',
  initSession: 'controller.window.initSession',
  addConfigInfo: 'controller.window.addConfigInfo',
  getConfigInfo: 'controller.window.getConfigInfo',
  executeJavaScript: 'controller.window.executeJavaScript',
  hideWindow: 'controller.window.hideWindow',
};


onMounted(async () => {
  // 页面加载时获取所有会话
  await getAllSessions();
  // 移除可能存在的旧的 'online-notify' 监听器，避免重复添加
  ipc.removeAllListeners('online-notify');
  // 监听进程消息
  ipc.on('online-notify', (event, args) => {
    const { onlineStatus, cardId ,avatarUrl} = args;
    console.log('登录通知：', args);
    getAllSessions();
  });
  ipc.removeAllListeners('new-message-notify');
  // 添加新的监听器
  ipc.on('new-message-notify', (event, data) => {
    getAllSessions();
  });
});

// 在组件卸载时，移除 'online-notify' 监听器，防止内存泄漏
onUnmounted(() => {
  ipc.removeAllListeners('online-notify');
});
// 监听 conversations 数组的变化
watch(conversations, () => {
  // 只有当有数据时才进行判断，避免在加载过程中误隐藏
  if (conversations.length === 0) return;
  
  const selectedCard = conversations.find(card => card.active_status === 'true');
  if (!selectedCard) {
    // 如果没有选中的卡片，执行隐藏窗体的逻辑
    console.log('没有选中卡片，设置窗体全部隐藏');
    ipc.invoke(ipcApiRoute.hideWindow);
  }
}, { deep: true });
// 获取所有会话数据
async function getAllSessions() {
  try {
    const res = await ipc.invoke(ipcApiRoute.getSessions, { platform: props.title });
    if (res && res.data) {
      console.log('获取所有会话成功', res.data);
      const sessionList = res.data.map(item => {
        // 统一字段名为 active_status，且值为字符串 'true' 或 'false'
        let activeStatus = 'false';
        if (item.activeStatus === 1 || item.active_status === 'true' || item.active_status === true) {
          activeStatus = 'true';
        }
        
        return {
          ...item,
          cardId: item.card_id || item.cardId, // 确保 cardId 和 card_id 都存在
          card_id: item.card_id || item.cardId,
          active_status: activeStatus,
          online_status: String(item.online_status || item.onlineStatus || 'false'),
          show_badge: String(item.show_badge || 'false')
        };
      });
      
      // 使用 splice 清空并更新数组，确保 Vue 响应性
      conversations.splice(0, conversations.length, ...sessionList);
      
      setActiveStatus(); // 检查并设置激活状态
    }
  } catch (error) {
    console.error('获取所有会话出错:', error);
  }
  
  // 异步获取后端数据，仅用于同步 sessionId 等后端特定字段
  get('/app/session/list', {
    pageSize: 1000,
    page: 1,
  }).then(res => {
    if (res && res.data) {
      console.log('从后端获取会话列表成功');
      // 将后端返回的 sessionId 等同步到现有的 conversations 中
      res.data.forEach(backendCard => {
        const localCard = conversations.find(c => c.card_id === backendCard.cardId);
        if (localCard) {
          localCard.sessionId = backendCard.id || backendCard.sessionId;
        }
      });
    }
  }).catch(err => {
    console.error('从后端获取会话列表失败:', err);
  });
}
// 设置选中的卡片索引
function setActiveStatus() {
  const activeCardIndex = conversations.findIndex((card) => card.active_status==='true');
  selectedCardIndex.value = activeCardIndex !== -1 ? activeCardIndex : null;
  const activeCard = conversations.find((card) => card.active_status==='true');
  console.log('activeCard', activeCard);
  
  if (activeCard) {
    ipc.invoke(ipcApiRoute.selectSession, {cardId:activeCard.card_id,platform:props.title}).then(res => {
      // getAllSessions()
    })
  }
}
const cancelClick = ()=>{
  emits('open-settings', null);
}
// 添加新会话
function addConversation() {
  emits('open-settings', { isEdit: false });
}
// 控制并发数的辅助函数
const asyncPool = async (poolLimit, array, iteratorFn) => {
  const ret = []; // 存储所有任务的结果
  const executing = []; // 当前正在执行的任务

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item)); // 创建一个新的任务
    ret.push(p); // 保存这个任务的结果

    // 如果任务数达到了并发上限，则等待一个任务完成
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing); // 等待最先完成的任务
      }
    }
  }

  return Promise.all(ret); // 等待所有任务完成
};

// 打开所有会话（限制每次并发 5 个）
const openAll = async () => {
  activeButtonLoading.value = true;

  // 定义每个会话初始化的操作
  const initSessionForCard = async (card) => {
    // 设置 card 状态为加载中
    card.loading = true;

    try {
      // 调用 initSession 初始化会话
      const res = await ipc.invoke(ipcApiRoute.initSession, { platform: props.title, cardId: card.card_id });

      // 根据返回结果更新 card 状态
      if (res.status) {
        console.log(`会话 ${card.card_id} 初始化成功:`, res.message);
      } else {
        console.warn(`会话 ${card.card_id} 初始化失败:`, res.message);
      }
    } catch (error) {
      // 处理调用失败的情况
      console.error(`会话 ${card.card_id} 初始化过程中出错:`, error.message);
    } finally {
      // 无论成功还是失败，都将 card 状态设置为非加载中
      card.loading = false;
    }
  };

  // 使用 asyncPool 函数限制并发数为 5
  await asyncPool(5, conversations, initSessionForCard);

  // 所有会话初始化完毕，关闭按钮的加载状态
  activeButtonLoading.value = false;
};

// 选择卡片
function selectCard(index, card) {
  card.show_badge = 'false'
  return new Promise((resolve) => {
    // 如果当前卡片已被选中，则直接返回
    if (card.active_status === 'true') {
      resolve();
      return;
    }
    // 设置当前卡片的加载状态
    card.loading = true;

    // 清除所有卡片的选中状态
    conversations.forEach((c) => (c.active_status = 'false'));

    // 设置当前卡片为选中状态
    card.active_status = 'true';

    // 更新选中的卡片索引
    selectedCardIndex.value = index;

    // 通过 IPC 调用 selectSession 接口以更新选中的会话状态
    ipc.invoke(ipcApiRoute.selectSession, { cardId: card.card_id, platform: props.title })
        .then((res) => {
          // 若响应成功，则取消卡片的加载状态
          if (res.status) {
            card.loading = false;
          }
          resolve();
        })
        .catch((error) => {
          // 若出现错误，记录日志并取消加载状态
          console.error('选择卡片时出错:', error);
          card.loading = false;
          resolve();
        });
  });
}
defineExpose({
  getAllSessions
});
// 处理设置按钮点击
function handleSetting(card) {
  emits('open-settings', { isEdit: true, card: card });
}

// 导入联系人被点击
function importContacts(card) {
  importPanel.value = true
  const platform = card.platform;
  const cardId = card.card_id;
  importPanelData.value = {platform, cardId};
}
// 用户画像按钮被点击
function userPortrait(card) {
  userPortraitPanel.value = true
  const platform = card.platform;
  const cardId = card.card_id;
  userPortraitPanelData.value = {platform, cardId};
}
// 处理刷新按钮点击
async function handleRefresh(card) {
  card.loading = true;
  const args = { cardId: card.cardId, platform: props.title };
  ipc.invoke(ipcApiRoute.refreshSession, args).then(res =>{
    if (res.status) {
      card.loading = false;
      console.log('刷新成功：',res)
    }else {
      console.log('刷新失败：',res)
      card.loading = false;
    }
  })
}

// 处理关闭按钮点击
function handleClose(card) {
  card.loading = true;
  ipc.invoke(ipcApiRoute.deleteSession, { platform: props.title, cardId: card.cardId }).then((res) => {
    if (res.status) {
      card.loading = false;
    }
    del(`/app/session/${card.sessionId}`).then(res=> { 
      if(res.code==200) { 
           Notification.message({ message: '删除回话成功', type: 'success' });
            setActiveStatus(); 
            getAllSessions()
          
      }

    })
    // 使用 reactive 数组时，直接操作即可，不需要 .value
    // conversations.splice(0, conversations.length, ...conversations.filter((c) => c.card_id !== card.card_id));
    // setActiveStatus(); // 更新选中状态
    // ipc.send('receive-notify', { type: 'success', message: '删除成功!' });
  });
}
</script>
<template>
  <div class="sidebar">
    <!-- 顶部标题和按钮 -->
    <div class="header">
      <el-row>
        <el-col :span="24">
          <p>{{ title + ` 会话数量:${conversations.length}` }}</p>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-button :loading="addLoading" size="default" @click="addConversation" type="primary">
            新建会话
            <el-icon class="el-icon--left"><Plus /></el-icon>
          </el-button>
        </el-col>
        <el-col :span="12">
          <el-button :loading="activeButtonLoading" size="default" @click="openAll" type="success">
            一键启动
            <el-icon class="el-icon--left"><SwitchButton/></el-icon>
          </el-button>
        </el-col>
      </el-row>

    </div>
    <!-- 会话列表 -->
    <div class="conversation-list">
      <el-card
          :body-style="{ padding: '10px 10px 0', height: '80px' }"
          shadow="never"
          v-for="(card, index) in conversations"
          :key="card.card_id"
          :class="{ 'selected-card': card.active_status === 'true', 'loading-card': card.loading }"
          class="conversation-card"
          v-loading="card.loading ?? false"
          @click="!card.loading && selectCard(index, card)"
      >
        <!-- 状态和用户信息 -->
        <div class="status">
          <span class="status-label" :class="{ 'online-status': card.online_status==='true' }">{{ card.online_status === 'true' ? '在线' : '未登录' }}</span>
        </div>
        <div class="card-header">
          <!-- 根据 card.showBadge 控制徽标的显示 -->
          <el-badge
              style="margin-right: 10px"
              v-if="card.avatar_url && card.show_badge==='true'"
              is-dot
              type="danger"
          >
            <el-avatar :src="card.avatar_url" class="avatar" />
          </el-badge>

          <!-- 当 avatar_url 存在但不显示徽标时 -->
          <el-avatar
              v-else-if="card.avatar_url"
              :src="card.avatar_url"
              class="avatar"
              style="margin-right: 10px"
          />

          <!-- 当没有 avatar_url 时显示默认头像 -->
          <el-avatar v-else style="margin-right: 10px" class="avatar">
            <el-icon><User /></el-icon>
          </el-avatar>

          <h4 class="title">{{ card.card_name ?? props.title }}</h4>
        </div>
        <!-- 右上角的按钮 -->
        <div class="action-buttons">
          <el-icon v-if="card.online_status==='true' && props.title==='WhatsApp'" :size="20" @click.stop="importContacts(card)">
            <img style="height: 20px;width: 20px" :src="importSvg" class="platform-svg" draggable="false">
          </el-icon>
<!--          <el-icon v-if="card.online_status==='true'" :size="20" @click.stop="userPortrait(card)">-->
<!--            <img style="height: 20px;width: 20px" :src="userportrait" class="platform-svg" draggable="false">-->
<!--          </el-icon>-->
          <el-icon :size="20" @click.stop="handleSetting(card)">
            <Setting />
          </el-icon>
          <el-icon :size="20" @click.stop="handleRefresh(card)">
            <Refresh />
          </el-icon>
          <el-icon :size="20" @click.stop="handleClose(card)">
            <Delete />
          </el-icon>
<!--          <el-icon :size="20" @click.stop="executeCode(card)">-->
<!--            <Pointer />-->
<!--          </el-icon>-->
        </div>
      </el-card>
    </div>


    <!-- 导入联系人面板 -->
    <ContactImporter
        v-model:visible="importPanel"
        :card-data="importPanelData"
    />

    <!-- 用户画像面板 -->
    <UserPortrait
        v-model:visible="userPortraitPanel"
        :card-data="userPortraitPanelData"
    />
  </div>
</template>
<style scoped>
.drawer-footer {
  text-align: center;
}
.sidebar {
  width: 220px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.conversation-card.loading-card {
  opacity: 0.6;
  pointer-events: none;
  cursor: not-allowed;
}
::v-deep .el-drawer__header {
  margin-bottom: 0;
  padding: 0;
  color: #5c5c5c;
}

.header {
  margin-bottom: 10px;
}

.conversation-list {
  flex-grow: 1;
  overflow-y: auto;
  max-height: calc(100vh - 130px);
}

.conversation-card {
  margin-bottom: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  position: relative;
  cursor: pointer;
  user-select: none;
  display: flex;
  flex-direction: column;
  /* 移除之前添加的 padding-top */
}

.conversation-card:hover {
  border-color: #42b983;
}

.selected-card {
  border-color: #42b983;
  background-color: #e8f5e9;
}

/* 将状态和操作按钮绝对定位在卡片的同一水平线上 */
.status {
  position: absolute;
  top: 10px;
  left: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.status-label {
  background-color: #e0e0e0;
  color: #666;
  padding: 2px 5px;
  border-radius: 4px;
  /* 移除 margin-bottom，避免不必要的间距 */
}

.online-status {
  background-color: #00b66f;
  color: #fff;
}

.card-header {
  display: flex;
  align-items: center;
  margin-top: 30px; /* 为状态和操作按钮留出空间，避免重叠 */
}

.avatar {
  width: 40px;
  height: 40px;
}

.title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.action-buttons {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 5px;
}

.conversation-list::-webkit-scrollbar {
  width: 0;
}

.el-drawer__body::-webkit-scrollbar {
  width: 0;
}
</style>
