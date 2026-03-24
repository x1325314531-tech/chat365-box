<template>
  <div class="translate-config">
    <div class="config-header">
      <h3>{{ $t('quickItems.aiReply') }}</h3>
      <p class="config-desc">{{ $t('settings.aiReplyConfigDesc') }}</p>
    </div>

    <div class="config-body">
      <!-- 左侧平台列表 -->
      <div class="platform-list">
        <div class="platform-title">{{ $t('settings.aiPlatform') }}</div>
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
            <span class="section-title">{{ $t('settings.aiBasicSettings') }}</span>
            <span class="section-tag">{{ expandedSections.aiBasic ? $t('settings.collapse') : $t('settings.expand') }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.aiBasic">
            <div class="form-col flex-between ">
               <div class="form-label">{{ $t('settings.aiReplyToggle') }}</div>
               <el-switch v-model="aiConfig[activeAiPlatform].aiReplyToggle"  style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" @change="handleAiReplyToggle"></el-switch>
            </div>
            <div class="form-col">
              <div class="form-label">{{ $t('settings.selectModel') }}</div>
              <el-select v-model="aiConfig[activeAiPlatform].model" :placeholder="$t('settings.modelPlaceholder')">
                <el-option
                  v-for="item in modelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div class="form-desc-ai form-desc">{{ $t('settings.modelDesc') }}</div>
            </div>

            <div class="form-col" style="margin-top: 16px;">
              <div class="form-label">{{ $t('settings.historyCountPrefix') }}{{ $t('settings.historyCountSuffix') }}</div>
              <el-select v-model="aiConfig[activeAiPlatform].historyCount"  :placeholder="$t('settings.historyPlaceholder')">
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
            <span class="section-title">{{ $t('settings.aiStyleSettings') }}</span>
            <span class="section-tag">{{ expandedSections.aiStyle ? $t('settings.collapse') : $t('settings.expand') }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.aiStyle">
            <div class="form-col">
              <div class="form-label">{{ $t('settings.tone') }}</div>
              <el-select v-model="aiConfig[activeAiPlatform].tone" @change="toneChange" :placeholder="$t('settings.tonePlaceholder')">
                <el-option
                  v-for="item in toneOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>

            <div class="form-col" style="margin-top: 16px;">
              <div class="form-label">{{ $t('settings.theme') }}</div>
              <el-select v-model="aiConfig[activeAiPlatform].theme" @change="themeChange" :placeholder="$t('settings.themePlaceholder')">
                <el-option
                  v-for="item in themeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>

            <div class="form-col" style="margin-top: 16px;">
              <div class="form-label">{{ $t('settings.role') }}</div>
              <el-select v-model="aiConfig[activeAiPlatform].role" @change="roleChange" :placeholder="$t('settings.rolePlaceholder')">
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
import { reactive, ref, onMounted, watch, computed} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Notification from "@/utils/notification"
import { ipc } from '@/utils/ipcRenderer'
import {get} from '@/utils/request'

const { t } = useI18n()
const router = useRouter()

const expandedSections = reactive({
  aiBasic: true,
  aiStyle: true
})

const activeAiPlatform = ref('whatsapp')

const aiConfig = reactive({
  whatsapp: {
    aiReplyToggle: false,
    model: 'Gemini',
    historyCount: 3,
    tone: 'default',
    theme: 'default',
    role: 'default',
    toneName:'默认',
    themeName:'默认',
    roleName:'默认',
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
const historyOptions = computed(() => [
  { label: `3 ${t('settings.historyCountSuffix')}`, value: 3 },
  { label: `5 ${t('settings.historyCountSuffix')}`, value: 5 },
  { label: `10 ${t('settings.historyCountSuffix')}`, value: 10 }
])
const toneOptions = ref([])
const themeOptions = ref([])
const roleOptions = ref([])

const toggleSection = (section) => {
  expandedSections[section] = !expandedSections[section]
}

const handleAiReplyToggle = (val) => {
  if (val) {
    // 互斥逻辑：开启 AI 回复时，关闭自动翻译
    ipc.invoke('get-translate-config').then(transRes => {
      if (transRes) {
        transRes.sendAutoTranslate = false
        ipc.invoke('save-translate-config', JSON.parse(JSON.stringify(transRes))).then(res => {
          console.log('互斥逻辑：已自动关闭发送自动翻译开关', res)
        })
      }
    })
  }
}
const toneChange = (val) => { 
   aiConfig[activeAiPlatform.value].toneName = toneOptions.value.find((item)=> item.value===val)?.label
}
const  themeChange = (val)=> { 
  aiConfig[activeAiPlatform.value].themeName = themeOptions.value.find((item)=> item.value===val)?.label
}
const roleChange =(val)=> { 
  aiConfig[activeAiPlatform.value].roleName = roleOptions.value.find((item)=> item.value===val)?.label
}
const applyConfig = () => {
  const  aiConfigData=  aiConfig[activeAiPlatform]
  console.log('wwwww', aiConfigData);
  
  localStorage.setItem('aiConfig', JSON.stringify(aiConfig))
  ipc.invoke('save-ai-config', JSON.parse(JSON.stringify(aiConfig))).then(res => {
    console.log('AI配置已同步到主进程:', res)
  })

  Notification.message({ message: t('settings.updateSuccess'), type: 'success' })
  
  setTimeout(() => {
    router.push({ path: '/home/whatsapp', query: { refresh: 'true' } })
  }, 1000)
}
//获取回复语调
const  getagentToneDict = async()=> { 
  try {
    const dictType='box_agent_tone'
    const res = await get(`/app/dict/listData?dictType=${dictType}`)  
    if (res && res.code === 200) {
      toneOptions.value = res.data.map(item=> {
        return{
          label:item.dictLabel,
          value:item.dictValue
        }
      }) || []
    }
  } catch (err) {
    console.error('获取回复语调失败:', err)
  }
}
//获取回复主题
const  getAgentThemeDict =async() => { 
try {
    const dictType='box_agent_theme'
    const res = await get(`/app/dict/listData?dictType=${dictType}`)  
    if (res && res.code === 200) {
       themeOptions.value = res.data.map(item=> {
        return{
          label:item.dictLabel,
          value:item.dictValue
        }
      }) || []
    }
  } catch (err) {
    console.error('获取回复语调失败:', err)
  }
}
//获取回复角色
const getAgentRoleDict = async() =>{ 
try {
    const dictType='box_agent_role'
    const res = await get(`/app/dict/listData?dictType=${dictType}`)  
    if (res && res.code === 200) {
      roleOptions.value = res.data.map(item=> {
        return{
          label:item.dictLabel,
          value:item.dictValue
        }
      }) || []
    }
  } catch (err) {
    console.error('获取回复语调失败:', err)
  }
}
onMounted(async() => {
  ipc.invoke('get-ai-config').then(res => {
    console.log('aires', res);
    
    if (res) {
      Object.assign(aiConfig, res)
    } else {
      const localAiConfig = localStorage.getItem('aiConfig')
      if (localAiConfig) {
        Object.assign(aiConfig, JSON.parse(localAiConfig))
      }
    }
  })
  await getagentToneDict()
 await getAgentThemeDict()
 await getAgentRoleDict()
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
.flex-between { 
  justify-content: space-between;
  align-items: center;
  display: flex;
}
.form-col .form-label {
  margin-bottom: 8px;
}

.form-col .el-select {
  width: 100%;
}

.form-actions {
  position: sticky;
  bottom: -20px;
  margin-top: 20px;
  padding: 20px 0;
  background: #fff;
  text-align: right;
  border-top: 1px solid #f5f5f5;
  z-index: 10;
  margin-left: -20px;
  margin-right: -20px;
  padding-right: 20px;
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
