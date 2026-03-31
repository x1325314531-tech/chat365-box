<script setup>
import { computed, onMounted, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ipc } from '@/utils/ipcRenderer';
import { post } from '@/utils/request';
import Notification from '@/utils/notification';

const props = defineProps({
  chatId: {
    type: String,
    required: true
  },
  conversationId: {
    type: String,
    default: ''
  },
  initialText: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();
const emit = defineEmits(['close']);
const activeTab = ref('polish');
const originalText = ref(props.initialText);
const polishedText = ref('');
const translatedText = ref('');
const isLoading = ref(false);
const isTranslationEnabled = ref(false);

const dictTone = ref([]);
const dictTheme = ref([]);
const dictRole = ref([]);

const defaultLocalConfig = {
  enabled: false,
  tone: '',
  theme: '',
  role: '',
  toneName: t('aiPolish.default'),
  themeName: t('aiPolish.default'),
  roleName: t('aiPolish.default'),
  historyCount: 3
};

const historyOptions = computed(() => [
  { label: t('aiPolish.historyCount', { n: 3 }), value: 3 },
  { label: t('aiPolish.historyCount', { n: 5 }), value: 5 },
  { label: t('aiPolish.historyCount', { n: 10 }), value: 10 }
]);

const config = ref({
  ...defaultLocalConfig
});

const sessionConfigKey = computed(() => {
  const cardId = String(props.chatId || '').trim();
  const cid = String(props.conversationId || '').trim();
  return cid ? `${cardId}::${cid}` : cardId;
});

const globalConfig = ref({
  tone: 'default',
  theme: 'default',
  role: 'default',
  model: 'Gemini',
  historyCount: 3,
  toneName: t('aiPolish.default'),
  themeName: t('aiPolish.default'),
  roleName: t('aiPolish.default')
});

const translateConfig = ref({
  sendTargetLang: 'zh'
});

const toneDisplayName = computed(() => {
  return config.value.enabled
    ? (config.value.toneName || t('aiPolish.default'))
    : (globalConfig.value.toneName || t('aiPolish.default'));
});

const themeDisplayName = computed(() => {
  return config.value.enabled
    ? (config.value.themeName || t('aiPolish.default'))
    : (globalConfig.value.themeName || t('aiPolish.default'));
});

const roleDisplayName = computed(() => {
  return config.value.enabled
    ? (config.value.roleName || t('aiPolish.default'))
    : (globalConfig.value.roleName || t('aiPolish.default'));
});


const hasActiveConversation = computed(() => {
  const cid = String(props.conversationId || '').trim();
  return !!cid && cid !== 'default' && cid !== 'null' && cid !== 'undefined';
});


onMounted(async () => {
  await fetchDicts();
  await loadGlobalAiConfig();
  await loadTranslateConfig();
  await loadSessionConfig();
  if (hasActiveConversation.value && originalText.value) {
    handlePolish();
  }
});

watch(
  () => props.initialText,
  (newVal) => {
    // 允许空值赋值以支持重置，但在有值时强制更新
    originalText.value = newVal || '';
    if (newVal && hasActiveConversation.value) {
      handlePolish();
    }
  },
  { immediate: true }
);

watch(
  () => hasActiveConversation.value,
  (available) => {
    // 如果没有活跃会话，且原本就没内容，则才执行清空，防止在同步期间误伤
    if (!available && !props.initialText) {
      originalText.value = '';
      polishedText.value = '';
      translatedText.value = '';
      isLoading.value = false;
    }
  },
  { immediate: true }
);

watch(
  () => sessionConfigKey.value,
  async () => {
    await loadSessionConfig();
  }
);

async function fetchDicts() {
  const toneRes = await ipc.invoke('controller.window.getDictData', 'box_agent_tone');
  if (toneRes && toneRes.code === 200) dictTone.value = toneRes.data;

  const themeRes = await ipc.invoke('controller.window.getDictData', 'box_agent_theme');
  if (themeRes && themeRes.code === 200) dictTheme.value = themeRes.data;

  const roleRes = await ipc.invoke('controller.window.getDictData', 'box_agent_role');
  if (roleRes && roleRes.code === 200) dictRole.value = roleRes.data;
}

async function loadSessionConfig() {
  const cached = await ipc.invoke('controller.window.getSessionConfig', sessionConfigKey.value);
  config.value = {
    ...defaultLocalConfig,
    ...(cached || {})
  };
}

async function loadGlobalAiConfig() {
  try {
    const res = await ipc.invoke('get-ai-config');
    const whatsappConfig = res?.whatsapp || res;
    if (whatsappConfig && typeof whatsappConfig === 'object') {
      globalConfig.value = {
        ...globalConfig.value,
        ...whatsappConfig,
        toneName: whatsappConfig.toneName || t('aiPolish.default'),
        themeName: whatsappConfig.themeName || t('aiPolish.default'),
        roleName: whatsappConfig.roleName || t('aiPolish.default'),
        historyCount: Number(whatsappConfig.historyCount) || 3,
        model: whatsappConfig.model || 'Gemini'
      };
    }
  } catch (e) {
    console.error('loadGlobalAiConfig failed', e);
  }
}

async function loadTranslateConfig() {
  try {
    const res = await ipc.invoke('get-translate-config');
    if (res && typeof res === 'object') {
      translateConfig.value = {
        ...translateConfig.value,
        ...res
      };
    }
  } catch (e) {
    console.error('loadTranslateConfig failed', e);
  }
}

async function saveConfig() {
  const tone = dictTone.value.find((i) => i.dictValue === config.value.tone);
  if (tone) config.value.toneName = tone.dictLabel;

  const theme = dictTheme.value.find((i) => i.dictValue === config.value.theme);
  if (theme) config.value.themeName = theme.dictLabel;

  const role = dictRole.value.find((i) => i.dictValue === config.value.role);
  if (role) config.value.roleName = role.dictLabel;

  const configPayload = JSON.parse(JSON.stringify(toRaw(config.value)));

  await ipc.invoke('controller.window.saveSessionConfig', {
    chatId: sessionConfigKey.value,
    config: configPayload
  });

  await ipc.invoke('controller.window.sendToWv', {
    chatId: props.chatId,
    channel: 'sync-ai-config',
    args: [configPayload]
  });
}

async function handlePolish() {
  if (!hasActiveConversation.value) return;
  if (!originalText.value) return;

  isLoading.value = true;
  polishedText.value = '';
  translatedText.value = '';

  try {
    const resolvedTone = config.value.enabled
      ? (config.value.tone || globalConfig.value.tone)
      : globalConfig.value.tone;
    const resolvedTheme = config.value.enabled
      ? (config.value.theme || globalConfig.value.theme)
      : globalConfig.value.theme;
    const resolvedRole = config.value.enabled
      ? (config.value.role || globalConfig.value.role)
      : globalConfig.value.role;

    const resolvedHistoryCount = config.value.enabled 
      ? (Number(config.value.historyCount) || 3) 
      : (Number(globalConfig.value.historyCount) || 3);
     console.log(' props.chatId',  props.chatId)
    const historyRes = await ipc.invoke('controller.window.getChatHistory', {
      chatId: String(props.chatId || '').trim(),
      count: resolvedHistoryCount
    });
    console.log('historyRes', historyRes)
    const history = Array.isArray(historyRes?.data)
      ? historyRes.data
      : (Array.isArray(historyRes) ? historyRes : []);

    const params = {
      content: originalText.value,
      history,
      tone: resolvedTone,
      theme: resolvedTheme,
      role: resolvedRole,
      targetLanguage: 'en',
      modelName: globalConfig.value.model || 'Gemini'
    };
console.log('params', params)
    const res = await post('/app/agentChat', params);
    if (res && res.code === 200) {
      polishedText.value = res.data || '';
      if (isTranslationEnabled.value) {
        handleTranslate();
      }
    }
  } catch (e) {
    if (!e.isHandled) {
      Notification.message({ message: `${t('aiPolish.polishFailed')}: ${e.message}`, type: 'error' });
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleTranslate() {
  if (!polishedText.value) return;
  try {
    const res = await post('/app/translate', {
      text: polishedText.value,
     targetLang: "zh",
      fromLang: "en"

    });
    if (res && res.code === 200) {
      translatedText.value = res.data;
    }
  } catch (e) {
    console.error('handleTranslate failed', e);
  }
}

async function handleTranslationToggle(enabled) {
  if (!enabled) {
    translatedText.value = '';
    return;
  }
  if (!polishedText.value) return;
  await handleTranslate();
}

async function applyToDraft() {
  if (!polishedText.value) return;

  const result = await ipc.invoke('controller.window.sendToWv', {
    chatId: props.chatId,
    channel: 'apply-polish-to-draft',
    args: [polishedText.value]
  });

  Notification.message({
    message: result?.status ? t('aiPolish.applySuccess') : t('aiPolish.applyFailed'),
    type: result?.status ? 'success' : 'error'
  });
}

async function sendImmediate() {
  if (!polishedText.value) return;

  const result = await ipc.invoke('controller.window.sendToWv', {
    chatId: props.chatId,
    channel: 'send-polished-message',
    args: [polishedText.value]
  });

  Notification.message({
    message: result?.status ? t('aiPolish.sendSuccess') : t('aiPolish.sendFailed'),
    type: result?.status ? 'success' : 'error'
  });
  originalText.value= '';
  polishedText.value = ''
}
</script>

<template>
  <div class="ai-polish-panel">
    <div v-if="hasActiveConversation">
    <div class="panel-header">
      <div class="panel-title"><span class="star">✦</span>{{ $t('aiPolish.title') }}</div>
      <button class="panel-close" type="button" @click="emit('close')">×</button>
    </div>

    <el-tabs v-model="activeTab" class="ai-tabs">
      <el-tab-pane :label="$t('aiPolish.tabPolish')" name="polish">
        <div class="content-row">
          <div class="left-col">
            <div class="block-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> {{ $t('aiPolish.original') }}</div>
            <el-input
              v-model="originalText"
              class="original-input"
              type="textarea"
              :rows="9"
              resize="none"
              :placeholder="$t('aiPolish.originalPlaceholder')"
              @blur="handlePolish"
            />
          </div>

          <div class="right-col">
            <div class="block-label suggest-label">
              <div class="suggest-label-left">
                <span class="star">✦</span>
                <span>{{ $t('aiPolish.suggestions') }}</span>
              </div>
              <div class="suggest-tools">
                <span class="translate-text">{{ $t('aiPolish.translateToZh') }}</span>
                <el-switch
                  v-model="isTranslationEnabled"
                  class="translate-switch"
                  style="--el-switch-on-color: #22C55E; --el-switch-off-color: #bfbfbf"
                  @change="handleTranslationToggle"
                />
              </div>
            </div>
            <div class="suggestion-box" :class="{ 'is-empty': !isLoading && !polishedText }" v-loading="isLoading">
              <template v-if="polishedText">
                <div class="suggestion-text">{{ polishedText }}</div>
                <div v-if="translatedText" class="translation-text">{{ translatedText }}</div>
              </template>
              <div v-else class="suggestion-empty">
                <div class="empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3L13.9 8.1L19 10L13.9 11.9L12 17L10.1 11.9L5 10L10.1 8.1L12 3Z" fill="currentColor" />
                  </svg>
                </div>
                <div class="empty-title">{{ $t('aiPolish.noSuggestions') }}</div>
                <div class="empty-tip">{{ $t('aiPolish.noSuggestionsDesc') }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="style-panel">
          <div class="style-title">{{ $t('aiPolish.replyStyle') }}</div>

          <div class="style-inline-row">
            <div class="style-item">
              <span class="style-name">{{ $t('aiPolish.tone') }}</span>
              <el-tag class="style-tag" round>{{ toneDisplayName }}</el-tag>
            </div>
            <div class="style-item">
              <span class="style-name">{{ $t('aiPolish.theme') }}</span>
              <el-tag class="style-tag" round>{{ themeDisplayName }}</el-tag>
            </div>
            <div class="style-item">
              <span class="style-name">{{ $t('aiPolish.role') }}</span>
              <el-tag class="style-tag" round>{{ roleDisplayName }}</el-tag>
            </div>
          </div>
        </div>

        <div class="bottom-actions">
          <el-button class="action-btn  action-primary" :disabled="!polishedText" @click="sendImmediate">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            {{ $t('aiPolish.sendChat') }}
          </el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="$t('aiPolish.tabSettings')" name="settings">
        <div class="settings-wrap">
          <div class="setting-row">
            <div class="setting-label">
              <div class="main-label">{{ $t('aiPolish.enableSessionConfig') }}</div>
              <div class="sub-label">{{ $t('aiPolish.enableSessionConfigDesc') }}</div>
            </div>
            <el-switch v-model="config.enabled" style="--el-switch-on-color: #2ed36a; --el-switch-off-color: #bfbfbf" @change="saveConfig" />
          </div>

          <template v-if="config.enabled">
            <div class="setting-field">
              <div class="field-label">{{ $t('aiPolish.toneLabel') }}</div>
              <el-select v-model="config.tone" :placeholder="$t('aiPolish.tonePlaceholder')" style="width: 100%" @change="saveConfig">
                <el-option
                  v-for="item in dictTone"
                  :key="item.dictValue"
                  :label="item.dictLabel"
                  :value="item.dictValue"
                />
              </el-select>
            </div>

            <div class="setting-field">
              <div class="field-label">{{ $t('aiPolish.themeLabel') }}</div>
              <el-select v-model="config.theme" :placeholder="$t('aiPolish.themePlaceholder')" style="width: 100%" @change="saveConfig">
                <el-option
                  v-for="item in dictTheme"
                  :key="item.dictValue"
                  :label="item.dictLabel"
                  :value="item.dictValue"
                />
              </el-select>
            </div>

            <div class="setting-field">
              <div class="field-label">{{ $t('aiPolish.roleLabel') }}</div>
              <el-select v-model="config.role" :placeholder="$t('aiPolish.rolePlaceholder')" style="width: 100%" @change="saveConfig">
                <el-option
                  v-for="item in dictRole"
                  :key="item.dictValue"
                  :label="item.dictLabel"
                  :value="item.dictValue"
                />
              </el-select>
            </div>

            <!-- <div class="setting-field"  style="margin-top: 14px;">
              <div class="field-label">对话上下文</div>
              <el-select v-model="config.historyCount" placeholder="选择历史条数" style="width: 100%" @change="saveConfig">
                <el-option
                  v-for="item in historyOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div> -->
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>
    </div>
    <div class="polishing-box-empty" v-else>
      <el-empty :image-size="48" :description="$t('aiPolish.noSession')" />
    </div>
  </div>
</template>

<style scoped>
.ai-polish-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #eef0ef;
  color: #2f3832;
  box-sizing: border-box;
 

}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
   background: linear-gradient(135deg, #F8FFFE 0%, #F0FAF5 100%);
    padding: 20px 22px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 20px;
  font-weight: 700;
  color: #22C55E;

}

.star {
  color: #21b35b;
  font-size: 14px;
}

.panel-close {
  border: 0;
  background: transparent;
  color: #747d77;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.panel-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.ai-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0px 22px;
}

.ai-tabs :deep(.el-tabs__header) {
  margin: 0 0 10px;
}

.ai-tabs :deep(.el-tabs__item.is-active) {
  color: #22C55E;
}

.ai-tabs :deep(.el-tabs__item:hover) {
  color: #22C55E;
}

.ai-tabs :deep(.el-tabs__active-bar) {
  background-color: #22C55E;
}

.ai-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
}

.content-row {
  display: flex;
  flex-direction: column;
}

.block-label {
  font-size: 12px;
  color: #5a635d;
  font-weight: 700;
  margin-bottom: 6px;
  text-align: left;
}

.suggest-label {
  color: #20ab59;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.suggest-label-left {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.suggest-tools {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6a756e;
}

.translate-text {
  font-size: 12px;
  font-weight: 500;
}

.translate-switch {
  transform: scale(0.9);
  transform-origin: right center;
}

.original-input :deep(.el-textarea__inner) {
  height: 168px;
  min-height: 168px;
  border: 1px solid #d4d9d6;
  border-radius: 10px;
  background: #e4e4e4;
  box-shadow: none;
  color: #3a423d;
  font-size: 14px;
}

.suggestion-box {
  height: 168px;
  border: 1px solid #71c88f;
  border-radius: 12px;
  background: linear-gradient(180deg, #edf9f1 0%, #e3efe7 100%);
  padding: 12px;
  box-sizing: border-box;
  overflow: auto;
  position: relative;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.suggestion-box.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.suggestion-box::-webkit-scrollbar {
  width: 6px;
}

.suggestion-box::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background: rgba(58, 130, 89, 0.28);
}

.suggestion-box::-webkit-scrollbar-track {
  background: transparent;
}

.suggestion-empty {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #738178;
  text-align: center;
}

.empty-icon {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #6cb686;
  background: radial-gradient(circle at 30% 30%, #ffffff 0%, #d9efdf 100%);
  border: 1px solid rgba(105, 177, 132, 0.35);
  box-shadow: 0 6px 14px rgba(83, 156, 112, 0.16);
  margin-bottom: 8px;
}

.empty-title {
  color: #5f6e65;
  font-size: 13px;
  font-weight: 600;
}

.empty-tip {
  margin-top: 4px;
  color: #7d8b83;
  font-size: 12px;
  line-height: 1.45;
  max-width: 200px;
}

.suggestion-text {
  color: #3f4a43;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
}

.translation-text {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #b9c7bc;
  color: #617068;
  font-size: 12px;
}

.style-panel {
  margin-top: 12px;
}

.style-title {
  font-size: 15px;
  color: #2b302d;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: left;
}

.style-inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 2px;
}

.style-item {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid #d7e4db;
  border-radius: 999px;
  padding: 4px 6px;
}

.style-name {
  color: #68726b;
  font-size: 10px;
  line-height: 1;
  display: flex;
  align-items: center;

}

.style-tag {
  --el-tag-bg-color: #e4f8e8;
  --el-tag-border-color: #2ec66d;
  --el-tag-text-color: #24a65a;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
}

.bottom-actions {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.action-btn {
  height: 42px;
  border-radius: 8px;
  font-size: 16px;
}

.action-primary {
  background: #22C55E;
  border-color: #22C55E;
  color: #fff;
}

.action-primary:hover,
.action-primary:focus {
  background: #1fb152;
  border-color: #1fb152;
  color: #fff;
}

.action-secondary {
  background: #f5f6f5;
  border-color: #d8ddd9;
  color: #303933;
}

.settings-wrap {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid #dde2de;
  border-radius: 10px;
  padding: 14px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.main-label {
  color: #2f3832;
  font-size: 14px;
  font-weight: 600;
}

.sub-label {
  color: #76817a;
  font-size: 12px;
  margin-top: 4px;
}

.setting-field {
  margin-bottom: 12px;
}

.setting-field:last-child {
  margin-bottom: 0;
}

.field-label {
  font-size: 13px;
  color: #59635d;
  margin-bottom: 6px;
  text-align: left;
}
.polishing-box-empty { 
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
