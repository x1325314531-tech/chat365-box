<template>
  <el-container direction="vertical" style="height: 100%; padding: 20px; box-sizing: border-box; overflow-y: auto;">
    <!-- 顶部部分 -->
        <div class="header-top ">
          <el-row :gutter="12">
            <el-col :span="8">
             <el-card>
             <div class="countdown">
          <el-icon><AlarmClock /></el-icon>
          <span class="countdown-tex">{{ currentTime }}</span>
        </div>
          </el-card>
            </el-col>
            <el-col :span="6">
              <el-card>
                <div>
                  <i class="iconfont icon-qingchu"></i>
                  {{ $t('home.clearCache') }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
                 <el-card>
                <div class="select-language">
                  <el-dropdown trigger="click" @command="handleLangChange">
                    <span class="lang-trigger">
                      <i class="iconfont icon-language language"></i>
                      {{ currentLangLabel }}
                      <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </span>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          v-for="lang in langOptions"
                          :key="lang.value"
                          :command="lang.value"
                          :class="{ 'is-active': locale === lang.value }"
                        >
                          {{ lang.flag }} {{ lang.label }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </el-card>
            </el-col>
          </el-row>
       
       
      </div>
      
      <!-- 用户信息区域 -->
      <div class="header-user-info">
        <div class="greeting">{{ $t('home.greeting', { name: userInfo.name || 'User' }) }}</div>
        <div class="info-cards-row">
          <!-- 账户类型 -->
          <div class="info-card-item">
            <div class="info-icon account-icon">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <circle cx="12" cy="8" r="5" fill="#1890ff"/>
                <path d="M12 14c-6 0-9 3-9 6v1h18v-1c0-3-3-6-9-6z" fill="#1890ff"/>
                <circle cx="18" cy="16" r="4" fill="#40a9ff" stroke="#fff" stroke-width="1"/>
                <path d="M16 16h4M18 14v4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">{{ $t('home.accountType') }}</span>
              <span class="info-value">{{ $t('home.accountValue') }}</span>
            </div>
          </div>

          <!-- 可用字符 -->
          <div class="info-card-item">
            <div class="info-icon chars-icon">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path d="M4 4h12l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" fill="#ffa940"/>
                <path d="M6 8h8M6 12h6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="17" cy="17" r="5" fill="#1890ff"/>
                <path d="M15.5 17h3M17 15.5v3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">{{ $t('home.availableChars') }}</span>
              <span class="info-value">
                {{ availableChars }}
                <el-popover
                  placement="bottom-start"
                  :width="280"
                  trigger="hover"
                  popper-class="char-details-popover"
                >
                  <template #reference>
                    <el-icon class="info-question"><QuestionFilled /></el-icon>
                  </template>
                  <div class="popover-content">
                    <div class="popover-header">
                      <span class="popover-title">字符列表</span>
                      <el-icon class="refresh-icon" @click="getCurrentCharUsage"><Refresh /></el-icon>
                    </div>
                    <div class="char-table">
                      <div class="char-table-header">
                        <div class="col">翻译通道</div>
                        <div class="col">今日已用</div>
                        <div class="col">已用</div>
                        <div class="col">可用</div>
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
              </span>
            </div>
          </div>

          <!-- 可用端口 -->
          <div class="info-card-item">
            <div class="info-icon port-icon">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <rect x="2" y="4" width="14" height="16" rx="2" fill="#1890ff"/>
                <circle cx="9" cy="10" r="3" fill="#fff"/>
                <rect x="6" y="14" width="6" height="3" rx="1" fill="#fff"/>
                <rect x="10" y="6" width="12" height="14" rx="2" fill="#40a9ff"/>
                <path d="M14 10h4M14 13h4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">{{ $t('home.availablePorts') }}</span>
              <span class="info-value">0/3</span>
            </div>
          </div>
        </div>
      </div>
       <!-- 快捷入口-->
      <div class="quick-access">
        <div class="quick-access-title">{{ $t('home.quickAccess') }}</div>
        <div class="quick-access-grid">
          <div 
            class="quick-item" 
            v-for="(item, index) in quickAccessList" 
            :key="index"
            @click="handleQuickAccess(item)"
          >
            <div class="quick-icon">
              <img :src="item.icon" :alt="item.titleKey" width="36" height="36" />
            </div>
            <div class="quick-text">
              <span class="quick-title">{{ $t(item.titleKey) }}</span>
              <span class="quick-desc">{{ $t(item.descKey) }}</span>
            </div>
          </div>
        </div>
      </div>
    <el-header style="display: flex; align-items: stretch; gap: 20px; height: 250px;">
      
      <!-- 左侧轮播图 -->
      <el-carousel autoplay height="100%" class="carousel-container">
        <el-carousel-item v-for="(color, index) in colors" :key="index">
          <div class="carousel-item" :style="{ backgroundColor: color }"></div>
        </el-carousel-item>
      </el-carousel>

      <!-- 右侧信息展示区 -->
      <el-card class="info-card" :style="{ height: '100%' }">
        <div class="info-content">
          <h3>------</h3>
          <p>{{ $t('home.planRemaining') }}：<strong>----条</strong></p>
          <p>{{ $t('home.sessionPorts') }}：<strong>---</strong> <el-icon><i class="el-icon-chat-dot-square"></i></el-icon></p>
          <el-button type="success" size="small">{{ $t('home.renewPlan') }}</el-button>
        </div>
      </el-card>
    </el-header>

    <!-- 内容主体部分 -->
    <el-main style="flex: none; overflow: visible;" v-if="chartShow">
      <el-card>
        <div class="title">{{ $t('home.dataStats') }}</div>
        <LineChart />
      </el-card>
    </el-main>
  </el-container>

</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlarmClock, QuestionFilled, ArrowDown, Refresh } from '@element-plus/icons-vue'
import LineChart from '../components/LineChart.vue'
import Notification from "@/utils/notification";
import { get } from '@/utils/request'

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
  return found ? `${found.flag} ${found.label}` : '🇨🇳 中文'
})

