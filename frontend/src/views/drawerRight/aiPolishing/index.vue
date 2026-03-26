<script setup>
import { ref, onMounted, watch } from 'vue';
import { 
  MagicStick, 
  Setting, 
  Refresh, 
  CopyDocument, 
  Promotion,
  Check
} from '@element-plus/icons-vue';
import { ipc } from '@/utils/ipcRenderer';
import { post, get } from "@/utils/request";
import Notification from "@/utils/notification";

const props = defineProps({
  chatId: {
    type: String,
    required: true
  },
  initialText: {
    type: String,
    default: ''
  }
});

const activeTab = ref('polish');
const originalText = ref(props.initialText);
const polishedText = ref('');
const translatedText = ref('');
const isLoading = ref(false);
const isTranslationEnabled = ref(false);

const dictTone = ref([]);
const dictTheme = ref([]);
const dictRole = ref([]);

const config = ref({
  enabled: false,
  tone: '',
  theme: '',
  role: '',
  toneName: '默认',
  themeName: '默认',
  roleName: '默认'
});

const globalConfig = ref({
  toneName: '默认',
  themeName: '默认',
  roleName: '默认'
});

onMounted(async () => {
  await fetchDicts();
  await loadSessionConfig();
  await fetchGlobalConfig();
  if (originalText.value) {
    handlePolish();
  }
});

// 监听文本变化（当从外部触发且抽屉已打开时）
watch(() => props.initialText, (newVal) => {
  if (newVal) {
    originalText.value = newVal;
    handlePolish();
  }
});

async function fetchDicts() {
  const toneRes = await ipc.invoke('controller.window.getDictData', 'box_agent_tone');
  if (toneRes && toneRes.code === 200) dictTone.value = toneRes.data;
  
  const themeRes = await ipc.invoke('controller.window.getDictData', 'box_agent_theme');
  if (themeRes && themeRes.code === 200) dictTheme.value = themeRes.data;
  
  const roleRes = await ipc.invoke('controller.window.getDictData', 'box_agent_role');
  if (roleRes && roleRes.code === 200) dictRole.value = roleRes.data;
}

async function loadSessionConfig() {
  // 从数据库获取当前会话配置
  const cached = await ipc.invoke('controller.window.getSessionConfig', props.chatId);
  if (cached) {
    config.value = { ...config.value, ...cached };
  }
}

async function fetchGlobalConfig() {
  // 获取全局配置
  try {
    const res = await get('/app/agent/config');
    if (res && res.code === 200 && res.data) {
      globalConfig.value = {
        toneName: res.data.toneName || '默认',
        themeName: res.data.themeName || '默认',
        roleName: res.data.roleName || '默认'
      };
    }
  } catch (e) {
    console.error('获取全局配置失败', e);
  }
}

async function saveConfig() {
  // 更新名称
  const tone = dictTone.value.find(i => i.dictValue === config.value.tone);
  if (tone) config.value.toneName = tone.dictLabel;
  
  const theme = dictTheme.value.find(i => i.dictValue === config.value.theme);
  if (theme) config.value.themeName = theme.dictLabel;
  
  const role = dictRole.value.find(i => i.dictValue === config.value.role);
  if (role) config.value.roleName = role.dictLabel;

  await ipc.invoke('controller.window.saveSessionConfig', { chatId: props.chatId, config: config.value });
  Notification.message({ message: '配置已保存', type: 'success' });
  
  // 通知 WhatsApp 注入脚本更新
  ipc.sendToWv(props.chatId, 'sync-ai-config', config.value);
}

async function handlePolish() {
  if (!originalText.value) return;
  isLoading.value = true;
  polishedText.value = '';
  translatedText.value = '';

  try {
    const params = {
      content: originalText.value,
      tone: config.value.enabled ? config.value.tone : undefined,
      theme: config.value.enabled ? config.value.theme : undefined,
      role: config.value.enabled ? config.value.role : undefined,
    };

    const res = await post('/app/agentChat', params);
    if (res && res.code === 200) {
      polishedText.value = res.data;
      if (isTranslationEnabled.value) {
        handleTranslate();
      }
    }
  } catch (e) {
    Notification.message({ message: '润色失败：' + e.message, type: 'error' });
  } finally {
    isLoading.value = false;
  }
}

async function handleTranslate() {
  if (!polishedText.value) return;
  try {
    const res = await post('/app/agent/translate', { text: polishedText.value, target: 'zh' });
    if (res && res.code === 200) {
      translatedText.value = res.data;
    }
  } catch (e) {
    console.error('翻译失败', e);
  }
}

function applyToDraft() {
  ipc.sendToWv(props.chatId, 'apply-polish-to-draft', polishedText.value);
  Notification.message({ message: '已应用至草稿', type: 'success' });
}

function sendImmediate() {
  ipc.sendToWv(props.chatId, 'send-polished-message', polishedText.value);
  Notification.message({ message: '已发送消息', type: 'success' });
}

function copyResult() {
  navigator.clipboard.writeText(polishedText.value);
  Notification.message({ message: '已复制到剪贴板', type: 'success' });
}

</script>

