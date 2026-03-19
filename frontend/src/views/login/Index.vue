<template>
  <div class="login-page">
    <div class="login-container">
      <div class="info-container">
        <div ref="animationContainer" class="animation">
          <img src ="@/assets/images/logo_bg.png" class="bg-img" />
        </div>
      </div>
    
      <div class="login-form">
        <!-- 语言切换 -->
        <div class="select-language">
          <el-dropdown @command="switchLang" trigger="click">
            <span class="lang-trigger">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              {{ currentLocale === 'zh' ? '简体中文' : (currentLocale === 'en' ? 'English' : 'Français') }}
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh" :class="{ 'is-active': currentLocale === 'zh' }">简体中文</el-dropdown-item>
                <el-dropdown-item command="en" :class="{ 'is-active': currentLocale === 'en' }">English</el-dropdown-item>
                <el-dropdown-item command="fr" :class="{ 'is-active': currentLocale === 'fr' }">Français</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="logo">
          <img src="@/assets/images/logo.png" alt="Logo" class="logo-img" />
          <h1 class="hero-title">
            <span class="gradient-text">Chat365</span>
          </h1>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          class="input-container"
          @submit.prevent
        >
          <el-form-item prop="userName">
            <el-input v-model="form.userName" :placeholder="t('login.usernamePlaceholder')" :prefix-icon="User" class="input-item" size="large" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" :placeholder="t('login.passwordPlaceholder')" :prefix-icon="Lock" type="password" show-password class="input-item" size="large" />
          </el-form-item>
          <el-form-item v-if="isMachineCode">
            <el-input v-model="form.machineCode" :placeholder="t('login.machineCodePlaceholder')" readonly class="input-item">
              <template #append>
                <el-button size="large" @click="copyMachineCode" :icon="DocumentCopy" />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="agree" class="form-item-agree">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <label class="agreement-label">
                <input type="checkbox" v-model="form.agree" class="agreement-checkbox" />
                <span class="agreement-text">{{ t('login.agreeText') }}</span>
                <a href="javascript:void(0)" class="agreement-link" @click="handleAgreementClick">{{ t('login.agreementLink') }}</a>
              </label>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-if="isMachineCode" @click="handleLogin" :loading="submitLoading" class="login-button">{{ t('login.loginBtn') }}</el-button>
            <el-button type="primary" v-else @click="handleAccountLogin" :loading="submitLoading" class="login-button">{{ t('login.loginBtn') }}</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import lottie from "lottie-web";
import animationData from "@/assets/json/bg.json";
import Notification from "@/utils/notification";
import {decrypt, encrypt} from "@/utils/rsaEncrypt";
import {post,get} from "@/utils/request";
import {ipc} from "@/utils/ipcRenderer";
import { useI18n } from 'vue-i18n';

import { DocumentCopy, User, Lock } from '@element-plus/icons-vue'
import {onMounted, reactive, ref} from 'vue';
import { useRouter } from 'vue-router';

const { t, locale } = useI18n();
const currentLocale = ref(localStorage.getItem('app-locale') || 'zh');
const switchLang = (lang) => {
  locale.value = lang;
  currentLocale.value = lang;
  localStorage.setItem('app-locale', lang);
};

const submitLoading = ref(false)
const formRef = ref(null)

const animationContainer = ref(null);
const  isMachineCode = ref(false)
const firstTranslateSetting = ref(false)
const config = reactive({
  // 发送设置
  sendAutoTranslate: true,
  sendChannel: 'Baidu',
  sendTargetLang: 'en',
  translatePreview: false,
  blockChineseMessage: false,
  blockChineseTranslation: true,
  // 接收设置
  receiveAutoTranslate: true,
  receiveChannel: 'Baidu',
  receiveTargetLang: 'zh',
  // manualTranslate: true,
  // 聊天列表
  showTranslateConfig: true,
  // showSourcePlatform: false,
  // 智能转发
  // groupAutoTranslate: false
})
onMounted(() => {
  // lottie.loadAnimation({
  //   container: animationContainer.value, // 动画容器
  //   renderer: 'svg',
  //   loop: true,
  //   autoplay: true,
  //   animationData: animationData, // 动画数据
  // });
});




// 复制机器码功能
const copyMachineCode = ()=>{
  // 创建一个临时文本输入元素
  const tempInput = document.createElement('input');
  tempInput.value = form.machineCode;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  // 提示用户复制成功
  Notification.message({ message: '机器码已复制到剪贴板', type: 'success' });
}

