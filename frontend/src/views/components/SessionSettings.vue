<script setup>
import { reactive, onMounted, watch, ref, computed } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ipc } from '@/utils/ipcRenderer';
import { post, put, get } from "@/utils/request";
import { nanoid } from 'nanoid';
import { ElMessage } from 'element-plus';
import moment from 'moment-timezone';

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


const activeTab = ref('fingerprint');
const configForm = reactive({
  sessionId:'',
 cardId: '',
  name: '',
  fingerprintSwitch: false,
  browser: 'Chrome随机版本',
  os: 'Windows',
  userAgent: '',
  webglMetadata: '真实',
  webglVendor: '',
  webglRenderer: '',
  webgpu: '基于WebGL',
  webglImage: '噪音',
  webrtc: '替换',
  timezone: '基于IP',
  geolocation: '关闭',
  geolocationCustom: false,
  language: '基于IP',
  resolution: '真实',
  resolutionWidth: '',
  resolutionHeight: '',
  cookie: '',
  // 新增指纹配置
  font: '真实',
  fontCustom: '',
  canvas: '噪音',
  audioContext: '噪音',
  mediaDevices: '噪音',
  clientRects: '噪音',
  speechVoices: '噪音',
  cpuCores: '真实',
  cpuCoresCustom: '',
  memory: '真实',
  memoryCustom: '',
  doNotTrack: true,
  screen: '噪音',
  battery: '噪音',
  portScanProtection: true,
  languages: ['英语', '英语 (美国)'],
  // 代理配置
  proxyStatus: 'false',
  proxy: 'noProxy',
  host: '',
  port: '',
  username: '',
  password: ''
});
const timezoneList = ref([]);
const addLanguageVisible = ref(false);
const languageSearchQuery = ref('');
const allLanguages = ref([]);
const selectedLanguagesInDialog = ref([]);

const fontDialogVisible = ref(false);
const fontSearchQuery = ref('');
const allFonts = ref([
  'Academy Engraved LET Fonts', 'ADTNumeric', 'Agave', 'Al Bayan', 'Al Nile', 'Al Tarikh', 'AlBayan', 'Aldhabi', 'American Typewriter', 'Andale Mono', 'Apple Color Emoji', 'Apple SD Gothic Neo', 'Arial', 'Arial Black', 'Arial Hebrew', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72', 'Bodoni 72 Oldstyle', 'Bodoni Ornaments', 'Bradley Hand', 'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier', 'Courier New', 'DIN Alternate', 'DIN Condensed', 'Didot', 'Emoji', 'Futura', 'Galvji', 'Geeza Pro', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'ITF Devanagari', 'Impact', 'InaiMathi', 'Iowan Old Style', 'Kailasa', 'Kannada MN', 'Kefa', 'Khmer MN', 'Kohinoor Bangla', 'Kohinoor Devanagari', 'Kohinoor Gujarati', 'Kohinoor Telugu', 'Lao MN', 'Lucida Grande', 'Luminari', 'Malayalam MN', 'Marion', 'Marker Felt', 'Menlo', 'Microsoft Sans Serif', 'Mishafi', 'Monaco', 'Myanmar MN', 'Noteworthy', 'Noto Sans Kannada', 'Noto Sans Myanmar', 'Noto Sans Oriya', 'Optima', 'Oriya MN', 'Palatino', 'Papyrus', 'Party LET', 'PingFang HK', 'PingFang SC', 'PingFang TC', 'PT Mono', 'PT Sans', 'PT Serif', 'Rockwell', 'Savoye LET', 'Segoe UI', 'Seravek', 'Shree Devanagari 714', 'SignPainter', 'Skia', 'Snell Roundhand', 'STHeiti', 'STIXGeneral', 'STIXIntegralsD', 'STIXIntegralsSm', 'STIXIntegralsUp', 'STIXNonUnicode', 'STIXSizeFiveSym', 'STIXSizeFourSym', 'STIXSizeOneSym', 'STIXSizeThreeSym', 'STIXSizeTwoSym', 'STIXVariants', 'Symbol', 'Tahoma', 'Tamil MN', 'Telugu MN', 'Thonburi', 'Times', 'Times New Roman', 'Trattatello', 'Trebuchet MS', 'Verdana', 'Waseem', 'Webdings', 'Wingdings'
]);
const selectedFontsInDialog = ref([]);
const cpuCoresOptions= ref([
  { 
  value: '2',
  label: '2核'
},
  { 
  value: '4',
  label: '4核'
},
  { 
  value: '6',
  label: '6核'
},
  { 
  value: '8',
  label: '8核'
},
  { 
  value: '12',
  label: '12核'
},
  { 
  value: '16',
  label: '16核'
},

])
const memoryOptions =ref([
  { 
    label:'2GB',
    value:'2',
  },
    { 
    label:'4GB',
    value:'4',
  },
    { 
    label:'8GB',
    value:'8',
  },
    { 
    label:'16GB',
    value:'16',
    }
])
const filteredLanguages = computed(() => {
  if (!languageSearchQuery.value) return allLanguages.value;
  return allLanguages.value.filter(lang => 
    lang.displayName?.toLowerCase().includes(languageSearchQuery.value.toLowerCase()) || 
    lang.toLowerCase().includes(languageSearchQuery.value.toLowerCase())
  );
});

const filteredFonts = computed(() => {
  if (!fontSearchQuery.value) return allFonts.value;
  return allFonts.value.filter(font => 
    font.toLowerCase().includes(fontSearchQuery.value.toLowerCase())
  );
});

