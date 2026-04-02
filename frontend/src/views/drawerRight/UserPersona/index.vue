<script setup>
import { onMounted, ref, watch, nextTick } from 'vue';
import { User, Calendar, Plus, Delete, QuestionFilled, CopyDocument } from '@element-plus/icons-vue'
import { ipc } from "@/utils/ipcRenderer";
import Notification from "@/utils/notification";
import { post, get, put } from "@/utils/request";
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  chatId: {
    type: String,
    required: true
  },
  conversationId: {
    type: String,
    default: ''
  },
  cardData: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close']);

const isEditProfile = ref(false);
const isLoading = ref(false);

const formData = ref({
  phone_number: '',
  platform: '',
  card_id: '',
  nickname: '',
  country: '',
  gender: '未知',
  notes: '',
  birthday: '',
  address: '',
  email: '',
  occupation: '',
  income: '',
  source: '',
  tags: [],
  profileId:'',
});
// 平台下拉列表
const platformOptions = ref([])
const sexOptions= ref([])
const followUpRecords = ref([]);
const newFollowUpContent = ref('');
const showAddRecord = ref(false);
const isAddTag = ref(false);
const inputValue = ref('');
const tagInputRef = ref(null);

const ipcApiRoute = {
  addFollowRecord: 'controller.user.addFollowRecord',
  updateUserInfo: 'controller.user.updateUserInfo',
  getUserPortrait: 'controller.user.getUserPortrait',
  deleteFollowRecord: 'controller.user.deleteFollowRecord',
};
//获取平台字典
const getplatformList = async () => { 
  try {
    const dictType='box_platform'
    const res = await get(`/app/dict/listData?dictType=${dictType}`)  
    if (res && res.code === 200) {
      platformOptions.value = res.data || []
    }
  } catch (err) {
    console.error('获取平台列表失败:', err)
  }
}
//获取性别字典
const getSexList = async () => { 
  try {
    const dictType='sys_user_sex'
    const res = await get(`/app/dict/listData?dictType=${dictType}`)  
    if (res && res.code === 200) {
      sexOptions.value = res.data || []
    }
  } catch (err) {
    console.error('获取平台列表失败:', err)
  }
}
const getUserPortraitData = () => {
    console.log('获取平台列表失败:', props.chatId, )
  if (!props.chatId) return;
  const targetPhone = formData.value.phone_number || props.cardData?.phone_number || '';
   console.log('获取平台列表失败:', targetPhone)
  if (!targetPhone) return;

  isLoading.value = true;

  // First fetch local IPC records if needed, then fetch from API
  const args = { 
    card_id: props.chatId, 
    platform: 'WhatsApp', 
    phone_number: targetPhone
  }
  
  // Continue fetching local records (e.g. from SQL) just in case
  ipc.invoke(ipcApiRoute.getUserPortrait, args).then(res => {
    if (res && res.record) {
      followUpRecords.value = res.record || [];
    }
  }).catch(e => console.error(e));

  // Query via REST API
  const requestPromise = post(`/app/profiles/getByAppId`,{appId:targetPhone});
  
  // 保证至少 300ms 的加载动画延时，防止本地加载过快导致肉眼无法察觉而误以为失效
  Promise.all([
    requestPromise,
    new Promise(res => setTimeout(res, 300))
  ]).finally(() => {
    isLoading.value = false;
  });

  requestPromise.then(res => {
    if (res.code === 200 && res.data) {
      isEditProfile.value = true;
      const data = res.data;
      formData.value = {
        ...formData.value,
        profileId:data.profileId,
        nickname: data.nickName || '',
        birthday: data.birthday || '',
        gender: data.gender || '未知',
        address: data.address || '',
        email: data.email || '',
        occupation: data.vocation || '',
        income: data.income || '',
        tags: data.tag ? data.tag.split(',').filter(t => t) : [],
        phone_number: data.appId 
      };
      if (data.record && Array.isArray(data.record)) {
        followUpRecords.value = data.record;
      }
    } else {
      isEditProfile.value = false;
      // Reset form on new profile, keep phone number
      formData.value = {
        phone_number: targetPhone,
        profileId: '',
        platform: '',
        card_id: '',
        nickname: '',
        country: '',
        gender: '未知',
        notes: '',
        birthday: '',
        address: '',
        email: '',
        occupation: '',
        income: '',
        source: '',
        tags: []
      };
    }
  }).catch(err => {
    console.error('Fetch user portrait failed:', err);
    isEditProfile.value = false;
  });
}

