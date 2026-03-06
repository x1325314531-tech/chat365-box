<template>
  <div class="fans-list-page">
    <div class="fans-container">
    <!-- 头部标题 -->
    <div class="page-header">
      <span class="title">粉丝列表</span>
    </div>

    <!-- 搜索表单 -->
    <div class="search-section">
      <el-form :inline="true" :model="searchForm" class="search-form" size="default">
        <el-form-item>
          <el-select v-model="searchForm.platform" placeholder="平台" style="width: 120px" clearable>
            <el-option label="WhatsApp" value="whatsapp"></el-option>
            <el-option label="Zalo" value="zalo"></el-option>
            <el-option label="Telegram" value="telegram"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.myAccounts" placeholder="我的账号(多选)" style="width: 180px" multiple collapse-tags clearable>
            <el-option 
              v-for="account in availableAccounts" 
              :key="account" 
              :label="account" 
              :value="account">
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.fanType" placeholder="粉丝类型" style="width: 120px" clearable>
            <el-option label="类型1" value="type1"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="→"
            start-placeholder="进粉开始时间"
            end-placeholder="进粉结束时间"
            style="width: 280px"
          >
          </el-date-picker>
        </el-form-item>
        <el-form-item>
          <el-input 
            v-model="searchForm.keyword" 
            placeholder="搜索粉丝账号/ID/电话号码/备注" 
            style="width: 250px"
            clearable>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="success" @click="handleSearch" :icon="Search">搜索</el-button>
          <el-button @click="resetSearch" :icon="RefreshRight">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 统计卡片 -->
    <div class="summary-section">
      <el-row :gutter="10">
        <!-- 第一个卡片：当前账号 -->
        <el-col :span="12">
          <div class="summary-card">
            <div class="card-top">
            <div class="card-header">
              <span class="card-title">当前账号</span> 
              <span class="sub-text">(数据已当前工单去重)</span>
            </div>
            <div class="card-sub-header">所属工单: --</div>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">总进粉</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">总留存</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">分流粉</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日进粉</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日留存</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日新粉</div>
                <div class="stat-value">0</div>
              </div>
            </div>
          </div>
        </el-col>

        <!-- 第二个卡片：当前工单 -->
        <el-col :span="12">
          <div class="summary-card">
              <div class="card-top">
            <div class="card-header">
              <span class="card-title">当前工单</span> 
              <span class="sub-text">(数据已当前工单去重)</span>
            </div>
            <div class="card-sub-header">当前工单数量(每天): --</div>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">总进粉</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">总留存</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">分流粉</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日进粉</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日留存</div>
                <div class="stat-value">0</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日新粉</div>
                <div class="stat-value">0</div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 数据表格 -->
    <div class="table-section">
      <el-table 
        :data="tableData" 
        style="width: 100%; height: 100%" 
        v-loading="loading"
        header-cell-class-name="fans-table-header"
      >
        <template #empty>
          <div class="empty-state">
            <div class="empty-icon-wrapper">
              <el-icon class="empty-icon"><Document /></el-icon>
            </div>
            <div class="empty-text">当前账号未开启工单功能，如需使用，请前往中台重新添加激活码并开启工单功能。</div>
          </div>
        </template>
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column prop="platform" label="平台" align="center" />
        <el-table-column prop="myAccount" label="我的账号" align="center" />
        <el-table-column prop="fanAccount" label="粉丝账号" align="center" />
        <el-table-column prop="source" label="来源" align="center" />
        <el-table-column prop="region" label="地区" align="center" />
        <el-table-column prop="fanTime" label="进粉时间" align="center" min-width="120" />
        <el-table-column prop="recordTime" label="记录时间" align="center" min-width="120" />
        <el-table-column prop="repeatCount" label="重复次数" align="center" />
        <el-table-column prop="fanType" label="粉丝类型" align="center" />
      </el-table>
    </div>

    <!-- 底部操作栏 -->
    <div class="footer-section">
      <div class="left-controls">
        <el-select v-model="refreshInterval" size="small" style="width: 100px; margin-right: 15px">
          <el-option label="每1分钟" :value="1"></el-option>
          <el-option label="每3分钟" :value="3"></el-option>
          <el-option label="每5分钟" :value="5"></el-option>
        </el-select>
        <span class="auto-refresh-label">自动刷新数据:</span>
        <el-switch v-model="autoRefresh" active-color="#13ce66" />
      </div>

      <div class="pagination-controls">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, prev, pager, next, sizes"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { Search, RefreshRight, Document } from '@element-plus/icons-vue'
