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
  webglMetadata: '自定义',
  webglVendor: '',
  webglRenderer: '',
  webgpu: '基于WebGL',
  webgpuCustom: '',
  webglImage: '噪音',
  webglImageCustom: '',
  webrtc: '替换',
  webrtcCustom: '',
  timezone: '基于IP',
  timezoneCustom: '',
  geolocation: '询问',
  geolocationCustom: true,
  geolocationLatitude: '',
  geolocationLongitude: '',
  geolocationAccuracy: '1000',
  language: '自定义',
  resolution: '自定义',
  resolutionWidth: '',
  resolutionHeight: '',
  cookie: '',
  // 新增指纹配置
  font: '自定义',
  fontCustom: '',
  canvas: '噪音',
  canvasCustom: '',
  audioContext: '噪音',
  audioContextCustom: '',
  mediaDevices: '噪音',
  mediaDevicesCustom: '',
  clientRects: '真实',
  clientRectsCustom: '',
  speechVoices: '隐私',
  speechVoicesCustom: '',
  cpuCores: '自定义',
  cpuCoresCustom: '2',
  memory: '自定义',
  memoryCustom: '2',
  doNotTrack: false,
  doNotTrackCustom: '',
  screen: '真实',
  screenCustom: '',
  Bluetooth :'真实',
  BluetoothCustom: '',
  battery: '隐私',
  batteryCustom: '',
  portScanProtection: true,
  portScanProtectionCustom: '',
  languages: ['英语', '英语 (美国)'],
  languageCustom: '',
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

const resolutionOptions = ref(['1920*1080', '1440*900', '1366*768', '1280*1024', '1280*720', '1024*768']);
const currentResolution = computed({
  get: () => (configForm.resolutionWidth && configForm.resolutionHeight) ? `${configForm.resolutionWidth}*${configForm.resolutionHeight}` : '',
  set: (val) => {
    if (val && val.includes('*')) {
      const [w, h] = val.split('*');
      configForm.resolutionWidth = w;
      configForm.resolutionHeight = h;
    }
  }
});
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
  getIPInfo: 'get-ip-info-backend'
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

const getWebGPUInfo = async () => {
  if (!navigator.gpu) return 'Unavailable';
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return 'Unknown WebGPU Adapter';
    const info = adapter.info;
    const parts = [];
    if (info.vendor) parts.push(info.vendor);
    if (info.architecture) parts.push(info.architecture);
    if (info.description || info.device) parts.push(info.description || info.device);
    if (info.driver) parts.push(info.driver);
    return parts.length > 0 ? parts.join(' ') : 'Unknown WebGPU Adapter';
  } catch (e) {
    return 'Error detecting WebGPU';
  }
};

const getWebRTCIP = () => {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
    pc.onicecandidate = (ice) => {
      if (!ice || !ice.candidate || !ice.candidate.candidate) {
        resolve('Unknown IP');
        pc.close();
        return;
      }
      const ip = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)?.[1];
      resolve(ip || 'Unknown IP');
      pc.close();
    };
    // Timeout fallback
    setTimeout(() => {
        resolve('Detection Timeout');
        pc.close();
    }, 2000);
  });
};

const getIPTimezone = async () => {
  try {
    const res = await ipc.invoke(ipcApiRoute.getIPInfo, {});
    console.log('RES', res);
    
    if (res.status && res.data && res.data.timezone) {
      const tzName = res.data.timezone;
      const hourOffset = moment.tz(tzName).utcOffset() / 60;
      const sign = hourOffset >= 0 ? '+' : '';
      return `UTC(${sign}${hourOffset}) ${tzName}`;
    }
    return 'Unknown IP Timezone';
  } catch (e) {
    console.error('Fetch IP timezone (IPC) failed:', e);
    return 'Detection Failed';
  }
};

const getIPGeolocation = async () => {
  try {
    const res = await ipc.invoke(ipcApiRoute.getIPInfo, {});
    if (res.status && res.data && res.data.latitude && res.data.longitude) {
      return {
        latitude: res.data.latitude.toString(),
        longitude: res.data.longitude.toString(),
        accuracy: '1000' // Default accuracy
      };
    }
    return null;
  } catch (e) {
    console.error('Fetch IP geolocation (IPC) failed:', e);
    return null;
  }
};