onMounted(() => {
  if (props.conversationId) {
    // WhatsApp's conversationId sometimes ends with @c.us or similar suffixes,
    // we extract just the number part as the phone_number.
    const rawId = String(props.conversationId).split('@')[0];
    formData.value.phone_number = rawId;
  }
  getUserPortraitData();
  getplatformList()
  getSexList()
});

watch(() => [props.chatId, props.conversationId], ([newChatId, newConvId]) => {
  if (newConvId) {
    const rawId = String(newConvId).split('@')[0];
    formData.value.phone_number = rawId;
  } else {
    // 收到空 ID（代表退出登录或离开会话），强制清空本机缓存特征码，回归空状态
    formData.value.phone_number = '';
  }
  getUserPortraitData();
});

const handleCopy = () => {
  const sourceOption = platformOptions.value.find(item => item.dictValue === formData.value.source);
  const sourceLabel = sourceOption ? sourceOption.dictLabel : '';
  const sexOption = sexOptions.value.find(item => item.dictValue === formData.value.gender);
  const sexLabel = sexOption ? sexOption.dictLabel : '';
  let bdText = '';
  if (formData.value.birthday) {
      const d = new Date(formData.value.birthday);
      bdText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  
  const lines = [];
  if (formData.value.phone_number) lines.push(`账号ID: ${formData.value.phone_number}`);
  if (formData.value.nickname) lines.push(`昵称备注: ${formData.value.nickname}`);
  if (formData.value.gender) lines.push(`性别: ${sexLabel}`);
  if (bdText) lines.push(`生日: ${bdText}`);
  if (formData.value.address) lines.push(`地址: ${formData.value.address}`);
  if (formData.value.email) lines.push(`邮箱: ${formData.value.email}`);
  if (formData.value.occupation) lines.push(`职业: ${formData.value.occupation}`);
  if (formData.value.income) lines.push(`收入: ${formData.value.income}`);
  if (sourceLabel) lines.push(`客户来源: ${sourceLabel}`);
  
  const tagsText = Array.isArray(formData.value.tags) ? formData.value.tags.join(', ') : '';
  if (tagsText) lines.push(`用户标签: ${tagsText}`);

  const text = lines.join('\n');
  if (!text) {
    Notification.message({ message: '暂无有效数据可复制', type: 'warning' });
    return;
  }
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      Notification.message({ message: '已复制到剪贴板', type: 'success' });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      Notification.message({ message: '复制失败，请重试', type: 'error' });
    });
  } else {
      // 降级处理
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
          document.execCommand('copy');
          Notification.message({ message: '已复制到剪贴板', type: 'success' });
      } catch (err) {}
      document.body.removeChild(textArea);
  }
};

const addFollowUp = () => {
  if (!newFollowUpContent.value.trim()) return;
  
  const time = new Date().toLocaleString();
  const content = newFollowUpContent.value;
  const args = {
    time,
    content,
    platform: 'WhatsApp',
    card_id: props.chatId,
    phone_number: formData.value.phone_number
  };
  
  ipc.invoke(ipcApiRoute.addFollowRecord, args).then(res => {
    if (res.status) {
      followUpRecords.value.unshift({ time, content });
      newFollowUpContent.value = '';
      showAddRecord.value = false;
      Notification.message({ message: '添加成功', type: 'success' });
    }
  });
};

const deleteRecord = (index) => {
  // Assuming there's a delete API or we just update local and save parent state
  followUpRecords.value.splice(index, 1);
  // Optional: ipc call to delete from DB
};

const handleCloseTag = (tag) => {
  if (Array.isArray(formData.value.tags)) {
    formData.value.tags.splice(formData.value.tags.indexOf(tag), 1);
  }
};

const handleAddTag = () => {
  isAddTag.value = true;
  nextTick(() => {
    tagInputRef.value?.focus();
  });
};

const handleInputConfirm = () => {
  if (inputValue.value) {
    if (!Array.isArray(formData.value.tags)) {
      formData.value.tags = [];
    }
    if (!formData.value.tags.includes(inputValue.value)) {
      formData.value.tags.push(inputValue.value);
    }
  }
  isAddTag.value = false;
  inputValue.value = '';
};