const handleLangChange = (lang) => {
  locale.value = lang
  localStorage.setItem('app-locale', lang)
}

// 当前时间
const currentTime = ref('00:00:00')
let timer = null

// 获取用户信息
const userInfo = ref({})
const  chartShow= ref(false)
const loadUserInfo = () => {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}

// 字符使用情况
const charInfo = ref({
  totalChar: 0,
  usedChar: 0,
  accountUsed: {
    todayUsed: 0
  }
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

// 组件挂载时启动定时器
onMounted(() => {
  loadUserInfo() // 加载用户信息
  // getCurrentCharUsage()
  updateTime() // 立即更新一次
  timer = setInterval(updateTime, 1000) // 每秒更新
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

// 模拟轮播图色块数据
const colors = ref(['#4caf50', '#2196f3', '#ff9800'])

// 导入SVG图标
import translateIcon from '@/assets/svgs/translate.svg'
import aiReplyIcon from '@/assets/svgs/ai-reply.svg'
import materialIcon from '@/assets/svgs/material.svg'
import platformIcon from '@/assets/svgs/platform.svg'
import wsGroupIcon from '@/assets/svgs/ws-group.svg'
import wsJoinIcon from '@/assets/svgs/ws-join.svg'
import wsLeaveIcon from '@/assets/svgs/ws-leave.svg'
import wsImportIcon from '@/assets/svgs/ws-import.svg'
import wsAiIcon from '@/assets/svgs/ws-ai.svg'
import wsContactIcon from '@/assets/svgs/ws-contact.svg'
import fansIcon from '@/assets/svgs/fans.svg'

// 快捷入口数据 (使用 i18n key 而非硬编码文案)
const quickAccessList = ref([
  { id: 'translate', icon: translateIcon, titleKey: 'quickItems.translate', descKey: 'quickItems.translateDesc' },
  { id: 'aiReply', icon: aiReplyIcon, titleKey: 'quickItems.aiReply', descKey: 'quickItems.aiReplyDesc' },
  { id: 'material', icon: materialIcon, titleKey: 'quickItems.material', descKey: 'quickItems.materialDesc' },
  { id: 'platform', icon: platformIcon, titleKey: 'quickItems.platform', descKey: 'quickItems.platformDesc' },
  { id: 'wsGroup', icon: wsGroupIcon, titleKey: 'quickItems.wsGroup', descKey: 'quickItems.wsGroupDesc' },
  { id: 'wsJoin', icon: wsJoinIcon, titleKey: 'quickItems.wsJoin', descKey: 'quickItems.wsJoinDesc' },
  { id: 'wsLeave', icon: wsLeaveIcon, titleKey: 'quickItems.wsLeave', descKey: 'quickItems.wsLeaveDesc' },
  { icon: wsImportIcon, titleKey: 'quickItems.wsImport', descKey: 'quickItems.wsImportDesc' },
  { icon: wsAiIcon, titleKey: 'quickItems.wsAi', descKey: 'quickItems.wsAiDesc' },
  { icon: wsContactIcon, titleKey: 'quickItems.wsContact', descKey: 'quickItems.wsContactDesc' },
  { icon: fansIcon, titleKey: 'quickItems.fans', descKey: 'quickItems.fansDesc' }
])

const router = useRouter()
// 处理快捷入口点击
const handleQuickAccess = (item) => {
  if (item.id === 'translate') {
    router.push('/home/settings')
  }else  { 
     Notification.message({ 
      message: t('home.developing'),
      type:'info'
     })
  }
}


</script>

<style scoped>
.carousel-container {
  width: 70%;
}
.header-top{
  padding: 0 20px;
  margin-bottom: 20px;
}
.countdown { 
  display: flex;
}
.countdown-tex   { 
  margin-left: 8px;
}
.carousel-item {
  width: 100%;
  height: 100%;
}

.info-card {
  width: 30%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.info-content {
  text-align: center;
}

.title {
  font-size: 20px;
  margin-bottom: 10px;
}
.select-language {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lang-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}
.lang-trigger:hover {
  color: #1890ff;
}
.language { 
  font-size: 20px;
}

/* 下拉菜单激活项样式 */
:deep(.el-dropdown-menu__item.is-active) {
  color: #1890ff;
  font-weight: 500;
  background-color: #e6f7ff;
}

/* 用户信息区域样式 */
.header-user-info {
  border-radius: 8px;
  padding: 16px 0;
  margin: 0 20px 20px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.greeting {
  color: #333;
  font-size: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
  text-align: left;
  margin-left: 12px;
}

.info-cards-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.info-card-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #8c8c8c;
}

.info-value {
  font-size: 16px;
  color: #262626;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-value .info-question {
  font-size: 14px;
  color: #bfbfbf;
  cursor: pointer;
  margin-left: 4px;
}

.info-value .info-question:hover {
  color: #1890ff;
}

/* Popover 内容样式 */
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
}

.refresh-icon:hover {
  color: #1890ff;
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

/* 快捷入口样式 */
.quick-access {
  margin: 0 20px 20px 20px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.quick-access-title {
  font-size: 14px;
  color: #333;
  margin-bottom: 20px;
  font-weight: 500;
  text-align: left;
}

.quick-access-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.quick-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-item:hover {
  background: #f0f5ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.quick-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quick-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.quick-title {
  font-size: 14px;
  color: #262626;
  font-weight: 500;
}

.quick-desc {
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 自定义滚动条样式 */
.el-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.el-container::-webkit-scrollbar-thumb {
  background: #dbdbdb;
  border-radius: 10px;
}

.el-container::-webkit-scrollbar-thumb:hover {
  background: #c1c1c1;
}

.el-container::-webkit-scrollbar-track {
  background: transparent;
}
</style>