const getIPLanguage = async () => {
  try {
    const res = await ipc.invoke(ipcApiRoute.getIPInfo, {});
    if (res.status && res.data) {
      // ipwho.is returns a string of languages like "English, Spanish"
      // or we can use country_code to map
      console.log('languages', res );
      const country = res.data.country || 'Unknown';
      const languages = res.data.languages || '';
      console.log('Fetch IP language (IPC) failed:', country, languages );
      return {
        display: `基于 IP 匹配：${country} (${languages})`,
        list: languages.split(',').map(l => l.trim()).filter(l => l)
      };
    }
    return { display: '未知 IP 语言', list: [] };
  } catch (e) {
    console.error('Fetch IP language (IPC) failed:', e);
    return { display: '检测失败', list: [] };
  }
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

const fetchConfig = async () => {
  if (props.isEdit && props.card) {
    console.log('编辑模式，加载会话详情:', props.card);
    
    try {
      // 调用会话详情接口
      const sessionRes = await get(`/app/session/${props.card.sessionId}`);
      
      if (sessionRes.code === 200 && sessionRes.data) {
        const sessionData = sessionRes.data;
        
        // 解析 moreOptions JSON 字符串
        let moreOptions = {};
        if (sessionData.moreOptions) {
          try {
            moreOptions = typeof sessionData.moreOptions === 'string' 
              ? JSON.parse(sessionData.moreOptions) 
              : sessionData.moreOptions;
          } catch (e) {
            console.error('解析 moreOptions 失败:', e);
          }
        }
        
        // 回显基本信息
        configForm.sessionId = sessionData.sessionId || props.card.sessionId;
        configForm.cardId = sessionData.cardId || props.card.card_id;
        configForm.name = sessionData.sessionName || '';
        
        // 回显 moreOptions 中的所有配置
        if (Object.keys(moreOptions).length > 0) {
          // 代理配置
          configForm.proxyStatus = moreOptions.proxyStatus || 'false';
          configForm.proxy = moreOptions.proxy || 'noProxy';
          configForm.host = moreOptions.host || '';
          configForm.port = moreOptions.port || '';
          configForm.username = moreOptions.username || '';
          configForm.password = moreOptions.password || '';
          
          // 指纹配置
          configForm.fingerprintSwitch = moreOptions.fingerprintSwitch || false;
          configForm.browser = moreOptions.browser || 'Chrome随机版本';
          configForm.os = moreOptions.os || 'Windows';
          configForm.userAgent = moreOptions.userAgent || '';
          
          // WebGL 配置
          configForm.webglMetadata = moreOptions.webglMetadata || '自定义';
          configForm.webglVendor = moreOptions.webglVendor || '';
          configForm.webglRenderer = moreOptions.webglRenderer || '';
          configForm.webgpu = moreOptions.webgpu || '基于WebGL';
          configForm.webgpuCustom = moreOptions.webgpuCustom || '';
          configForm.webglImage = moreOptions.webglImage || '噪音';
          configForm.webglImageCustom = moreOptions.webglImageCustom || '';
          
          // WebRTC 配置
          configForm.webrtc = moreOptions.webrtc || '替换';
          configForm.webrtcCustom = moreOptions.webrtcCustom || '';
          
          // 时区配置
          configForm.timezone = moreOptions.timezone || '基于IP';
          configForm.timezoneCustom = moreOptions.timezoneCustom || '';
          
          // 地理位置配置
          configForm.geolocation = moreOptions.geolocation || '询问';
          configForm.geolocationCustom = moreOptions.geolocationCustom !== undefined ? moreOptions.geolocationCustom : true;
          configForm.geolocationLatitude = moreOptions.geolocationLatitude || '';
          configForm.geolocationLongitude = moreOptions.geolocationLongitude || '';
          configForm.geolocationAccuracy = moreOptions.geolocationAccuracy || '1000';
          
          // 语言配置
          configForm.language = moreOptions.language || '自定义';
          configForm.languages = moreOptions.languages || ['英语'];
          configForm.languageCustom = moreOptions.languageCustom || '';
          
          // 分辨率配置
          configForm.resolution = moreOptions.resolution || '自定义';
          configForm.resolutionWidth = moreOptions.resolutionWidth || '';
          configForm.resolutionHeight = moreOptions.resolutionHeight || '';
          if (configForm.resolutionWidth && configForm.resolutionHeight) {
            currentResolution.value = `${configForm.resolutionWidth}*${configForm.resolutionHeight}`;
          }
          
          // 字体配置
          configForm.font = moreOptions.font || '自定义';
          configForm.fontCustom = moreOptions.fontCustom || '';
          
          // Canvas 配置
          configForm.canvas = moreOptions.canvas || '噪音';
          configForm.canvasCustom = moreOptions.canvasCustom || '';
          
          // AudioContext 配置
          configForm.audioContext = moreOptions.audioContext || '噪音';
          configForm.audioContextCustom = moreOptions.audioContextCustom || '';
          
          // 媒体设备配置
          configForm.mediaDevices = moreOptions.mediaDevices || '噪音';
          configForm.mediaDevicesCustom = moreOptions.mediaDevicesCustom || '';
          
          // ClientRects 配置
          configForm.clientRects = moreOptions.clientRects || '真实';
          configForm.clientRectsCustom = moreOptions.clientRectsCustom || '';
          
          // SpeechVoices 配置
          configForm.speechVoices = moreOptions.speechVoices || '隐私';
          configForm.speechVoicesCustom = moreOptions.speechVoicesCustom || '';
          
          // CPU 配置
          configForm.cpuCores = moreOptions.cpuCores || '自定义';
          configForm.cpuCoresCustom = moreOptions.cpuCoresCustom || '2';
          
          // 内存配置
          configForm.memory = moreOptions.memory || '自定义';
          configForm.memoryCustom = moreOptions.memoryCustom || '2';
          
          // Do Not Track
          configForm.doNotTrack = moreOptions.doNotTrack !== undefined ? moreOptions.doNotTrack : false;
          configForm.doNotTrackCustom = moreOptions.doNotTrackCustom || '';
          
          // 屏幕配置
          configForm.screen = moreOptions.screen || '真实';
          configForm.screenCustom = moreOptions.screenCustom || '';
          
          // 蓝牙配置
          configForm.Bluetooth = moreOptions.Bluetooth || '真实';
          configForm.BluetoothCustom = moreOptions.BluetoothCustom || '';
          
          // 电池配置
          configForm.battery = moreOptions.battery || '隐私';
          configForm.batteryCustom = moreOptions.batteryCustom || '';
          
          // 端口扫描保护
          configForm.portScanProtection = moreOptions.portScanProtection !== undefined ? moreOptions.portScanProtection : true;
          configForm.portScanProtectionCustom = moreOptions.portScanProtectionCustom || '';
          
          // Cookie
          configForm.cookie = moreOptions.cookie || '';
        }
        
        console.log('会话详情加载成功:', configForm);
      } else {
        ElMessage.error('获取会话详情失败');
      }
    } catch (error) {
      console.error('获取会话详情出错:', error);
      ElMessage.error('获取会话详情出错，请稍后重试');
    }
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
    configForm.webglMetadata ='自定义';
    configForm.webgpu = '基于WebGL';
    configForm.webglImage ='噪音';
    configForm.webrtc = '替换';
    configForm.timezone= '基于IP';
    configForm.geolocation= '询问',
    configForm.geolocationCustom= true;
    configForm.language = '自定义';
    configForm.languages=['英语'];
    configForm.resolution = '自定义';
    currentResolution.value ='1920*1080';
    configForm.font = '自定义';
    configForm.canvas = '噪音';
    configForm.audioContext ='噪音';
    configForm.mediaDevices ='噪音';
    configForm.clientRects = '真实'; 
    configForm.speechVoices = '隐私';
    configForm.cpuCores = '自定义';
    configForm.cpuCoresCustom = '2';
    configForm.memory = '自定义';
    configForm.memoryCustom ='2';
    configForm.doNotTrack = false;
    configForm.screen = '真实';
    configForm.Bluetooth ='真实';
    configForm.battery = '隐私';
    configForm.portScanProtection = true;
  }
};

onMounted(() => {
  detectOS();
  fetchConfig();
  initTimezoneList();
  generateRandomUA()
  webglRenderer()
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
  if (val === '真实') {
    const info = getWebGLInfo();
    configForm.webglVendor = info.vendor;
    configForm.webglRenderer = info.renderer;
  } else if (val === '关闭硬件加速') {
    configForm.webglVendor = 'Google Inc. (Google)';
    configForm.webglRenderer = 'Google SwiftShader';
  } else if (val === '自定义') {
    if (!configForm.webglVendor || !configForm.webglRenderer) {
      const info = getWebGLInfo();
      configForm.webglVendor = info.vendor;
      configForm.webglRenderer = info.renderer;
    }
  }
});

watch(() => configForm.webgpu, async (val) => {
  if (val === '基于WebGL') {
    configForm.webgpuCustom = '通过 WebGL 来模拟 WebGPU';
  } else if (val === '真实') {
    configForm.webgpuCustom = await getWebGPUInfo();
  } else if (val === '禁用') {
    configForm.webgpuCustom = '不适用 WebGPU,网站将检测不到';
  }
}, { immediate: true });

watch(() => configForm.webglImage, (val) => {
  if (val === '噪音') {
    configForm.webglImageCustom = '在同一网页上为每个浏览器实例生成不同的 WebGL 图像';
  } else if (val === '真实') {
    const info = getWebGLInfo();
    configForm.webglImageCustom = `${info.vendor} ${info.renderer}`;
  }
}, { immediate: true });

watch(() => configForm.webrtc, async (val) => {
  if (val === '替换') {
    configForm.webrtcCustom = '启用与代理IP匹配的 WebRTC IP';
  } else if (val === '真实') {
    configForm.webrtcCustom = await getWebRTCIP();
  } else if (val === '禁用') {
    configForm.webrtcCustom = '网站将无法获取您的 WebRTC 指纹信息';
  }
}, { immediate: true });

watch(() => [configForm.geolocation, configForm.geolocationCustom], async ([geo, custom]) => {
  if (geo === '询问' && custom) {
    const data = await getIPGeolocation();
    if (data) {
      configForm.geolocationLatitude = data.latitude;
      configForm.geolocationLongitude = data.longitude;
      configForm.geolocationAccuracy = data.accuracy;
    }
  } else if (!custom) {
    configForm.geolocationLatitude = '';
    configForm.geolocationLongitude = '';
    configForm.geolocationAccuracy = '';
  }
}, { immediate: false });

watch(() => configForm.language, async (val) => {
  if (val === '基于IP') {
    configForm.languageCustom = '正在检测 IP 语言...';
    const result = await getIPLanguage();
    console.log('1000', result);
    
    configForm.languageCustom = result.display;
    if (result.list.length > 0) {
      configForm.languages = result.list;
    }
  } else {
    configForm.languageCustom = '';
    configForm.languages = ['英语']
  }
}, { immediate: true });

watch(() => configForm.timezone, async (val) => {
  if (val === '基于IP') {
    configForm.timezoneCustom = '正在检测 IP 时区...';
    configForm.timezoneCustom = await getIPTimezone();
  } else if (val === '真实') {
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hourOffset = moment.tz(tzName).utcOffset() / 60;
    const sign = hourOffset >= 0 ? '+' : '';
    configForm.timezoneCustom = `UTC(${sign}${hourOffset}) ${tzName}`;
  }
}, { immediate: true });



watch(() => configForm.resolution, (val) => {
  if (val === '真实') {
    const { width, height } = window.screen;
    configForm.resolutionWidth = width;
    configForm.resolutionHeight = height;
  }
}, { immediate: true });


const handleRefreshFonts = (silent = false) => {
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
  if (!silent) {
    ElMessage.success('已生成新字体指纹');
  }
};

watch(() => configForm.font, async (val, oldVal) => {
  if (val === '真实') {
    if ('queryLocalFonts' in window) {
      try {
        const fonts = await window.queryLocalFonts();
        const fontNames = fonts.map(f => f.fullName);
        configForm.fontCustom = [...new Set(fontNames)].join(', ');
      } catch (err) {
        console.warn('获取真实字体失败:', err);
      }
    }
  } else if (val === '自定义') {
    if (oldVal === '真实' || !configForm.fontCustom) {
      handleRefreshFonts(true);
    }
  }
}, { immediate: true });

 const webglRenderer =() => {
   const info = getWebGLInfo();
   configForm.webglVendor = info.vendor;
   configForm.webglRenderer = info.renderer;
 }
const handleRefreshWebGlInfo = () => {
   const info = getWebGLInfo();
   configForm.webglVendor = info.vendor;
   configForm.webglRenderer = info.renderer;
   ElMessage.success('已刷新 WebGL 信息');
}

watch(() => configForm.canvas, (val) => {
  if (val === '噪音') {
    configForm.canvasCustom = '同一浏览上为每个浏览器生成不同的 Canvas指纹信息';
  } else if (val === '真实') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const txt = 'BrowserLeaks,com <canvas> 1.0';
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText(txt, 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText(txt, 4, 17);
      const dataURL = canvas.toDataURL();
      // 截取一部分作为展示，避免过长
      // configForm.canvasCustom = '即将使用当前电脑真实的 Canvas指纹信息 (Hash: ' + dataURL.substring(dataURL.length - 20) + ')'; 
       configForm.canvasCustom = dataURL; 
    } catch (e) {
       configForm.canvasCustom = '真实 Canvas指纹信息获取失败';
    }
  }
}, { immediate: true });

