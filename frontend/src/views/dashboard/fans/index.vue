<template>
  <div class="fans-dashboard">
    <div class="main-content">
      <!-- 1. 顶部统计卡片区 -->
      <div class="stats-overview">
        <div 
          v-for="card in statCards" 
          :key="card.key"
          class="stat-card"
          :class="{ active: activeDimension === card.label, [card.colorClass]: true }"
          @click="handleDimensionChange(card.label)"
        >
          <div class="card-icon-wrapper">
             <el-icon :size="24">
                <component :is="card.icon" />
             </el-icon>
          </div>
          <div class="card-info">
            <div class="card-label">{{ card.label }}</div>
            <div class="card-value">{{ stats[card.statKey] || 0 }}<span class="unit">人</span></div>
          </div>
        </div>
      </div>
      <div class="main-dashboard-content">
        <!-- 2. 筛选搜索区 -->
        <div class="filter-section">
          <el-form :inline="true" :model="searchForm" class="filter-form">
            <el-form-item label="模糊搜索">
              <el-input 
                v-model="searchForm.keyword" 
                placeholder="搜索粉丝账号/粉丝昵称/备注" 
                clearable 
                style="width: 250px"
              />
            </el-form-item>
            <el-form-item label="所属平台">
              <el-select v-model="searchForm.platform" @change="handlePlatform" placeholder="选择平台" clearable style="width: 120px">
                <el-option 
                  v-for="item in platformOptions" 
                  :key="item.dictValue" 
                  :label="item.dictLabel" 
                  :value="item.dictValue"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-select v-model="searchForm.appPhone" :disabled="appPHONEDisable" placeholder="我的账号(多选)" style="width: 180px"  collapse-tags clearable>
                <el-option 
                  v-for="account in availableAccounts" 
                  :key="account" 
                  :label="account" 
                  :value="account">
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="统计时段">
              <el-date-picker
                v-model="searchForm.dateRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD HH:mm:ss"
                :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
                style="width: 350px"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Search" @click="handleSearch">搜索联动</el-button>
              <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 3. 维度信息行 -->
      <div class="dimension-summary" :class="currentTheme">
        <span class="dim-label">当前列表维度:</span>
        <span class="dim-value">{{ activeDimension }}</span>
        <span class="dim-desc">{{ currentDimensionDesc }}</span>
      </div>

        <!-- 4. 数据表格区 -->
        <div class="table-container">
          <el-table 
            v-loading="loading"
            :data="tableData" 
            border 
            stripe
            height="100%"
            style="width: 100%"
            header-cell-class-name="table-header"
          >
            <el-table-column type="index" label="序号" width="70" align="center" />
            <el-table-column prop="platform" label="平台" width="100" align="center" />
            <el-table-column prop="fansPhone" label="粉丝账号" min-width="120" align="center" />
            <el-table-column prop="fansName" label="粉丝昵称" min-width="150" align="center" />
            <el-table-column prop="fansType" label="状态" width="100" align="center">
              <template #default="scope">
                <el-tag :type="getTagType(scope.row.fansType)" effect="plain" size="small">
                  {{ scope.row.fansType || '未知' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="addTime" label="进粉时间" width="180" align="center" />
            <el-table-column prop="source" label="最新来源" min-width="120" align="center" />
          </el-table>
        </div>

        <!-- 5. 分页 -->
        <div class="pagination-footer">
             <div class="left-controls">
        <el-select v-model="refreshInterval" size="small" style="width: 100px; margin-right: 15px">
          <el-option label="每1分钟" :value="1"></el-option>
          <el-option label="每3分钟" :value="3"></el-option>
          <el-option label="每5分钟" :value="5"></el-option>
          <el-option label="每10分钟" :value="10"></el-option>
        </el-select>
        <span class="auto-refresh-label">自动刷新数据:</span>
        <el-switch v-model="autoRefresh" active-color="#13ce66" />
      </div>
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.size"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
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
import { ref, reactive, onMounted,onUnmounted, computed } from 'vue'
import { 
  Search, 
  Refresh, 
  Wallet, 
  Switch, 
  CirclePlus, 
  CopyDocument, 
  Histogram,
  View
} from '@element-plus/icons-vue'
import { post, get } from '@/utils/request'
import { ElMessage } from 'element-plus'
import { ipc } from '@/utils/ipcRenderer'
import moment from 'moment-timezone'
// --- 1. 状态定义 ---
const loading = ref(false)
const activeDimension = ref('总库人数')
const userInfo = ref({})
const  appPHONEDisable = ref(false)
const searchForm = reactive({
  keyword: '',
  platform: '',
  appPhone: '',
  dateRange: [
    moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')
  ],
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const stats = reactive({
  totalFans: 0,
  periodAddFans: 0,
  periodNewFans: 0,
  periodRepeatFans: 0,
  trafficDiverterFans: 0
})
const  availableAccounts= ref([])
const tableData = ref([])
const platformOptions = ref([])
// 底部控制状态
const refreshInterval = ref(1)
const autoRefresh = ref(true)
// --- 2. 配置定义 ---
const statCards = [
  { label: '总库人数', key: 'total', statKey: 'totalFans', icon: Wallet, colorClass: 'blue-card' },
  { label: '进粉流水', key: 'inflow', statKey: 'periodAddFans', icon: Switch, colorClass: 'red-card' },
  { label: '期间新粉', key: 'new', statKey: 'periodNewFans', icon: CirclePlus, colorClass: 'cyan-card' },
  { label: '期间重粉', key: 'duplicate', statKey: 'periodRepeatFans', icon: CopyDocument, colorClass: 'purple-card' },
  { label: '平台统计', key: 'traffic', statKey: 'trafficDiverterFans', icon: Histogram, colorClass: 'green-card' }
]

const dimensionDescMap = {
  '总库人数': '符合搜索条件的不重复粉丝总量',
  '进粉流水': '选定时段内产生的原始进粉流水记录',
  '期间新粉': '选定时段内首次产生的不重复粉丝记录',
  '期间重粉': '选定时段内被标记为重复进粉的数据',
  '平台统计': '请选择对应平台查看分流粉丝数据'
}
let timer = null
const currentDimensionDesc = computed(() => {
  return dimensionDescMap[activeDimension.value] || ''
})
const currentTheme = computed(()=> {
  return statCards.find(item=>item.label===activeDimension.value)?.colorClass
})
// --- 3. 方法实现 ---

// 加载用户信息
const loadUserInfo = () => {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}
const handlePlatform = (e) => { 
  console.log('选择平台', e);
  searchForm.platform = e
  getAccounts()
}
 // 获取所有 WhatsApp 账号（已登录且有号码的）
const getAccounts = async () => {
  const accountId = userInfo.value.accountId;
  try {
    const res = await ipc.invoke('controller.window.getSessions', { 
      platform: searchForm.platform ? searchForm.platform : 'WhatsApp',
      accountId: accountId 
    })
     console.log('res',res);
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      const loggedInAccounts = res.data
        .filter(item => item.active_status === 'true' && (item.my_phone || item.myPhone))
        .map(item => item.my_phone || item.myPhone)
      
      // 更新候选项
      availableAccounts.value = Array.from(new Set(loggedInAccounts))
      
      // 如果当前没选，且有新账号，默认选中第一个
      if (searchForm.appPhone.length === 0 && availableAccounts.value.length > 0) {
        searchForm.appPhone = availableAccounts.value[0]
      }
      appPHONEDisable.value = false
    } else { 
      availableAccounts.value = []
      appPHONEDisable.value = true
      searchForm.appPhone = ''
      console.log('⚠️ [Debug] 未找到可用账号或数据格式不正确');
    }
  } catch (err) {
    console.error('获取同步账号失败:', err)
  }
}
// 获取平台字典
const getPlatformList = async () => {
  try {
    const res = await get(`/app/dict/listData?dictType=box_platform`)
    if (res && res.code === 200) {
      platformOptions.value = res.data || []
    }
  } catch (err) {
    console.error('获取平台列表失败:', err)
  }
}

// 核心查询方法
const handleSearch = async () => {
  loading.value = true
  try {
    const  dimension=statCards.find(item=> item.label===activeDimension.value).statKey
    const data = {
      pageNum: pagination.page,
      pageSize: pagination.size,
      platform: searchForm.platform || undefined,
      appPhone: searchForm.appPhone || undefined,
      keyword: searchForm.keyword || undefined,
      dimension: dimension, 
      accountId: userInfo.value.accountId,
      addTimeBegin: searchForm.dateRange?.[0] || undefined,
      addTimeEnd: searchForm.dateRange?.[1] || undefined,
    }

    // 后端接口要求参数放在 data 对象中，或者直接 POST body
    // 根据用户提供的示例：{ pageNum: 34, ... }
    const res = await post('/app/fansStore/dashboard', data)
    
    if (res && res.code === 200) {
      const { pageData, statistics } = res.data || {}
      
      // 更新表格与分页
      tableData.value = pageData?.records || []
      pagination.total = pageData?.total || 0
      
      // 更新统计数据
      if (statistics) {
        // 如果 statistics 是对象，直接合并；如果是单值（根据维度不同），则按需处理
        if (typeof statistics === 'object') {
          Object.assign(stats, statistics)
        } else {
          const currentKey = statCards.find(item => item.label === activeDimension.value)?.statKey
          if (currentKey) stats[currentKey] = statistics
        }
      }
    } else {
      ElMessage.error(res?.msg || '获取数据失败')
    }
  } catch (err) {
    console.error('搜索异常:', err)
  } finally {
    loading.value = false
  }
}

// 切换维度
const handleDimensionChange = (statKey) => {
  activeDimension.value = statKey
  pagination.page = 1
  handleSearch()
}

// 重置搜索
const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.platform = ''
  searchForm.appPhone = ''
  searchForm.dateRange = null
  pagination.page = 1
  handleSearch()
}

// 分页处理
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
      // handleSearch()
    }, refreshInterval.value * 60 * 1000)
  }
}
// 标签颜色
const getTagType = (type) => {
  const map = {
    '新粉': 'info',
    '重粉': 'danger',
    '底粉': 'success',
    '活跃粉': 'warning'
  }
  return map[type] || ''
}

