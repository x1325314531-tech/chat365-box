<script setup>
import {onMounted, onUnmounted, reactive, ref, watch, nextTick} from 'vue';
import { useI18n } from 'vue-i18n';
import { debounce } from 'lodash';
import { useRoute, useRouter } from 'vue-router';
import { Refresh, Close,Delete,Setting ,Plus,User, Edit, SwitchButton,Select, VideoPlay, Moon} from '@element-plus/icons-vue';
import importSvg from '@/assets/svgs/import.svg';
import userportrait from '@/assets/svgs/userportrait.svg';
import whatsappDefaultIcon from '@/assets/svgs/whatsapp.svg';
import facebookDefaultIcon from '@/assets/svgs/facebook.svg'
import defaultAvatar from '@/assets/svgs/defaultAvatar.svg'
import refreshIcon from '@/assets/slide/refresh.png'
import settingIcon from '@/assets/slide/setting.png'
import deleteIcon from '@/assets/slide/delete.png'
import { nanoid } from 'nanoid'; // 用于生成唯一 ID
import { ipc } from '@/utils/ipcRenderer';
import ContactImporter from '../components/ContactImporter.vue';
import UserPortrait from '../components/UserPortrait.vue';
import {post,get, del} from "@/utils/request";
import Notification from "@/utils/notification";
const addLoading = ref(false)
const { t } = useI18n()
const route = useRoute();
const router = useRouter();
const activeButtonLoading = ref(false)
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
const accountId = userInfo.accountId;
const jsCode = ref('')
const executeCode = (card)=>{
  const args = {cardId:card.cardId,code:jsCode.value};
  ipc.invoke(ipcApiRoute.executeJavaScript, args).then(res => {
    console.log(res)
  })
}
const emits = defineEmits(['open-settings', 'refresh', 'layout-change']);
const importPanel = ref(false)
const userPortraitPanel = ref(false)
const userPortraitPanelData = ref({})
const importPanelData = ref({})
const openSidebar = ref(false)
const conversationListRef = ref(null)
const isPlacedTop = ref(false)

// 顶部横排卡片右键菜单
function onCardContextMenu(e, card) {
  e.preventDefault()
  e.stopPropagation()
   if (card.active_status === 'false') {
     return
   }
  const menuItems = [
    { 
      label: '刷新', 
      action: 'refresh', 
      icon: !isPlacedTop.value ? refreshIcon : refreshIcon
    },
    { 
      label: '设置', 
      action: 'setting', 
      icon: !isPlacedTop.value ? settingIcon: settingIcon
    },
    { type: 'separator' },
    { 
      label: '删除', 
      action: 'delete', 
      icon: !isPlacedTop.value ? deleteIcon :deleteIcon
    },
  ];

  ipc.invoke(ipcApiRoute.showContextMenu, { items: menuItems }).then(res => {
    if (res && res.status && res.action) {
      switch (res.action) {
        case 'refresh':
          handleRefresh(card);
          break;
        case 'setting':
          handleSetting(card);
          break;
        case 'delete':
          handleClose(card);
          break;
      }
    }
  });
}
// 点击其他位置关闭右键菜单
function onDocumentClick() {
  // 原有的 hideWindow 逻辑已移除，原生菜单会自动处理点击外部关闭
}

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
  showContextMenu: 'controller.window.showContextMenu',
  changeSidebarWidth: 'controller.window.changeSidebarWidth',
  changeSidebarLayout: 'controller.window.changeSidebarLayout',
  getSidebarState: 'controller.window.getSidebarState',
};


onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('contextmenu', onDocumentClick)
  // 获取侧边栏初始状态
  ipc.invoke(ipcApiRoute.getSidebarState).then(res => {
    if (res) {
      openSidebar.value = res.isShrunk;
      isPlacedTop.value = res.isPlacedTop;
      // 初始加载时也要通知父组件同步布局状态
      emits('layout-change', res.isPlacedTop);
    }
  });

  // 监听侧边栏状态全局变更通知
  ipc.on('sidebar-state-change', (event, state) => {
    console.log('AsideCard 收到侧边栏状态变更:', state);
    if (state) {
      isPlacedTop.value = state.isPlacedTop;
      openSidebar.value = state.isShrunk;
    }
  });
  // 页面加载时获取所有会话
  await getAllSessions();
  // 延时加载一次后端数据同步（非阻塞，不影响本地展示）
  setTimeout(syncSessionIdsFromBackend, 2000);

  // 移除可能存在的旧监听器，避免重复添加
  ipc.removeAllListeners('online-notify');
  ipc.removeAllListeners('new-message-notify');
  
  // 使用防抖处理高频事件，避免接口风暴
  const debouncedRefresh = debounce(() => {
    console.log('🔄 [AsideCard] 执行防抖后的会话刷新');
    getAllSessions();
  }, 500);

  // 监听进程消息
  ipc.on('online-notify', (event, args) => {
    const { onlineStatus, cardId, avatarUrl } = args;
    console.log('登录通知：', args);
    debouncedRefresh();
  });

  ipc.on('new-message-notify', (event, data) => {
    debouncedRefresh();
  });
  
  // 处理翻译设置返回后的刷新逻辑
  if (route.query.refresh === 'true') {
    // 等待会话数据加载完毕再执行
    nextTick(() => {
      const activeCard = conversations.find(card => card.active_status === 'true');
      if (activeCard) {
        handleRefresh(activeCard);
      }
      // 刷新后清除 query 参数，避免反复触发
      router.replace({ path: route.path, query: { ...route.query, refresh: undefined } });
    });
  }
});