watch(() => configForm.audioContext, (val) => {
  if (val === '噪音') {
    configForm.audioContextCustom = '同一浏览上为每个浏览器生成不同的 AudioContext指纹信息';
  } else if (val === '真实') {
    try {
      const audioContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 1e4;
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;
      oscillator.connect(compressor);
      compressor.connect(audioContext.destination);
      oscillator.start(0);
      audioContext.startRendering().then((buffer) => {
        console.log('buffer', buffer ,buffer.getChannelData(0) );
        
          configForm.audioContextCustom = 'Hash: ' + buffer.getChannelData(0).slice(0, 10).reduce((acc, val) => acc + val, 0);
      });
    } catch (e) {
      configForm.audioContextCustom = '真实 AudioContext指纹信息获取失败';
    }
  }
}, { immediate: true });

watch(() => configForm.mediaDevices, async (val) => {
  if (val === '噪音') {
    configForm.mediaDevicesCustom = '采集指纹生成媒体设备在浏览器内代理多媒体设备指纹信息';
  } else if (val === '真实') {
     try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput').length;
      const audioInputs = devices.filter(d => d.kind === 'audioinput').length;
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput').length;
      configForm.mediaDevicesCustom = `将使用当前电脑真实的媒体设备信息指纹信息 (视频: ${videoInputs}, 音频输入: ${audioInputs}, 音频输出: ${audioOutputs})`;
    } catch (e) {
      configForm.mediaDevicesCustom = '将使用当前电脑真实的媒体设备信息指纹信息 (获取失败)';
    }
  }
}, { immediate: true });

