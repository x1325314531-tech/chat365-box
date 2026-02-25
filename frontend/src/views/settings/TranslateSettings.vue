<template>
  <div class="settings-page">
    <!-- 顶部标题 -->
    <div class="settings-header">
      <span class="header-title">{{ $t('settings.title') }}</span>
    </div>

    <div class="settings-content">
      <!-- 左侧导航菜单 -->
      <div class="settings-sidebar">
        <div 
          v-for="item in sidebarMenus" 
          :key="item.id"
          class="sidebar-item"
          :class="{ active: activeMenu === item.id }"
          @click="activeMenu = item.id"
        >
          <img :src="item.icon" class="sidebar-icon" />
          <span>{{ item.title }}</span>
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div class="settings-main">
        <!-- 翻译配置 -->
        <div v-if="activeMenu === 'translate'" class="translate-config">
          <div class="config-header">
            <h3>{{ $t('settings.translateConfig') }}</h3>
            <p class="config-desc">{{ $t('settings.globalConfigDesc') }}</p>
          </div>

          <div class="config-body">
            <!-- 左侧平台列表 -->
            <div class="platform-list">
              <div class="platform-title">{{ $t('settings.translateConfig') }}</div>
              <div 
                class="platform-item active"
              >
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
                    <el-switch v-model="config.sendAutoTranslate"  @change="handleSendAutoTranslate" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf"  />
                  </div>

                  <div class="form-row" v-if="config.sendAutoTranslate ">
                    <div class="form-col" >
                      <div class="form-label">{{ $t('settings.channel') }}</div>
                      <el-select v-model="config.sendChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                        <el-option :label="$t('settings.baidu')" value="Baidu"  />
                      </el-select>
                    </div>
                    <div class="form-col">
                      <div class="form-label">{{ $t('settings.targetLang') }}</div>
                      <el-select v-model="config.sendTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                  </div>
                  <div class="form-item" v-if="!config.sendAutoTranslate">
                   
                    <div class="form-item-left">
                    <div class="form-label">{{ $t('settings.sendMsgSettings') }}</div>
                    <div class="form-desc">{{ $t('settings.sendMsgSettingsDesc') }}</div>
                    <!-- <div class="form-desc">发送时是否输入区显示文案预览</div> -->
                    </div>
                    <el-switch v-model="config.sendAutoNotTranslate"  @change="handlesendAutoNotTranslate" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf"/>
                  
                  </div> 
                  <div class="form-row" v-if="!config.sendAutoTranslate ">
                    <div class="form-col" >
                      <div class="form-label">{{ $t('settings.channel') }}</div>
                      <el-select v-model="config.sendColoseChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                        <el-option :label="$t('settings.baidu')" value="Baidu"  />
                      </el-select>
                    </div>
                     <div class="form-col">
                      <div class="form-label">{{ $t('settings.sourceLang') }}</div>
                      <el-select v-model="config.sendAutoNotSourceLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                    <div class="form-col">
                      <div class="form-label">{{ $t('settings.targetLang') }}</div>
                      <el-select v-model="config.sendAutoNotTargetlseLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                  </div>
                  
                  <div class="form-item">
                    <div class="form-item-left">
                    <div class="form-label">{{ $t('settings.translatePreview') }}</div>
                    <div class="form-desc">{{ $t('settings.translatePreviewDesc') }}</div>
                    <!-- <div class="form-desc">发送时是否输入区显示文案预览</div> -->
                    </div>
                    <el-switch v-model="config.translatePreview"  @change="handleTranslatePreview" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf"/>
                  </div>

                  <div class="form-item">
                    <div  class="form-item-left">
                    <div class="form-label">{{ $t('settings.blockChinese') }}</div>
                    <div class="form-desc">{{ $t('settings.blockChineseDesc') }}</div>
                    </div>
                    <el-switch v-model="config.blockChineseMessage" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
                  </div>

                  <div class="form-item">
                      <div  class="form-item-left">
                    <div class="form-label">{{ $t('settings.blockChineseTrans') }}</div>
                    <div class="form-desc">{{ $t('settings.blockChineseTransDesc') }}</div>
                    </div>
                    <el-switch v-model="config.blockChineseTranslation" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
                  </div>
                    <div class="form-item form-none">                  
                    <div class="form-item-left">
                    <div class="form-label">  <span class="label-dot"></span>{{ $t('settings.voiceSendSettings') }}</div>
                    <div class="form-desc">{{ $t('settings.voiceTransDesc') }}</div>
                    <!-- <div class="form-desc">发送时是否输入区显示文案预览</div> -->
                    </div>
                  </div> 
                      <div class="form-row" >
                    <div class="form-col" >
                      <div class="form-label">{{ $t('settings.channel') }}</div>
                      <el-select v-model="config.sendVoiceChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                        <el-option :label="$t('settings.baidu')" value="Baidu"  />
                      </el-select>
                    </div>
                     <div class="form-col">
                      <div class="form-label">{{ $t('settings.voiceSourceLang') }}</div>
                      <el-select v-model="config.sendVoiceSourceLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                    <div class="form-col">
                      <div class="form-label">{{ $t('settings.voiceTargetLang') }}</div>
                      <el-select v-model="config.sendVoiceTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
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
                    <div  class="form-item-left">
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
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                  </div>
                     <div class="form-item form-none">                  
                    <div class="form-item-left">
                    <div class="form-label">  <span class="label-dot"></span>{{ $t('settings.voiceReceiveSettings') }}</div>
                    <div class="form-desc">{{ $t('settings.voiceTransDesc') }}</div>
                    <!-- <div class="form-desc">发送时是否输入区显示文案预览</div> -->
                    </div>
                  </div> 
                      <div class="form-row" >
                    <div class="form-col" >
                      <div class="form-label">{{ $t('settings.channel') }}</div>
                      <el-select v-model="config.receiveVoiceChannel" disabled :placeholder="$t('settings.selectPlaceholder')">
                        <el-option :label="$t('settings.baidu')" value="Baidu"  />
                      </el-select>
                    </div>
                     <div class="form-col">
                      <div class="form-label">{{ $t('settings.voiceSourceLang') }}</div>
                      <el-select v-model="config.receiveVoiceSourceLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                    <div class="form-col">
                      <div class="form-label">{{ $t('settings.voiceTargetLang') }}</div>
                      <el-select v-model="config.receiveVoiceTargetLang" :placeholder="$t('settings.selectPlaceholder')">
                        <el-option
                          v-for="lang in languageList"
                          :key="lang.id"
                          :label="lang.displayName"
                          :value="lang.code"
                        />
                      </el-select>
                    </div>
                  </div>
                  <!-- <div class="form-item">
                     <div  class="form-item-left">
                    <div class="form-label">手动翻译</div>
                    <div class="form-desc">允许点文字、复制可手动翻译按钮不显示</div>
                    </div>
                    <el-switch v-model="config.manualTranslate" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
                  </div> -->
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
                      <div  class="form-item-left">
                    <div class="form-label">{{ $t('settings.showTranslateConfig') }}</div>
                    <div class="form-desc">{{ $t('settings.showTranslateConfigDesc') }}</div>
                    </div>
                    <el-switch v-model="config.showTranslateConfig" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
                  </div>

                  <!-- <div class="form-item">
                    <div class="form-item-left">
                    <div class="form-label">WhatsApp消息显示来源平台</div>
                    <div class="form-desc">消息旁边显示发送的平台（Windows、Mac、iPhone、Android）</div>
                    </div>
                    <el-switch v-model="config.showSourcePlatform" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
                  </div> -->
                </div>
              </div>

              <!-- 智能转发设置 -->
              <!-- <div class="config-section" >
                <div class="section-header" @click="toggleSection('forward')">
                  <span class="section-title">群聊特定设置</span>
                  <span class="section-tag">{{ expandedSections.forward ? '折叠' : '展开' }}</span>
                </div>
                <div class="section-content" v-show="expandedSections.forward" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf">
                  <div class="form-item">
                     <div class="form-item-left">
                    <div class="form-label">群聊消息自动翻译</div>
                    <div class="form-desc">在群聊中启用/禁用自动翻译功能</div>
                    </div>
                    <el-switch v-model="config.groupAutoTranslate"  style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" />
                  </div>
                </div>
              </div> -->

              <!-- 应用按钮 -->
              <div class="form-actions">
                <el-button type="primary" class="apply-btn" @click="applyConfig">{{ $t('settings.apply') }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Notification from "@/utils/notification";
import { get } from "@/utils/request";
import { ipc } from '@/utils/ipcRenderer';
// 导入图标
import translateIcon from '@/assets/svgs/translate.svg'
import aiReplyIcon from '@/assets/svgs/ai-reply.svg'
import materialIcon from '@/assets/svgs/material.svg'
import platformIcon from '@/assets/svgs/platform.svg'

const router = useRouter()
const { t } = useI18n()

// 左侧导航菜单
const sidebarMenus = ref([
  { id: 'translate', title: t('settings.translateSettings'), icon: translateIcon },
  // { id: 'aiReply', title: 'AI回复设置', icon: aiReplyIcon },
  // { id: 'material', title: '个人素材', icon: materialIcon },
  // { id: 'display', title: '显示设置', icon: platformIcon },
  // { id: 'platform', title: '平台设置', icon: platformIcon },
])

const activeMenu = ref('translate')

// 展开的section
const expandedSections = reactive({
  send: true,
  receive: true,
  chatList: true,
  forward: true
})

// 翻译配置
const config = reactive({
  // 发送设置
  sendAutoTranslate: true,
  sendChannel: 'Baidu',
  sendTargetLang: 'en',
  translatePreview: false,
  blockChineseMessage: false,
  blockChineseTranslation: true,
  // 接收设置
  receiveAutoTranslate: true,
  receiveChannel: 'Baidu',
  receiveTargetLang: 'zh',
  sendAutoNotTranslate:false,
  sendAutoNotSourceLang:'en',
  sendAutoNotTargetLang:'zh',
  sendColoseChannel:'Baidu',
  sendVoiceSourceLang:'zh',
  sendVoiceTargetLang:'en',
  sendVoiceChannel:'Baidu',
  receiveVoiceSourceLang:'en',
  receiveVoiceTargetLang:'zh',
  receiveVoiceChannel:'Baidu',
  // manualTranslate: true,
  // 聊天列表
  showTranslateConfig: true,
  // showSourcePlatform: false,
  // 智能转发
  // groupAutoTranslate: false
})

// 语言列表
const languageList = ref([])

// 获取语言列表
const fetchLanguageList = () => {
  get('/app/languageList/languageList').then(res => {
    if (res.code === 200) {
      languageList.value = res.data
    }
  }).catch(error => {
    console.error('获取语言列表失败:', error)
  })
}
 
onMounted(() => {
  fetchLanguageList()
  // 从主进程加载保存的配置
  ipc.invoke('get-translate-config').then(res => {
    if (res) {
      Object.assign(config, res)
    } else {
      // 兼容旧的 localStorage 方案
      const localConfig = localStorage.getItem('translateConfig')
      if (localConfig) {
        Object.assign(config, JSON.parse(localConfig))
      }
    }
  })
})

// 切换section展开
const toggleSection = (section) => {
  expandedSections[section] = !expandedSections[section]
}
//发送自动消息
const handleSendAutoTranslate= (val) =>{ 
  if(!val) { 
    config.sendAutoNotTranslate =  true
  }
}
const handlesendAutoNotTranslate = (val) =>{

}
//消息预览
const handleTranslatePreview = (val) => {
  // val 是 translatePreview 的最新值
  // 如果开启了“翻译预览”，通常也需要同时开启“发送自动翻译”
  if (val) {
    config.sendAutoTranslate = true
  }
}
// 应用配置
const applyConfig = () => {
  console.log('翻译配置config',config);
  
  // 保存配置到localStorage
  localStorage.setItem('translateConfig', JSON.stringify(config)) 
  // 保存配置到electron
  ipc.invoke('save-translate-config', JSON.parse(JSON.stringify(config))).then(res => {
    console.log('配置已同步到主进程:', res);
  });
 //更新成功提示
  Notification.message({ message: t('settings.updateSuccess'), type: 'success' });
  // 返回首页W
  // router.push('/home')
}
</script>

<style scoped>
.settings-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.settings-header {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  text-align: left;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #262626;
}

.settings-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 160px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  padding: 16px 0;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  cursor: pointer;
  color: #595959;
  font-size: 14px;
  transition: all 0.2s;
}

.sidebar-item:hover {
  background: #f5f5f5;
}

.sidebar-item.active {
  background: #e6f7e6;
  color: #52c41a;
  border-left: 3px solid #52c41a;
}

.sidebar-icon {
  width: 20px;
  height: 20px;
}

.settings-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

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

.platform-item:hover {
  background: #f5f5f5;
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
  /* flex: 1; */
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
  background:#f0fff3;
  cursor: pointer;
  position: relative;
}
.section-header::before { 
 content: '';
 position: absolute;
 left: 0;
 top:0;
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

.section-tag.paid {
  color: #fa8c16;
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
.form-item:last-child {
  border-bottom: none;
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
  margin-top: 20px;
  padding: 20px 0;
  background: #fff;
  position: sticky;
  bottom: -20px; /* 抵消 settings-main 的 padding-bottom */
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

.apply-btn:hover {
  background: #2ed36a;
  border-color: #2ed36a;
  opacity: 0.8;
}
</style>
