<template>
  <el-container style="height: 100%;">
    <!-- 左侧导航栏 -->
    <el-aside width="50px" class="aside-menu">
      <div class="aside-logo">
        <img src="@/assets/slide/slide-login.png"/>
      </div>
      <div class="nav-container">
        <div
            v-for="item in menuItems"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeMenu === item.id }"
            @click="handleMenuSelect(item.id)"
        >
          <el-badge :value="item.unreadCount" :hidden="item.unreadCount <= 0" type="danger" class="menu-badge">
            <el-tooltip
            v-if="!isPlacedTop"
             class="box-item"
             effect="dark"
             :content="item.name"
             placement="right-start"
            >
            <el-icon><img :src="item.icon" class="platform-svg" draggable="false"></el-icon>
            </el-tooltip>
            <el-icon v-else><img :src="item.icon" class="platform-svg" :title="item.name" draggable="false"></el-icon>
          </el-badge>
        </div>
      </div>
      <!-- 退出按钮 -->
      <div class="logout-button" @click="handleLogout">
        <el-tooltip
             class="box-item"
             effect="dark"
             content="退出"
             placement="right-start"
            >
        <el-icon><img src="@/assets/svgs/quit.svg" class="platform-svg" draggable="false"></el-icon>
        </el-tooltip>
      </div>
    </el-aside>

    <!-- 主体内容 -->
    <el-container>
      <el-main style="padding: 0; overflow: hidden">
        <router-view />
      </el-main>
    </el-container>

    <!-- 退出登录确认弹窗 -->
    <el-dialog
        v-model="logoutDialogVisible"
        title="退出登录"
        width="400px"
        :show-close="true"
        class="custom-logout-dialog"
        align-center
    >
      <div class="dialog-content">
        <p class="sessions-info">当前 {{ runningSessionsCount }} 个会话正在运行</p>
        <p class="confirm-text">确认退出当前用户？</p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelLogout" class="cancel-btn">取消</el-button>
          <el-button type="primary" @click="confirmLogout" class="confirm-btn">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
// 导入图标文件
import homeIcon from '@/assets/svgs/index.svg';
import whatsappIcon from '@/assets/svgs/whatsapp.svg';
import facebookIcon from '@/assets/svgs/facebook.svg';
import zaloIcon from '@/assets/svgs/zalo.svg';
import telegramIcon from '@/assets/svgs/telegram.svg';
import telegramKIcon from '@/assets/svgs/telegramK.svg';
import { ipc } from '@/utils/ipcRenderer';
import {del} from "@/utils/request";
import { ElMessageBox } from 'element-plus';

const router = useRouter();
const route = useRoute();

// 定义通信频道，即路由
const ipcApiRoute = {
  hideWindow: 'controller.window.hideWindow',
  logout: 'controller.window.logout',
  changeSidebarWidth: 'controller.window.changeSidebarWidth',
  changeSidebarLayout: 'controller.window.changeSidebarLayout',
  getSidebarState: 'controller.window.getSidebarState',
};

// 菜单项配置
const menuItems = ref([
  { id: 'home',name:'Home', icon: homeIcon, path: '/home', unreadCount: 0 },
  { id: 'whatsApp', name:'WhatsApp', icon: whatsappIcon, path: '/home/whatsapp', unreadCount: 0 },
  { id:'faceBook', icon: facebookIcon, path: '/home/facebook', unreadCount:0},
  //  {id: 'zalo', icon:zaloIcon, path:'/home/zalo'},
]);

// 存储所有会话的未读数映射 { cardId: { platform, count } }
const sessionCounts = ref({});
const isPlacedTop = ref(false)
// 计算并更新各平台的总未读数
const updatePlatformUnreadCounts = () => {
  // 先重置所有菜单项的未读数
  menuItems.value.forEach(item => {
    item.unreadCount = 0;
  });

  // 累加计算
  Object.values(sessionCounts.value).forEach(info => {
    const platformId = info.platform === 'WhatsApp' ? 'whatsApp' : info.platform;
    const item = menuItems.value.find(m => m.id === platformId);
    if (item) {
      item.unreadCount += (info.count || 0);
    }
  });
};