const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const confirmClick = () => {
  const accountInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  
  const params = {
    appId: formData.value.phone_number,
    profileId:formData.value.profileId,
    nickName: formData.value.nickname,
    birthday: formatDate(formData.value.birthday),
    gender: formData.value.gender,
    address: formData.value.address,
    email: formData.value.email,
    vocation: formData.value.occupation,
    income: formData.value.income,
    appSource: 'WhatsApp',
    tag: Array.isArray(formData.value.tags) ? formData.value.tags.join(',') : '',
    record: null,
    remark: null
  };

  const requestMethod = isEditProfile.value&&formData.value.profileId ? put : post;

  requestMethod('/app/profiles', params).then(res => {
    if (res.code === 200) {
      Notification.message({ message: '保存成功', type: 'success' });
      getUserPortraitData()
      isEditProfile.value = true;
      
      // Notify WhatsApp WebView to update nickname in UI
      if (formData.value.phone_number && formData.value.nickname) {
        ipc.invoke('controller.window.sendToWv', {
          chatId: props.chatId,
          channel: 'update-contact-nickname',
          args: [{
            phone: formData.value.phone_number,
            nickname: formData.value.nickname
          }]
        });
      }
    }
  }).catch(err => {
    console.error('Save profile failed:', err);
  });
};

</script>

<template>
  <div class="user-persona-panel">
    <div class="panel-header">
      <div class="header-main">
        <span class="title">用户画像</span>
        <div class="share-status">
          <span class="share-dot"></span>
          全账号共享数据已开启
          <el-icon class="info-icon"><QuestionFilled /></el-icon>
        </div>
      </div>
      <button class="close-btn" @click="emit('close')">×</button>
    </div>
    <template v-if="formData.phone_number && formData.phone_number !== 'default'">
      <el-scrollbar class="persona-scroll">
        <div class="persona-content" v-loading="isLoading" element-loading-text="加载数据中...">
        <!-- 用户信息 Section -->
        <div class="section-block">
          <div class="section-top-bar">
            <div class="section-title">
              <div class="icon-circle">
                <el-icon><User /></el-icon>
              </div>
              <span>用户信息</span>
            </div>
            <div class="section-actions">
              <el-button size="small" class="copy-btn" @click="handleCopy">一键复制</el-button>
              <el-button size="small" type="success" class="save-btn" @click="confirmClick">保存</el-button>
            </div>
          </div>

          <div class="persona-form">
            <div class="form-row">
              <span class="label">账号ID</span>
              <el-input v-model="formData.phone_number" disabled class="custom-input readonly" />
            </div>
            <div class="form-row">
              <span class="label">昵称备注</span>
              <el-input v-model="formData.nickname" placeholder="请输入昵称备注" class="custom-input" />
            </div>
            <div class="form-row">
              <span class="label">性别</span>
              <el-radio-group v-model="formData.gender" text-color="#fff" fill="#2db85f" class="gender-radio-group">
                <el-radio-button v-for="item in  sexOptions"  :key="item.dictValue" :label="item.dictLabel" :value="item.dictValue"></el-radio-button>
              </el-radio-group>
            </div>
            <div class="form-row">
              <span class="label">生日</span>
              <el-date-picker v-model="formData.birthday" type="date" placeholder="年 / 月 / 日" class="custom-date-picker" />
            </div>
            <div class="form-row">
              <span class="label">地址</span>
              <el-input v-model="formData.address" placeholder="输入地址" class="custom-input" />
            </div>
            <div class="form-row">
              <span class="label">邮箱</span>
              <el-input v-model="formData.email" placeholder="输入邮箱" class="custom-input" />
            </div>
            <div class="form-row">
              <span class="label">职业</span>
              <el-input v-model="formData.occupation" placeholder="输入职业" class="custom-input" />
            </div>
            <div class="form-row">
              <span class="label">收入</span>
              <el-input v-model="formData.income" placeholder="输入收入" class="custom-input" />
            </div>
            <div class="form-row">
              <span class="label">客户来源</span>
              <el-select v-model="formData.source" placeholder="选择客户来源" class="custom-select">
                 <el-option 
                v-for="item in platformOptions" 
              :key="item.dictValue" 
              :label="item.dictLabel" 
              :value="item.dictValue">
            </el-option>
              </el-select>
            </div>
            <div class="form-row align-top">
              <span class="label">用户标签</span>
              <div class="tags-container">
                <el-tag v-for="tag in formData.tags" :key="tag" closable class="custom-tag" @close="handleCloseTag(tag)">{{ tag }}</el-tag>
                <el-input
                  v-if="isAddTag"
                  ref="tagInputRef"
                  v-model="inputValue"
                  class="add-tag-input"
                  size="small"
                  @keyup.enter="handleInputConfirm"
                  @blur="handleInputConfirm"
                />
                <div v-else class="add-tag-box" @click="handleAddTag">
                  <el-icon><Plus /></el-icon>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 跟进记录 Section -->
        <div class="section-block">
          <div class="section-top-bar">
            <div class="section-title">
              <div class="icon-circle calendar-icon">
                <el-icon><Calendar /></el-icon>
              </div>
              <span>跟进记录</span>
            </div>
            <el-button type="success" size="small" class="record-btn" @click="showAddRecord = !showAddRecord">跟进记录</el-button>
          </div>

          <div v-if="showAddRecord" class="inline-add-record">
            <el-input v-model="newFollowUpContent" type="textarea" :rows="2" placeholder="填写跟进内容..." />
            <div class="add-actions">
               <el-button size="small" @click="showAddRecord = false">取消</el-button>
               <el-button size="small" type="primary" @click="addFollowUp">保存记录</el-button>
            </div>
          </div>

          <div class="records-timeline">
            <el-timeline>
              <el-timeline-item
                v-for="(record, index) in followUpRecords"
                :key="index"
                :timestamp="record.time"
                placement="top"
                size="normal"
                type="primary"
                class="custom-timeline-item"
              >
                <div class="record-card">
                  <span class="record-text">{{ record.content }}</span>
                  <el-icon class="del-record" @click="deleteRecord(index)"><Delete /></el-icon>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </div>
      </div>
      </el-scrollbar>
    </template>
    
    <template v-else>
      <div class="empty-state-wrapper">
        <el-empty description="请选择一个会话" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-persona-panel {
  height: 100%;
  width: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  color: #333;
}

