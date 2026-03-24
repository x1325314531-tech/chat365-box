<template>
  <div class="translate-config">
    <div class="config-header">
      <h3>{{ $t('settings.translateConfig') }}</h3>
      <p class="config-desc">{{ $t('settings.globalConfigDesc') }}</p>
    </div>

    <div class="config-body">
      <!-- 左侧平台列表 -->
      <div class="platform-list">
        <div class="platform-title">{{ $t('settings.translateConfig') }}</div>
        <div class="platform-item active">
          <img src="@/assets/svgs/whatsapp.svg" class="platform-icon" />
          <span>WhatsApp</span>
        </div>
      </div>

      <!-- 右侧配置表单 -->
      <div class="config-form">
        <!-- 发送翻译设置 -->
        <div class="config-section">
          <div class="section-header" @click="toggleSection('send')">
            <span class="section-title">{{ $t('settings.sendSettings') }}</span>
            <span class="section-tag">{{ expandedSections.send ? $t('settings.collapse') : $t('settings.expand') }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.send">
            <div class="form-item">
              <div class="form-item-left">
                <div class="form-label">
                  <span class="label-dot"></span>
                  <span>{{ $t('settings.sendAutoTranslate') }}</span>
                </div>
                <div class="form-desc">{{ $t('settings.sendAutoTranslateDesc') }}</div>
              </div>
              <el-switch v-model="config.sendAutoTranslate" @change="handleSendAutoTranslate" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
            </div>

            <div class="form-row" v-if="config.sendAutoTranslate">
              <div class="form-col">
                <div class="form-label">{{ $t('settings.channel') }}</div>
                <el-select v-model="config.sendChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                  <el-option :label="$t('settings.baidu')" value="Baidu" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.targetLang') }}</div>
                <el-select v-model="config.sendTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
            </div>

            <div class="form-item" v-if="!config.sendAutoTranslate">
              <div class="form-item-left">
                <div class="form-label">{{ $t('settings.sendMsgSettings') }}</div>
                <div class="form-desc">{{ $t('settings.sendMsgSettingsDesc') }}</div>
              </div>
              <el-switch v-model="config.sendAutoNotTranslate" @change="handlesendAutoNotTranslate" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
            </div>

            <div class="form-row" v-if="!config.sendAutoTranslate">
              <div class="form-col">
                <div class="form-label">{{ $t('settings.channel') }}</div>
                <el-select v-model="config.sendColoseChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                  <el-option :label="$t('settings.baidu')" value="Baidu" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.sourceLang') }}</div>
                <el-select v-model="config.sendAutoNotSourceLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.targetLang') }}</div>
                <el-select v-model="config.sendAutoNotTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
            </div>

            <div class="form-item">
              <div class="form-item-left">
                <div class="form-label">{{ $t('settings.translatePreview') }}</div>
                <div class="form-desc">{{ $t('settings.translatePreviewDesc') }}</div>
              </div>
              <el-switch v-model="config.translatePreview" @change="handleTranslatePreview" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
            </div>

            <div class="form-item">
              <div class="form-item-left">
                <div class="form-label">{{ $t('settings.blockChinese') }}</div>
                <div class="form-desc">{{ $t('settings.blockChineseDesc') }}</div>
              </div>
              <el-switch v-model="config.blockChineseMessage" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
            </div>

            <div class="form-item">
              <div class="form-item-left">
                <div class="form-label">{{ $t('settings.blockChineseTrans') }}</div>
                <div class="form-desc">{{ $t('settings.blockChineseTransDesc') }}</div>
              </div>
              <el-switch v-model="config.blockChineseTranslation" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
            </div>

            <div class="form-item form-none">
              <div class="form-item-left">
                <div class="form-label"><span class="label-dot"></span>{{ $t('settings.voiceSendSettings') }}</div>
                <div class="form-desc">{{ $t('settings.voiceTransDesc') }}</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-col">
                <div class="form-label">{{ $t('settings.channel') }}</div>
                <el-select v-model="config.sendVoiceChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                  <el-option :label="$t('settings.baidu')" value="Baidu" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.voiceSourceLang') }}</div>
                <el-select v-model="config.sendVoiceSourceLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.voiceTargetLang') }}</div>
                <el-select v-model="config.sendVoiceTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
            </div>
          </div>
        </div>

        <!-- 消息接收设置 -->
        <div class="config-section">
          <div class="section-header" @click="toggleSection('receive')">
            <span class="section-title">{{ $t('settings.receiveSettings') }}</span>
            <span class="section-tag">{{ expandedSections.receive ? $t('settings.collapse') : $t('settings.expand') }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.receive">
            <div class="form-item">
              <div class="form-item-left">
                <div class="form-label">
                  <span class="label-dot"></span>
                  <span>{{ $t('settings.receiveAutoTranslate') }}</span>
                </div>
                <div class="form-desc">{{ $t('settings.receiveAutoTranslateDesc') }}</div>
              </div>
              <el-switch v-model="config.receiveAutoTranslate" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
            </div>

            <div class="form-row">
              <div class="form-col">
                <div class="form-label">{{ $t('settings.channel') }}</div>
                <el-select v-model="config.receiveChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                  <el-option :label="$t('settings.baidu')" value="Baidu" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.targetLang') }}</div>
                <el-select v-model="config.receiveTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
            </div>

            <div class="form-item form-none">
              <div class="form-item-left">
                <div class="form-label"><span class="label-dot"></span>{{ $t('settings.voiceReceiveSettings') }}</div>
                <div class="form-desc">{{ $t('settings.voiceTransDesc') }}</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-col">
                <div class="form-label">{{ $t('settings.channel') }}</div>
                <el-select v-model="config.receiveVoiceChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                  <el-option :label="$t('settings.baidu')" value="Baidu" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.voiceSourceLang') }}</div>
                <el-select v-model="config.receiveVoiceSourceLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
              <div class="form-col">
                <div class="form-label">{{ $t('settings.voiceTargetLang') }}</div>
                <el-select v-model="config.receiveVoiceTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                  <el-option v-for="lang in languageList" :key="lang.id" :label="lang.displayName" :value="lang.code" />
                </el-select>
              </div>
            </div>
          </div>
        </div>

        <!-- 聊天列表翻译 -->
        <div class="config-section">
          <div class="section-header" @click="toggleSection('chatList')">
            <span class="section-title">{{ $t('settings.chatListSettings') }}</span>
            <span class="section-tag">{{ expandedSections.chatList ? $t('settings.collapse') : $t('settings.expand') }}</span>
          </div>
          <div class="section-content" v-show="expandedSections.chatList">
            <div class="form-item">
              <div class="form-item-left">
                <div class="form-label">{{ $t('settings.showTranslateConfig') }}</div>
                <div class="form-desc">{{ $t('settings.showTranslateConfigDesc') }}</div>
              </div>
              <el-switch v-model="config.showTranslateConfig" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
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
import { get } from "@/utils/request"
import { ipc } from '@/utils/ipcRenderer'

const { t } = useI18n()
const router = useRouter()
const expandedSections = reactive({
  send: true,
  receive: true,
  chatList: true
})

const config = reactive({
  sendAutoTranslate: true,
  sendChannel: 'Baidu',
  sendTargetLang: 'en',
  translatePreview: false,
  blockChineseMessage: false,
  blockChineseTranslation: true,
  receiveAutoTranslate: true,
  receiveChannel: 'Baidu',
  receiveTargetLang: 'zh',
  sendAutoNotTranslate: false,
  sendAutoNotSourceLang: 'en',
  sendAutoNotTargetLang: 'zh',
  sendColoseChannel: 'Baidu',
  sendVoiceSourceLang: 'zh',
  sendVoiceTargetLang: 'en',
  sendVoiceChannel: 'Baidu',
  receiveVoiceSourceLang: 'en',
  receiveVoiceTargetLang: 'zh',
  receiveVoiceChannel: 'Baidu',
  showTranslateConfig: true
})

const languageList = ref([])

const fetchLanguageList = () => {
  get('/app/languageList/languageList').then(res => {
    if (res.code === 200) {
      languageList.value = res.data
    }
  }).catch(error => {
    console.error('获取语言列表失败:', error)
  })
}

const toggleSection = (section) => {
  expandedSections[section] = !expandedSections[section]
}

const handleSendAutoTranslate = (val) => {
  if (val) {
    config.sendAutoNotTranslate = false
    // 互斥逻辑：开启自动翻译时，关闭 AI 回复
    ipc.invoke('get-ai-config').then(aiRes => {
      if (aiRes && aiRes.whatsapp) {
        aiRes.whatsapp.aiReplyToggle = false
        ipc.invoke('save-ai-config', JSON.parse(JSON.stringify(aiRes))).then(res => {
          console.log('互斥逻辑：已自动关闭 AI 回复开关', res)
        })
      }
    })
  } else {
    config.sendAutoNotTranslate = true
  }
}

const handlesendAutoNotTranslate = (val) => {}

const handleTranslatePreview = (val) => {
  if (val) {
    config.sendAutoTranslate = true
  }
}

const applyConfig = () => {
  localStorage.setItem('translateConfig', JSON.stringify(config))
  ipc.invoke('save-translate-config', JSON.parse(JSON.stringify(config))).then(res => {
    console.log('配置已同步到主进程:', res)
  })
  
  Notification.message({ message: t('settings.updateSuccess'), type: 'success' })
  
  setTimeout(() => {
    router.push({ path: '/home/whatsapp', query: { refresh: 'true' } })
  }, 1000)
}

onMounted(() => {
  fetchLanguageList()
  ipc.invoke('get-translate-config').then(res => {
    if (res) {
      Object.assign(config, res)
    } else {
      const localConfig = localStorage.getItem('translateConfig')
      if (localConfig) {
        Object.assign(config, JSON.parse(localConfig))
      }
    }
  })
})
</script>

<style scoped>
/* 这里应当包含原有 TranslateSettings.vue 中相关的样式 */
/* 为了复用，建议在父组件中保留通用样式，或者在此处重复定义 */
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

.form-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  flex-wrap: wrap;
}

.form-none {
  border: none;
}

.form-item-left {
  display: flex;
  flex-direction: column;
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

.label-dot {
  width: 6px;
  height: 6px;
  background: #52c41a;
  border-radius: 50%;
}

.form-desc {
  font-size: 12px;
  color: #8c8c8c;
  width: 100%;
  margin-top: 4px;
  text-align: left;
}

.form-row {
  display: flex;
  gap: 20px;
  padding: 12px 0;
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
