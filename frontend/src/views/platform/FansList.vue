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
          <el-select v-model="searchForm.platform" @change="handlePlatform" placeholder="平台" style="width: 120px" clearable>
            <el-option 
              v-for="item in platformOptions" 
              :key="item.dictValue" 
              :label="item.dictLabel" 
              :value="item.dictValue">
            </el-option>
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
        <el-form-item>
          <el-select v-model="searchForm.fansType" placeholder="粉丝类型" style="width: 120px" clearable>
            <el-option label="新粉" value="新粉"></el-option>
            <el-option label="重粉" value="重粉"></el-option>
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
        <el-col :span="24">
          <div class="summary-card">
            <div class="card-top">
            <div class="card-header">
              <span class="card-title">当前账号：{{userInfo.name  }}</span> 
              <span class="sub-text">(数据已当前子账号) </span>
            </div>
            <!-- <div class="card-sub-header">所属工单: --</div> -->
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">总进粉</div>
                <div class="stat-value"> {{ fansData.newFansTotal }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">总留存</div>
                <div class="stat-value">{{ fansData.retentionTotal }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">分流粉</div>
                <div class="stat-value">{{ fansData.trafficDiverters }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日进粉</div>
                <div class="stat-value">{{ fansData.newFansGainedToday }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日留存</div>
                <div class="stat-value">{{ fansData.retentionToday }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">今日新粉</div>
                <div class="stat-value">{{ fansData.newFansToday }}</div>
              </div>
            </div>
          </div>
        </el-col>

        <!-- 第二个卡片：当前工单 -->
        <!-- <el-col :span="12">
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
        </el-col> -->
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
              <el-empty description="暂无数据" :image-size="120" />
            </div>
            <!-- <div class="empty-text">当前账号未开启工单功能，如需使用，请前往中台重新添加激活码并开启工单功能。</div> -->
          </div>
        </template>
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column prop="platform" label="平台" align="center" />
        <el-table-column prop="appPhone" label="我的账号" align="center" />
        <el-table-column prop="fansPhone" label="粉丝账号" align="center" />
        <el-table-column prop="fansName" label="粉丝昵称" align="center" />
        <el-table-column prop="source" label="来源" align="center" />
        <el-table-column prop="region" label="地区" align="center" />
        <el-table-column prop="addTime" label="进粉时间" align="center" min-width="120" />
        <el-table-column prop="createTime" label="记录时间" align="center" min-width="120" />
        <el-table-column prop="repeatCount" label="重复次数" align="center" />
        <el-table-column prop="fansType" label="粉丝类型" align="center" >
          <template #default="scope">
      <el-tag :type="getTagType(scope.row.fansType)">
        {{ scope.row.fansType }}
      </el-tag>
    </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 底部操作栏 -->
    <div class="footer-section">
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
import { ref, reactive, onMounted, onUnmounted,watch } from 'vue'
import { Search, RefreshRight } from '@element-plus/icons-vue'
import { ipc } from '@/utils/ipcRenderer'
import { get,post} from '@/utils/request'
import{ getGlobalIdentification} from '@/utils/phone-identifier'
import { formatDateTime, isToday }  from '@/utils/formatTime'


// 搜索表单状态
const availableAccounts = ref([])
const searchForm = reactive({
  platform: '',
  appPhone: '',
  fansType: '',
  dateRange: null,
  keyword: ''
})
 const userInfo = ref({})
 const  fansData= reactive({
   newFansTotal:0,
   retentionTotal:0,
   trafficDiverters:0,
   newFansGainedToday:0,
   retentionToday:0,
   newFansToday:0
 })
 const fansCount = ref(0)
// 平台下拉列表
const platformOptions = ref([])
const appPHONEDisable= ref(false)
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
        .filter(item => item.online_status === 'true' && (item.my_phone || item.myPhone))
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
function toQueryString(params) { 
  const queryString = new URLSearchParams();
    
    // 添加所有参数
    Object.keys(params).forEach(key => {
      const value = params[key];
      
      // 处理数组类型参数
      if (Array.isArray(value)) {
        value.forEach(item => {
          queryString.append(key, item);
        });
      } else if (value !== undefined && value !== null && value !== '') {
        queryString.append(key, value.toString());
      }
    });
    return queryString
}
const getTagType = (type) => {
  const map = {
    '新粉': 'success',   // 绿色
    '底粉': 'primary',   // 蓝色
    '重粉': 'danger', 
    '活跃粉': 'warning'
  }
  return map[type] || 'info' // 默认灰色
}
const handleSearch = async () => {
  loading.value = true
  
  try {
    // 构造查询参数
    const params = {
      pageNum: pagination.page,
      pageSize: pagination.size,
      platform: searchForm.platform || undefined,
      keyword: searchForm.keyword || undefined,
      fansType: searchForm.fansType || undefined,
      appPhone: searchForm.appPhone || undefined,
      // appPhone: searchForm.appPhone.length > 0 ? searchForm.appPhone : undefined
    }

    // 处理时间范围
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      // 假设后端需要 YYYY-MM-DD HH:mm:ss 或时间戳
      // const startTime = new Date(searchForm.dateRange[0]);
      // const endTime = new Date(searchForm.dateRange[1]);
      const [start, end] = searchForm.dateRange;
      const startTime = formatDateTime(new Date(start).setHours(0, 0, 0, 0));
      const endTime = formatDateTime(new Date(end).setHours(23, 59, 59, 999))
      // 如果后端要求是时间戳或者字符串（此处转换为常见的基础格式，具体可按需再调）
      params.addTimeBegin = startTime;
      params.addTimeEnd = endTime;
    }
     console.log('粉丝记录params', params);
     
     const  res = await post(`/app/fansStore/pageRecord`, params)
    if (res && res.code === 200) {
      // 适配响应结构
      const data = res.data || {}
      const records = data || data.records || data.list || []
      
      // 处理地区显示
      tableData.value = records.map(item => {
        if (!item.region || item.region === '未知') {
          const fansPhone =  '+' +item.fansPhone
          const regionData = getGlobalIdentification(fansPhone)   
          item.region = regionData.data.location
        }
        // if ((!item.fansType || item.fansType === '底粉') && isToday(item.createTime)) {
        //   item.fansType = '新粉'
        // }
        return item
      })
      
      pagination.total = res.total || 0
      
    } else {
      console.error('获取粉丝列表失败:', res?.msg)
      tableData.value = []
      pagination.total = 0
    }
  } catch (err) {
    console.error('查询报错:', err)
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}


const resetSearch = () => {
  searchForm.platform = ''
  searchForm.appPhone = ''
  searchForm.fansType = ''
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
      // handleSearch()
    }, refreshInterval.value * 60 * 1000)
  }
}

const initFansStatistics = () => {
    // 显示加载状态
    console.log('正在加载粉丝统计数据...');
    
    // 定义所有需要并行获取的异步请求
    const promises = [
        fetchNewFansTotal(), //获取总进粉
       fetchNewFansToday(),   // 获取今日新增粉丝  
       fetchReferenceFans(),  //获取底粉数量
       fetchTrafficDiverters(), //获取分流粉
       fetchNewFansGainedToday(), //获取今日进粉粉丝
       fetchrRetentionToday(),
       fetchCurrentReferenceFans(), //获取今日库底粉丝
       fetchrSevenDaysRetentionToday() //获取T日新增用户T:7天
    ];
    // 使用 Promise.all 并行执行所有请求
    return Promise.all(promises)
        .then(([newFansTotal,todayNew, fansCountValue,trafficDivertersCount, newFansGainedTodayCount,retentionTodayTotal,retentionSevenDaysTotal]) => {
            // 所有请求成功后，整理数据
            const statisticsData = {
                newFansTotal:newFansTotal,// 总进粉
                newFansToday: todayNew, // 今日新增粉丝 
                updateTime: new Date().toLocaleString()
            };
            
            // 同步到 fansData 和全局 ref
            fansData.newFansToday = statisticsData.newFansToday;
            fansData.newFansTotal = statisticsData.newFansTotal;
            fansCount.value =  Number(fansCountValue); //底粉数量
            fansData.retentionTotal =   fansData.newFansTotal - fansCount.value
            fansData.trafficDiverters = trafficDivertersCount;
            fansData.newFansGainedToday = newFansGainedTodayCount;
            fansData.retentionToday  =retentionTodayTotal    
            console.log('粉丝统计数据加载完成:', statisticsData);
            return statisticsData;
        })
        .catch((error) => {
            // 捕获任意一个请求失败的错误
            console.error('加载粉丝统计数据失败:', error);
            throw error;
        });
};
//获取总进粉 （注：不包含平台，子账号所有粉丝）
const fetchNewFansTotal = async()=>{ 
  const params=  {
       pageSize:1,
       pageNum:10000
  } 
  const  res = await post(`/app/fansStore/pageRecord`, params)
   const  newFansTotal = res.total || 0
  return newFansTotal
}
//获取今日新增粉丝 今日新粉 （注：账号今日新增粉丝，过滤底粉）
const  fetchNewFansToday = async() => { 
      const params= { 
        pageSize:10000,
        pasgeNum:1,
        addTimeBegin : formatDateTime(new Date().setHours(0, 0, 0, 0)),
        addTimeEnd : formatDateTime(new Date().setHours(23, 59, 59, 999)),
         appPhone: searchForm.appPhone || undefined,
        fansType:'底粉'

      }
      console.log('新粉粉丝', params);
      const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('新粉粉丝数量', res)
     const todayNew = res.total 
     return todayNew   
}
//获取今日进粉粉丝 （注：账号今日进粉粉丝， 不过滤底粉）
const  fetchNewFansGainedToday = async() => { 
      const params= { 
        pageSize:10000,
        pasgeNum:1,
        addTimeBegin : formatDateTime(new Date().setHours(0, 0, 0, 0)),
        addTimeEnd : formatDateTime(new Date().setHours(23, 59, 59, 999)),
        appPhone: searchForm.appPhone || undefined,

      }
      console.log('今日进粉粉丝', params);
    const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('新粉粉丝数量', res)
     const newFansGainedTodayCount= res.total 
     return newFansGainedTodayCount   
}
//获取底库粉丝 （注：获取分流粉）
const  fetchTrafficDiverters= async()=>{ 
  console.log('当前手机号', searchForm.appPhone);
  const params= { 
        pageSize:10000,
        pasgeNum:1,
        fansType: '底粉',
         appPhone: searchForm.appPhone || undefined,
      }
      console.log('底粉粉丝', params);
    const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('底库粉丝数量', res)
     const trafficDivertersCount = res.total 
     return trafficDivertersCount  
}
//获取所有底库粉丝 
const  fetchReferenceFans= async()=>{
  console.log('当前手机号', searchForm.appPhone);
  const params= { 
        pageSize:10000,
        pasgeNum:1,
        fansType: '底粉',
        //  appPhone: searchForm.appPhone || undefined,
      }
      console.log('所有底库粉丝 参数', params);
    const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('所有底库粉丝数量', res)
     const fansCount = res.total 
     return fansCount  
}
//获取当前账号底库粉丝 
const  fetchCurrentReferenceFans= async()=>{
  console.log('当前手机号', searchForm.appPhone);
  const params= { 
        pageSize:10000,
        pasgeNum:1,
        addTimeBegin : formatDateTime(new Date().setHours(0, 0, 0, 0)),
        addTimeEnd : formatDateTime(new Date().setHours(23, 59, 59, 999)),
        fansType: '底粉',
        appPhone: searchForm.appPhone || undefined,
      }
      console.log('底粉粉丝', params);
    const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('今日底粉粉丝数量', res)
     const currentReferenceFans = res.total  || 0
     return currentReferenceFans
}
//获取今日留存
const fetchrRetentionToday= async()=> { 
  // 获取昨天的日期范围
  const yesterday = new Date(); // 今天
  yesterday.setDate(yesterday.getDate() - 1); // 昨天
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0); // 昨天 00:00:00
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // 昨天 23:59:59
   const params= { 
        pageSize:10000,
        pasgeNum:1,
        addTimeBegin : formatDateTime(startOfYesterday),
        addTimeEnd : formatDateTime(endOfYesterday),
         appPhone: searchForm.appPhone || undefined,
        fansType:'底粉'  

      }
      console.log('今日留存粉丝参数', params);
    const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('今日留存粉丝数量', res)
     const retentionTodayTotal = res.total || 0
     return retentionTodayTotal   
}
//获取T日新增用户 T:7天
  const fetchrSevenDaysRetentionToday= async()=> { 
  // 获取昨天的日期范围
  const sevenday = new Date(); // 今天
  const yesterday = new Date(); // 今天
  yesterday.setDate(yesterday.getDate() - 1); // 昨天
  sevenday.setDate(sevenday.getDate() - 7); // 七天前
  const startOfYesterday = new Date(sevenday);
  startOfYesterday.setHours(0, 0, 0, 0); // 七天前 00:00:00
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // 昨天 23:59:59
   const params= { 
        pageSize:10000,
        pasgeNum:1,
        addTimeBegin : formatDateTime(startOfYesterday),
        addTimeEnd : formatDateTime(endOfYesterday),
         appPhone: searchForm.appPhone || undefined,
        fansType:'底粉'  

      }
      console.log('T7日留存粉丝参数', params);
    const  res = await post(`/app/fansStore/pageRecord`, params)
      console.log('T7日留存粉丝数量', res)
     const retentionSevenDaysTotal = res.total || 0
     return retentionSevenDaysTotal   
} 
//获取重粉数据
  const fetchHeavyPowder= async()=> { 

   const params= { 
        pageSize:10000,
        pasgeNum:1,
        addTimeBegin : '',
        addTimeEnd : '',
         appPhone: '',
        fansType:'重粉'  
      }
      const pageParams= {
        pageSize:10000,
        pasgeNum:1, 
      }
      const  queryString =  toQueryString(pageParams)
      console.log('重粉粉丝参数', params);
    const  res = await post(`/app/fansStore/pageRecord?${queryString.toString()}`, params)
      console.log('重粉粉丝数据', res)

}
const loadUserInfo = () => {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}
onMounted(async () => {
  // 获取已有的账号列表
  loadUserInfo()
  await getAccounts()
  await getplatformList()
  // 监听登录通知，实时更新账号列表
  ipc.on('online-notify', (event, args) => {
    console.log('FansList 收到登录通知:', args)
    getAccounts()
  })

  handleSearch()
  initFansStatistics()
  startAutoRefresh()
  fetchHeavyPowder()
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
    border-bottom: 1px solid #e5e7eb;
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
  display: flex;
  flex-direction: column;
  align-items: baseline;
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
  margin-top: 12px;
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
  margin-top: 10px;
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