import { ipc } from '@/utils/ipcRenderer'

// 搜索表单状态
const availableAccounts = ref([])
const searchForm = reactive({
  platform: '',
  myAccounts: [],
  fanType: '',
  dateRange: null,
  keyword: ''
})

// 数据相关状态
const loading = ref(false)
const tableData = ref([])

// 底部控制状态
const refreshInterval = ref(1)
const autoRefresh = ref(true)

// 分页状态
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

let timer = null

// 获取所有 WhatsApp 账号（已登录且有号码的）
const getAccounts = async () => {
  try {
    const res = await ipc.invoke('controller.window.getSessions', { platform: 'WhatsApp' })
    console.log('获取WhatsApp账号', res);
    
    if (res && res.data) {
      const loggedInAccounts = res.data
        .filter(item => item.online_status === 'true' && (item.my_phone || item.myPhone))
        .map(item => item.my_phone || item.myPhone)
      
      // 更新候选项
      availableAccounts.value = Array.from(new Set(loggedInAccounts))
      
      // 如果当前没选，且有新账号，默认选中第一个
      if (searchForm.myAccounts.length === 0 && availableAccounts.value.length > 0) {
        searchForm.myAccounts = [availableAccounts.value[0]]
      }
    }
  } catch (err) {
    console.error('获取同步账号失败:', err)
  }
}

const handleSearch = () => {
  loading.value = true
  // TODO: 模拟接口请求
  setTimeout(() => {
    loading.value = false
  }, 500)
}

const resetSearch = () => {
  searchForm.platform = ''
  searchForm.myAccounts = []
  searchForm.fanType = ''
  searchForm.dateRange = null
  searchForm.keyword = ''
  handleSearch()
}

const handleSizeChange = (val) => {
  pagination.size = val
  handleSearch()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  handleSearch()
}

const startAutoRefresh = () => {
  if (timer) clearInterval(timer)
  if (autoRefresh.value) {
    timer = setInterval(() => {
      handleSearch()
    }, refreshInterval.value * 60 * 1000)
  }
}

onMounted(() => {
  // 获取已有的账号列表
  getAccounts()

  // 监听登录通知，实时更新账号列表
  ipc.on('online-notify', (event, args) => {
    console.log('FansList 收到登录通知:', args)
    getAccounts()
  })

  handleSearch()
  startAutoRefresh()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  ipc.removeAllListeners('online-notify')
})
</script>

<style scoped>
.fans-list-page {
  height: 100%;
  
  display: flex;
  flex-direction: column;
  background-color: #f2f3f5;
  overflow: hidden;
}
.fans-container { 
  padding: 0 10px 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;

}
.page-header {
  margin-bottom: 12px;
  background-color: #fff;
  padding: 16px;
  text-align: left;
}

.page-header .title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.search-section {
  display: flex;
  background-color: #fff;
  padding: 16px 10px 0;
  border-radius: 4px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.search-form :deep(.el-form-item) {
  margin-right: 12px;
  margin-bottom: 16px;
}

.summary-section {
  margin-bottom: 10px;
  height:165px;
}
.card-top {
    display: flex;
    flex-direction: column;
    align-items: baseline;
}
.summary-card {
  background-color: #fff;
  border-radius: 4px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.card-header {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.card-title {
  margin-right: 4px;
}

.sub-text {
  font-weight: normal;
}

.card-sub-header {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #262626;
}

.table-section {
  flex: 1;
  background-color: #fff;
  border-radius: 4px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  min-height: 200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.fans-table-header th) {
  background-color: #fafafa !important;
  color: #333;
  font-weight: bold;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.empty-icon-wrapper {
  background-color: #f0f2f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.empty-icon {
  font-size: 48px;
  color: #bfbfbf;
}

.empty-text {
  font-size: 13px;
}

.footer-section {
  margin-top: 12px;
  background-color: #fff;
  padding: 12px 20px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.left-controls {
  display: flex;
  align-items: center;
}

.auto-refresh-label {
  font-size: 13px;
  color: #606266;
  margin-right: 8px;
}

.pagination-controls {
  display: flex;
  align-items: center;
}
</style>