const activeMenu = ref('home');
const logoutDialogVisible = ref(false);
const runningSessionsCount = ref(0);

// 根据当前路由更新激活菜单
const updateActiveMenu = () => {
  const path = route.path;
  if (path === '/home' || path === '/home/') activeMenu.value = 'home';
  else if (path.includes('whatsapp')) activeMenu.value = 'whatsApp';
  else if (path.includes('facebook')) activeMenu.value = 'faceBook';
  else if(path.includes('zalo')) activeMenu.value = 'zalo';
  else if (path.includes('telegramK')) activeMenu.value = 'telegramK';
  else if (path.includes('telegram')) activeMenu.value = 'telegram';
  else activeMenu.value = '';
};

// 监听路由变化
watch(() => route.path, () => {
  updateActiveMenu();
});

onMounted(async () => {
  updateActiveMenu();

  // 初始化所有平台的未读数
  const platforms = ['WhatsApp']; // 后续如有 Zalo/Telegram 可添加
  for (const p of platforms) {
    const res = await ipc.invoke('controller.window.getSessions', { platform: p });
    if (res && res.data) {
      res.data.forEach(card => {
        sessionCounts.value[card.card_id] = {
          platform: p,
          count: card.unread_count || 0
        };
      });
    }
  }
  // updatePlatformUnreadCounts();

  // 监听在线状态和未读数变化通知
  ipc.on('online-notify', (event, args) => {
    const { cardId, unreadCount, platform, onlineStatus } = args;
    // 动态记录或更新，确保新添加的会话也能被汇总
    // onlineStatus 可能是布尔值或字符串 'true'/'false'
    const isOnline = onlineStatus === true || onlineStatus === 'true';
    
    sessionCounts.value[cardId] = {
      platform: platform || 'WhatsApp',
      count: isOnline ? (Number(unreadCount) || 0) : 0
    };
    // updatePlatformUnreadCounts();
  });

  // 监听新消息通知（兜底）
  ipc.on('new-message-notify', (event, data) => {
     // 新消息产生时，通常 online-notify 会在 5s 内跟进，或者手动触发一次拉取
  });
   // 获取侧边栏初始状态
  ipc.invoke(ipcApiRoute.getSidebarState).then(res => {
    console.log('获取侧边栏状态', res);
    if (res) {
      isPlacedTop.value = res.isPlacedTop;
    }
  });

  // 监听侧边栏状态全局变更通知
  ipc.on('sidebar-state-change', (event, state) => {
    console.log('收到侧边栏状态变更:', state);
    if (state) {
      isPlacedTop.value = state.isPlacedTop;
    }
  });
  
});

onUnmounted(() => {
  ipc.removeAllListeners('online-notify');
  ipc.removeAllListeners('sidebar-state-change');
});

// 处理菜单点击
function handleMenuSelect(id) {
  if (activeMenu.value === id) return;
  ipc.invoke(ipcApiRoute.hideWindow, { platform: id });
  ipc.invoke(ipcApiRoute.changeSidebarWidth, { isShrunk: false });
  const item = menuItems.value.find(item => item.id === id);
  if (item) {
    router.push(item.path);
  }
  
}

// 处理退出按钮点击
async function handleLogout() {
  // 立即重置未读计数，避免弹窗期间红点残留
  menuItems.value.forEach(item => {
    item.unreadCount = 0;
  });
  sessionCounts.value = {};
  
  // 1. 隐藏所有活跃视图，防止遮挡弹窗
  await ipc.invoke(ipcApiRoute.hideWindow, {});
  
  // 2. 获取正在运行的会话数量
  runningSessionsCount.value = await ipc.invoke('controller.window.getRunningSessionsCount', {});
  
  // 3. 显示自定义确认弹窗
  logoutDialogVisible.value = true;
}