// # 定义通信频道，即路由
const ipcApiRoute = {
  getMachineCode: 'controller.login.getMachineCode',
  saveAuthCode: 'controller.login.saveAuthCode',
  saveAuthToken: 'controller.login.saveAuthToken',
}

onMounted(()=>{
  //初始化机器码
  ipc.invoke(ipcApiRoute.getMachineCode, {}).then(res => {
    console.log('res',res);
    
    if (res.status){
      form.machineCode = res.data.machineCode
      // initializeTranslateConfig()
      
      // 读取记住的账号密码
      const savedUser = localStorage.getItem('rememberedUser');
      if (savedUser) {
        try {
          const { userName, password,agree } = JSON.parse(savedUser);
          form.userName = userName;
          form.password = password;
          form.agree = true;
        } catch (e) {
          console.error('解析记住的账号失败', e);
        }
      }
    }else {
      Notification.message({ message: '初始化错误请重试', type: 'warning' });
    }
  })
  
})

const form = reactive({
  userName: '',
  password: '',
  machineCode: '',
  line: '',
  agree: false,
  remember: false,
});
const router = useRouter();

// 跳转用户协议
const handleAgreementClick = () => {
  const isDev = import.meta.env.MODE === 'development'
  if (isDev) {
    window.open('http://192.168.3.18/user-agreement/index', '_blank')
  } else {
    window.open('https://chat365.cc/user-agreement/index', '_blank')
  }
}

// ===== 表单校验规则（跟随语言实时更新） =====
import { computed } from 'vue';
const rules = computed(() => ({
  userName: [
    { required: true, message: t('login.usernameRequired'), trigger: 'blur' }
  ],
  password: [
    { required: true, message: t('login.passwordRequired'), trigger: 'blur' }
  ],
  agree: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error(t('login.agreeRequired')));
        } else {
          callback();
        }
      },
      trigger: 'change'
    }
  ]
}));

function initializeTranslateConfig() {
  try {
    if (!localStorage.getItem('translateConfig')) {
      localStorage.setItem('translateConfig', JSON.stringify(config))

    }
  } catch (error) {
    console.error('配置初始化失败:', error)
  }
}
const handleAccountLogin = async () => {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true;

  
  const payload = {
    username: form.userName,
    password: form.password,
    macCode: form.machineCode
  };

  try {
    // 1. 用户名登录
    const loginRes = await post("/app/account/login", payload);
    if (loginRes.code === 200) {
      // 缓存 token
      localStorage.setItem('box-token', loginRes.data);
      
      // 同步 Token 到主进程
      await ipc.invoke(ipcApiRoute.saveAuthToken, { token: loginRes.data });
      
      // 2. 并行获取用户信息和租户配置
      const [infoRes, tenantRes] = await Promise.all([
        get("/app/account/getInfo"),
        get("/app/tenantSetting")
      ]);

      // 处理用户信息
      if (infoRes.code === 200) {
        localStorage.setItem('userInfo', JSON.stringify(infoRes.data));
      }

      // 处理租户配置
      if (tenantRes.code === 200) {
        console.log('配置tenantRes', tenantRes);
        const tenantConfig = { 
          ...JSON.parse(tenantRes.data.triggerSetting || '{}'), 
          ...JSON.parse(tenantRes.data.interceptedSetting || '{}') 
        };
        console.log('tenantConfig', tenantConfig);
        // localStorage.setItem('tenantConfig', JSON.stringify(tenantConfig));
        
        // 关键：确保同步到主进程后再跳转
        // await ipc.invoke('save-tenant-config', tenantConfig);
        console.log('租房配置已同步到主进程');
      }

      Notification.message({ message: '登录成功', type: 'success' });
      // 登录成功后跳转到主页
    
      if (localStorage.getItem('translateConfig')) {
           router.replace({ name: 'HomeIndex' });
           firstTranslateSetting.value = false
      }else { 
           router.replace({name:'SettingsIndex'})
           firstTranslateSetting.value = true
        }
        localStorage.setItem('firstTranslateSetting', firstTranslateSetting.value);
           // 记住密码逻辑
      if (form.agree) {
        localStorage.setItem('rememberedUser', JSON.stringify({
          userName: form.userName,
          password: form.password,
          agree:form.agree
        }));
      } else {
        localStorage.removeItem('rememberedUser');
      }
    } else {
      Notification.message({ message: loginRes.msg || '登录失败', type: 'error' });
    }
  } catch (error) {
    console.error('登录异常:', error);
    // request.js 已经处理了大部分错误提示，除非是非请求类错误或者明确未处理的错误
    if (!error.isHandled) {
      Notification.message({ message: '网络请求失败，请稍后重试', type: 'error' });
    }
  } finally {
    submitLoading.value = false;
  }
};
const handleLogin = async () => {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitLoading.value = true
  //获取本机唯一机器码
  let oldTimestamp = new Date().getTime().toString();
  let machineCode = form.machineCode
  if (machineCode === '' || machineCode === undefined) {
    Notification.message({ message: '机器码不能为空', type: 'error' });
    submitLoading.value = false
    return;
  }
  let data = {machineCode: machineCode,authCode: '',timestamp: oldTimestamp};

  let jsonData = {timestamp: oldTimestamp,jsonData: encrypt(JSON.stringify(data))};
  post("/authManage/clientAuth",jsonData).then(res => {
    if (res.code === 200) {
      const {timestamp,jsonData} = res.data
      let authData = JSON.parse(decrypt(jsonData));
      if (timestamp.toString() === authData.timestamp.toString()) {
        //判断是否过期
        let expiryDate = authData.expiryDate;
        const currentTime = Date.now()
        if (expiryDate < currentTime) {
          Notification.message({ message: '账号已到期请联系管理员续费', type: 'error' });
          submitLoading.value = false
          return;
        }
        //存储授权码
        ipc.invoke(ipcApiRoute.saveAuthCode, authData).then(res => {
          if (res.status) {
            Notification.message({ message: '验证成功', type: 'success' });
            submitLoading.value = false
            //跳转页面
            router.replace({ name: 'HomeIndex' })
          }else {
            Notification.message({ message: '网络连接异常请重试', type: 'warning' });
          }
        })
      }else {
        Notification.message({ message: '验证失败', type: 'error' });
        submitLoading.value = false
      }
    }
  }).catch(error => {
    submitLoading.value = false
  })
};
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: #f5f8fa;
}