watch(() => configForm.clientRects, (val) => {
  if (val === '噪音') {
    configForm.clientRectsCustom = '同一浏览上为每个浏览器生成不同的 ClientRects指纹信息';
  } else if (val === '真实') {
    try {
      const element = document.createElement('div');
      element.innerHTML = 'BrowserLeaks,com <br> ClientRects Fingerprinting';
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.fontSize = '14px';
      element.style.fontFamily = 'Arial';
      document.body.appendChild(element);
      const rects = element.getClientRects();
      let serialized = '';
      for (const rect of rects) {
        serialized += `${rect.x},${rect.y},${rect.width},${rect.height},${rect.top},${rect.right},${rect.bottom},${rect.left},`;
      }
      document.body.removeChild(element);
      
      // Calculate a simple hash from the serialized string
      let hash = 0;
      for (let i = 0; i < serialized.length; i++) {
        const char = serialized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
      }
      configForm.clientRectsCustom = `将使用当前电脑真实的 ClientRects指纹信息 (Hash: ${Math.abs(hash).toString(16)})`;
    } catch (e) {
      configForm.clientRectsCustom = '将使用当前电脑真实的 ClientRects指纹信息 (获取失败)';
    }
  }
}, { immediate: true });

watch(() => configForm.speechVoices, (val) => {
  if (val === '隐私') {
    configForm.speechVoicesCustom = '同一电脑上为每个浏览器生成不同的 SpeechVoices指纹信息';
  } else if (val === '真实') {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    configForm.speechVoicesCustom = `将使用当前电脑真实的 SpeechVoices指纹信息 (检测到 ${voices.length} 个语音包)`;
    if (voices.length === 0 && window.speechSynthesis) {
         window.speechSynthesis.onvoiceschanged = () => {
             const updatedVoices = window.speechSynthesis.getVoices();
             if (configForm.speechVoices === '真实') {
                 configForm.speechVoicesCustom = `将使用当前电脑真实的 SpeechVoices指纹信息 (检测到 ${updatedVoices.length} 个语音包)`;
             }
         };
    }
  }
}, { immediate: true });