// 取消退出
async function cancelLogout() {
  logoutDialogVisible.value = false;
  // 恢复活跃视图显示
  await ipc.invoke('controller.window.restoreActiveViews', {});
}

// 确认退出
async function confirmLogout() {
  logoutDialogVisible.value = false;
  
  // 重置未读计数
  menuItems.value.forEach(item => {
    item.unreadCount = 0;
  });
  sessionCounts.value = {};
  
  del('/app/account/logout').then(res => {
    if (res.code === 200) {
      ipc.invoke(ipcApiRoute.logout, {}).then(() => {
        localStorage.removeItem('box-token');
        localStorage.removeItem('userInfo');
        router.push('/login');
      })
    }
  }).catch(error => {
    console.error('退出失败:', error);
    // 即使失败也尝试恢复视图，或者让用户手动处理
    ipc.invoke('controller.window.restoreActiveViews', {});
  })
}
</script>

<style scoped>
.aside-menu {
  position: relative; /* 为了定位底部按钮 */
  border-right: 1px solid #e0e0e0; /* 添加右侧边框 */
 background: linear-gradient(180deg, #DFEDF8 0%, #D8EFFD 31.25%, #F4F8FB 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden; /* 不影响底部按钮 */
}
.aside-logo { 
  width: 38px;
  height: 38px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  img { 
    width: 100%;
    height: 100%;
  }
}
.nav-container {
  width: 100%;
  overflow-y: auto; /* 当菜单项过多时启用滚动 */
  flex-grow: 1;
}

.nav-item {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
  position: relative;
}

.nav-item:hover {
  background-color: #f0f0f0; /* 悬停背景 */
}

.nav-item.active {
  background-color: rgba(255, 255, 255, 0.5);
; /* 激活状态背景 */
  color: white; /* 激活状态图标颜色 */
  border-right: 3px solid #52c41a;

}

.logout-button {
  position: absolute; /* 固定在容器底部 */
  bottom: 1px; /* 离底部的距离 */
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px 0;
  cursor: pointer;
  color: #000000; /* 退出按钮颜色 */
  transition: background-color 0.3s, color 0.3s;
  border-top: 1px solid #e0e0e0; /* 添加右侧边框 */
}

.logout-button:hover {
  background-color: #dddddd; /* 悬停背景 */
}
.nav-item.active  .platform-svg {
   transform: scale(1.1);
}
.platform-svg {
  height: 30px;
  width: 30px;
}

:deep(.menu-badge .el-badge__content) {
  top: 5px;
  right: auto;
  left: 5px;
  transform: translateY(-50%) translateX(-50%);
  border: none;
}

/* 自定义滚动条样式 */
.nav-container::-webkit-scrollbar {
  width: 0; /* 滚动条的宽度 */
}

.nav-container::-webkit-scrollbar-thumb {
  background-color: #bbbbbb; /* 滚动条滑块的颜色 */
  border-radius: 0; /* 滑块的圆角 */
}

/* 自定义退出弹窗样式 */
:deep(.custom-logout-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.custom-logout-dialog .el-dialog__header) {
  margin: 0;
  padding: 20px 24px 10px;
}

:deep(.custom-logout-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

:deep(.custom-logout-dialog .el-dialog__body) {
  padding: 10px 24px 30px;
}

.dialog-content {
  color: #666;
  line-height: 1.6;
}

.sessions-info {
  margin: 0;
  font-size: 15px;
}

.confirm-text {
  margin: 5px 0 0;
  font-size: 15px;
}

:deep(.custom-logout-dialog .el-dialog__footer) {
  padding: 0 24px 24px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  border-radius: 8px;
  padding: 10px 20px;
  height: 40px;
  font-size: 15px;
}

.confirm-btn {
  background-color: #26d366 !important; /* WhatsApp Green */
  border-color: #26d366 !important;
  border-radius: 8px;
  padding: 10px 20px;
  height: 40px;
  font-size: 15px;
  color: white;
}

.confirm-btn:hover {
  background-color: #20bd5a !important;
  border-color: #20bd5a !important;
}
</style>
