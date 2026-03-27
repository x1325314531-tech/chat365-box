<template>
  <div class="login-page">
    <!-- 顶部语言切换 -->
    <div class="header-tools">
      <el-dropdown @command="switchLang" trigger="click" class="lang-dropdown">
        <div class="lang-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span class="lang-text">{{ currentLocale === 'zh' ? '简体中文' : (currentLocale === 'en' ? 'English' : 'Français') }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="zh" :class="{ 'is-active': currentLocale === 'zh' }">简体中文</el-dropdown-item>
            <el-dropdown-item command="en" :class="{ 'is-active': currentLocale === 'en' }">English</el-dropdown-item>
            <el-dropdown-item command="fr" :class="{ 'is-active': currentLocale === 'fr' }">Français</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 居中登录框包裹区 -->
    <div class="login-wrapper">
      <!-- 左侧留白区，确保不遮挡背景图左侧文字 -->
      <div class="login-spacer"></div>
      
      <div class="login-form">
        <div class="logo-container">
          <img src="@/assets/images/logo.png" alt="Logo" class="form-logo" />
          <span class="logo-text">Chat 365</span>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          class="input-container"
          @submit.prevent
        >
          <el-form-item prop="userName">
            <el-input 
              v-model="form.userName" 
              :placeholder="t('login.usernamePlaceholder')" 
              class="custom-input" 
              size="large"
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input 
              v-model="form.password" 
              :placeholder="t('login.passwordPlaceholder')" 
              type="password" 
              show-password 
              class="custom-input" 
              size="large"
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item v-if="isMachineCode">
            <el-input v-model="form.machineCode" :placeholder="t('login.machineCodePlaceholder')" readonly class="custom-input" size="large">
              <template #append>
                <el-button size="large" @click="copyMachineCode" :icon="DocumentCopy" />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="agree" class="form-item-agree">
            <div class="agreement-wrapper">
              <label class="agreement-label">
                <input type="checkbox" v-model="form.agree" class="agreement-checkbox" />
                <span class="checkbox-custom"></span>
                <span class="agreement-text">{{ t('login.agreeText') }}</span>
                <a href="javascript:void(0)" class="agreement-link" @click="handleAgreementClick">【{{ t('login.agreementLink') }}】</a>
              </label>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button 
              type="primary" 
              v-if="isMachineCode" 
              @click="handleLogin" 
              :loading="submitLoading" 
              class="submit-btn"
            >
              {{ t('login.loginBtn') }}
            </el-button>
            <el-button 
              type="primary" 
              v-else 
              @click="handleAccountLogin" 
              :loading="submitLoading" 
              class="submit-btn"
            >
              {{ t('login.loginBtn') }}
            </el-button>
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
  width: 100vw;
  height: 100vh;
  background: url('@/assets/images/chat_login_bg.png') no-repeat;
  background-size: cover;
  background-position: left center;
  position: relative;
  overflow: hidden;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 顶部语言切换按钮 */
.header-tools {
  position: absolute;
  top: 24px;
  right: 32px;
  z-index: 100;
}

.lang-btn {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 14px;
  border-radius: 100px;
  cursor: pointer;
  color: #333;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 1);
}

.lang-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  background: #ffffff;
}

.lang-text {
  margin: 0 8px;
  font-weight: 500;
}

/* 核心布局区 */
.login-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 4% 0 6%; /* 增加左侧内边距，给背景图留白 */
  align-items: center;
  position: relative;
  z-index: 2;
}

.login-spacer {
  flex: 1.8; /* 进一步增大左侧弹性占比，将表单推向极右侧 */
  min-width: 400px; /* 设置硬性最小宽度，保护背景图文字区 */
}

