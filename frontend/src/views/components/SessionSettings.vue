<script setup>
import { reactive, onMounted, watch } from 'vue';
import { ipc } from '@/utils/ipcRenderer';
import { post, put } from "@/utils/request";
import { nanoid } from 'nanoid';
import { ElMessage } from 'element-plus';

const props = defineProps({
  card: {
    type: Object,
    default: null
  },
  platform: {
    type: String,
    required: true
  },
  isEdit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['confirm', 'cancel']);

const configForm = reactive({
 cardId: '',
  name: '',
  userAgent: '',
  cookie: '',
  proxyStatus: 'false',
  proxy: 'noProxy',
  host: '',
  port: '',
  username: '',
  password: ''
});

const ipcApiRoute = {
  addSession: 'controller.window.addSession',
  getConfigInfo: 'controller.window.getConfigInfo',
  addConfigInfo: 'controller.window.addConfigInfo',
};

const fetchConfig = () => {
  if (props.isEdit && props.card) {
     console.log('prps',props.card);
    const args = { cardId: props.card.card_id };
    const fieldMapping = {
      cardId: 'cardId',
      name: 'name',
      user_agent: 'userAgent',
      cookie: 'cookie',
      proxy_status: 'proxyStatus',
      proxy_type: 'proxy',
      proxy_host: 'host',
      proxy_port: 'port',
      proxy_username: 'username',
      proxy_password: 'password'
    };
    ipc.invoke(ipcApiRoute.getConfigInfo, args).then((res) => {
      if (res.status) {
        for (const key in fieldMapping) {
          if (res.data.hasOwnProperty(key)) {
            const formField = fieldMapping[key];
            configForm[formField] = res.data[key];
          }
        }
        configForm.card_id = props.card.card_id;
       
        

      }
    });
  } else {
    // Reset form for new session
    Object.keys(configForm).forEach(key => {
      if (key === 'proxyStatus') configForm[key] = 'false';
      else if (key === 'proxy') configForm[key] = 'noProxy';
      else configForm[key] = '';
    });
    configForm.cardId = nanoid();
  }
};

onMounted(() => {
  fetchConfig();
});

watch(() => props.card, () => {
  fetchConfig();
});

const confirmClick = () => {
  const moreOptions = JSON.stringify(configForm);
  const data = {
    sessionName: configForm.name,
    avatarUrl: '',
    groupName: '',
    moreOptions: moreOptions,
    status: 0,
    platform: props.platform,
    cardId: configForm.cardId,
    activeStatus: 0,
  };
  console.log('cans',configForm );
  
  const requestMethod = props.isEdit ? put : post;
  
  requestMethod('/app/session', data).then(res => {
    if (res.code === 200) {
      // Sync with IPC
      const argsConfig = {
        card_id: data.cardId,
        name: configForm.name,
        user_agent: configForm.userAgent,
        cookie: configForm.cookie,
        proxy_status: configForm.proxyStatus || 'false',
        proxy_type: configForm.proxy || '',
        proxy_host: configForm.host || '',
        proxy_port: configForm.port || '',
        proxy_username: configForm.username || '',
        proxy_password: configForm.password || ''
      };
     const args = {
       activeStatus: false,
       cardId: configForm.cardId,
      title: '',
      online:  false,
    platform: props.platform,
  };
  console.log('args', args);
  
  ipc.invoke(ipcApiRoute.addSession, args).then((res) => {
    console.log('huh',res );
    
    if (res.status) {
    //   conversations.push(card);
      // 更新选中状态
      emit('handleSetActiveStatus')
    }
    // addLoading.value = false;
  })

      ipc.invoke(ipcApiRoute.addConfigInfo, args).then(ipcRes => {
        ElMessage.success(props.isEdit ? '修改成功' : '添加成功');
        emit('confirm');
      });
    }
  });
};

const cancelClick = () => {
  emit('cancel');
};
</script>

<template>
  <div class="settings-container">
    <div class="settings-header">
      <h3>{{ isEdit ? '修改会话' : '新建会话' }}</h3>
    </div>
    <div class="settings-body">
      <el-form :model="configForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="24">
            <h4 class="section-title">指纹配置 </h4>
          </el-col>
          <el-col :span="24">
            <el-form-item label="会话昵称">
              <el-input v-model="configForm.name" placeholder="请输入名称"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="UserAgent">
              <el-input v-model="configForm.userAgent" placeholder="请输入 User Agent"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="Cookie">
              <el-input type="textarea" :rows="3" v-model="configForm.cookie" placeholder="请输入 Cookie"></el-input>
            </el-form-item>
          </el-col>

          <el-col :span="24">
            <h4 class="section-title">代理配置</h4>
          </el-col>
          <el-col :span="24">
            <el-form-item label="代理开关">
              <el-switch
                  v-model="configForm.proxyStatus"
                  active-value="true"
                  inactive-value="false"
                  active-text="开启"
                  inactive-text="关闭">
              </el-switch>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="选择代理">
              <el-select v-model="configForm.proxy" placeholder="请选择代理" style="width: 100%">
                <el-option label="No Proxy" value="noProxy"></el-option>
                <el-option label="HTTP" value="http"></el-option>
                <el-option label="HTTPS" value="https"></el-option>
                <el-option label="SOCKS5" value="socks5"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="主机">
              <el-input v-model="configForm.host" placeholder="请输入主机"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="端口">
              <el-input v-model="configForm.port" placeholder="请输入端口"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="用户名">
              <el-input v-model="configForm.username" placeholder="请输入用户名"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="密码">
              <el-input type="password" v-model="configForm.password" placeholder="请输入密码"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
    <div class="settings-footer">
      <el-button @click="cancelClick">取消</el-button>
      <el-button type="primary" @click="confirmClick">保存修改</el-button>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  width: 100%;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  margin: 20px auto;
  position: relative;
  z-index: 1000;
}
.settings-header {
  margin-bottom: 20px;
  text-align: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.settings-body {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 10px;
}
.settings-body::-webkit-scrollbar {
  width: 6px;
}
.settings-body::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}
.section-title {
  margin: 15px 0 10px;
  padding-left: 10px;
  border-left: 4px solid #409EFF;
  color: #333;
}
.settings-footer {
  margin-top: 20px;
  text-align: center;
  border-top: 1px solid #eee;
  padding-top: 20px;
}
</style>
