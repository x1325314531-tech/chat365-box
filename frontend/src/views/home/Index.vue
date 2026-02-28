<template>
  <el-container style="height: 100vh;">
    <!-- 左侧导航栏 -->
    <el-aside width="50px" class="aside-menu">
      <div class="nav-container">
        <div
            v-for="item in menuItems"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeMenu === item.id }"
            @click="handleMenuSelect(item.id)"
        >
          <el-icon><img :src="item.icon" class="platform-svg" draggable="false"></el-icon>
        </div>
      </div>

      <!-- 退出按钮 -->
      <div class="logout-button" @click="handleLogout">
        <el-icon><img src="@/assets/svgs/quit.svg" class="platform-svg" draggable="false"></el-icon>
      </div>
    </el-aside>

    <!-- 主体内容 -->
    <el-container>
      <el-main style="padding: 0; overflow: hidden">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
// 导入图标文件
import homeIcon from '@/assets/svgs/index.svg';
import whatsappIcon from '@/assets/svgs/whatsapp.svg';
import zaloIcon from '@/assets/svgs/zalo.svg';
import telegramIcon from '@/assets/svgs/telegram.svg';
import telegramKIcon from '@/assets/svgs/telegramK.svg';
import { ipc } from '@/utils/ipcRenderer';
import {del} from "@/utils/request";

const router = useRouter();
const route = useRoute();

// 定义通信频道，即路由
const ipcApiRoute = {
  hideWindow: 'controller.window.hideWindow',
  logout: 'controller.window.logout',
  changeSidebarWidth: 'controller.window.changeSidebarWidth',
  changeSidebarLayout: 'controller.window.changeSidebarLayout',
};

// 菜单项配置
const menuItems = [
  { id: 'home', icon: homeIcon, path: '/home' },
  { id: 'whatsApp', icon: whatsappIcon, path: '/home/whatsapp' },
  // {id: 'zalo', icon:zaloIcon, path:'/home/zalo'},
  // { id: 'telegram', icon: telegramIcon, path: '/home/telegram' },
  // { id: 'telegramK', icon: telegramKIcon, path: '/home/telegramK' },
];

const activeMenu = ref('home');

// 根据当前路由更新激活菜单
const updateActiveMenu = () => {
  const path = route.path;
  if (path === '/home' || path === '/home/') activeMenu.value = 'home';
  else if (path.includes('whatsapp')) activeMenu.value = 'whatsApp';
  else if(path.includes('zalo')) activeMenu.value = 'zalo';
  else if (path.includes('telegramK')) activeMenu.value = 'telegramK';
  else if (path.includes('telegram')) activeMenu.value = 'telegram';
  else activeMenu.value = '';
};

// 监听路由变化
watch(() => route.path, () => {
  updateActiveMenu();
});

onMounted(() => {
  updateActiveMenu();
  ipc.invoke(ipcApiRoute.changeSidebarLayout, { isPlacedTop: false });
});

// 处理菜单点击
function handleMenuSelect(id) {
  if (activeMenu.value === id) return;
  ipc.invoke(ipcApiRoute.hideWindow, { platform: id });
  ipc.invoke(ipcApiRoute.changeSidebarWidth, { isShrunk: false });
  ipc.invoke(ipcApiRoute.changeSidebarLayout, { isPlacedTop: false });
  const item = menuItems.find(item => item.id === id);
  if (item) {
    router.push(item.path);
  }
  
}

// 处理退出按钮点击
function handleLogout() {
  del('/app/account/logout').then(res=>{ 
    if(res.code===200) { 
    ipc.invoke(ipcApiRoute.logout,{}).then(()=>{
    localStorage.removeItem('box-token');
    localStorage.removeItem('userInfo');
    router.push('/login');
    })
    }
  }).catch(error=>{ 
     console.error('退出失败:', error);
  })
}
</script>

<style scoped>
.aside-menu {
  position: relative; /* 为了定位底部按钮 */
  border-right: 1px solid #e0e0e0; /* 添加右侧边框 */
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden; /* 不影响底部按钮 */
}
.nav-container {
  width: 100%;
  overflow-y: auto; /* 当菜单项过多时启用滚动 */
  flex-grow: 1;
}

.nav-item {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
}

.nav-item:hover {
  background-color: #f0f0f0; /* 悬停背景 */
}

.nav-item.active {
  background-color: #cccccc; /* 激活状态背景 */
  color: white; /* 激活状态图标颜色 */
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

.platform-svg {
  height: 30px;
  width: 30px;
}

/* 自定义滚动条样式 */
.nav-container::-webkit-scrollbar {
  width: 0; /* 滚动条的宽度 */
}

.nav-container::-webkit-scrollbar-thumb {
  background-color: #bbbbbb; /* 滚动条滑块的颜色 */
  border-radius: 0; /* 滑块的圆角 */
}
</style>
