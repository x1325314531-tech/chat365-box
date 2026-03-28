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

      <!-- 右侧内容�?-->
      <div class="settings-main">
        <!-- 翻译配置 -->
        <TranslateConfig v-if="activeMenu === 'translate'" />
        
        <!-- AI回复设置 -->
        <AiReplyConfig v-if="activeMenu === 'aiReply'" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
// 导入组件
import TranslateConfig from './components/TranslateConfig.vue'
import AiReplyConfig from './components/AiReplyConfig.vue'
import { useRoute } from 'vue-router'
// 导入图标
import translateIcon from '@/assets/svgs/translate.svg'
import aiReplyIcon from '@/assets/svgs/ai-reply.svg'

const { t } = useI18n()
const route = useRoute()

// 左侧导航菜单
const sidebarMenus = ref([
  { id: 'translate', title: t('settings.translateSettings'), icon: translateIcon },
  { id: 'aiReply', title: t('settings.aiReplySettings'), icon: aiReplyIcon },
])

const activeMenu = ref(route.query.activeMenu || 'translate')
</script>

<style scoped>
.settings-page {
  height: 100%;
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
</style>
