<template>
  <div class="update-version-container">
    <div class="update-version-row">
    <div class="one-block-1">
      <span>
        当前版本: {{ appVersion }} 
        <el-tag v-if="available"  type="success" size="small" effect="plain" class="ml-10 tag-version">有新版本: v{{ latestVersion }}</el-tag>
      </span>
    </div>
    <div class="one-block-2">
      <el-space>
        <el-button type="primary" plain @click="checkForUpdate(true)">检查更新</el-button>
        <!-- <el-button v-if="available" type="success" @click="showUpdateDialog = true">立即更新</el-button> -->
      </el-space>
    </div>
</div>
    <!-- 发现新版本弹窗 (Screenshot 1 Style) -->
    <el-dialog
      v-model="showUpdateDialog"
      :show-close="false"
      width="560px"
      class="update-dialog-custom"
      :align-center="true"
    >
      <div class="update-card-content">
        <div class="update-header">
          <div class="header-main">
            <span class="title">发现新版本</span>
            <span class="version-badge">v{{ latestVersion }}</span>
          </div>
          <div class="header-illustration">
            <!-- 这里原本是一个插图，我们可以用一个渐变色块或图标模拟 -->
          </div>
        </div>
        
        <div class="update-body">
          <!-- <ul >
            <li v-for="(note, index) in releaseNotes" :key="index">{{ note }}</li>
          </ul> -->
            <div  class="release-notes" v-html="releaseNotes"></div>
        </div>
        
        <div class="update-footer">
          <el-button class="btn-later" @click="showUpdateDialog = false">暂不更新</el-button>
          <el-button type="primary" class="btn-now" @click="handleStartUpdate">立即更新</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 下载进度弹窗 (Screenshot 2 Style) -->
    <el-dialog
      v-model="showProgressDialog"
      title="自动更新"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="480px"
      class="progress-dialog-custom"
    >
      <div class="progress-content">
        <div class="status-text">正在下载更新...</div>
        <div class="progress-bar-wrapper">
          <el-progress :percentage="downloadPercent" :show-text="false" :stroke-width="8" color="#48c78e" />
          <span class="percentage-label">{{ downloadPercent }}%</span>
        </div>
        <div class="progress-info">
          <span class="speed">速度: {{ downloadSpeed }}</span>
          <span class="size">{{ transferredSize }} / {{ totalSize }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ipcRoute, specialIpcRoute } from '@/api';
import { ipc } from '@/utils/ipcRenderer';
import { ElMessage } from 'element-plus';
import { get } from '@/utils/request';
import {toQueryString} from '@/utils/utils'
const appVersion = ref('');
const latestVersion = ref('');
const available = ref(false);
const showUpdateDialog = ref(false);
const showProgressDialog = ref(false);
const installationPackageAddress = ref('')
const downloadPercent = ref(0);
const downloadSpeed = ref('0.0MB/秒');
const transferredSize = ref('0MB');
const totalSize = ref('0MB');

// const releaseNotes = ref([
//   "全平台翻译配置新增 源语言功能，翻译更准确",
//   "切换联系人后，所有历史消息和接收消息的翻译（只要本地有缓存）都会立即恢复显示",
//   "更新检查版本功能上线",
//   "修复语音翻译问题"
// ]);
const releaseNotes = ref('');
onMounted(() => {
  init();
});

function init() {
  // 监听主进程下发的更新进度
  ipc.removeAllListeners(specialIpcRoute.appUpdater);
  ipc.on(specialIpcRoute.appUpdater, (event, result) => {
    try {
      const data = typeof result === 'string' ? JSON.parse(result) : result;
      console.log('🔄 更新进度:', data);
      
      const { status, percent, speed, transferredSize: trans, totalSize: total, error } = data;
      
      if (status === 3) { // 下载中
        available.value = true;
        showProgressDialog.value = true;
        showUpdateDialog.value = false;
        downloadPercent.value = parseInt(percent) || 0;
        downloadSpeed.value = speed || '0.0MB/秒';
        transferredSize.value = trans || '0MB';
        totalSize.value = total || '0MB';
      } else if (status === 4) { // 下载完成
        showProgressDialog.value = false;
        ElMessage.success("下载完成，正在准备安装...");
      } else if (status === -1) { // 错误
        showProgressDialog.value = false;
        ElMessage.error(error || "下载失败");
      }
    } catch (e) {
      console.error('解析更新数据失败:', e);
    }
  });

  // 获取当前版本
  ipc.invoke(ipcRoute.getAppInfo).then(result => {
    appVersion.value = result.currentVersion;
    checkForUpdate(false);
  });
}

/**
 * 检查更新
 * @param {boolean} showTips 是否显示“已是最新”提示
 */