const initTimezoneList = () => {
  const names = moment.tz.names();
  const list = names.map(name => {
    const tz = moment.tz(name);
    const offsetMinutes = tz.utcOffset();
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const minutes = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    let offsetLabel = sign + hours;
    if (minutes > 0) {
      offsetLabel += ':' + (minutes < 10 ? '0' + minutes : minutes);
    }
    return {
      label: `UTC(${offsetLabel}) ${name}`,
      value: name,
      offset: offsetMinutes
    };
  }).sort((a, b) => a.offset - b.offset);

  // 获取本地时区并置顶
  const localName = moment.tz.guess();
  const localTz = moment.tz(localName);
  const localOffsetMinutes = localTz.utcOffset();
  const localHours = Math.floor(Math.abs(localOffsetMinutes) / 60);
  const localMinutes = Math.abs(localOffsetMinutes) % 60;
  const localSign = localOffsetMinutes >= 0 ? '+' : '-';
  let localOffsetLabel = localSign + localHours;
  if (localMinutes > 0) {
    localOffsetLabel += ':' + (localMinutes < 10 ? '0' + localMinutes : localMinutes);
  }
  
  const localItem = {
    label: `UTC(${localOffsetLabel}) ${localName} (本地时区)`,
    value: localName,
    offset: localOffsetMinutes
  };

  timezoneList.value = [localItem, ...list];
};
const ipcApiRoute = {
  addSession: 'controller.window.addSession',
  getConfigInfo: 'controller.window.getConfigInfo',
  addConfigInfo: 'controller.window.addConfigInfo',
};

const currentOS = ref('');
const detectOS = () => {
  const ua = navigator.userAgent;
  if (ua.indexOf('Win') !== -1) currentOS.value = 'Windows';
  else if (ua.indexOf('Mac') !== -1) currentOS.value = 'macOS';
  else currentOS.value = 'Windows'; // Default fallback
};

const getWebGLInfo = () => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown Vendor',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown Renderer'
    };
  }
  return { vendor: 'Unavailable', renderer: 'Unavailable' };
};

const generateRandomUA = () => {
  const browsers = [
    {
      name: 'Chrome',
      versions: Array.from({ length: 31 }, (_, i) => 100 + i), // 100 to 130
      template: 'Mozilla/5.0 ({os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36'
    }
  ];
  const oss = [
    'Windows NT 10.0; Win64; x64',
    'Windows NT 11.0; Win64; x64',
    'Macintosh; Intel Mac OS X 10_15_7',
  ];
  
  const browser = browsers[Math.floor(Math.random() * browsers.length)];
  const version = browser.versions[Math.floor(Math.random() * browser.versions.length)];
  const os = oss[Math.floor(Math.random() * oss.length)];
  
  configForm.userAgent = browser.template.replace('{version}', version).replace('{os}', os);
};