watch(() => configForm.cpuCores, (val) => {
  if (val === '真实') {
    const cores = navigator.hardwareConcurrency || 'Unknown';
    configForm.cpuCoresCustom = `使用当前电脑真实的 CPU 内核数指纹信息 (Core: ${cores})`;
  } else if (val === '自定义') {
    if (configForm.cpuCoresCustom && configForm.cpuCoresCustom.includes('使用当前电脑真实的')) {
      configForm.cpuCoresCustom = '2';
    }
  }
}, { immediate: true });

watch(() => configForm.memory, (val) => {
  if (val === '真实') {
    const memory = navigator.deviceMemory || 'Unknown';
    configForm.memoryCustom = `使用当前电脑真实内存大小指纹信息 (Memory: ${memory}GB)`;
  } else if (val === '自定义') {
    if (configForm.memoryCustom && configForm.memoryCustom.includes('使用当前电脑真实')) {
      configForm.memoryCustom = '2';
    }
  }
}, { immediate: true });

watch(() => configForm.doNotTrack, (val) => {
  if (val === false) {
    configForm.doNotTrackCustom = '获取当前设备设置愿意被站点追踪个人信息指纹';
  } else {
    configForm.doNotTrackCustom = '获取当前设备设置不愿意被站点追踪个人信息指纹';
  }
}, { immediate: true });

watch(() => configForm.screen, (val) => {
  if (val === '噪音') {
    configForm.screenCustom = '同一浏览上为每个浏览器生成不同的 Screen指纹信息';
  } else if (val === '真实') {
    const { width, height, colorDepth, pixelDepth } = window.screen;
    configForm.screenCustom = `将使用当前电脑真实窗口的属性和属性指纹信息 (Width: ${width}, Height: ${height}, ColorDepth: ${colorDepth})`;
  }
}, { immediate: true });