/* 登录表单卡片 - Glassmorphism */
.login-form {
  flex: 0 0 440px; /* 固定宽度 */
  padding: 48px;
  background: rgba(230, 245, 255, 0.65);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1.5px solid rgba(255, 255, 255, 0.7);
  border-radius: 32px;
  box-shadow: 0 20px 60px rgba(0, 50, 100, 0.12);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Logo 样式还原 */
.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.form-logo {
  width: 48px;
  height: 48px;
  margin-right: 12px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.logo-text {
  font-size: 30px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

.input-container {
  width: 100%;
}

/* 输入框改版 */
.custom-input {
  margin-bottom: 4px;
}

:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.95) !important;
  border: 1px solid transparent !important;
  box-shadow: none !important;
  border-radius: 12px !important;
  height: 56px;
  padding: 0 16px !important;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper.is-focus) {
  background-color: #ffffff !important;
  border-color: #17A948 !important;
  box-shadow: 0 0 0 4px rgba(23, 169, 72, 0.1) !important;
}

:deep(.el-input__inner) {
  font-size: 15.5px;
  color: #222;
}

:deep(.el-input__prefix) {
  font-size: 18px;
  margin-right: 8px;
  color: #a0a0a0;
}

/* 复选框与协议条 */
.form-item-agree {
  margin-top: 12px;
  margin-bottom: 20px;
}

.agreement-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}

.agreement-label {
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
}

.agreement-checkbox {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-custom {
  height: 18px;
  width: 18px;
  background-color: #fff;
  border: 2px solid #dcdfe6;
  border-radius: 5px;
  margin-right: 10px;
  position: relative;
  transition: all 0.2s ease;
}

.agreement-checkbox:checked ~ .checkbox-custom {
  background-color: #17A948;
  border-color: #17A948;
}

.checkbox-custom:after {
  content: "";
  position: absolute;
  display: none;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.agreement-checkbox:checked ~ .checkbox-custom:after {
  display: block;
}

.agreement-text {
  color: #666;
}

.agreement-link {
  color: #17A948;
  text-decoration: none;
  font-weight: 500;
  margin-left: 2px;
}

.agreement-link:hover {
  text-decoration: underline;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  height: 56px;
  border-radius: 12px;
  background-color: #17A948 !important;
  border: none !important;
  color: #ffffff !important;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 4px;
  transition: all 0.3s ease;
  box-shadow: 0 8px 16px rgba(23, 169, 72, 0.2);
}

.submit-btn:hover {
  background-color: #138D3C !important;
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(23, 169, 72, 0.3);
}

.submit-btn:active {
  transform: translateY(1px);
}

/* 响应式适配 */
@media screen and (max-width: 1440px) {
  .login-spacer {
    flex: 1.4;
    min-width: 320px;
  }
}

@media screen and (max-width: 1200px) {
  .login-wrapper {
    padding: 0 3% 0 5%;
  }
  .login-form {
    flex: 0 0 400px;
    padding: 36px;
  }
  .login-spacer {
    flex: 1.2;
    min-width: 200px;
  }
}

/* 专项优化：984px 左右的窗口，让表单进一步缩窄并保持靠右，不要居中 */
@media screen and (max-width: 1100px) and (min-width: 851px) {
  .login-page {
    background-position: left center; /* 确保文字靠左不移动 */
  }
  .login-form {
    flex: 0 0 370px; /* 缩窄表单 */
    padding: 30px;
  }
  .login-spacer {
    flex: 2; /* 增大间距占比，强力推向右侧 */
  }
  .logo-container {
    margin-bottom: 30px;
  }
}

/* 只有当宽度极其有限时，才切换为居中模式 */
@media screen and (max-width: 850px) {
  .login-page {
    background-position: 25% center;
  }
  .login-wrapper {
    justify-content: center;
    padding: 0 24px;
  }
  .login-spacer {
    display: none;
  }
  .login-form {
    width: 100%;
    max-width: 400px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 30px 80px rgba(0, 50, 100, 0.15);
  }
}

@media screen and (max-width: 500px) {
  .login-form {
    padding: 30px 24px;
    border-radius: 20px;
  }
}

@media screen and (max-height: 750px) {
  .login-form {
    padding: 30px 48px;
  }
  .logo-container {
    margin-bottom: 28px;
  }
  :deep(.el-input__wrapper) {
    height: 50px;
  }
  .submit-btn {
    height: 50px;
  }
}

:deep(.el-form-item__content) {
  width: 100%;
}

</style>