.login-container {
  display: flex;
  width: 100%;
  height: 100%;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.1);
}

.info-container {
  width: 82%;
  padding: 0;
  color: white;
  /* background-color: #2878f0; */
  background-color: #ffffff;
  position: relative;
  overflow: hidden;
}

.info-container h2 {
  font-size: 24px;
  margin-bottom: 10px;
}

.info-container p {
  font-size: 16px;
  text-align: center;
}

.animation {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.bg-img {
  width: 100%;
   height: 100%; 
  object-fit: cover; 
}

.login-form {
  width: 40%;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #ffffff;
  justify-content: center;
  position: relative;
}
.select-language { 
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 1px solid #dedede;
  border-radius: 4px;
  width: 100px;
}
.logo {
  text-align: center;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  width: 68px;
  height: auto;
  margin-bottom: 15px;
}

.hero-title {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.gradient-text {
  font-size: 60px;
  /* background: linear-gradient(90deg, #f4da0d, #67e76a, rgba(189, 21, 21, 0.99), #119ee2, #fbc2eb); */
  background-color: #2377dd;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1rem;
  color: #666;
  margin-top: 0.5rem;
}

.input-container {
  width: 100%;
  margin-top: 30px;
  display: flex;
  flex-direction: column; /* 垂直排列 */
  justify-content: center; /* 垂直居中 */
}

.input-item {
  margin-bottom: 8px; /* 增加间距 */
}

.input {
  width: 100%;
  padding: 15px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  outline: none;
  font-size: 16px;
}

.forgot-password {
  color: #888;
  font-size: 14px;
  margin-top: 10px;
  text-decoration: none;
}

.login-button {
  margin-top: 20px;
  width: 100%; /* 改成全宽 */
  height: 50px;
  border-radius: 25px; /* 圆角 */
  background-color: #28a745;
  color: white;
  font-size: 16px;
  font-weight: bold;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s;
}

.login-button:hover {
  background-color: #218838; /* 悬停效果 */
}

/* agree form-item 减少底部空间 */
.form-item-agree {
  margin-bottom: 0;
}

/* 让包含登录按钮的 form-item 撑满宽度 */
:deep(.el-form-item__content) {
  width: 100%;
}

.service-agreement {
  width: 100%;
  margin-top: 8px;
  margin-bottom: 2px;
}

.agreement-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.agreement-checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: #28a745;
}

.agreement-text {
  font-size: 13px;
  color: #555;
}

.agreement-link {
  font-size: 13px;
  color: #28a745;
  text-decoration: none;
}


</style>
