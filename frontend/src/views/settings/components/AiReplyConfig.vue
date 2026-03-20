<template>
  <div class="translate-config">
    <div class="config-header">
      <h3>AI回复设置</h3>
      <p class="config-desc">配置AI回复的相关参数，包括模型选择、回复风格等</p>
    </div>

    <div class="config-body">
      <!-- 左侧平台列表 -->
      <div class="platform-list">
        <div class="platform-title">平台</div>
        <div 
          class="platform-item"
          :class="{ active: activeAiPlatform === 'whatsapp' }"
          @click="activeAiPlatform = 'whatsapp'"
        >
          <img src="@/assets/svgs/whatsapp.svg" class="platform-icon" />
          <span>WhatsApp</span>
        </div>
      </div>

      <!-- 右侧配置表单 -->
      <div class="config-form">
        <!-- 基础设置 -->
        <div class="config-section">
          <div class="section-header" @click="toggleSection('aiBasic')">
            <span class="section-title">基础设置</span>
            <span class="section-tag">{{ expandedSections.aiBasic ? '折叠' : '展开' }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.aiBasic">
            <div class="form-col">
              <div class="form-label">选择模型</div>
              <el-select v-model="aiConfig[activeAiPlatform].model" placeholder="请选择模型">
                <el-option
                  v-for="item in modelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div class="form-desc-ai form-desc">用于生成回复的AI产品</div>
            </div>

            <div class="form-col" style="margin-top: 16px;">
              <div class="form-label">基于前 条对话记录</div>
              <el-select v-model="aiConfig[activeAiPlatform].historyCount" placeholder="请选择条数">
                <el-option
                  v-for="item in historyOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 回复风格设置 -->
        <div class="config-section">
          <div class="section-header" @click="toggleSection('aiStyle')">
            <span class="section-title">回复风格设置</span>
            <span class="section-tag">{{ expandedSections.aiStyle ? '折叠' : '展开' }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.aiStyle">
            <div class="form-col">
              <div class="form-label">回复语调</div>
              <el-select v-model="aiConfig[activeAiPlatform].tone" placeholder="请选择语调">
                <el-option
                  v-for="item in toneOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>

            <div class="form-col" style="margin-top: 16px;">
              <div class="form-label">回复主题</div>
              <el-select v-model="aiConfig[activeAiPlatform].theme" placeholder="请选择主题">
                <el-option
                  v-for="item in themeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>

            <div class="form-col" style="margin-top: 16px;">
              <div class="form-label">回复角色</div>
              <el-select v-model="aiConfig[activeAiPlatform].role" placeholder="请选择角色">
                <el-option
                  v-for="item in roleOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 应用按钮 -->
        <div class="form-actions">
          <el-button type="primary" class="apply-btn" @click="applyConfig">{{ $t('settings.apply') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Notification from "@/utils/notification"
import { ipc } from '@/utils/ipcRenderer'

const { t } = useI18n()
const router = useRouter()

const expandedSections = reactive({
  aiBasic: true,
  aiStyle: true
})

const activeAiPlatform = ref('whatsapp')

const aiConfig = reactive({
  whatsapp: {
    model: 'Gemini',
    historyCount: 3,
    tone: '默认',
    theme: '默认',
    role: '朋友'
  },
  telegram: {
    model: 'Gemini',
    historyCount: 3,
    tone: '默认',
    theme: '默认',
    role: '朋友'
  }
})

const modelOptions = [
  { label: 'Gemini', value: 'Gemini' },
  { label: 'GPT-3.5', value: 'GPT-3.5' },
  { label: 'GPT-4', value: 'GPT-4' }
]
const historyOptions = [
  { label: '3条', value: 3 },
  { label: '5条', value: 5 },
  { label: '10条', value: 10 }
]
const toneOptions = [
  { label: '默认', value: '默认' },
  { label: '专业', value: '专业' },
  { label: '友好', value: '友好' },
  { label: '热情', value: '热情' },
  { label: '随意', value: '随意' },
  { label: '正式', value: '正式' }
]
const themeOptions = [
  { label: '默认', value: '默认' },
  { label: '客服', value: '客服' },
  { label: '销售', value: '销售' },
  { label: '支持', value: '支持' },
  { label: '通用', value: '通用' }
]
const roleOptions = [
  { label: '默认', value: '默认' },
  { label: '朋友', value: '朋友' },
  { label: '助手', value: '助手' },
  { label: '客服', value: '客服' },
  { label: '顾问', value: '顾问' },
  { label: '专家', value: '专家' }
]

const toggleSection = (section) => {
  expandedSections[section] = !expandedSections[section]
}

const applyConfig = () => {
  localStorage.setItem('aiConfig', JSON.stringify(aiConfig))
  ipc.invoke('save-ai-config', JSON.parse(JSON.stringify(aiConfig))).then(res => {
    console.log('AI配置已同步到主进程:', res)
  })

  Notification.message({ message: t('settings.updateSuccess'), type: 'success' })
  
  setTimeout(() => {
    router.push({ path: '/home/whatsapp', query: { refresh: 'true' } })
  }, 1000)
}

onMounted(() => {
  ipc.invoke('get-ai-config').then(res => {
    if (res) {
      Object.assign(aiConfig, res)
    } else {
      const localAiConfig = localStorage.getItem('aiConfig')
      if (localAiConfig) {
        Object.assign(aiConfig, JSON.parse(localAiConfig))
      }
    }
  })
})
</script>

<style scoped>
.translate-config {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}

.config-header h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #262626;
  text-align: left;
}

.config-desc {
  font-size: 12px;
  color: #8c8c8c;
  margin: 0;
  text-align: left;
}

.config-body {
  display: flex;
  margin-top: 20px;
  border-top: 1px solid #f0f0f0;
  padding-top: 20px;
}

.platform-list {
  width: 180px;
  border-right: 1px solid #f0f0f0;
  padding-right: 20px;
}

.platform-title {
  font-size: 14px;
  color: #8c8c8c;
  margin-bottom: 12px;
  text-align: left;
}

.platform-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #595959;
  transition: all 0.2s;
}

.platform-item.active {
  background: #e6f7e6;
  color: #52c41a;
}

.platform-icon {
  width: 24px;
  height: 24px;
}

.config-form {
  padding-left: 20px;
  width: 620px;
}

.config-section {
  margin-bottom: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f0fff3;
  cursor: pointer;
  position: relative;
}

.section-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  background-color: #2ed36a;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.section-tag {
  font-size: 12px;
  color: #1890ff;
}

.section-content {
  padding: 16px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #262626;
  flex: 1;
  text-align: left;
}

.form-desc {
  font-size: 12px;
  color: #8c8c8c;
  width: 100%;
  margin-top: 4px;
  text-align: left;
}

.form-desc-ai {
  text-align: left;
}

.form-col {
  flex: 1;
}

.form-col .form-label {
  margin-bottom: 8px;
}

.form-col .el-select {
  width: 100%;
}

.form-actions {
  margin-top: 20px;
  padding: 20px 0;
  background: #fff;
  text-align: right;
  border-top: 1px solid #f5f5f5;
  z-index: 10;
}

.apply-btn {
  width: 120px;
  background: #2ed36a;
  border-color: #2ed36a;
  height: 40px;
  font-size: 14px;
  font-weight: 500;
}
</style>