<template>
  <div class="ai-polish-container">
    <el-tabs v-model="activeTab" class="custom-tabs">
      <el-tab-pane name="polish">
        <template #label>
          <div class="tab-label">
            <el-icon><MagicStick /></el-icon>
            <span>AI润色</span>
          </div>
        </template>
        
        <div class="polish-content">
          <div class="section-card">
            <div class="section-title">原文内容</div>
            <el-input
              v-model="originalText"
              type="textarea"
              :rows="4"
              placeholder="请输入需要润色的回复内容..."
              resize="none"
            />
            <div class="section-actions">
              <el-button type="primary" :loading="isLoading" @click="handlePolish" round>
                开始润色
              </el-button>
            </div>
          </div>

          <div class="section-card result-card" v-loading="isLoading">
            <div class="section-title">
              <span>润色建议</span>
              <div class="title-right">
                <span class="sub-label">翻译为中文</span>
                <el-switch v-model="isTranslationEnabled" size="small" @change="handleTranslate" />
              </div>
            </div>
            
            <div class="result-box">
              <div v-if="polishedText" class="text-content">
                {{ polishedText }}
              </div>
              <div v-if="translatedText" class="translation-content">
                {{ translatedText }}
              </div>
              <el-empty v-if="!polishedText && !isLoading" description="暂无建议" :image-size="60" />
            </div>

            <div class="result-actions" v-if="polishedText">
              <el-button-group>
                <el-button :icon="CopyDocument" @click="copyResult">复制</el-button>
                <el-button type="success" :icon="Check" @click="applyToDraft">填入草稿</el-button>
                <el-button type="primary" :icon="Promotion" @click="sendImmediate">直接发送</el-button>
              </el-button-group>
            </div>
          </div>

          <div class="config-summary">
            <div class="summary-item">
              <span class="label">当前风格:</span>
              <el-tag size="small" type="info" effect="plain">
                {{ config.enabled ? config.toneName : globalConfig.toneName }}
              </el-tag>
              <el-tag size="small" type="info" effect="plain">
                {{ config.enabled ? config.themeName : globalConfig.themeName }}
              </el-tag>
              <el-tag size="small" type="info" effect="plain">
                {{ config.enabled ? config.roleName : globalConfig.roleName }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="settings">
        <template #label>
          <div class="tab-label">
            <el-icon><Setting /></el-icon>
            <span>AI设置</span>
          </div>
        </template>

        <div class="settings-content">
          <div class="section-card">
            <div class="setting-item-row">
              <div class="setting-info">
                <div class="main-label">开启独立AI配置</div>
                <div class="sub-label">仅对当前会话生效，关闭则使用全局配置</div>
              </div>
              <el-switch v-model="config.enabled" @change="saveConfig" />
            </div>
          </div>

          <transition name="fade">
            <div v-if="config.enabled" class="section-card">
              <div class="form-item">
                <div class="form-label">回复语调</div>
                <el-select v-model="config.tone" placeholder="选择语调" @change="saveConfig" style="width: 100%">
                  <el-option
                    v-for="item in dictTone"
                    :key="item.dictValue"
                    :label="item.dictLabel"
                    :value="item.dictValue"
                  />
                </el-select>
              </div>

              <div class="form-item">
                <div class="form-label">回复主题</div>
                <el-select v-model="config.theme" placeholder="选择主题" @change="saveConfig" style="width: 100%">
                  <el-option
                    v-for="item in dictTheme"
                    :key="item.dictValue"
                    :label="item.dictLabel"
                    :value="item.dictValue"
                  />
                </el-select>
              </div>

              <div class="form-item">
                <div class="form-label">回复角色</div>
                <el-select v-model="config.role" placeholder="选择角色" @change="saveConfig" style="width: 100%">
                  <el-option
                    v-for="item in dictRole"
                    :key="item.dictValue"
                    :label="item.dictLabel"
                    :value="item.dictValue"
                  />
                </el-select>
              </div>
            </div>
          </transition>
          
          <div v-if="!config.enabled" class="global-preview">
            <div class="section-title">全局配置预览</div>
            <div class="info-grid">
              <div class="info-item"><span class="label">语调:</span> {{ globalConfig.toneName }}</div>
              <div class="info-item"><span class="label">主题:</span> {{ globalConfig.themeName }}</div>
              <div class="info-item"><span class="label">角色:</span> {{ globalConfig.roleName }}</div>
            </div>
            <div class="hint">如需修改，请前往“系统设置-AI回复设置”或开启上方独立配置</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.ai-polish-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.custom-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 16px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
}

.polish-content, .settings-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.result-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-box {
  flex: 1;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 12px;
  min-height: 120px;
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
}

.translation-content {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #cbd5e1;
  color: #64748b;
  font-size: 13px;
}

.result-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.config-summary {
  margin-top: auto;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.setting-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.main-label {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.sub-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.form-item {
  margin-bottom: 16px;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 13px;
  color: #475569;
  margin-bottom: 6px;
}

.global-preview {
  padding: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 8px;
}

.info-item {
  font-size: 12px;
  color: #475569;
  background: #fff;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.info-item .label {
  color: #94a3b8;
  display: block;
  margin-bottom: 2px;
}

.hint {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 12px;
  font-style: italic;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
