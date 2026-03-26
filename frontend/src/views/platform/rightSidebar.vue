<script setup>
import { ref } from 'vue';
import { 
  Operation, 
  Rank, 
  ChatDotRound, 
  Star, 
  User, 
  ChatLineRound, 
  Fold, 
  Files 
} from '@element-plus/icons-vue';

const activeItem = ref('ai');
const emits = defineEmits(['open-drawer']);

const menuItems = [
  { id: 'expand', label: '展开', icon: Fold },
//   { id: 'proxy', label: '代理', icon: Operation },
//   { id: 'translate', label: '翻译', icon: Rank },
//   { id: 'fans', label: '粉丝', icon: Star },
//   { id: 'portrait', label: '画像', icon: User },
//   { id: 'session', label: '会话', icon: ChatLineRound },
//   { id: 'bulk', label: '群发', icon: Files },
//   { id: 'material', label: '素材', icon: ChatDotRound },
];

const handleItemClick = (id) => {
  activeItem.value = id;
  emits('open-drawer', id);
};
</script>

<template>
  <div class="right-sidebar">
    <div class="menu-container">
      <!-- Standard Menu Items -->
      <div 
        v-for="item in menuItems" 
        :key="item.id" 
        class="menu-item"
        :class="{ 'active': activeItem === item.id }"
        @click="handleItemClick(item.id)"
      >
        <div class="icon-wrapper">
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
        </div>
        <span class="label">{{ item.label }}</span>
      </div>

      <!-- AI Polish Item (Special Style) -->
      <div 
        class="menu-item ai-item"
        :class="{ 'active': activeItem === 'ai' }"
        @click="handleItemClick('ai')"
      >
        <div class="icon-wrapper ai-icon-bg">
          <div class="ai-logo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
              <path d="M21 15a2 2 0 0 1-2 2H7l4-4V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10zM9 11l-4 4V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4H7a2 2 0 0 0-2 2v6l4-4z"/>
              <text x="50%" y="65%" text-anchor="middle" font-size="8" font-weight="bold" fill="white">AI</text>
            </svg>
          </div>
        </div>
        <span class="label">AI润色</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.right-sidebar {
  width: 70px;
  height: 100%;
  background: #f8f9fa;
  border-left: 1px solid #eee;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  user-select: none;
}

.menu-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #606266;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.menu-item:hover .icon-wrapper {
  background: #e4e7ed;
  color: #303133;
}

.label {
  font-size: 12px;
  color: #606266;
  text-align: center;
}

/* AI Item Special Styling */
.ai-icon-bg {
  background: #28c05d !important;
  color: white !important;
  box-shadow: 0 4px 10px rgba(40, 192, 93, 0.2);
}

.ai-item:hover .icon-wrapper {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(40, 192, 93, 0.3);
}

.ai-item .label {
  color: #28c05d;
  font-weight: 500;
}

.ai-logo {
  display: flex;
  justify-content: center;
  align-items: center;
}

.menu-item.active .icon-wrapper {
  outline: 2px solid #28c05d;
  outline-offset: 2px;
}
</style>