// 轨迹详情
const showTrackDetails = (row) => {
  console.log('查看轨迹详情:', row)
  // 这里可以根据实际需求实现弹窗或跳转
  ElMessage.info(`查看粉丝 ${row.fansName || row.fansPhone} 的轨迹详情`)
}

// --- 4. 生命周期 ---
onMounted(async () => {
  loadUserInfo()
  await getAccounts()
  await getPlatformList()
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
.fans-dashboard {
  height: 100%;
  background-color: #f5f7fa;
  padding: 8px 0 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-radius: 8px;
  padding: 8px 16px;
  overflow: hidden;
}

/* 统计卡片样式 */
.stats-overview {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.stat-card {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  background-color: #ffffff;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-card.active {
  border-color: var(--theme-color);
  background-color: var(--bg-color) !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.stat-card.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 4px;
  background-color: var(--theme-color);
  border-radius: 4px 4px 0 0;
}

.card-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.card-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.unit {
  font-size: 12px;
  font-weight: normal;
  margin-left: 4px;
}

/* 颜色变体 */
/* 颜色变体 */
.blue-card { --theme-color: #409eff; --bg-color: #f0f7ff; }
.red-card { --theme-color: #f56c6c; --bg-color: #fff5f5; }
.cyan-card { --theme-color: #00bcd4; --bg-color: #f0fcfe; }
.purple-card { --theme-color: #9b59b6; --bg-color: #f9f5fc; }
.green-card { --theme-color: #67c23a; --bg-color: #f0f9eb; }

.blue-card .card-icon-wrapper { background-color: #ecf5ff; color: var(--theme-color); }
.red-card .card-icon-wrapper { background-color: #fef0f0; color: var(--theme-color); }
.cyan-card .card-icon-wrapper { background-color: #e0f7fa; color: var(--theme-color); }
.purple-card .card-icon-wrapper { background-color: #f5f0fa; color: var(--theme-color); }
.green-card .card-icon-wrapper { background-color: #f0f9eb; color: var(--theme-color); }

/*看板内容*/
.main-dashboard-content { 
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 筛选区样式 */
.filter-section {
  padding: 16px 0 0 0;
  background-color: #fcfdfe;
  border-radius: 8px;
  display: flex;

}
.filter-form { 
  display: flex;
  align-items: center; 
  flex-wrap: wrap;
 
} 
.filter-form :deep(.el-form-item) {
  margin-bottom: 16px;
  margin-right: 16px;
}

.filter-form :deep(.el-form-item__label) {
  font-weight: bold;
}

/* 维度总结行 */
.dimension-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  position: relative;
  padding: 16px 12px ;
}

.dimension-summary::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 40px;
  background-color: var(--theme-color);
  border-radius: 2px;
}

.dim-label {
  font-weight: bold;
  color: #303133;
}

.dim-value {
  color: #000;
  font-weight: bold;
  font-size: 16px;
  transition: color 0.3s;
}

.dim-desc {
  color: #f56c6c;
  margin-left: 10px;
}

/* 表格样式 */
.table-container {
  flex: 1;
  overflow: hidden;
  margin: 16px 0;
}

:deep(.table-header) {
  background-color: #f8fafc !important;
  color: #333;
  font-weight: bold;
}

/* 分页 */
.pagination-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 10px;
}
</style>