const fetchConfig = () => {
  if (props.isEdit && props.card) {
     console.log('prps',props.card);
    const args = { cardId: props.card.card_id };
    const fieldMapping = {
      sessionId:'sessionId',
      cardId: 'cardId',
      name: 'name',
      user_agent: 'userAgent',
      cookie: 'cookie',
      proxy_status: 'proxyStatus',
      proxy_type: 'proxy',
      proxy_host: 'host',
      proxy_port: 'port',
      proxy_username: 'username',
      proxy_password: 'password',
      fingerprint_switch: 'fingerprintSwitch',
      browser: 'browser',
      os: 'os',
      webgl_metadata: 'webglMetadata',
      webgl_vendor: 'webglVendor',
      webgl_renderer: 'webglRenderer',
      webgpu: 'webgpu',
      webgl_image: 'webglImage',
      webrtc: 'webrtc',
      timezone: 'timezone',
      geolocation: 'geolocation',
      geolocation_custom: 'geolocationCustom',
      language: 'language',
      resolution: 'resolution',
      resolution_width: 'resolutionWidth',
      resolution_height: 'resolutionHeight',
      font: 'font',
      font_custom: 'fontCustom',
      canvas: 'canvas',
      audio_context: 'audioContext',
      media_devices: 'mediaDevices',
      client_rects: 'clientRects',
      speech_voices: 'speechVoices',
      cpu_cores: 'cpuCores',
      cpu_cores_custom: 'cpuCoresCustom',
      memory: 'memory',
      memory_custom: 'memoryCustom',
      do_not_track: 'doNotTrack',
      screen: 'screen',
      battery: 'battery',
      port_scan_protection: 'portScanProtection'
    };
    ipc.invoke(ipcApiRoute.getConfigInfo, args).then((res) => {
      if (res.status) {
        for (const key in fieldMapping) {
          if (res.data.hasOwnProperty(key)) {
            const formField = fieldMapping[key];
            configForm[formField] = res.data[key];
          }
        }
        configForm.cardId = props.card.card_id;
        configForm.sessionId = props.card.sessionId;

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
    // Use detected OS as default
    configForm.os = currentOS.value;
  }
};

onMounted(() => {
  detectOS();
  fetchConfig();
  initTimezoneList();
  console.log('timezoneList', timezoneList.value);
  
});

const generateFingerprint = () => {
    generateRandomUA();
    // Here we could add more randomization for other fingerprint items if needed
    ElMessage.success('已生成新指纹');
};

watch(() => props.card, () => {
  fetchConfig();
});

watch(() => configForm.webglMetadata, (val) => {
  if (val === '自定义') {
    if (!configForm.webglVendor || !configForm.webglRenderer) {
      const info = getWebGLInfo();
      configForm.webglVendor = info.vendor;
      configForm.webglRenderer = info.renderer;
    }
  }
});
const handleRefreshWebGlInfo = () => {
   const info = getWebGLInfo();
   configForm.webglVendor = info.vendor;
   configForm.webglRenderer = info.renderer;
   ElMessage.success('已刷新 WebGL 信息');
}
const handleRefreshFonts = () => {
  const fontPool = [
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 
    'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 
    'Impact', 'Tahoma', 'Geneva', 'Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Noto Sans', 'Gill Sans', 'Helvetica Neue', 'STIXGeneral', 'Gabriola', 'Andale Mono'
  ];
  const count = Math.floor(Math.random() * 11) + 10;
  const selected = [];
  for(let i=0; i<count; i++) {
    const randomFont = fontPool[Math.floor(Math.random() * fontPool.length)];
    if(!selected.includes(randomFont)) selected.push(randomFont);
  }
  configForm.fontCustom = selected.join(', ');
  ElMessage.success('已生成新字体指纹');
};
const handleEditFonts = () => {
  fontDialogVisible.value = true;
  selectedFontsInDialog.value = configForm.fontCustom ? configForm.fontCustom.split(',').map(f => f.trim()) : [];
};

const confirmEditFont = () => {
  configForm.fontCustom = selectedFontsInDialog.value.join(', ');
  fontDialogVisible.value = false;
};
const addLanguage = async () => {
  addLanguageVisible.value = true;
  if (allLanguages.value.length === 0) {
    try {
      const res = await get('/app/languageList/languageList');
      if (res.code === 200) {
        console.log('lb', res.data);
        
        allLanguages.value = res.data || [];
      }
    } catch (error) {
      console.error('获取语言列表失败:', error);
    }
  }
  selectedLanguagesInDialog.value = [...configForm.languages];
};

const confirmAddLanguage = () => {
  configForm.languages = [...selectedLanguagesInDialog.value];
  addLanguageVisible.value = false;
};

const handleLanguageCommand = (command, index) => {
  const list = configForm.languages;
  if (command === 'top') {
    const item = list.splice(index, 1)[0];
    list.unshift(item);
  } else if (command === 'up') {
    if (index > 0) {
      [list[index], list[index - 1]] = [list[index - 1], list[index]];
    }
  } else if (command === 'down') {
    if (index < list.length - 1) {
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
    }
  } else if (command === 'delete') {
    list.splice(index, 1);
  }
};
const confirmClick = async () => {
  const moreOptions = JSON.stringify(configForm);
  const data = {
    sessionId: configForm.sessionId,
    sessionName: configForm.name,
    avatarUrl: '',
    groupName: '',
    moreOptions: moreOptions,
    status: 0,
    platform: props.platform,
    cardId: configForm.cardId,
    activeStatus: 0,
  };
  
  try {
    const requestMethod = props.isEdit ? put : post;
    const res = await requestMethod('/app/session', data);
    
    if (res.code === 200) {
      // 准备 IPC 配置数据
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
        proxy_password: configForm.password || '',
        fingerprint_switch: configForm.fingerprintSwitch,
        browser: configForm.browser,
        os: configForm.os,
        webgl_metadata: configForm.webglMetadata,
        webgl_vendor: configForm.webglVendor,
        webgl_renderer: configForm.webglRenderer,
        webgpu: configForm.webgpu,
        webgl_image: configForm.webglImage,
        webrtc: configForm.webrtc,
        timezone: configForm.timezone,
        geolocation: configForm.geolocation,
        geolocation_custom: configForm.geolocationCustom,
        language: configForm.language,
        resolution: configForm.resolution,
        resolution_width: configForm.resolutionWidth,
        resolution_height: configForm.resolutionHeight,
        font: configForm.font,
        font_custom: configForm.fontCustom,
        canvas: configForm.canvas,
        audio_context: configForm.audioContext,
        media_devices: configForm.mediaDevices,
        client_rects: configForm.clientRects,
        speech_voices: configForm.speechVoices,
        cpu_cores: configForm.cpuCores,
        cpu_cores_custom: configForm.cpuCoresCustom,
        memory: configForm.memory,
        memory_custom: configForm.memoryCustom,
        do_not_track: configForm.doNotTrack,
        screen: configForm.screen,
        battery: configForm.battery,
        port_scan_protection: configForm.portScanProtection
      };

      // 如果是新建会话，先通过 IPC 添加
      if (!props.isEdit) {
        const addArgs = {
          activeStatus: false,
          cardId: configForm.cardId,
          title: configForm.name,
          online: false,
          platform: props.platform,
        };
        await ipc.invoke(ipcApiRoute.addSession, addArgs);
      }

      // 无论新建还是编辑，都同步配置信息
      await ipc.invoke(ipcApiRoute.addConfigInfo, argsConfig);
      
      ElMessage.success(props.isEdit ? '修改成功' : '添加成功');
      
      // 触发 confirm 事件，父组件（如 WhatsApp.vue）会监听到并调用 getAllSessions() 刷新列表
      emit('confirm');
    }
  } catch (error) {
    console.error('保存会话失败:', error);
    ElMessage.error('保存失败，请检查网络或配置');
  }
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

    <div class="settings-content">
      <!-- Left Column: Configuration Tabs -->
      <div class="config-section">
        <el-tabs v-model="activeTab" class="custom-tabs">
          <el-tab-pane label="指纹配置" name="fingerprint">
            <div class="scroll-area">
              <el-form :model="configForm" label-width="120px" label-position="left">
                <el-form-item label="会话昵称">
                  <el-input v-model="configForm.name" placeholder="请输入名称"></el-input>
                </el-form-item>

                <el-form-item label="指纹开关">
                  <el-switch v-model="configForm.fingerprintSwitch" active-color="#13ce66"></el-switch>
                </el-form-item>
                
                <el-form-item label="浏览器">
                  <el-select v-model="configForm.browser" placeholder="智能匹配" style="width: 100%">
                    <template #prefix>
                        <i class="iconfont icon-chrome" style="color: #409EFF; margin-right: 4px;"></i>
                    </template>
                    <el-option label="Chrome 智能匹配" value="Chrome随机版本"></el-option>
                    <el-option label="130 " value="130"></el-option>
                    <el-option label="129" value="129"></el-option>
                    <el-option label="128" value="128"></el-option>
                    <el-option label="127" value="127"></el-option>
                    <el-option label="126" value="126"></el-option>
                  </el-select>
                </el-form-item>

                <el-form-item label="操作系统">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.os">
                    <el-radio-button label="Windows" :disabled="currentOS !== 'Windows'">
                        <div class="radio-content"> <i class="iconfont icon-windows" style="color: #666666; margin-right: 4px;"></i><span>Windows</span></div>
                    </el-radio-button>
                    <el-radio-button label="macOS" :disabled="currentOS !== 'macOS'">
                        <div class="radio-content"><i class="iconfont icon-mac" style="color: #666666; margin-right: 4px;"></i><span>macOS</span></div>
                    </el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip">默认使用当前电脑系统</div>
                  </div>
                </el-form-item>

                <el-form-item label="User Agent">
                  <div class="fex-row-textarea">
                  <el-input 
                    type="textarea" 
                    v-model="configForm.userAgent" 
                    :rows="4" 
                    readonly
                    placeholder="Mozilla/5.0..."
                  >
                    <template #append>
                      <el-button :icon="Refresh" @click="generateRandomUA"> 自动生成 </el-button>
                    </template>
                  </el-input>
                  <span class="refresh-btn"  @click="generateRandomUA"><i class="iconfont icon-refresh"></i> </span>
                 </div>
                </el-form-item>
                <el-form-item label="WebGL元数据">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.webglMetadata">
                    <el-radio-button label="真实" value="真实">真实</el-radio-button>
                    <el-radio-button label="关闭硬件加速" value="关闭硬件加速">关闭硬件加速</el-radio-button>
                    <el-radio-button label="自定义" value="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.webglMetadata==='真实'">将会使用当前电脑的真实的 WebGL 元数据</div>
                   <div class="form-sub-tip" v-if="configForm.webglMetadata==='关闭硬件加速'">通过关闭硬件加速网站就无法获取到真实的 WebGL 元数据</div>
                    <div class="form-sub-tip" v-if="configForm.webglMetadata==='自定义'">设置合适的值代替真实的 WebGL 元数据</div>
                  </div>
                </el-form-item>
                <div class="form-box" v-if="configForm.webglMetadata==='自定义'">
                <el-form-item label="" label-width="0px">
                  <div class="flex-row">
                    <div class="item-label">厂商</div>
                    <el-input v-model="configForm.webglVendor" disabled placeholder="请输入 WebGL Vendor"></el-input>
                    <span class="refresh-icon" ></span>
                  </div>
                </el-form-item>
                
                <el-form-item label="" label-width="0px">
                  <div class="flex-row">
                    <div class="item-label">渲染器</div>
                    <el-input v-model="configForm.webglRenderer" disabled style="width:100%" placeholder="请输入 WebGL Renderer"></el-input>
                    <span class="refresh-icon" @click="handleRefreshWebGlInfo"><i class="iconfont icon-refresh"></i></span>
                  </div>
                </el-form-item>
                </div>
                <el-form-item label="WebGPU">
                    <div class="flex-column">
                  <el-radio-group v-model="configForm.webgpu">
                    <el-radio-button label="基于WebGL">基于WebGL</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="禁用">禁用</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.webgpu==='基于WebGL'">通过 WebGL 来模拟 WebGPU</div>
                   <div class="form-sub-tip" v-if="configForm.webgpu==='真实'">将使用当前电脑真实的 WebGPU</div>
                    <div class="form-sub-tip" v-if="configForm.webgpu==='禁用'">不适用 WebGPU,网站将检测不到</div>

                  </div>
                </el-form-item>

                <el-form-item label="WebGL图像">
                 
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.webglImage">
                    <el-radio-button label="噪音">噪音</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.webglImage==='噪声'">在同一网页上为每个浏览器实例生成不同的 WebGL 图像</div>
                    <div class="form-sub-tip" v-if="configForm.webglImage==='真实'">将使用当前电脑真实的 WebGL 图像</div>
                  </div>
                </el-form-item>

                <el-form-item label="WebRTC">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.webrtc">
                    <el-radio-button label="替换">替换</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="禁用">禁用</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.webrtc==='替换'">启用与代理IP匹配的 WebRTC IP</div>
                   <div class="form-sub-tip" v-if="configForm.webrtc==='真实'">使用当前电脑真实的 WebRTC IP。</div>
                    <div class="form-sub-tip" v-if="configForm.webrtc==='禁用'">网站将无法获取您的 WebRTC 信息</div>
                  </div>
                </el-form-item>

                <el-form-item label="时区">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.timezone">
                    <el-radio-button label="基于IP">基于IP</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.timezone==='基于IP'">基于 IP 匹配对应的时区</div>
                   <div class="form-sub-tip" v-if="configForm.timezone==='真实'">使用当前电脑的时区</div>
                    <div class="form-sub-input" v-if="configForm.timezone==='自定义'">
                      <el-select  v-model="configForm.timezoneCustom" placeholder="请选择时区">
                        <el-option v-for="item  in timezoneList" :key="item.value" :label="item.label" :value="item.value">
                          {{ item.label }}
                        </el-option>
                      </el-select>
                    </div>
                  </div>
                </el-form-item>

                <el-form-item label="地理位置">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.geolocation">
                    <el-radio-button label="询问">询问</el-radio-button>
                    <el-radio-button label="禁止">禁止</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.geolocation==='询问'">网站会显示获取当前位置的询问提示，您可以允许或禁止</div>
                   <div class="form-sub-tip"  v-if="configForm.geolocation==='禁止'">无法获取地理位置信息</div>
                  <div class="switch-inline" v-if="configForm.geolocation== '询问'  ">
                    <el-switch v-model="configForm.geolocationCustom"></el-switch>
                    <span>基于IP生成对应的地理位置</span>
                  </div>
                  </div>
                </el-form-item>

                <el-form-item label="语言">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.language">
                    <el-radio-button label="基于IP">基于IP</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip">基于 IP 匹配对应的国家语言</div>
                  <div v-if="configForm.language === '自定义'" class="language-custom-wrapper">
                    <div class="language-box">
                      <div v-for="(lang, index) in configForm.languages" :key="index" class="language-item">
                        <span>{{ lang }}</span>
                        <el-dropdown trigger="hover" @command="(cmd) => handleLanguageCommand(cmd, index)">
                          <div class="more-icon-wrapper">
                            <i class="iconfont icon-more-v"></i>
                          </div>
                          <template #dropdown>
                            <el-dropdown-menu class="language-dropdown-menu">
                              <el-dropdown-item command="top">移到顶点</el-dropdown-item>
                              <el-dropdown-item command="up">上移</el-dropdown-item>
                              <el-dropdown-item command="down">下移</el-dropdown-item>
                              <el-dropdown-item command="delete" class="delete-item">删除</el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </div>
                    <div class="add-language-btn" @click="addLanguage">添加语言</div>
                  </div>
                  </div>
                </el-form-item>

                <el-form-item label="分辨率">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.resolution">
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  </div>
                </el-form-item>

                <el-form-item label="宽度" v-if="configForm.resolution === '自定义'">
                  <el-input v-model="configForm.resolutionWidth" placeholder="宽度"></el-input>
                </el-form-item>
                
                <el-form-item label="高度" v-if="configForm.resolution === '自定义'">
                  <el-input v-model="configForm.resolutionHeight" placeholder="高度"></el-input>
                </el-form-item>

                <el-form-item label="字体">
                  <div class="flex-column">
                    <div class="flex-row-center">
                      <el-radio-group v-model="configForm.font">
                        <el-radio-button label="真实">真实</el-radio-button>
                        <el-radio-button label="自定义">自定义</el-radio-button>
                      </el-radio-group>
                      <span class="refresh-icon-font" @click="handleRefreshFonts">
                        <i class="iconfont icon-refresh"></i>
                      </span>
                    </div>
                    <div class="form-sub-tip" v-if="configForm.font==='真实'">将使用当前电脑的真实字体</div>
                    
                    <div v-if="configForm.font === '自定义'" class="font-custom-wrapper">
                      <div class="font-display-box">
                        {{ configForm.fontCustom || '未生成建议字体' }}
                      </div>
                      <div class="edit-font-link" @click="handleEditFonts">编辑字体</div>
                    </div>
                  </div>
                </el-form-item>

                <el-form-item label="Canvas">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.canvas">
                    <el-radio-button label="噪音">噪音</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.canvas==='噪音'" >同一浏览上为每个浏览器生成不同的 Canvas</div>
                   <div class="form-sub-tip" v-if="configForm.canvas==='真实'">将使用当前电脑真实的 Canvas</div>
                  </div>
                </el-form-item>

                <el-form-item label="AudioContext">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.audioContext">
                    <el-radio-button label="噪音">噪音</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.audioContext==='噪音'">同一浏览上为每个浏览器生成不同的 AudioContext</div>
                    <div class="form-sub-tip" v-if="configForm.audioContext==='真实'">将使用当前电脑真实的 AudioContext</div>
                  </div>
                </el-form-item>

                <el-form-item label="媒体设备">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.mediaDevices">
                    <el-radio-button label="噪音">噪音</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.mediaDevices==='噪音'">采集指纹生成媒体设备在浏览器内代理多媒体设备</div>
                   <div class="form-sub-tip" v-if="configForm.mediaDevices==='真实'">将使用当前电脑真实的媒体设备信息</div>
                  </div>
                </el-form-item>

                <el-form-item label="ClientRects">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.clientRects">
                    <el-radio-button label="噪音">噪音</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.clientRects==='噪音'">同一浏览上为每个浏览器生成不同的 ClientRects</div>
                    <div class="form-sub-tip" v-if="configForm.clientRects==='真实'">将使用当前电脑真实的 ClientRects</div>
                  </div>
                </el-form-item>

                <el-form-item label="SpeechVoices">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.speechVoices">
                    <el-radio-button label="隐私">隐私</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.speechVoices==='隐私'" >同一电脑上为每个浏览器生成不同的 SpeechVoices</div>
                   <div class="form-sub-tip" v-if="configForm.speechVoices==='真实'" >将使用当前电脑真实的 SpeechVoices</div>
                  </div>
                </el-form-item>

                <el-form-item label="CPU内核数">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.cpuCores">
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.cpuCores==='真实'">使用当前电脑真实的 CPU 内核数</div>
                  <div class="form-sub-tip"  v-if="configForm.cpuCores==='自定义'">可自定义 CPU 内核数用于指纹防护</div>

                  </div>
                </el-form-item>
                
                <el-form-item label="" v-if="configForm.cpuCores === '自定义'">
                  <el-select v-model="configForm.cpuCoresCustom" placeholder="请输入 CPU 内核数">
                    <el-option v-for="item  in cpuCoresOptions" :key="item.value" :label="item.label" :value="item.value"></el-option>
                  </el-select>
                </el-form-item>

                <el-form-item label="内存">
                  <div class="flex-column">
                  <el-radio-group v-model="configForm.memory">
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.memory==='真实'">使用当前电脑真实内存大小</div>
                     <div class="form-sub-tip" v-if="configForm.memory==='自定义'">可自定义内存大小用于指纹防护</div>
                  </div>
                </el-form-item>
                
                <el-form-item label="内存大小" v-if="configForm.memory === '自定义'">
                  <el-select v-model="configForm.memoryCustom" placeholder="请选择内存大小 (GB)">
                    <el-option v-for="item in memoryOptions" :key="item.value" :label="item.label" :value="item.value"></el-option>
                  </el-select>
                </el-form-item>

                <el-form-item label="Do Not Track">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.doNotTrack">
                    <el-radio-button :label="true">开启</el-radio-button>
                    <el-radio-button :label="false">关闭</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.doNotTrack===true">设置不联盟请求此浏览器个人信息</div>
                   <div class="form-sub-tip" v-if="configForm.doNotTrack===false">设置愿意被站点追踪个人信息</div>
                  </div>
                </el-form-item>

                <el-form-item label="屏幕">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.screen">
                    <el-radio-button label="噪音">噪音</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip">使用指纹替换窗口的属性和属性</div>
                  </div>
                </el-form-item>
                    <el-form-item label="蓝牙">
                       <div class="flex-column">
                  <el-radio-group v-model="configForm.Bluetooth">
                    <el-radio-button label="隐私">隐私</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.Bluetooth==='隐私'">使用相匹配的值代替您真实的蓝牙信息</div>
                   <div class="form-sub-tip" v-if="configForm.Bluetooth==='真实'">将使用当前电脑真实的蓝牙</div>
                   </div>
                </el-form-item>
                <el-form-item label="电池">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.battery">
                    <el-radio-button label="隐私">隐私</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.battery==='隐私'">使用相匹配的值代替您真实的电池信息</div>
                   <div class="form-sub-tip" v-if="configForm.battery==='真实'">将使用当前电脑真实的电池</div>
                  </div>
                </el-form-item>

                <el-form-item label="端口扫描保护">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.portScanProtection">
                    <el-radio-button :label="true">开启</el-radio-button>
                    <el-radio-button :label="false">关闭</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.portScanProtection">阻止脚本使用网站检测对本地网络内的端口和服务器</div>
                   <div class="form-sub-tip" v-if="!configForm.portScanProtection">关闭后，将不会阻止网站检测您使用了本地网络的哪些端口</div>
                    <el-input type="textarea" v-if="configForm.portScanProtectionPort" :rows="3" v-model="configForm.cookie" placeholder="选填， 允许被连接的本地网络端口范围之间， 分隔多个逗号隔开 例：2000-3000， 3000-5000"></el-input>
                  </div>
                </el-form-item>

                <el-form-item label="Cookie">
                  <el-input type="textarea" :rows="3" v-model="configForm.cookie" placeholder="请输入 Cookie"></el-input>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <el-tab-pane label="代理配置" name="proxy">
            <div class="scroll-area">
              <el-form :model="configForm" label-width="120px" label-position="left">
                <el-form-item label="代理开关">
                  <el-switch
                    v-model="configForm.proxyStatus"
                    active-value="true"
                    inactive-value="false"
                  ></el-switch>
                </el-form-item>
                <el-form-item label="选择代理">
                  <el-select v-model="configForm.proxy" placeholder="请选择代理" style="width: 100%">
                    <el-option label="No Proxy" value="noProxy"></el-option>
                    <el-option label="HTTP" value="http"></el-option>
                    <el-option label="HTTPS" value="https"></el-option>
                    <el-option label="SOCKS5" value="socks5"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="主机">
                  <el-input v-model="configForm.host" placeholder="请输入主机"></el-input>
                </el-form-item>
                <el-form-item label="端口">
                  <el-input v-model="configForm.port" placeholder="请输入端口"></el-input>
                </el-form-item>
                <el-form-item label="用户名">
                  <el-input v-model="configForm.username" placeholder="请输入用户名"></el-input>
                </el-form-item>
                <el-form-item label="密码">
                  <el-input type="password" v-model="configForm.password" placeholder="请输入密码" show-password></el-input>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- <el-tab-pane label="协议号登录" name="protocol">
            <div class="scroll-area empty-state">
              <el-empty description="协议号登录配置暂未启用"></el-empty>
            </div>
          </el-tab-pane> -->
        </el-tabs>
      </div>

      <!-- Right Column: Fingerprint Overview -->
      <div class="overview-section">
        <div class="overview-header">
           <span class="overview-title">指纹概览</span>
           <el-button type="success" class="generate-btn" @click="generateFingerprint" size="small" round> 
            <i class="iconfont icon-fingerprint" style="margin-right: 15px;"></i>
            <span>生成新指纹</span>
            </el-button>
        </div>
        <div class="overview-list">
          <div class="overview-item">
            <span class="label">浏览器</span>
            <span class="value">{{ configForm.browser }} (Chrome内核)</span>
          </div>
          <div class="overview-item">
            <span class="label">User Agent</span>
            <div class="value ua-value">{{ configForm.userAgent }}</div>
          </div>
          <div class="overview-item">
            <span class="label">操作系统</span>
            <span class="value">{{ configForm.os }}</span>
          </div>
          <div class="overview-item">
            <span class="label">WebGL元数据</span>
            <span class="value text-success" v-if="configForm.webglMetadata === '真实'">真实</span>
            <span class="value text-warning" v-else-if="configForm.webglMetadata === '关闭硬件加速'">关闭硬件加速</span>
            <span class="value text-primary" v-else-if="configForm.webglMetadata === '自定义'">自定义</span>
          </div>
          <div class="overview-item" v-if="configForm.webglMetadata === '自定义'">
            <span class="label">WebGL厂商</span>
            <span class="value text-primary">{{ configForm.webglVendor }}</span>
          </div>
          <div class="overview-item" v-if="configForm.webglMetadata === '自定义'">
            <span class="label">WebGL渲染</span>
            <span class="value text-primary">{{ configForm.webglRenderer }}</span>
          </div>
          <div class="overview-item">
            <span class="label">WebGL图像</span>
            <span class="value text-success">噪音</span>
          </div>
          <div class="overview-item">
            <span class="label">WebGPU</span>
            <span class="value text-success">基于 WebGL</span>
          </div>
          <div class="overview-item">
            <span class="label">WebRTC</span>
            <span class="value text-success">替换</span>
          </div>
          <div class="overview-item">
            <span class="label">时区</span>
            <span class="value text-success">基于 IP</span>
          </div>
          <div class="overview-item">
            <span class="label">地理位置</span>
            <span class="value text-success">基于 IP (允许)</span>
          </div>
          <div class="overview-item">
            <span class="label">语言</span>
            <span class="value text-success">基于 IP</span>
          </div>
          <div class="overview-item">
            <span class="label">分辨率</span>
            <span class="value text-success">真实</span>
          </div>
          <div class="overview-item">
            <span class="label">字体</span>
            <span class="value text-success">真实</span>
          </div>
          <div class="overview-item">
            <span class="label">Canvas</span>
            <span class="value text-success">噪音</span>
          </div>
          <div class="overview-item">
            <span class="label">AudioContext</span>
            <span class="value text-success">噪音</span>
          </div>
          <div class="overview-item">
            <span class="label">媒体设备</span>
            <span class="value text-success">查看</span>
          </div>
          <div class="overview-item">
            <span class="label">ClientRects</span>
            <span class="value text-success">噪音</span>
          </div>
          <div class="overview-item">
            <span class="label">SpeechVoices</span>
            <span class="value text-success">隐私</span>
          </div>
          <div class="overview-item">
            <span class="label">CPU内核数</span>
            <span class="value text-primary">真实</span>
          </div>
          <div class="overview-item">
            <span class="label">内存</span>
            <span class="value text-primary">真实</span>
          </div>
          <div class="overview-item">
            <span class="label">Do Not Track</span>
            <span class="value">启用</span>
          </div>
          <div class="overview-item">
            <span class="label">蓝牙</span>
            <span class="value text-success">替换</span>
          </div>
          <div class="overview-item">
            <span class="label">电池</span>
            <span class="value text-success">替换</span>
          </div>
          <div class="overview-item">
            <span class="label">跨门保护</span>
            <span class="value">启用</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <el-button @click="cancelClick">取消</el-button>
      <el-button type="success" class="launch-btn" @click="confirmClick">确定启动</el-button>
    </div>

    <!-- 添加语言弹窗 -->
    <el-dialog
      v-model="addLanguageVisible"
      title="添加语言"
      width="500px"
      class="custom-language-dialog"
      :show-close="true"
      append-to-body
    >
      <div class="dialog-content">
        <el-input
          v-model="languageSearchQuery"
          placeholder="搜索关键词"
          class="language-search"
          clearable
        >
          <template #prefix>
            <i class="iconfont icon-search"></i>
          </template>
        </el-input>
        <div class="language-scroll-area">
          <el-checkbox-group v-model="selectedLanguagesInDialog">
            <div v-for="lang in filteredLanguages" :key="lang" class="language-selection-item">
              <el-checkbox :label="lang.displayName">{{ lang.displayName }}</el-checkbox>
            </div>
          </el-checkbox-group>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="addLanguageVisible = false">取消</el-button>
          <el-button type="success" class="confirm-btn" @click="confirmAddLanguage">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 编辑字体弹窗 -->
    <el-dialog
      v-model="fontDialogVisible"
      title="编辑字体"
      width="500px"
      class="custom-language-dialog"
      :show-close="true"
      append-to-body
    >
      <div class="dialog-content">
        <el-input
          v-model="fontSearchQuery"
          placeholder="搜索关键词"
          class="language-search"
          clearable
        >
          <template #prefix>
            <i class="iconfont icon-search"></i>
          </template>
        </el-input>
        <div class="language-scroll-area">
          <el-checkbox-group v-model="selectedFontsInDialog">
            <div v-for="font in filteredFonts" :key="font" class="language-selection-item">
              <el-checkbox :label="font">{{ font }}</el-checkbox>
            </div>
          </el-checkbox-group>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="fontDialogVisible = false">取消</el-button>
          <el-button type="success" class="confirm-btn" @click="confirmEditFont">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.settings-container {
  width: 100%;
  max-width: 95vw;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0 auto;
}

.settings-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left Section */
.config-section {
  flex: 1.6;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.custom-tabs {
  height: 100%;
}

:deep(.el-tabs__header) {
  margin: 0;
  padding: 0 24px;
}

:deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: #f0f0f0;
}

:deep(.el-tabs__item) {
  height: 50px;
  line-height: 50px;
  font-size: 14px;
}

:deep(.el-tabs__active-bar) {
  background-color: #2ed36a; 
}

:deep(.el-tabs__item.is-active) {
  color: #2ed36a;
  font-weight: 500;
}

.scroll-area {
  padding: 24px;
  overflow-y: auto;
  height: calc(85vh - 50px - 58px - 72px);
}

.scroll-area::-webkit-scrollbar {
  width: 4px;
}

.scroll-area::-webkit-scrollbar-thumb {
  background: #e5e5e5;
  border-radius: 2px;
}
.refresh-btn  { 
  cursor: pointer;
  margin-left: 20px;
  color: #409EFF;
}
.flex-column { 
  display: flex;
  flex-direction: column;
  text-align: left;
}
.fex-row-textarea{ 
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
}
.form-box { 
  border: 1px solid #d9d9d9;
  display: flex;
  flex-direction: column;
  margin-left: 120px;
  margin-bottom: 16px;
  padding: 12px 12px 0;
  border-radius: 8px
}
.flex-row { 
  display: flex;
  flex-direction: row;
  width: 100%;
}
.refresh-icon { 
  width: 24px;
  height: 24px;
  margin-left: 12px;
  cursor: pointer;
  color: #409EFF;
}
.item-label { 
  width: 70px;
  text-align: left;
}
/* Form Styles */
.form-sub-input { 
  margin: 12px 0;
}
.refresh-icon-font {
  margin-left: 12px;
  cursor: pointer;
  color: #409EFF;
  display: flex;
  align-items: center;
}
.flex-row-center {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.form-sub-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  line-height: 1.4;
}

.switch-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.radio-content {
    display: flex;
    align-items: center;
    gap: 6px;
}

.language-custom-wrapper {
  margin-top: 12px;
}

.language-box {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background-color: #fff;
  overflow: hidden;
  width: 100%;
}

.language-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
  color: #333;
}

.language-item:last-child {
  border-bottom: none;
}

.language-item i {
  color: #999;
  font-size: 16px;
}

.more-icon-wrapper {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.more-icon-wrapper:hover {
  background-color: #f2f2f2;
}

.language-dropdown-menu :deep(.delete-item) {
  color: #ff4d4f !important;
}

.language-dropdown-menu :deep(.el-dropdown-menu__item) {
  padding: 8px 20px;
  font-size: 14px;
}

.add-language-btn {
  margin-top: 8px;
  color: #3b5998;
  font-size: 14px;
  cursor: pointer;
  display: inline-block;
  text-decoration: none;
}

.add-language-btn:hover {
  text-decoration: underline;
}

.font-custom-wrapper {
  margin-top: 12px;
  width: 100%;
}

.font-display-box {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
  max-height: 120px;
  overflow-y: auto;
  word-break: break-all;
}

.edit-font-link {
  color: #3b5998;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
  display: inline-block;
}

.edit-font-link:hover {
  text-decoration: underline;
}

/* Add Language Dialog Styles */
.custom-language-dialog :deep(.el-dialog__header) {
  padding: 20px 24px;
  margin-right: 0;
  border-bottom: 1px solid #f0f0f0;
}

.custom-language-dialog :deep(.el-dialog__title) {
  font-size: 18px;
  font-weight: 500;
  color: #333;
}

.dialog-content {
  padding: 0;
}

.language-search {
  margin-bottom: 16px;
}

.language-search :deep(.el-input__wrapper) {
  border-radius: 4px;
  background-color: #fff;
}

.language-scroll-area {
  max-height: 400px;
  overflow-y: auto;
  padding: 4px 0;
}

.language-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.language-scroll-area::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.language-selection-item {
  padding: 8px 0;
}

.language-selection-item :deep(.el-checkbox) {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
}

.language-selection-item :deep(.el-checkbox__label) {
  font-size: 14px;
  color: #333;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
}

.confirm-btn {
  background-color: #2ba471 !important;
  border-color: #2ba471 !important;
}

/* Right Section */
.overview-section {
  flex: 1;
  background-color: #f9fbfb;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.overview-title {
  background-color: #e8f3ee;
  color: #2ba471;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}
.generate-btn { 
  padding: 18 !important ;
  border-radius: 8px;
  background-color: #2ed36a;
}
.overview-list {
  overflow-y: auto;
  flex: 1;
}

.overview-list::-webkit-scrollbar {
  width: 4px;
}

.overview-list::-webkit-scrollbar-thumb {
  background: #e5e5e5;
  border-radius: 2px;
}

.overview-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 13px;
  border-bottom: 1px dashed #eee;
}

.overview-item:last-child {
  border-bottom: none;
}

.overview-item .label {
  color: #888;
  flex-shrink: 0;
}

.overview-item .value {
  color: #333;
  text-align: right;
  padding-left: 12px;
  word-break: break-all;
}

.ua-value {
    font-size: 11px;
    line-height: 1.4;
    color: #666 !important;
}

.text-success {
  color: #2ba471 !important;
}

.text-primary {
    color: #409EFF !important;
}

/* Footer */
.settings-footer {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.launch-btn {
  background-color: #2ed36a !important;
  border-color: #2ed36a !important;
  padding: 0 40px;
}

.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}
</style>