async function checkForUpdate(showTips = false) {
  try {
    const res = await get('/app/version');
    if (res.code === 200 && res.data) {
      latestVersion.value = res.data;
      getVersionIntroduction()
      if (latestVersion.value && latestVersion.value !== appVersion.value) {
        available.value = true;
        showUpdateDialog.value = true;
      } else if (showTips) {
        ElMessage.info("已经是最新版本");
      }
    }
  } catch (err) {
    console.error('获取最新版本失败:', err);
    if (showTips) ElMessage.error("检查更新失败");
  }
}
  const getVersionIntroduction = async() => { 
    const  params = { 
         noticeTitle: `V${latestVersion.value}`
    }
    const queryString = toQueryString(params)
    const  res = await get(`/app/notice/list?${queryString.toString()}` )
    if(res.code===200) {
       const baseUrl = import.meta.env.MODE === 'development'
      ? 'http://192.168.3.18'
      : 'https://chat365.cc';

    // 将 /dev-api 替换成 完整域名 + /dev-api
    let htmlContent = res.data[0].noticeContent;
   const fullDevApiPath = `${baseUrl}/dev-api`;
    htmlContent = htmlContent.replace(/\/dev-api/g, fullDevApiPath);
    releaseNotes.value = htmlContent;
    installationPackageAddress.value = res.data[0].noticeFile
    }else{
    }
  }
function handleStartUpdate() {
  showUpdateDialog.value = false;
  showProgressDialog.value = true;
  // 调用主进程下载，传入目标地址
  // const   downloadUrl =`https://pub-e800306e538c4dc3a15baef9bd281c8b.r2.dev/Chat365-win-${latestVersion.value}-x64.exe`
 const downloadUrl =installationPackageAddress.value
  ipc.invoke(ipcRoute.downloadApp, { url: downloadUrl });
}

</script>

<style lang="less">
/* 全局覆盖弹窗样式，因为 el-dialog 会被挂载到 body 下 */
.update-dialog-custom {
  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    padding: 0;
  }
  border-radius: 12px;
  overflow: hidden;
  border: none;
}

.update-card-content {
  background: white;
  
  .update-header {
    height: 180px;
    background: linear-gradient(135deg, #e0f2fe 0%, #dcfce7 100%);
    position: relative;
    padding: 30px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    
    // 模拟右上角的蓝色插图区域
    &::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 200px;
      height: 180px;
      background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
      pointer-events: none;
    }

    .header-main {
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 1;
      
      .title {
        font-size: 24px;
        font-weight: bold;
        color: #334155;
      }
      
      .version-badge {
        background: #4ade80;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 14px;
        width: fit-content;
      }
    }
  }
  
  .update-body {
    padding: 30px;
    
    .release-notes {
      font-size: 15px;
      color: #475569;
      line-height: 1.6;
      
      ul {
        padding-left: 22px;
        margin: 0 0 12px 0;
        list-style-type: disc;
      }
      
      ol {
        padding-left: 22px;
        margin: 0 0 12px 0;
        list-style-type: decimal;
      }
      
      li {
        margin-bottom: 8px;
      }
      
      li::marker {
        color: #334155;
      }
      
      p {
        margin: 0 0 8px 0;
      }
      
      > *:last-child {
        margin-bottom: 0;
      }
    }
  }
  
  .update-footer {
    padding: 0 30px 30px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    
    .btn-later {
      border-radius: 8px;
      height: 40px;
      padding: 0 20px;
      color: #64748b;
    }
    
    .btn-now {
      background: #4ade80;
      border-color: #4ade80;
      border-radius: 8px;
      height: 40px;
      padding: 0 20px;
      
      &:hover {
        background: #22c55e;
        border-color: #22c55e;
      }
    }
  }
}

.progress-dialog-custom {
  .el-dialog__header {
    padding-bottom: 10px;
    border-bottom: 1px solid #f1f5f9;
  }
  .el-dialog__title {
    font-size: 16px;
    font-weight: 500;
  }
  
  .progress-content {
    padding: 20px 0;
    
    .status-text {
      font-size: 18px;
      font-weight: 500;
      color: #334155;
      margin-bottom: 25px;
    }
    
    .progress-bar-wrapper {
      position: relative;
      margin-bottom: 15px;
      
      .percentage-label {
        position: absolute;
        right: 0;
        top: -24px;
        font-size: 14px;
        color: #64748b;
      }
    }
    
    .progress-info {
      display: flex;
      justify-content: flex-end;
      gap: 15px;
      font-size: 13px;
      color: #94a3b8;
    }
  }
}

.update-version-container {
  padding: 0px 10px;
  text-align: left;
  width: 100%;

  .update-version-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-around;
    width: 100%;
  }

  .one-block-1 {
    font-size: 16px;
  }

  .ml-10 {
    margin-left: 10px;
  }
  .tag-version  { 
    height: 34px;
  }
}
</style>