const getBluetoothFingerprint = async () => {
  if (!navigator.bluetooth) {
    return '浏览器不支持蓝牙 API';
  }

  try {
    // 检查蓝牙可用性
    const available = await navigator.bluetooth.getAvailability();
    if (!available) {
      return '蓝牙不可用 (硬件未启用或不存在)';
    }

    // 构建蓝牙指纹信息
    const fingerprintData = {
      available: true,
      apiVersion: 'Web Bluetooth API',
      devices: [],
      features: {}
    };

    // 检测蓝牙 API 特性
    fingerprintData.features = {
      getAvailability: typeof navigator.bluetooth.getAvailability === 'function',
      requestDevice: typeof navigator.bluetooth.requestDevice === 'function',
      getDevices: typeof navigator.bluetooth.getDevices === 'function',
      requestLEScan: typeof navigator.bluetooth.requestLEScan === 'function'
    };

    // 尝试获取已配对的设备（需要用户之前授权过）
    if (fingerprintData.features.getDevices) {
      try {
        const devices = await navigator.bluetooth.getDevices();
        fingerprintData.devices = devices.map(device => ({
          id: device.id || 'unknown',
          name: device.name || 'unnamed',
          connected: device.gatt?.connected || false
        }));
      } catch (e) {
        console.log('无法获取已配对设备:', e.message);
      }
    }

    // 生成指纹哈希（基于特性和设备信息）
    const fingerprintString = JSON.stringify({
      features: fingerprintData.features,
      deviceCount: fingerprintData.devices.length,
      userAgent: navigator.userAgent
    });
    
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const fingerprintHash = Math.abs(hash).toString(16).substring(0, 8);

    // 构建详细的指纹信息文本
    let fingerprintText = `将使用当前电脑真实的蓝牙指纹信息 (可用: 是`;
    
    if (fingerprintData.devices.length > 0) {
      fingerprintText += `, 已配对: ${fingerprintData.devices.length}个设备`;
    }
    
    // 统计支持的特性
    const supportedFeatures = Object.entries(fingerprintData.features)
      .filter(([_, supported]) => supported).length;
    
    fingerprintText += `, API特性: ${supportedFeatures}/4`;
    fingerprintText += `, 指纹: ${fingerprintHash})`;
    
    return fingerprintText;

  } catch (e) {
    console.error('蓝牙指纹检测失败:', e);
    return `蓝牙检测失败: ${e.message || '未知错误'}`;
  }
};

const getBatteryFingerprint = async () => {
  if (!navigator.getBattery) {
    return '浏览器不支持电池 API';
  }

  try {
    const battery = await navigator.getBattery();
    
    // 构建电池指纹信息
    const fingerprintData = {
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
      level: battery.level
    };

    // 判断设备类型
    let deviceType = '未知设备';
    if (fingerprintData.chargingTime === Infinity && fingerprintData.dischargingTime === Infinity) {
      deviceType = '台式机/无电池设备';
    } else {
      deviceType = '笔记本/移动设备';
    }

    // 生成指纹哈希
    const fingerprintString = JSON.stringify({
      charging: fingerprintData.charging,
      hasChargingTime: fingerprintData.chargingTime !== Infinity,
      hasDischargingTime: fingerprintData.dischargingTime !== Infinity,
      levelRange: Math.floor(fingerprintData.level * 10) / 10 // 精确到0.1
    });
    
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const fingerprintHash = Math.abs(hash).toString(16).substring(0, 8);

    // 构建详细的指纹信息文本
    let fingerprintText = `将使用当前电脑真实的电池指纹信息 (设备: ${deviceType}`;
    
    if (deviceType !== '台式机/无电池设备') {
      const levelPercent = Math.round(fingerprintData.level * 100);
      const chargingStatus = fingerprintData.charging ? '充电中' : '未充电';
      fingerprintText += `, 电量: ${levelPercent}%, 状态: ${chargingStatus}`;
    }
    
    fingerprintText += `, 指纹: ${fingerprintHash})`;
    
    return fingerprintText;

  } catch (e) {
    console.error('电池指纹检测失败:', e);
    return `电池检测失败: ${e.message || '未知错误'}`;
  }
};

watch(() => configForm.Bluetooth, async (val) => {
  if (val === '隐私') {
    configForm.BluetoothCustom = '同一浏览上为每个浏览器生成不同的 Bluetooth指纹信息';
  } else if (val === '真实') {
    configForm.BluetoothCustom = '正在检测蓝牙指纹信息...';
    configForm.BluetoothCustom = await getBluetoothFingerprint();
  }
}, { immediate: true });

watch(() => configForm.battery, async (val) => {
  if (val === '隐私') {
    configForm.batteryCustom = '同一浏览上为每个浏览器生成不同的电池指纹信息';
  } else if (val === '真实') {
    configForm.batteryCustom = '正在检测电池指纹信息...';
    configForm.batteryCustom = await getBatteryFingerprint();
  }
}, { immediate: true });

watch(() => configForm.portScanProtection, (val) => {
  if (val === true) {
    configForm.portScanProtectionCustom = '已启用端口扫描保护，阻止脚本使用网站检测对本地网络内的端口和服务器，保护您的网络隐私安全';
  } else {
    configForm.portScanProtectionCustom = '已关闭端口扫描保护，网站可以检测您使用了本地网络的哪些端口，可能存在隐私泄露风险';
  }
}, { immediate: true });


