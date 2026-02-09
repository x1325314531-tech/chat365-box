<template>
  <el-container style="height: 100%; padding: 20px; box-sizing: border-box;">
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
                <div> 清除缓存</div>
              </el-card>
            </el-col>
          </el-row>
       
       
      </div>
      
      <!-- 用户信息区域 -->
      <div class="header-user-info">
        <div class="greeting">你好, {{ userInfo.name || '用户' }}。</div>
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
              <span class="info-label">账户类型</span>
              <span class="info-value">子账号</span>
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
              <span class="info-label">可用字符</span>
              <span class="info-value">43830 <el-icon><QuestionFilled /></el-icon></span>
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
              <span class="info-label">可用端口(已用/总数)</span>
              <span class="info-value">0/3</span>
            </div>
          </div>
        </div>
      </div>
       <!-- 快捷入口-->
      <div class="quick-access">
        <div class="quick-access-title">快捷入口</div>
        <div class="quick-access-grid">
          <div 
            class="quick-item" 
            v-for="(item, index) in quickAccessList" 
            :key="index"
            @click="handleQuickAccess(item)"
          >
            <div class="quick-icon">
              <img :src="item.icon" :alt="item.title" width="36" height="36" />
            </div>
            <div class="quick-text">
              <span class="quick-title">{{ item.title }}</span>
              <span class="quick-desc">{{ item.desc }}</span>
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
          <p>套餐剩余：<strong>----条</strong></p>
          <p>会话端口：<strong>---</strong> <el-icon><i class="el-icon-chat-dot-square"></i></el-icon></p>
          <el-button type="success" size="small">续费套餐</el-button>
        </div>
      </el-card>
    </el-header>

    <!-- 内容主体部分 -->
    <el-main style="overflow: auto;">
      <el-card>
        <div class="title">数据统计</div>
        <LineChart />
      </el-card>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { AlarmClock, QuestionFilled } from '@element-plus/icons-vue'
import LineChart from '../components/LineChart.vue'
import Notification from "@/utils/notification";
// 当前时间
const currentTime = ref('00:00:00')
let timer = null

// 获取用户信息
const userInfo = ref({})
const loadUserInfo = () => {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
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

// 快捷入口数据
const quickAccessList = ref([
  { id: 'translate', icon: translateIcon, title: '翻译设置', desc: '为新会话设置默认配置' },
  { id: 'aiReply', icon: aiReplyIcon, title: 'AI回复设置', desc: '配置AI自动回复功能的全局设置' },
  { id: 'material', icon: materialIcon, title: '个人素材', desc: '自定义左侧显示的平台' },
  { id: 'platform', icon: platformIcon, title: '平台设置', desc: '自定义左侧显示的平台' },
  { id: 'wsGroup', icon: wsGroupIcon, title: 'WS多账号群发', desc: '跨账号群发群聊消息' },
  { id: 'wsJoin', icon: wsJoinIcon, title: 'WS批量进群', desc: '支持批量加入多个群组' },
  { id: 'wsLeave', icon: wsLeaveIcon, title: 'WS批量退群', desc: '支持多账号批量退群' },
  { icon: wsImportIcon, title: 'WS导入式群发', desc: '轻松粘贴号码，批量发送消息' },
  { icon: wsAiIcon, title: 'WS智能AI养号', desc: '托管式，全自动的AI智能养号' },
  { icon: wsContactIcon, title: 'WS批量导入通讯录', desc: '批量导入已注册WS的通讯录号码' },
  { icon: fansIcon, title: '粉丝列表', desc: '查看和管理粉丝数据' }
])

const router = useRouter()
// 处理快捷入口点击
const handleQuickAccess = (item) => {
  if (item.id === 'translate') {
    router.push('/home/settings')
  }else  { 
     Notification.message({ 
      message:'开发中',
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

.info-value .el-icon {
  font-size: 14px;
  color: #bfbfbf;
  cursor: pointer;
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
</style>