.panel-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-header .title {
  font-size: 18px;
  font-weight: 600;
}

.share-status {
  padding: 2px 10px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  font-size: 11px;
  color: #409eff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.share-dot {
  width: 6px;
  height: 6px;
  background: #409eff;
  border-radius: 50%;
}

.close-btn {
  border: none;
  background: transparent;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.persona-scroll {
  flex: 1;
}

.persona-content {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

.section-block {
  margin-bottom: 24px;
}

.section-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.icon-circle {
  width: 24px;
  height: 24px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.copy-btn {
  border: 1px dashed #dcdfe6;
  background: transparent;
  color: #606266;
}

.save-btn, .record-btn {
  background-color: #2db85f !important;
  border-color: #2db85f !important;
  color: #fff !important;
}

/* Form Styles */
.persona-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-row.align-top {
  align-items: flex-start;
}

.form-row .label {
  width: 65px;
  font-size: 13px;
  color: #666;
  flex-shrink: 0;
}

.custom-input :deep(.el-input__inner) {
  height: 32px;
  background-color: #fcfcfc;
}

.readonly :deep(.el-input__inner) {
  background-color: #f5f7fa;
  color: #999;
}

.gender-radio-group :deep(.el-radio-button__inner) {
  padding: 7px 15px;
  font-size: 12px;
}

.custom-date-picker, .custom-select {
  width: 100% !important;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.add-tag-box {
  width: 32px;
  height: 24px;
  background-color: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #999;
  cursor: pointer;
}

.add-tag-input {
  width: 80px;
  height: 24px;
}
.add-tag-input :deep(.el-input__wrapper) {
  padding: 0 8px;
}

/* Timeline Styles */
.records-timeline {
  margin-top: 10px;
  padding-left: 4px;
}

.record-card {
  background: #f8f9fb;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
}

.record-text {
  font-size: 13px;
  line-height: 1.5;
  color: #444;
  flex: 1;
}

.del-record {
  font-size: 14px;
  color: #ccc;
  cursor: pointer;
  margin-left: 8px;
  transition: color 0.2s;
}

.del-record:hover {
  color: #f56c6c;
}

.inline-add-record {
  margin-bottom: 16px;
  background: #fdfdfd;
  border: 1px solid #eee;
  padding: 12px;
  border-radius: 8px;
}

.add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

:deep(.el-timeline-item__content) {
  top: -4px;
}

:deep(.el-timeline-item__timestamp) {
  margin-bottom: 6px;
  color: #999;
}

.empty-state-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