const handleEditFonts = () => {
  fontDialogVisible.value = true;
  selectedFontsInDialog.value = configForm.fontCustom ? configForm.fontCustom.split(',').map(f => f.trim()) : [];
};

const confirmEditFont = () => {
  configForm.fontCustom = selectedFontsInDialog.value.join(', ');
  fontDialogVisible.value = false;
};
const handleRefreshResolution = () => {
  const randomRes = resolutionOptions.value[Math.floor(Math.random() * resolutionOptions.value.length)];
  currentResolution.value = randomRes;
  ElMessage.success('已随机切换分辨率');
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
    onlineStatus:1,
  };
  console.log('data会话参数',data);
  
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
        Bluetooth: configForm.Bluetooth,
        battery: configForm.battery,
        battery_custom: configForm.batteryCustom,
        port_scan_protection: configForm.portScanProtection,
        port_scan_protection_custom: configForm.portScanProtectionCustom
      };

      // 如果是新建会话，先通过 IPC 添加
      if (!props.isEdit) {
        const addArgs = {
          activeStatus: false,
          cardId: configForm.cardId,
          title: configForm.name,
          name: configForm.name,
          online: true,
          platform: props.platform,
        };
        console.log('addIPC', addArgs);
        
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
                      {{configForm.webgpuCustom}}
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
                   <div class="form-sub-tip" v-if="configForm.webglImage==='噪音'">
                    在同一网页上为每个浏览器实例生成不同的 WebGL 图像。
                   </div>
                    <div class="form-sub-tip" v-if="configForm.webglImage==='真实'">将使用当前电脑真实的 WebGL 图像信息</div>
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
                    {{ configForm.timezoneCustom }}
                  <el-radio-group v-model="configForm.timezone">
                    <el-radio-button label="基于IP">基于IP</el-radio-button>
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.timezone==='基于IP'">基于 IP 匹配对应的时区</div>
                   <div class="form-sub-tip" v-if="configForm.timezone==='真实'">使用当前电脑的时区：{{ configForm.timezoneCustom }}</div>
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

                  <div class="form-sub-tip" v-if="configForm.geolocation === '询问' && configForm.geolocationCustom && configForm.geolocationLatitude">
                    检测到位置：纬度 {{ configForm.geolocationLatitude }}, 经度 {{ configForm.geolocationLongitude }}
                  </div>
                  
                  <div class="geolocation-custom-container" v-if="configForm.geolocation === '询问' && !configForm.geolocationCustom">
                    <div class="geo-input-row">
                      <span class="geo-label"><span class="required-star">*</span>经/纬度</span>
                      <el-input v-model="configForm.geolocationLatitude" placeholder="纬度" style="width: 120px;"></el-input>
                      <el-input v-model="configForm.geolocationLongitude" placeholder="精度" style="width: 120px; margin-left:12px"></el-input>
                    </div>
                    <div class="geo-input-row" style="margin-top: 12px">
                      <span class="geo-label">精度(米)</span>
                      <el-input v-model="configForm.geolocationAccuracy" placeholder="精度(米)" style="width: 120px;"></el-input>
                    </div>
                    <div class="geo-tip">范围10 ~ 5000</div>
                  </div>

                  </div>
                </el-form-item>

                <el-form-item label="语言">
                   <div class="flex-column">
                  <el-radio-group v-model="configForm.language">
                    <el-radio-button label="基于IP">基于IP</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="form-sub-tip" v-if="configForm.language === '基于IP' && configForm.languageCustom">{{ configForm.languageCustom }}</div>
                  <div class="form-sub-tip" v-else></div>
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
                  <el-radio-group v-model="configForm.resolution" class="resolution-radio-group">
                    <el-radio-button label="真实">真实</el-radio-button>
                    <el-radio-button label="自定义">自定义</el-radio-button>
                  </el-radio-group>
                   <div class="form-sub-tip"  v-if="configForm.resolution==='真实'">将使用当前电脑的真实分辨率</div>
                  <div v-if="configForm.resolution === '自定义'" class="resolution-custom-row">
                    <el-select
                      v-model="currentResolution"
                      filterable
                      allow-create
                      default-first-option
                      placeholder="请选择或输入分辨率"
                      class="resolution-select"
                    >
                      <el-option
                        v-for="item in resolutionOptions"
                        :key="item"
                        :label="item"
                        :value="item"
                      />
                    </el-select>
                    <span class="refresh-icon-resolution" @click="handleRefreshResolution">
                      <i class="iconfont icon-refresh"></i>
                    </span>
                  </div>
                  </div>
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
                     {{ configForm.batteryCustom }}
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
                    <el-input type="textarea" v-if="configForm.portScanProtection" :rows="3" v-model="configForm.cookie" placeholder="选填， 允许被连接的本地网络端口范围之间， 分隔多个逗号隔开 例：2000-3000， 3000-5000"></el-input>
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
            <span class="value text-success">{{configForm.webglImage}}</span>
          </div>
          <div class="overview-item">
            <span class="label">WebGPU</span>
            <span class="value text-success">{{configForm.webgpu}}</span>
          </div>
          <div class="overview-item" v-if="configForm.webgpu === '真实' && configForm.webgpuCustom">
            <span class="label">WebGPU 详情</span>
            <span class="value text-primary">{{ configForm.webgpuCustom }}</span>
          </div>
          <div class="overview-item">
            <span class="label">WebRTC</span>
            <span class="value text-success">{{configForm.webrtc }}</span>
          </div>
          <div class="overview-item">
            <span class="label">时区</span>
            <span class="value text-success">{{configForm.timezone==='自定义' ? '替换': configForm.timezone }}</span>
          </div>
          <div class="overview-item">
            <span class="label">地理位置</span>
            <span class="value text-success">基于 IP ({{configForm.geolocation}})</span>
          </div>
          <div class="overview-item">
            <span class="label">语言</span>
            <span class="value text-success">{{configForm.language==='自定义' ? '替换': configForm.language }}</span>
          </div>
          <div class="overview-item">
            <span class="label">分辨率</span>
            <span class="value text-success">{{configForm.resolution==='真实' ?configForm.resolution : currentResolution }}</span>
          </div>
          <div class="overview-item">
            <span class="label">字体</span>
            <span class="value text-success">{{configForm.font==='自定义' ? '替换': configForm.font }}</span>
          </div>
          <div class="overview-item">
            <span class="label">Canvas</span>
            <span class="value text-success">{{configForm.canvas}}</span>
          </div>
          <div class="overview-item">
            <span class="label">AudioContext</span>
            <span class="value text-success">{{configForm.audioContext}}</span>
          </div>
          <div class="overview-item">
            <span class="label">媒体设备</span>
            <span class="value text-success">{{configForm.mediaDevices}}</span>
          </div>
          <div class="overview-item">
            <span class="label">ClientRects</span>
            <span class="value text-success">{{configForm.clientRects}}</span>
          </div>
          <div class="overview-item">
            <span class="label">SpeechVoices</span>
            <span class="value text-success">{{configForm.speechVoices}}</span>
          </div>
          <div class="overview-item">
            <span class="label">CPU内核数</span>
            <span class="value text-primary">{{configForm.cpuCores==='真实' ?configForm.cpuCores : configForm.cpuCoresCustom }} {{configForm.cpuCores==='真实' ?'' : '核'}}</span>
          </div>
          <div class="overview-item">
            <span class="label">内存</span>
            <span class="value text-primary">{{configForm.memory==='真实' ?configForm.memory : configForm.memoryCustom }} {{configForm.memory==='真实' ?' ' : 'GB'}}</span>
          </div>
          <div class="overview-item">
            <span class="label">Do Not Track</span>
            <span class="value">{{configForm.doNotTrack ? '启用' : '关闭' }}</span>
          </div>
          <div class="overview-item">
            <span class="label">蓝牙</span>
            <span class="value text-success">{{configForm.Bluetooth==='真实' ? configForm.Bluetooth : '替换'}}</span>
          </div>
          <div class="overview-item">
            <span class="label">电池</span>
            <span class="value text-success">{{configForm.battery==='真实' ? configForm.battery : '替换'}}</span>
          </div>
          <div class="overview-item">
            <span class="label">跨门保护</span>
            <span class="value">{{configForm.portScanProtection ? '启用' : '关闭' }}</span>
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

.resolution-custom-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.resolution-select {
  flex: 1;
}

.refresh-icon-resolution {
  cursor: pointer;
  color: #409EFF;
  display: flex;
  align-items: center;
  font-size: 18px;
}

/* 1:1 Green Theme Recreation */
:deep(.resolution-radio-group .el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  background-color: #2ed36a !important;
  border-color: #2ed36a !important;
  box-shadow: -1px 0 0 0 #2ed36a !important;
  color: #fff !important;
}

:deep(.resolution-select .el-input__wrapper) {
  border: 1px solid #2ed36a !important;
  box-shadow: none !important;
}

:deep(.resolution-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #2ed36a inset !important;
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

/* Geolocation Custom Styles */
.geolocation-custom-container {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid #eef2f2;
  border-radius: 8px;
  background-color: #fff;
}

.geo-input-row {
  display: flex;
  align-items: center;
}

.geo-label {
  width: 80px;
  font-size: 14px;
  color: #333;
}

.required-star {
  color: #f56c6c;
  margin-right: 4px;
}

.geo-tip {
  margin-left: 80px;
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}

.geolocation-custom-container :deep(.el-input__wrapper) {
  border-radius: 6px;
  background-color: #fcfdfe;
}
</style>
