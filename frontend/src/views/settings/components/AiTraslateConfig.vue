<template>
  <div class="translate-config">
    <div class="config-header">
      <h3>{{ $t('quickItems.aiTranslation') }}</h3>
      <p class="config-desc">{{ $t('settings.aiTranslationConfigDesc') }}</p>
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
               <div class="form-label">{{ $t('settings.aiTranslationToggle') }}</div>
               <el-switch v-model="aiTranslateConfig[activeAiPlatform].aiTranslationToggle"  style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" @change="handleAiReplyToggle"></el-switch>
            </div>
          
            <div class="form-col">
              <div class="form-label">{{ $t('settings.selectModel') }}</div>
              <el-select v-model="aiTranslateConfig[activeAiPlatform].model" :placeholder="$t('settings.modelPlaceholder')">
                <el-option
                  v-for="item in modelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div class="form-desc-ai form-desc">{{ $t('settings.AImodelDesc') }}</div>
            </div>
                  <div class="form-col flex-between  ai-translation-preview">
                <div class="flex-column">
               <div class="form-label">{{ $t('settings.aiTranslationPreview') }}</div>
               <div class="form-desc">{{ $t('settings.aiTranslationPreviewDesc') }}</div>
               </div>
               <el-switch v-model="aiTranslateConfig[activeAiPlatform].aiTranslationPreview"  style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf"  @change="handleAiTranslationPreview"></el-switch>
            </div>
            <div class="form-col" style="margin-top: 16px;">
              <div class="flex-between">
              <div class="form-label">{{ $t('settings.historyCountPrefix') }}{{ $t('settings.historyCountSuffix') }}</div>
              <el-switch v-model="aiTranslateConfig[activeAiPlatform].historyCountToggle"  style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" @change="handlehistoryCountToggle"></el-switch>
             </div>
              <el-select  v-if="aiTranslateConfig[activeAiPlatform].historyCountToggle" v-model="aiTranslateConfig[activeAiPlatform].historyCount"  :placeholder="$t('settings.historyPlaceholder')">
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

        <!-- AI翻译目前语音设置 -->
        <div class="config-section">
          <div class="section-header" @click="toggleSection('aiStyle')">
            <span class="section-title">{{ $t('settings.aiTranslationTargetLanguageSettings') }}</span>
            <span class="section-tag">{{ expandedSections.aiStyle ? $t('settings.collapse') : $t('settings.expand') }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.aiStyle">
            <div class="form-col">
              <div class="form-label">{{ $t('settings.aiTranslationTargetLanguage') }}</div>
              <el-select v-model="aiTranslateConfig[activeAiPlatform].aiTranslationTargetLang" @change="languageChange" :placeholder="$t('settings.aiTranslationTargetPlaceholder')">
                <el-option
                  v-for="lang in languageList"
                  :key="lang.id" 
                  :label="lang.displayName" 
                  :value="lang.code"
                />
              </el-select>
            </div>
               <div v-if="aiTranslateConfig[activeAiPlatform].aiTranslationTargetLang === 'en'" class="form-col form-col-item">
              <div class="form-label">{{ $t('settings.englishType') }}</div>
              <el-select v-model="aiTranslateConfig[activeAiPlatform].enTargetLang"  :placeholder="$t('settings.enTargetPlaceholder')">
                <el-option
                  v-for="lang in enLangOtions"
                  :key="lang.value" 
                  :label="lang.label" 
                  :value="lang.value"
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

const aiTranslateConfig = reactive({
  whatsapp: {
    aiTranslationToggle: false,
    aiTranslationPreview: false,
    model: 'Gemini',
    historyCountToggle: true,
    historyCount: 3,
    aiTranslationTargetLang: '',
    enTargetLang:'',
    validationLevel: 'rules'
  },
  telegram: {
   aiTranslationToggle: false,
   aiTranslationPreview: false,
   model: 'Gemini',
   historyCountToggle: true,
   historyCount: 3,
  aiTranslationTargetLang: '',
  enTargetLang:'',
  validationLevel: 'rules'
  }
})

const modelOptions =  ref([])
const historyOptions = computed(() => [
  { label: `3 ${t('settings.historyCountSuffix')}`, value: 3 },
  { label: `5 ${t('settings.historyCountSuffix')}`, value: 5 },
  { label: `10 ${t('settings.historyCountSuffix')}`, value: 10 }
])
const enLangOtions = computed(()=> [
  { label: `${t('settings.enUsTargetLang')}`, value: 'american' },
  { label: `${t('settings.enGbTargetLang')}`, value: 'british' },
])
const languageList =ref([])
const toggleSection = (section) => {
  expandedSections[section] = !expandedSections[section]
}

const handleAiReplyToggle = (val) => {
  if (val) {
    // 互斥逻辑：开启 AI翻译 回复时，关闭自动翻译
    ipc.invoke('get-translate-config').then(transRes => {
      if (transRes) {
        transRes.sendAutoTranslate = false
        transRes.sendAutoNotTranslate = true
        ipc.invoke('save-translate-config', JSON.parse(JSON.stringify(transRes))).then(res => {
          console.log('互斥逻辑：已自动关闭发送自动翻译开关', res)
          localStorage.setItem('translateConfig', JSON.stringify(transRes))
        })
      }
    })
    //AI润色 关闭
    ipc.invoke('get-ai-config').then(transRes => {
      if (transRes) {
        transRes.whatsapp.aiReplyToggle = false
        console.log('润色', transRes);
        ipc.invoke('save-ai-config', JSON.parse(JSON.stringify(transRes))).then(res => {
          console.log('互斥逻辑：已自动关闭AI润色开关', res)
          localStorage.setItem('aiConfig', JSON.stringify(transRes))
        })
      }
    })
  } else {
    // 互斥逻辑：开启 AI翻译 回复时，关闭自动翻译
    ipc.invoke('get-translate-config').then(transRes => {
      if (transRes) {
        transRes.sendAutoTranslate = false
        transRes.sendAutoNotTranslate = true
        ipc.invoke('save-translate-config', JSON.parse(JSON.stringify(transRes))).then(res => {
          console.log('互斥逻辑：已自动关闭发送自动翻译开关', res)
          localStorage.setItem('translateConfig', JSON.stringify(transRes))
        })
      }
    })
    //AI润色 关闭 (这里原本逻辑是开启AI润色，保持原样同步)
    ipc.invoke('get-ai-config').then(transRes => {
      if (transRes) {
        transRes.whatsapp.aiReplyToggle = true
        console.log('润色', transRes);
        ipc.invoke('save-ai-config', JSON.parse(JSON.stringify(transRes))).then(res => {
          console.log('互斥逻辑：已恢复开启AI润色开关', res)
          localStorage.setItem('aiConfig', JSON.stringify(transRes))
        })
      }
    })
    //AI 翻译预览关闭
    aiTranslateConfig[activeAiPlatform.value].aiTranslationPreview = false
  }
}
//AI翻译预览开关
const handleAiTranslationPreview = (val)=> { 
  if(!aiTranslateConfig[activeAiPlatform.value].aiTranslationToggle) { 
      Notification.message({ message: 'AI翻译设置开关未开启', type: 'warning' })
      aiTranslateConfig[activeAiPlatform.value].aiTranslationPreview =false
      return
  }
}
//历史消息开关
const handlehistoryCountToggle = (val) => { 
  console.log('条数开关', val);
  if (!aiTranslateConfig[activeAiPlatform.value]) {
    aiTranslateConfig[activeAiPlatform.value] = {}
  }

  aiTranslateConfig[activeAiPlatform.value].historyCountToggle = val

  if (!val) {
    aiTranslateConfig[activeAiPlatform.value].historyCount =''
  }
  console.log(' AI翻译',  aiTranslateConfig[activeAiPlatform.value] );
}

const languageChange = (val) => { 
//    aiConfig[activeAiPlatform.value]. = languageList.value.find((item)=> item.value===val)?.label
}

const applyConfig = () => {
  const  aiConfigData=  aiTranslateConfig[activeAiPlatform.value]
  console.log('wwwww', aiConfigData);
   console.log('AI翻译配置', aiTranslateConfig);
  localStorage.setItem('aiTranslateConfig', JSON.stringify(aiTranslateConfig))
  ipc.invoke('save-ai-translate-config', JSON.parse(JSON.stringify(aiTranslateConfig))).then(res => {
    console.log('AI配置已同步到主进程:', res)
  })

  Notification.message({ message: t('settings.updateSuccess'), type: 'success' })
  
  // setTimeout(() => {
  //   router.push({ path: '/home/whatsapp', query: { refresh: 'true' } })
  // }, 1000)
}
//获取模型
const getModelOptions = async() => { 
    try {
    const dictType='box_agent_models'
    const res = await get(`/app/dict/listData?dictType=${dictType}`)  
    if (res && res.code === 200) {
      modelOptions.value = res.data.map(item=> {
        return{
          label:item.dictLabel,
          value:item.dictValue
        }
      }) || []
    }
  } catch (err) {
    console.error('获取模型失败',err) 
  }
}

const fetchLanguageList = async () => {
    try{
        const res = await get('/app/languageList/languageList')
      languageList.value = res.data
    }catch { 
      console.error('获取语言列表失败:', error)
    }
}
onMounted(async() => {
  ipc.invoke('get-ai-translate-config').then(res => {
    console.log('aires', res);
    
    if (res) {
      Object.assign(aiTranslateConfig, res)
    } else {
      const localAiConfig = localStorage.getItem('aiTranslateConfig')
      if (localAiConfig) {
        Object.assign(aiTranslateConfig, JSON.parse(localAiConfig))
      }
    }
  })
  await getModelOptions()
 await  fetchLanguageList()
 
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
.ai-translation-preview { 
  margin-top: 16px;
  align-items: baseline !important;
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
.form-col-item { 
    margin-top: 15px;
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
