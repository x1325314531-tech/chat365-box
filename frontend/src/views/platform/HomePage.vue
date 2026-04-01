<template>
  <div class="home-page-container">
    <!-- 顶部导航栏 -->
    <div class="top-nav">
      <div class="nav-left">
        <div class="nav-item">
          <el-icon><AlarmClock /></el-icon>
          <span class="nav-text">{{ currentTime }}</span>
        </div>
        <div class="nav-item btn-item" @click="handleClearCache">
          <i class="iconfont icon-qingchu"></i>
          <span class="nav-text">{{ $t('home.clearCache') }}</span>
        </div>
        <div class="nav-item update-item">
          <UpdateVersion/>
        </div>
      </div>
      <div class="nav-right">
        <!-- 多语言 -->
        <el-dropdown trigger="click" @command="handleLangChange">
           <div class="nav-item btn-item lang-trigger">
             <i class="iconfont icon-language language"></i>
             <span class="nav-text" style="color: #666">{{ currentLangLabel }}</span>
           </div>
           <template #dropdown>
             <el-dropdown-menu>
               <el-dropdown-item v-for="lang in langOptions" :key="lang.value" :command="lang.value" :class="{ 'is-active': locale === lang.value }">
                 {{ lang.flag }} {{ lang.label }}
               </el-dropdown-item>
             </el-dropdown-menu>
           </template>
        </el-dropdown>
        <!-- 退出登录 -->
        <div class="nav-item btn-item" @click="handleLogout">
          <el-icon class="logout-icon"><SwitchButton /></el-icon>
          <span class="nav-text">{{ $t('home.logout', '退出登录') }}</span>
        </div>
      </div>
    </div>

    <!-- 用户信息与充值模块 -->
    <div class="info-section">
      <div class="user-info-card">
        <div class="user-greeting">{{ $t('home.greeting', { name: userInfo.name || 'User' }) }}</div>
        <div class="info-metrics">
          <!-- 账户类型 -->
          <div class="metric-item">
            <img :src="subaccountIcon" class="metric-icon" />
            <div class="metric-text-box">
              <div class="metric-label">{{ $t('home.accountType') }}</div>
              <div class="metric-value">{{ $t('home.accountValue') }}</div>
            </div>
          </div>
          <!-- 可用字符 -->
          <div class="metric-item">
            <img :src="charQuotaIcon" class="metric-icon" />
            <div class="metric-text-box">
              <div class="metric-label">{{ $t('home.availableChars') }}</div>
              <div class="metric-value">
                {{ availableChars }}
                <el-popover placement="bottom-start" :width="280" trigger="hover" popper-class="char-details-popover">
                  <template #reference>
                    <el-icon class="info-question"><QuestionFilled /></el-icon>
                  </template>
                  <div class="popover-content">
                    <div class="popover-header">
                      <span class="popover-title">{{ $t('home.charList') }}</span>
                      <el-icon class="refresh-icon" @click="getCurrentCharUsage"><Refresh /></el-icon>
                    </div>
                    <div class="char-table">
                      <div class="char-table-header">
                        <div class="col">{{ $t('home.translateChannel') }}</div>
                        <div class="col">{{ $t('home.todayUsed') }}</div>
                        <div class="col">{{ $t('home.used') }}</div>
                        <div class="col">{{ $t('home.available') }}</div>
                      </div>
                      <div class="char-table-row">
                        <div class="col">free</div>
                        <div class="col">{{ charInfo.accountUsed?.todayUsed || 0 }}</div>
                        <div class="col">{{ charInfo.usedChar }}</div>     
                        <div class="col">{{ availableChars }}</div>
                      </div>
                    </div>
                  </div>
                </el-popover>
              </div>
            </div>
          </div>
          <!-- 可用端口 -->
          <div class="metric-item">
            <img :src="portQuotaIcon" class="metric-icon" />
            <div class="metric-text-box">
              <div class="metric-label">{{ $t('home.availablePorts') }}</div>
              <div class="metric-value">{{charInfo.usedPortCount}}/{{ charInfo.totalPortCount }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="recharge-card">
        <div class="recharge-text">
          <div class="recharge-title">{{ $t('home.renewPlan') }}</div>
          <div class="recharge-subtitle">{{ $t('home.planPromo') }}</div>
          <el-button type="success" color="#2cd67a" class="recharge-btn">{{ $t('home.goToRecharge') }}</el-button>
        </div>
        <div class="recharge-illustration">
          <img :src="planRenewalIcon" />
        </div>
      </div>
    </div>

    <!-- 快捷入口模块 -->
    <div class="quick-access-section">
      <div class="section-title">{{ $t('home.quickAccess') }}</div>
      <div class="quick-grid">
        <div class="quick-item" v-for="(item, index) in quickAccessList" :key="index" @click="handleQuickAccess(item)">
          <div class="quick-item-icon">
            <img :src="item.icon" :alt="item.titleKey" />
          </div>
          <div class="quick-item-text">
            <div class="quick-item-title">{{ $t(item.titleKey) }}</div>
            <div class="quick-item-desc">{{ $t(item.descKey) }}</div>
          </div>
        </div>
      </div>
    </div>
    
    
    <!-- 退出登录确认弹窗 -->
    <el-dialog
        v-model="logoutDialogVisible"
        :title="$t('home.logoutDialogTitle')"
        width="400px"
        :show-close="true"
        class="custom-logout-dialog"
        align-center
    >
      <div class="dialog-content">
        <p class="sessions-info">{{ $t('home.runningSessions', { count: runningSessionsCount }) }}</p>
        <p class="confirm-text">{{ $t('home.confirmLogoutText') }}</p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelLogout" class="cancel-btn">{{ $t('home.cancel') }}</el-button>
          <el-button type="primary" @click="confirmLogout" class="confirm-btn">{{ $t('home.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlarmClock, QuestionFilled, Refresh, SwitchButton } from '@element-plus/icons-vue'
import LineChart from '../components/LineChart.vue'
import Notification from "@/utils/notification"
import UpdateVersion from '@/views/components/UpdateVersion.vue'
import { get, del } from '@/utils/request'
import { ipc } from '@/utils/ipcRenderer'
import useSocketIO from '@/utils/useSocketIO'

// WebSocket 
const { socket, isConnected, on, off } = useSocketIO()
// i18n
const { t, locale } = useI18n()

// 语言选项
const langOptions = [
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' }
]

const currentLangLabel = computed(() => {
  const found = langOptions.find(l => l.value === locale.value)
  return found ? `${found.label}` : '简体中文'
})

const handleLangChange = (lang) => {
  locale.value = lang
  localStorage.setItem('app-locale', lang)
  // 有些提示语如果不在 template 中，可能需要手动翻译
}

// 当前时间
const currentTime = ref('00:00:00')
let timer = null

// 获取用户信息
const userInfo = ref({})
const chartShow = ref(false)
const loadUserInfo = () => {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}

const logoutDialogVisible = ref(false);
const runningSessionsCount = ref(0);

// 字符使用情况
const charInfo = ref({
  totalChar: 0,
  usedChar: 0,
  accountUsed: {
    todayUsed: 0
  },
  totalPortCount: 0,
  usedPortCount: 0,
})

const availableChars = computed(() => {
  return charInfo.value.totalChar - charInfo.value.usedChar
})

async function getCurrentCharUsage() {
  try {
    const res = await get('/app/tenantWallet/getCurrent')
    if (res.code === 200 && res.data) {
      charInfo.value = res.data
    }
  } catch (error) {
    console.error('获取字符使用情况失败:', error)
  }
}

// 更新时间函数
const updateTime = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const handleClearCache = async () => {
   try {
     Notification.success(t('home.clearCacheSuccess'), 'Success')
   } catch(e) {}
}

const handleLogout = async () => {
  // 1. 隐藏所有活跃视图，防止遮挡弹窗
  await ipc.invoke('controller.window.hideWindow', {});
  
  // 2. 获取正在运行的会话数量
  runningSessionsCount.value = await ipc.invoke('controller.window.getRunningSessionsCount', {});
  
  // 3. 显示自定义确认弹窗
  logoutDialogVisible.value = true;
}

const cancelLogout = async () => {
  logoutDialogVisible.value = false;
  // 恢复活跃视图显示
  await ipc.invoke('controller.window.restoreActiveViews', {});
}

const confirmLogout = async () => {
  logoutDialogVisible.value = false;
  
  const userInfoStr = localStorage.getItem('userInfo');
  const userInfoObj = JSON.parse(userInfoStr || '{}');
  const accountId = userInfoObj.accountId;

  del('/app/account/logout').then(res => {
    if (res.code === 200) {
      ipc.invoke('controller.window.logout', { accountId: accountId }).then(() => {
        localStorage.removeItem('box-token');
        localStorage.removeItem('userInfo');
        router.push('/login');
      })
    }
  }).catch(error => {
    console.error('退出失败:', error);
    // 即使失败也尝试恢复视图
    ipc.invoke('controller.window.restoreActiveViews', {});
  })
}

// 组件挂载时启动定时器
onMounted(() => {
  loadUserInfo() // 加载用户信息
  updateTime() // 立即更新一次
  timer = setInterval(updateTime, 1000) // 每秒更新

  // 监听 WebSocket 的 message 响应
  on('message', (res) => {
    // 解析心跳包返回的具体数据格式
    if (res && res.code === 200 && res.data === 'pong') {
      getCurrentCharUsage()
    }
  })
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
  off('message')
})

// 导入SVG/PNG图标
import translateIcon from '@/assets/home/translate.png'
import aiReplyIcon from '@/assets/home/ai-reply.png'
import materialIcon from '@/assets/home/material.png'
import platformIcon from '@/assets/home/platform.png'
import wsGroupIcon from '@/assets/home/ws-group.png'
import wsJoinIcon from '@/assets/home/ws-join.png'
import wsLeaveIcon from '@/assets/home/ws-leave.png'
import wsImportIcon from '@/assets/home/ws-import.png'
import wsAiIcon from '@/assets/home/ws-ai.png'
import wsContactIcon from '@/assets/home/ws-contact.png'
import fansIcon from '@/assets/home/fans.png'

import subaccountIcon from '@/assets/home/sub-account.png'
import charQuotaIcon from '@/assets/home/char-quota.png'
import portQuotaIcon from '@/assets/home/port-quota.png'
import planRenewalIcon from '@/assets/home/plan-renewal.png'
// 快捷入口数据 (使用 i18n key 而非硬编码文案)
const quickAccessList = ref([
  { id: 'translate', icon: translateIcon, titleKey: 'quickItems.translate', descKey: 'quickItems.translateDesc' },
  { id: 'aiReply', icon: aiReplyIcon, titleKey: 'quickItems.aiReply', descKey: 'quickItems.aiReplyDesc' },
   { id: 'fans', icon: fansIcon, titleKey: 'quickItems.fans', descKey: 'quickItems.fansDesc' },
  // { id: 'material', icon: materialIcon, titleKey: 'quickItems.material', descKey: 'quickItems.materialDesc' },
  // { id: 'wsGroup', icon: wsGroupIcon, titleKey: 'quickItems.wsGroup', descKey: 'quickItems.wsGroupDesc' },
  // { id: 'wsJoin', icon: wsJoinIcon, titleKey: 'quickItems.wsJoin', descKey: 'quickItems.wsJoinDesc' },
  // { id: 'wsLeave', icon: wsLeaveIcon, titleKey: 'quickItems.wsLeave', descKey: 'quickItems.wsLeaveDesc' },
  // { icon: wsAiIcon, titleKey: 'quickItems.wsAi', descKey: 'quickItems.wsAiDesc' },
  // { icon: wsImportIcon, titleKey: 'quickItems.wsImport', descKey: 'quickItems.wsImportDesc' },
  // { id: 'fans', icon: fansIcon, titleKey: 'quickItems.fans', descKey: 'quickItems.fansDesc' },
  // { id: 'platform', icon: platformIcon, titleKey: 'quickItems.platform', descKey: 'quickItems.platformDesc' },
  // { icon: wsContactIcon, titleKey: 'quickItems.wsContact', descKey: 'quickItems.wsContactDesc' }
])

const router = useRouter()
// 处理快捷入口点击
const handleQuickAccess = (item) => {
  if (item.id === 'translate') {
    router.push({ path: '/home/settings', query: { activeMenu: 'translate' } })
  } else if (item.id === 'aiReply') {
    router.push({ path: '/home/settings', query: { activeMenu: 'aiReply' } })
  } else if (item.id === 'fans') {
    router.push('/home/fans')
  } else { 
     Notification.message({ 
      message: t('home.developing'),
      type:'info'
     })
  }
}
</script>

<style lang="less" scoped>
/* =========== 整体布局 =========== */
.home-page-container {
  min-height: 100%;
  background-color: #f5f7fa; /* 淡灰色背景 */
  padding: 12px 12px;
  box-sizing: border-box;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* 隐藏原有滚动条，使用自定义简洁样式 */
.home-page-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.home-page-container::-webkit-scrollbar-thumb {
  background: #dbdbdb;
  border-radius: 10px;
}
.home-page-container::-webkit-scrollbar-thumb:hover {
  background: #c1c1c1;
}

/* =========== 顶部导航栏 =========== */
.top-nav {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.nav-left, .nav-right {
  display: flex;
  gap: 16px;
  align-items: center;
}

.nav-item {
  background-color: #ffffff;
  border-radius: 6px;
  padding: 0 16px;
  height: 44px;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #333333;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);

  .el-icon {
    font-size: 16px;
    margin-right: 6px;
    color: #666;
  }
  .icon-language {
    font-size: 16px;
    margin-right: 6px;
    color: #666;
  }
}

.nav-text {
  color: #333;
}

.update-item {
  padding: 0;   
  box-shadow: none;
  height: 44px;
  display: flex;
  align-items: center;
}

.btn-item {
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background-color: #fcfcfc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
}

.lang-trigger {
  border: none;
  outline: none;
}

.logout-icon {
  transform: rotate(90deg); /* 模拟退出登录方向或使用原色 */
}

/* =========== 中间信息卡片模块 =========== */
.info-section {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

/* 左侧用户信息卡片 */
.user-info-card {
  flex: 1 1 500px;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 24px 30px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-greeting {
  font-size: 15px;
  color: #333333;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
}

.info-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  gap: 16px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.metric-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.metric-text-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 13px;
  color: #8c8c8c;
}

.metric-value {
  font-size: 16px;
  color: #262626;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.info-question {
  font-size: 14px;
  color: #bfbfbf;
  margin-left: 6px;
  cursor: pointer;
  &:hover {
    color: #1890ff;
  }
}

/* 右侧充值卡片 */
.recharge-card {
  flex: 1 1 260px;
  max-width: 280px;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  display: flex;
  position: relative;
  overflow: hidden;
}

.recharge-text {
  display: flex;
  flex-direction: column;
  z-index: 2;
}

.recharge-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  text-align: left;
}

.recharge-subtitle {
  font-size: 13px;
  color: #999;
  line-height: 1.5;
  margin-bottom: 16px;
}

.recharge-btn {
  width: 86px;
  height: 32px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  background: #2DD26A;
  color: #ffffff;
}

.recharge-illustration {
  position: absolute;
  right: 20px;
  bottom: 10px; 
  width: 120px;
  height: 120px;
  background-image: radial-gradient(circle, #eff6ff 30%, transparent 70%);
  pointer-events: none;
  opacity: 0.8;
  z-index: 1;
  img { 
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

/* =========== 快捷入口模块 =========== */
.quick-access-section {
  background-color: #ffffff;
  padding: 24px;
}

.section-title {
  font-family:'PingFang SC';
  font-size: 18px;
  font-weight: 400;
  color: #333333;
  margin-bottom: 16px;
  padding-left: 2px;
  text-align: left;
}

.quick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.quick-item {
  width: calc((100% - 32px) / 3); /* 默认3列 (100% - 2个gap) / 3 */
  background: #FAFAFA;
  border-radius: 6px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.01);
  box-sizing: border-box;

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    transform: translateY(-1px);
  }
}

@media (max-width: 1200px) {
  .quick-item {
    width: calc((100% - 16px) / 2); /* 2列 */
  }
}

@media (max-width: 768px) {
  .quick-item {
    width: 100%; /* 1列 */
  }
}

.quick-item-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 6px;
  background-color: #fcfcfc;
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }
}

.quick-item-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.quick-item-title {
  font-size: 14px;
  color: #262626;
  font-weight: 500;
  text-align: left;
}

.quick-item-desc {
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


/* =========== Popover 内容样式保持原样 =========== */
:deep(.char-details-popover) {
  padding: 16px !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.popover-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  
}

.refresh-icon {
  font-size: 18px;
  color: #666;
  cursor: pointer;
  transition: color 0.2s;
  &:hover {
    color: #1890ff;
  }
}

.char-table {
  width: 100%;
}

.char-table-header {
  display: flex;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 8px 0;
  margin-bottom: 8px;
}

.char-table-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.col {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: #666;
}

.char-table-header .col {
  font-weight: 500;
  color: #333;
}

.char-table-row .col {
  font-family: monospace;
}

/* 下拉菜单激活项样式 */
:deep(.el-dropdown-menu__item.is-active) {
  color: #1890ff;
  font-weight: 500;
  background-color: #e6f7ff;
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
  text-align: left;
}

.confirm-text {
  margin: 5px 0 0;
  font-size: 15px;
  text-align: left;
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