// 在组件卸载时，移除 'online-notify' 监听器，防止内存泄漏
onUnmounted(() => {
  ipc.removeAllListeners('online-notify');
  ipc.removeAllListeners('sidebar-state-change');
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('contextmenu', onDocumentClick)
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

// 监听内部面板状态变化，管理窗口显示/隐藏
watch([importPanel, userPortraitPanel], ([newImport, newUserPortrait]) => {
  if (newImport || newUserPortrait) {
    ipc.invoke(ipcApiRoute.hideWindow);
  } else {
    // 关闭面板时，恢复当前选中会话的显示
    setActiveStatus();
  }
});
// 获取所有会话数据 (本地库同步)
async function getAllSessions() {
  try {
    const res = await ipc.invoke(ipcApiRoute.getSessions, { platform: props.title, accountId: accountId });
    if (res && res.data) {
      console.log('获取本地会话列表成功:', res, res.data.length);
      const sessionList = res.data.map(item => {
        let activeStatus = 'false';
        if (item.activeStatus === 1 || item.active_status === 'true' || item.active_status === true) {
          activeStatus = 'true';
        }
        
        return {
          ...item,
          cardId: item.card_id || item.cardId,
          card_id: item.card_id || item.cardId,
          sessionId: item.session_id || item.sessionId,
          active_status: activeStatus,
          online_status: String(item.online_status || item.onlineStatus || 'false') === 'true' || String(item.online_status || item.onlineStatus) === '1' ? 'true' : 'false',
          show_badge: String(item.show_badge || 'false'),
          unread_count: item.unread_count || 0
        };
      });
      
      conversations.splice(0, conversations.length, ...sessionList);
      setActiveStatus();
    }
  } catch (error) {
    console.error('获取所有会话出错:', error);
  }
}

// 异步从后端同步 sessionId 等扩展字段 (低频调用)
async function syncSessionIdsFromBackend() {
  console.log('🚀 [AsideCard] 开始从后端同步会话完整数据...');
  get('/app/session/list', {
    params: {
      pageSize: 1000,
      page: 1,
    }
  }).then(res => {
    if (res && res.data) {
      console.log('✅ 从后端同步会话成功:', res.data.length);
      res.data.forEach(backendCard => {
        const localCard = conversations.find(c => c.card_id === backendCard.cardId);
        if (localCard) {
          localCard.sessionId = backendCard.id || backendCard.sessionId;
        }
      });
    }
  }).catch(err => {
    console.error('❌ 从后端获取会话列表失败:', err);
  });
}
//根据平台获取默认头像
const getplatformDefaultIcon =( platform) => { 
  const map = {  
    'WhatsApp': whatsappDefaultIcon,
    'FaceBook':facebookDefaultIcon
  }
  return map[platform] || 'WhatsApp'
}
// 设置选中的卡片索引
function setActiveStatus() {
  const activeCardIndex = conversations.findIndex((card) => card.active_status==='true');
  selectedCardIndex.value = activeCardIndex !== -1 ? activeCardIndex : null;
  const activeCard = conversations.find((card) => card.active_status==='true');
  console.log('activeCard', activeCard);
  
  if (activeCard) {
    ipc.invoke(ipcApiRoute.selectSession, {cardId:activeCard.card_id, platform:props.title, accountId: accountId}).then(res => {
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
   console.log('wwww', card);
   
    try {
      // 调用 initSession 初始化会话
      const res = await ipc.invoke(ipcApiRoute.initSession, { platform: props.title, cardId: card.card_id, accountId: accountId });

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
    ipc.invoke(ipcApiRoute.selectSession, { cardId: card.card_id, platform: props.title, accountId: accountId })
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

const selectAndRefreshCard = async (cardId) => {
  const index = conversations.findIndex(c => c.card_id === cardId || c.cardId === cardId);
  if (index !== -1) {
    const card = conversations[index];
    await selectCard(index, card);
    handleRefresh(card);
  }
};

defineExpose({
  getAllSessions,
  setActiveStatus,
  hideWindow: () => ipc.invoke(ipcApiRoute.hideWindow),
  selectAndRefreshCard
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
  const args = { cardId: card.cardId, platform: props.title, accountId: accountId };
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
// 处理打开/关闭侧边栏
const handleShrink=() => {
  openSidebar.value= !openSidebar.value
  ipc.invoke(ipcApiRoute.changeSidebarWidth, { isShrunk: openSidebar.value });
}
// 处理关闭按钮点击
function handleClose(card) {
  Notification.confirm({
    message: t('aside.deleteConfirm'),
    title: t('aside.deleteSession'),
    type: 'warning'
  }).then(() => {
    card.loading = true;
    ipc.invoke(ipcApiRoute.deleteSession, { platform: props.title, cardId: card.cardId, accountId: accountId }).then((res) => {
      if (res.status) {
        card.loading = false;
      }
      del(`/app/session/${card.sessionId}`).then(res=> { 
        if(res.code==200) { 
             Notification.message({ message: t('aside.deleteSuccess'), type: 'success' });
              setActiveStatus(); 
              getAllSessions()
        }
      })
    });
  });
}
// 会话置于顶部
function sessionPlacedTop() {
  const activeIndex = conversations.findIndex(c => c.active_status === 'true');
  if (activeIndex !== -1) {
    const activeCard = conversations[activeIndex];
    // 从当前位置移除
    conversations.splice(activeIndex, 1);
    // 插入到最前面
    conversations.unshift(activeCard);
    // 更新选中索引
    selectedCardIndex.value = 0;
    
    // 滚动容器到顶部
    nextTick(() => {
      if (conversationListRef.value) {
        conversationListRef.value.scrollTop = 0;
      }
    });
  }
  isPlacedTop.value = true;
  ipc.invoke(ipcApiRoute.changeSidebarLayout, { isPlacedTop: true });
  emits('layout-change', true);
}

// 置于左侧
function placedLeft() {
  isPlacedTop.value = false;
  ipc.invoke(ipcApiRoute.changeSidebarLayout, { isPlacedTop: false });
  emits('layout-change', false);
}
</script>
<template>
  <div v-if="!isPlacedTop" class="sidebar" :class="{'sidebar-shrink': openSidebar}">
    <!-- 顶部标题和按钮 -->
    <div class="header">
      <div class="header-shrink">
         <span v-if="!openSidebar" class="header-title-text">{{ title }}</span>
         <span v-else class="header-title-text" style="font-size: 14px; color: #00b66f; margin-left: 5px;">Wha...</span>
        <span class="shrink" @click="handleShrink" :class="{'is-active': openSidebar}">
            <i class="iconfont icon-shrink"></i>
        </span>
      </div>
      
      <div class="header-actions" :class="{'is-shrunk': openSidebar}">
          <el-button :loading="addLoading" size="default" @click="addConversation" type="success" class="header-btn btn-new" :title="openSidebar ? t('aside.newSession') : ''">
            <el-icon><Plus /></el-icon>
            <span v-if="!openSidebar">{{ t('aside.newSession') || '新建' }}</span>
            <span v-else>新建</span>
          </el-button>
          
          <el-button :loading="activeButtonLoading" size="default" @click="openAll" type="primary" class="header-btn btn-start" :title="openSidebar ? t('aside.startAll') : ''">
            <el-icon><SwitchButton/></el-icon>
            <span v-if="!openSidebar">{{ t('aside.startAll') || '启动' }}</span>
            <span v-else>启动</span>
          </el-button>
      </div>
    </div>
    
    <!-- 会话列表 -->
    <div class="conversation-list" ref="conversationListRef">
      <div
          v-for="(card, index) in conversations"
          :key="card.card_id"
          :class="{ 'selected-card': card.active_status === 'true', 'loading-card': card.loading, 'is-shrunk': openSidebar }"
          class="conversation-card"
          v-loading="card.loading ?? false"
          @click="!card.loading && selectCard(index, card)"
          @contextmenu="onCardContextMenu($event, card)"
      >
        <div class="card-avatar-area">
          <el-badge
              v-if="card.unread_count > 0 || card.show_badge === 'true'"
              :value="card.unread_count > 0 ? card.unread_count : ''"
              :is-dot="card.unread_count <= 0 && card.show_badge === 'true'"
              type="danger"
          >
            <div class="avatar-wrapper">
              <el-avatar v-if="card.avatar_url" :src="card.avatar_url" class="avatar" />
              <el-avatar v-else class="avatar">
                 <img class="avatar-img" :src="card.online_status === 'true' ? getplatformDefaultIcon(props.title) : defaultAvatar" />
              </el-avatar>
              <span class="online-status" :class="{'online-status-online': card.online_status==='true'}"></span>
            </div>
          </el-badge>
          <!-- 当没有未读提醒时 -->
          <template v-else>
            <div class="avatar-wrapper">
              <el-avatar v-if="card.avatar_url" :src="card.avatar_url" class="avatar" />
              <el-avatar v-else class="avatar">
                <img class="avatar-img" :src="card.online_status === 'true' ? getplatformDefaultIcon(props.title) : defaultAvatar" />
              </el-avatar>
              <span class="online-status" :class="{'online-status-online': card.online_status==='true'}"></span>
            </div>
          </template>
          <!-- 折叠下的名字 -->
          <div v-if="openSidebar" class="shrunk-label">
            {{ card.card_name || 'Master' }}
          </div>
        </div>
        
        <div class="card-content-area" v-if="!openSidebar">
           <div class="card-title-row">
             <span class="title">{{ card.card_name || card.card_name === '' ? card.card_name : props.title }}</span>
             <div @mousedown.stop.prevent="onCardContextMenu($event, card)" class="more-options">
               <span class="more-dots">
                 <span class="dot"></span>
                 <span class="dot"></span>
                 <span class="dot"></span>
               </span>
               <!---->
              </div>
           </div>
           
           <div class="subtitle-phone" v-if="card.my_phone">{{ card.my_phone}}</div>
           <div class="subtitle-desc" v-if="card.my_phone">{{ props.title }}</div>
        </div>
      </div>
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
    
    <div class="footer" :class="{'footer-shrink': openSidebar }">
      <div @click="sessionPlacedTop" class="place-top-btn" :class="{'shrunk-btn': openSidebar}">
         <i class="iconfont icon-top-bar" :class="{'shrunk-icon': openSidebar}"></i>
         <span v-if="!openSidebar">会话置于顶部</span>
      </div>
    </div>
  </div>

  <div v-else class="sidebar-top">
    <!-- Main large actions -->
    <div class="top-main-actions">
      <el-button :loading="addLoading" size="default" @click="addConversation" type="success" class="top-main-btn btn-new">
        <el-icon><Plus /></el-icon> <span>新建会话</span>
      </el-button>
      <el-button :loading="activeButtonLoading" size="default" @click="openAll" type="primary" class="top-main-btn btn-start">
        <el-icon><SwitchButton/></el-icon> <span>一键启动</span>
      </el-button>
    </div>

    <div class="conversation-list-horizontal" ref="conversationListRef">
      <div 
        v-for="(card, index) in conversations" 
        :key="card.card_id"
        class="horizontal-card"
        :class="{ 'selected-card': card.active_status === 'true' }"
        @click="!card.loading && selectCard(index, card)"
        @contextmenu="onCardContextMenu($event, card)"
      >
        <el-badge
          v-if="card.unread_count > 0 || card.show_badge === 'true'"
          :value="card.unread_count > 0 ? card.unread_count : ''"
          :is-dot="card.unread_count <= 0 && card.show_badge === 'true'"
          type="danger"
        >
          <div class="avatar-wrapper-horiz">
            <el-avatar v-if="card.avatar_url" :size="36" class="avatar-row" :src="card.avatar_url" />
            <el-avatar v-else  class="avatar-row" :size="36">
               <img class="avatar-img" :src="card.online_status === 'true' ? getplatformDefaultIcon(props.title) : defaultAvatar" />
            </el-avatar>
            <span class="online-status" :class="{'online-status-online': card.online_status==='true'}"></span>
          </div>
        </el-badge>
        <!-- 当没有未读提醒时 -->
        <template v-else>
          <div class="avatar-wrapper-horiz">
            <el-avatar v-if="card.avatar_url" class="avatar-row" :size="36" :src="card.avatar_url" />
            <el-avatar v-else class="avatar-row" :size="36">
              <img class="avatar-img " :src="card.online_status === 'true' ? getplatformDefaultIcon(props.title) : defaultAvatar" />
            </el-avatar>
            <span class="online-status" :class="{'online-status-online': card.online_status === 'true'}"></span>
          </div>
        </template>
             <!-- 折叠下的名字 -->
          <div class="shrunk-label">
            {{ card.card_name || 'Master' }}
          </div>
      </div>
    </div>


      <!-- rightactions stacked -->
    <div class="top-stacked-actions">
      <div class="top-outline-btn" @click="placedLeft">
         <i class="iconfont icon-sidebar" style="margin-right:2px; font-size: 14px;"></i> 置于左侧
      </div>
      <div class="top-outline-btn" @click="openAll">
         <i class="iconfont icon-expand" style="margin-right:2px; font-size: 14px;"></i> 展开全部
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 侧边栏全局与基础结构 */
.sidebar {
  width: 265px;
  padding: 15px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease;
  position: relative;
  height: 100%;
  background-color: #ebf3f9; /* 淡蓝色背景 */
  box-sizing: border-box;
}
.sidebar-shrink { 
  width: 100px;
  padding: 15px 10px;
}

/* 顶部 Header */
.header {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}
.header-shrink { 
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 4px;
}
.header-title-text {
  font-size: 16px;
  color: #00b66f;
  font-weight: 500;
}
.shrink { 
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #6a7178;
}
.shrink .iconfont {
  transition: transform 0.3s ease;
  font-size: 18px;
}
.shrink.is-active .iconfont {
  transform: rotate(180deg);
}

/* 按钮组区块 */
.header-actions {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 10px;
}
.header-actions.is-shrunk {
  flex-direction: column !important;
  align-items: center !important;
  gap: 12px;
}

.header-btn {
  flex: 1;
  border-radius: 6px;
  font-size: 14px;
  height: 38px;
  border: none;
}
.btn-new {
  background-color: #25d366 !important;
  color: white;
  padding: 12px !important;

}
.btn-new:hover {
  background-color: #20b858 !important;
}
.btn-start {
  background-color: #2b91ff !important;
  color: white;
  padding: 12px !important;
  margin-left: 0 !important;
}
.btn-start:hover {
  background-color: #227be0 !important;
}
.header-actions.is-shrunk .header-btn {
  width: 100% !important;
  margin-left: 0 !important;
  margin-top: 0 !important;
  padding: 0;
  display: flex;
  justify-content: center;
}

/* 消息列表容器 */
.conversation-list {
  flex-grow: 1;
  overflow-y: auto;
  max-height: calc(100vh - 180px);
  padding: 4px;
  border-radius: 6px;
}
.conversation-list::-webkit-scrollbar {
  width: 4px;
}
.conversation-list::-webkit-scrollbar-thumb {
  background-color: #d1d9e2;
  border-radius: 4px;
}

/* 卡片样式 */
.conversation-card {
  margin-bottom: 8px;
    border: 1px solid transparent;
  position: relative;
  cursor: pointer;
  user-select: none;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 12px;
  transition: all 0.2s ease;
  background-color: transparent;

  border-bottom: 1px solid #D3D9DF;
}
.conversation-card:hover {
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 12px;
}
.conversation-card.selected-card {
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid transparent;
   border-radius: 12px;

}
.conversation-card.is-shrunk {
  flex-direction: column;
  align-items: center;
  padding: 12px 6px;
}
.loading-card {
  opacity: 0.6;
  pointer-events: none;
  cursor: not-allowed;
}

/* 卡片内部结构 */
.card-avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.card-content-area {
  margin-left: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0; 
  align-items: baseline;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  position: relative;
 background-color: transparent;
}
.avatar-img { 
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-wrapper {
  position: relative;
  display: inline-block;
  line-height: normal;
}
.online-status {
  position: absolute;
  bottom: 0px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #c0c4cc;
  border: 2px solid #fff;
  transition: background-color 0.3s ease;
}
.online-status-online {
  background-color: #25d366;
}

.shrunk-label {
  margin-top: 8px;
  font-size: 12px;
  color: #1a1b1d;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.selected-card .shrunk-label {
  color: #337bf6;
}

/* 右侧文本区域 */
.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 2px;
}
.title {
  font-size: 15px;
  font-weight: 500;
  color: #26A3FF;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* flex: 1; */
}

/* ...更多操作按钮 */
.more-options {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: 4px;
}

.more-options:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

.more-options:active {
  background-color: rgba(0, 0, 0, 0.1);
  transform: scale(0.92);
}

.more-dots {
  display: flex;
  gap: 2px;
  align-items: center;
  justify-content: center;
  color: #b0c0ce;
  pointer-events: none;
}
.dot {
  width: 4px;
  height: 4px;
  background-color: #b0c0ce;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}
.more-options:hover .dot {
  background-color: #6a7178;
}

.subtitle-phone {
  font-size: 13px;
  color: #afb1b4;
  margin-bottom: 2px;
}
.subtitle-desc {
  font-size: 12px;
  color: #6a7178;
}

/* 底部功能区 */
.footer { 
  position: absolute;
  bottom: 0px;
  left: 0;
  width: 100%;
  padding: 15px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
}
.place-top-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #16c063;
  border-radius: 6px;
  cursor: pointer;
  padding: 8px 16px;
  font-size: 14px;
  color: #16c063;
  width: 80%;
  background-color: transparent;
  transition: all 0.2s;
}
.place-top-btn:hover {
  background-color: rgba(22, 192, 99, 0.05);
}
.place-top-btn.shrunk-btn {
  width: 46px;
  padding: 8px 0;
  justify-content: center;
  gap: 0;
}

/* --- 顶部横排形态 (isPlacedTop) --- */
.sidebar-top {
  width: 100%;
  height: 85px;
  background-color: #ebf3f9;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-sizing: border-box;
  position: relative;
  z-index: 100;
}

/* 左侧两个叠加方块按钮 */
.top-stacked-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-right: 0;
}
.top-outline-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  background: #fff;
  width: 76px;
}
.top-outline-btn:hover {
  background: #f9f9f9;
}

/* 横排的大按钮 */
.top-main-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: 20px;
  flex-direction: column;
}
.top-main-btn {
  border-radius: 6px;
  height: 38px;
  min-width: 90px;
}

/* 横排头像列表 */
.conversation-list-horizontal {
  flex: 1;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  align-items: center;
  height: 100%;
}
.conversation-list-horizontal::-webkit-scrollbar {
  height: 4px;
}
.conversation-list-horizontal::-webkit-scrollbar-thumb {
  background-color: #eaeaea;
}

.horizontal-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.2s;
}
.horizontal-card.selected-card {
  /* border-color: #25d366; */
    background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid transparent;
   border-radius: 12px;
}
.avatar-wrapper-horiz {
  position: relative;
}
.avatar-row { 
  background-color: transparent !important;
}
:deep(.card-avatar-area .el-badge__content),
:deep(.horizontal-card .el-badge__content) {
  top: 5px;
  right: auto;
  left: 5px;
  transform: translateY(-50%) translateX(-50%);
  border: none;
}

</style>


