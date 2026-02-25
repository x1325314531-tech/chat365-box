// whatsapp-content.js
// 版本：2026-01-30 v2 - 添加 IndexedDB 存储发送消息原文
console.log('🔧 WhatsApp.js 脚本版本: 2026-01-30 v2 (含原文持久化)');

// ==================== 全局音频监听 & 自动连播拦截 (Sniffer) ====================
(function() {
    console.log('🎧 启动全局音频嗅探器 & 自动连播拦截器...');
    
    // 记录最后一次用户交互时间，用于判断播放是否由用户触发
    window._wp_last_user_touch = 0;
    const updateTouch = () => { window._wp_last_user_touch = Date.now(); };
    document.addEventListener('mousedown', updateTouch, true);
    document.addEventListener('keydown', updateTouch, true);

    // 拦截 HTMLMediaElement.play (涵盖 audio 和 video)
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
        // 判断是否是点击触发的播放（2秒内的交互视为用户触发）
        const isUserInitiated = (Date.now() - window._wp_last_user_touch) < 2000;
        
        // WhatsApp 的语音通常是 blob: 开头的 URL
        const isVoiceMessage = this.src && this.src.startsWith('blob:');
        
        if (isVoiceMessage && !isUserInitiated) {
            console.log('🚫 [Sniffer] 拦截到可能的自动连播:', this.src);
            // 返回一个已完成的 Promise，防止 WhatsApp 内部代码报错
            return Promise.resolve();
        }

        if (isVoiceMessage) {
            console.log('🎵 [Sniffer] HTMLMediaElement.play() 捕获语音:', this.src);
            window._wp_playing_audio = this;

            // 提示正在录音
            window.electronAPI.showNotification({
                message: '🎤 正在同步录制语音...',
                type: 'is-info'
            });

            // 启动录音逻辑
            startAudioRecording(this).catch(console.error);

            // 绑定结束事件用于自动停止和捕获
            if (!this._sniffer_event_inited) {
                this._sniffer_event_inited = true;
                this.addEventListener('pause', () => {
                    console.log('⏸️ [Sniffer] 音频暂停，同步录制结束');
                    stopAudioRecording();
                });
                this.addEventListener('stop', () => {
                    console.log('⏹️ [Sniffer] 音频停止');
                    stopAudioRecording();
                });
            }
        } else {
            console.log('🎵 [Sniffer] HTMLMediaElement.play() 捕获:', this.src);
            window._wp_playing_audio = this;
        }

        return originalPlay.apply(this, arguments);
    };

    // 拦截 window.Audio 构造函数
    const originalAudio = window.Audio;
    window.Audio = function() {
        const audio = new originalAudio(...arguments);
        console.log('🎵 [Sniffer] new Audio() 捕获:', audio);
        audio.addEventListener('play', () => { 
            window._wp_playing_audio = audio; 
        });
        return audio;
    };

    // 拦截 document.createElement('audio')
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.apply(this, arguments);
        if (tagName.toLowerCase() === 'audio') {
            console.log('🎵 [Sniffer] createElement("audio") 捕获:', element);
            element.addEventListener('play', () => {
                window._wp_playing_audio = element;
            });
        }
        return element;
    };
})();
// ==========================================================

function printElementEvery5Seconds() {
    console.info('✅ 进入 WhatsApp.js 脚本');

    setInterval(() => {
        // 稳健的选择器列表：
        // 1. 登录后的标志性元素 (侧边栏、主对话窗口、欢迎页标题)
        const loggedInElement = document.getElementById('pane-side') || 
                                document.querySelector('[data-testid="side-panel"]') ||
                                document.getElementById('main') ||
                                document.querySelector('[data-testid="intro-text-title"]');
        
        // 2. 扫码页面的标志性元素 (二维码 canvas 或容器)
        const qrCodeElement = document.querySelector('canvas') || 
                              document.querySelector('[data-testid="qrcode"]') ||
                              document.querySelector('._ak96'); // WhatsApp 扫码容器常见类名

        if (loggedInElement || qrCodeElement) {
            // 尝试获取用户头像（仅登录后有效）
            const avatarImg = document.querySelector('header img') || 
                            document.querySelector('div[role="button"] img');
            const url = avatarImg?.src || '';
            
            window.electronAPI.sendMsg({platform:'WhatsApp', online: true, avatarUrl: url}).then(res => {
                // console.log('状态上报（在线）：', res);
            });
        } else {
            window.electronAPI.sendMsg({platform:'WhatsApp', online: false, avatarUrl: ''}).then(res => {
                // console.log('状态上报（离线）：', res);
            });
        }
    }, 5000);
}

let languages = []
let globalConfig = null;
let lastPreviewedTranslation = '';
let lastPreviewedSource = '';
let previewNode = null;

// 钱包地址正则 (ETH/BNB/TRON等)
const walletAddressRegex = /\b0x[a-fA-F0-9]{40}\b/g;
const tronAddressRegex = /\bT[a-zA-Z0-9]{33}\b/g;

// 图片翻译语言选择
let fromImageLang = 'en';
let targetImageLang = 'zh';

// ==================== 自动化语音捕获系统 ====================
// 缓存：voiceContainer (Canonical) -> { path, time }
const audioCacheMap = new Map(); // 使用 Map 支持字符串(ID)或元素键

// 获取规范的消息容器 (用于作为统一的缓存 Key)
function getCanonicalVoiceContainer(element) {
    if (!element) return null;
    
    // 1. 优先寻找带有 data-id 的消息根容器 (最稳定)
    const messageNode = element.closest('[data-id]');
    if (messageNode) {
        // 返回 data-id 字符串作为 Key，确保在 UI 重新渲染后依然能对应
        return messageNode.getAttribute('data-id') || messageNode;
    }
    
    // 2. 其次寻找语音特定的按钮容器或气泡
    const container = element.closest('.message-in') || 
                      element.closest('.message-out') || 
                      element.closest('div[role="button"]')?.parentElement ||
                      element.closest('.x1n2onr6') || 
                      element.closest('div[role="row"]');
    
    return container || element;
}

// 录音全局状态
let audioSourceMap = new WeakMap(); // audioElement -> { audioContext, source, destination }
let currentRecorder = null;
let audioChunks = [];
let recordedAudioBlob = null;
let currentAudioElement = null; // 当前正在录制的音频元素
let recordingStateMap = new Map(); // 追踪录制状态，防止并发冲突: key -> 'recording' | 'processing' | 'done'
let voiceRecordingData= null
// ArrayBuffer 转 Base64 辅助函数
function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// 自动捕获核心逻辑
async function autoCaptureVoice(audioElement) {
    try {
        const src = audioElement.src;
        console.log('🎙️ [Auto-Capture] 开始处理音频:', src);
        
        const containerKey = getCanonicalVoiceContainer(audioElement);
        if (!containerKey) {
            console.warn('⚠️ [Capture] 无法找到关联的消息容器');
            return;
        }

        recordingStateMap.set(containerKey, 'processing');

        // 1. 获取 Buffer
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, resolve, reject);
        });

        // 2. 重采样 & 转换 PCM
        const targetRate = 16000;
        const resampledBuffer = await resampleAudioBuffer(audioBuffer, targetRate);
        const pcmBuffer = audioBufferToRawBuffer(resampledBuffer);
        
        // 3. 保存到本地
        const base64 = bufferToBase64(pcmBuffer);
        const res = await window.electronAPI.saveCapturedAudio({ 
            audioData: base64, 
            format: 'pcm' 
        });

        if (res && res.success) {
            // 存入缓存
            audioCacheMap.set(containerKey, {
                path: res.path,
                time: Date.now()
            });
            recordingStateMap.set(containerKey, 'done');
            console.log('✅ [Capture] 音频已自动保存至本地:', res.path, 'Key:', containerKey);
        } else {
            recordingStateMap.delete(containerKey);
        }
    } catch (e) {
        console.error('❌ [Auto-Capture] 捕获失败:', e);
        // 清理状态
        const key = getCanonicalVoiceContainer(audioElement);
        if (key) recordingStateMap.delete(key);
    }
}
// ==========================================================

// 更新预览UI
function updatePreviewUI(text) {
    if (!previewNode) {
        previewNode = document.createElement('div');
        previewNode.id = 'translationPreviewNode';
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUpPreview {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .preview-show {
                animation: slideUpPreview 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
        `;
        document.head.appendChild(style);

        previewNode.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            color: #1c1e21;
            padding: 12px 16px;
            font-size: 14px;
            border: 1px solid rgba(46, 211, 106, 0.3);
            border-bottom: none;
            border-radius: 12px 12px 0 0;
            z-index: 999;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.08);
            display: none;
            word-break: break-all;
            flex-direction: column;
            gap: 4px;
        `;
        const footer = document.querySelector('footer');
        if (footer) {
            footer.style.position = 'relative';
            footer.appendChild(previewNode);
        }
    }

    if (text) {
        previewNode.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2ed36a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 8l6 6"></path>
                    <path d="M4 14l6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="M22 22l-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                </svg>
                <span style="font-size: 11px; font-weight: 600; color: #2ed36a; text-transform: uppercase; letter-spacing: 0.5px;">译文预览</span>
            </div>
            <div style="color: #3b3c3e; line-height: 1.4; font-weight: 450;">${text}</div>
            <div style="font-size: 10px; color: #8696a0; margin-top: 4px;">按 Enter 确认发送，修改内容取消预览</div>
        `;
        previewNode.style.display = 'flex';
        previewNode.classList.remove('preview-show');
        void previewNode.offsetWidth; // 触发回流以重启动画
        previewNode.classList.add('preview-show');
    } else {
        previewNode.style.display = 'none';
        previewNode.classList.remove('preview-show');
    }
}

// 同步全局配置
async function syncGlobalConfig() {
    try {
        const config = await window.electronAPI.getTranslateConfig();
        // const tenantConfig = await window.electronAPI.getTenantConfig()
        // const tenantConfig  = await  initTenantConfig()   
        if (config) {
            globalConfig =  { ...config, }
            console.log('🔄 全局配置同步成功:', globalConfig);
        }
    } catch (e) {
        console.error('❌ 同步全局配置失败:', e);
    }
}

// 初始化租户配置
async function initTenantConfig() {
    try {
        console.log('📡 正在初始化租户配置...');
        const result = await window.electronAPI.fetchTenantSetting();
        console.log('租户配置初始化结果：', result);
        
        if (result && result.success) {
            console.log('✅ 租户配置初始化成功:', result.data);
            // 更新当前全局配置以确保 UI 能够实时响应
           let tenantConfig = { 
          ...JSON.parse(result.data.triggerSetting || '{}'), 
          ...JSON.parse(result.data.interceptedSetting || '{}') 
            };
            console.log('tenantConfig',tenantConfig);
             return tenantConfig
        } else {
            console.warn('⚠️ 租户配置初始化失败:', result?.msg || '未知错误');
        }
    } catch (e) {
        console.error('❌ 初始化租户配置异常:', e);
    }
}

function notify() {
    window.electronAPI.newMsgNotify({platform:'WhatsApp'})
}

monitorMainNode()
initTenantConfig()


// 初始化语言列表
function getLanguageList() {
    window.electronAPI.languageList().then((response) => {
        languages = response.data;
        console.log('语言列表加载完成:', languages.length, '种语言');
        // 加载完成后填充所有下拉框
        populateLanguageSelects();
    }).catch(error => {
        console.error('加载语言列表失败:', error);
    });
}
// 初始化租户配置

// 填充语言下拉框
function populateLanguageSelects() {
    const fromSelects = document.querySelectorAll('.fromImageLangSelect');
    const targetSelects = document.querySelectorAll('.targetImageLangSelect');
    
    if (fromSelects.length === 0 && targetSelects.length === 0) return;

    fromSelects.forEach(fromSelect => {
        const currentVal = fromSelect.value || fromImageLang;
        fromSelect.innerHTML = '';
        languages.forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang.code;
            opt.textContent = lang.displayName;
            fromSelect.appendChild(opt);
        });
        if (languages.some(l => l.code === currentVal)) fromSelect.value = currentVal;

        // 如果存在自定义 UI 更新钩子，则调用它
        if (typeof fromSelect._updateCustomUI === 'function') {
            fromSelect._updateCustomUI();
        }
    });

    targetSelects.forEach(targetSelect => {
        const currentVal = targetSelect.value || targetImageLang;
        targetSelect.innerHTML = '';
        languages.forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang.code;
            opt.textContent = lang.displayName;
            targetSelect.appendChild(opt);
        });
        if (languages.some(l => l.code === currentVal)) targetSelect.value = currentVal;

        // 如果存在自定义 UI 更新钩子，则调用它
        if (typeof targetSelect._updateCustomUI === 'function') {
            targetSelect._updateCustomUI();
        }
    });
}

// 同步所有图片语言下拉框
function syncAllImageLangSelects(type, value) {
    const selector = type === 'from' ? '.fromImageLangSelect' : '.targetImageLangSelect';
    document.querySelectorAll(selector).forEach(select => {
        if (select.value !== value) {

            select.value = value;
            console.log('select.value', select.value);
            
            // 如果存在自定义 UI 更新钩子，则调用它
            if (typeof select._updateCustomUI === 'function') {
                select._updateCustomUI();
            }
        }
    });
}

function sendMsg() {
    let sendButton = document.querySelector('footer span[data-icon="wds-ic-send-filled"]')?.parentNode;
    if (sendButton) {
        sendButton.click();
        console.log('消息已发送');
    } else {
        console.log('发送按钮不存在！');
    }
}

function startMonitor() {
    console.log('✅ 进入 startMonitor 函数');

    // 获取可编辑的 div 消息输入框元素
    let editableDiv = document.querySelector('footer div[aria-owns="emoji-suggestion"][contenteditable="true"]');

    console.log('输入框元素:', editableDiv ? '找到' : '未找到');

    if (editableDiv) {
        console.log('✅ 找到输入框，添加事件监听');

        // 移除可能存在的旧监听器
        // 关键修复：移除监听器时必须与添加时的 useCapture 参数（true）一致
        editableDiv.removeEventListener('keydown', handleKeyDown, true);
        editableDiv.removeEventListener('input', handleInput, true);

        // 添加新的事件监听器
        editableDiv.addEventListener('keydown', handleKeyDown, true);
        editableDiv.addEventListener('input', handleInput, true);

        console.log('✅ 事件监听器已添加');
    } else {
        console.error('❌ 未找到输入框元素，2秒后重试');
        setTimeout(startMonitor, 2000);
    }
}

// 处理输入变化，清除预览状态
function handleInput(event) {
    if (lastPreviewedTranslation) {
        const inputText = getInputContent();
        if (inputText !== lastPreviewedTranslation) {
            console.log('📝 内容已更改，清除预览');
            updatePreviewUI(null);
            lastPreviewedTranslation = '';
        }
    }
}
// 归一化文本，将所有空白字符（含换行、制表符、多个空格）统一处理为单个半角空格并修剪首尾
// 同时移除一些常见的不可见字符和 WhatsApp 特有的控制字符
function normalizeText(text) {
    if (!text) return '';
    return text.toString()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽空格等不可见字符
        .replace(/\u00A0/g, ' ') // 将不换行空格替换为普通空格
        .replace(/\s+/g, ' ')    // 连续空白字符塌陷为单个空格
        .trim();                 // 首尾修剪
}

// 处理空格 换行 
function cleanParagraph(text) {
  let noLineBreaks = text.replace(/[\r\n]+/g, ' ');
  let singleSpaces = noLineBreaks.replace(/\s{2,}/g, ' ');
  return singleSpaces.trim();
}
// 分离事件处理函数，便于管理
async function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.ctrlKey) {
        console.log('⏺️ Enter键按下,开始处理翻译');

        // 获取输入框内容
        const inputText = getInputContent();

        console.log('输入内容:', inputText);

        if (!inputText.trim()) {
            console.log('❌ 输入内容为空');
            return;
        }

        // 判断是否纯表情
        const hasSpan = document.querySelector('footer div[contenteditable="true"]')?.querySelector('span');
        if (hasSpan && !inputText.trim()) {
            console.log('😀 纯表情,直接发送');
            sendMsg();
            return;
        }

        // ========== 场景1: 发送自动翻译开启 - 翻译后发送 ==========
        if (globalConfig?.sendAutoTranslate) {
            console.log('🔄 场景1: 发送自动翻译开启,翻译后发送');
            
            // 立即阻止事件传播
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            // 检查是否正在处理中
            let loadingNode = document.getElementById('editDivLoadingNode');
            if (loadingNode) {
                console.log('⏳ 已有处理中的请求,跳过');
                return;
            }

            // --- 翻译预览逻辑 ---
            if (globalConfig?.translatePreview && lastPreviewedTranslation) {
                if (inputText.trim() === lastPreviewedTranslation.trim()) {
                    console.log('✅ 预览已确认,发送消息');
                    event.preventDefault();
                    event.stopPropagation();
                    
                    sendMsg();
                    
                    // 确保发送后也能持久化原文显示
                    const original = lastPreviewedSource;
                    const translated = lastPreviewedTranslation;
                    setTimeout(() => {
                        addOriginalTextToSentMessage(original, translated);
                    }, 500);

                    updatePreviewUI(null);
                    lastPreviewedTranslation = '';
                    lastPreviewedSource = '';
                    return;
                }
            }
            // ------------------

            // 执行翻译流程
            executeTranslationFlow(inputText);
            return;
        }

        // ========== 场景2: 发送自动翻译关闭,但开启了消息下方显示译文 ==========
        if (!globalConfig?.sendAutoTranslate && globalConfig?.sendAutoNotTranslate) {
            console.log('📝 场景2: 发送原文,稍后在消息下方显示译文');
            
            // 不阻止默认发送行为,让消息正常发送
            // 记录原文,用于后续翻译
            const originalText = inputText;
             // ===== 敏感词检测 =====
         console.log('敏感词inputText', inputText);
        const sensitiveCheck = await checkSensitiveContent(inputText);
        console.log('敏感词', sensitiveCheck);
        
        if (sensitiveCheck.isSensitive) {
            console.warn('🚫 检测到敏感内容，阻止发送');
            
            // 显示警告通知
            window.electronAPI.showNotification({
                message: `⚠️ ${sensitiveCheck.reason}`,
                type: 'is-danger'
            });
            
            // 可选：在输入框下方显示警告提示
            showSensitiveWarning(sensitiveCheck.reason);
            
            return false; // 修复：检测到敏感词应直接返回，不再执行后续流程
        }
        //  originalText = cleanParagraph(originalText); 
        //   
            // 延迟调用翻译并渲染
            // 传递原文(含换行)给翻译函数，以便 API 能正确处理换行，
            // 但在 translateAndDisplayBelowSentMessage 内部会归一化后进行缓存键匹配
            setTimeout(() => {
                translateAndDisplayBelowSentMessage(originalText);
            }, 500);
            return;
        }

        // ========== 场景3: 两个开关都关闭 - 直接发送,不做任何处理 ==========
        console.log('➡️ 场景3: 直接发送原文,不翻译');
        // 不需要额外代码,让消息正常发送即可
    }
}

// 获取输入框内容的函数
function getInputContent() {
    let editableDiv = document.querySelector('footer div[aria-owns="emoji-suggestion"][contenteditable="true"]');
    // 优先使用 innerText，因为它能更好地处理换行块 (<div>/p/<br>) 转换为文字
    return editableDiv ? (editableDiv.innerText || editableDiv.textContent) : '';
}

// 敏感词检测函数
async function checkSensitiveContent(text) {
    try {
        console.log('🔍 开始敏感词及特殊内容检测:', text);
        const tenantConfig  = await initTenantConfig()
        // 使用 electronAPI 调用后端接口
        const result = await window.electronAPI.checkSensitiveContent({ content: text,tenantConfig:tenantConfig } );
        console.log('后端验证结果:', result);
        
        if (result && result.success && result.data) {
            // 后端现在统一判断并在 data.isSensitive 中返回结果
            return result.data;
        }
        
        return {
            isSensitive: false,
            reason: '',
            details: {}
        };
        
    } catch (error) {
        console.error('❌ 敏感词检测失败:', error);
        // 检测失败时，为了不影响正常沟通，允许发送
        return {
            isSensitive: false,
            reason: '',
            details: {},
            error: error.message
        };
    }
}

// 执行翻译流程
async function executeTranslationFlow(inputText) {
    try {
        console.log('🔄 开始翻译流程，原文:', inputText);
        
        // ===== 敏感词检测 =====
        
        const sensitiveCheck = await checkSensitiveContent(inputText);
        
        if (sensitiveCheck.isSensitive) {
            console.warn('🚫 检测到敏感内容，阻止发送');
            
            // 显示警告通知
            window.electronAPI.showNotification({
                message: `⚠️ ${sensitiveCheck.reason}`,
                type: 'is-danger'
            });
            
            // 可选：在输入框下方显示警告提示
            showSensitiveWarning(sensitiveCheck.reason);
            
            return; // 阻止发送
        }


        
        // =====================

        // 显示加载状态
        const loadingNode = generateLoadingNode();
        loadingNode.id = 'editDivLoadingNode';
        operationNode('add', loadingNode, document.querySelector('footer div[contenteditable="true"]')?.parentNode?.parentNode);

        // 调用翻译API
        console.log('📝 调用翻译API...');
        const result = await translateTextAPI(inputText, getLocalLanguage(), getTargetLanguage());
        console.log('✅ 翻译结果:', result);

        let finalInput = inputText;

        if (result && result.success) {
            finalInput = result.data;
        } else {
            console.warn('⚠️ 翻译失败:', result?.msg);
            // 显示通知告诉用户为什么翻译失败
            window.electronAPI.showNotification({
                message: `翻译失败: ${result?.msg || '服务异常'}，将发送原文`,
                type: 'is-warning'
            });
            // 翻译失败，保留原文继续流程
        }

        // 确保输入框有焦点
        let editableDiv = document.querySelector('footer div[aria-owns="emoji-suggestion"][contenteditable="true"]');
        if (editableDiv) {
            editableDiv.focus();
        }

        // 使用 Electron 原生键盘模拟 - 这会绕过 Lexical 的 DOM 保护
        console.log('⌨️ 使用原生键盘模拟输入...');
        const typResult = await window.electronAPI.simulateTyping({
            text: finalInput,
            clearFirst: true  // 先清空（Ctrl+A + Backspace）
        });

        if (typResult && typResult.success) {
            console.log('✅ 原生键盘输入成功');
        } else {
            console.error('❌ 原生键盘输入失败:', typResult?.error);
        }

        // 移除加载状态
        operationNode('remove', loadingNode);

        // 检查输入框内容
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 处理预览逻辑
        if (globalConfig?.translatePreview && result && result.success) {
            console.log('👀 开启了翻译预览，显示译文并不发送');
            updatePreviewUI(finalInput);
            lastPreviewedTranslation = finalInput;
            lastPreviewedSource = inputText;
            
            // 消息已替换，但不调用 sendMsg
            return;
        }

        // 发送消息
        setTimeout(() => {
            sendMsg();
            console.log('📤 消息已发送');
            
            // 消息发送后，如果是翻译成功的，则添加原文显示
            if (result && result.success) {
                setTimeout(() => {
                    addOriginalTextToSentMessage(inputText, finalInput);
                }, 500);
            }
        }, 200);

    } catch (error) {
        console.error('❌ 翻译过程出错:', error);

        // 移除加载状态
        operationNode('remove', document.getElementById('editDivLoadingNode'));

        // 翻译失败，直接发送原文
        sendMsg();
    }
}

// 将原文添加到已发送的消息上
async function addOriginalTextToSentMessage(originalText, translatedText) {
    try {
        // 查找最新发送的消息（message-out 是发送的消息）
        const sentMessages = document.querySelectorAll('.message-out');
        if (sentMessages.length === 0) {
            console.log('❌ 未找到发送的消息');
            return;
        }
        
        // 获取最后一条发送的消息
        const lastSentMessage = sentMessages[sentMessages.length - 1];
        
        // 查找消息文本的span
        const textSpan = lastSentMessage.querySelector('span[dir="ltr"], span[dir="rtl"]');
        if (!textSpan) {
            console.log('❌ 未找到消息文本span');
            return;
        }
        
        // 检查是否已经添加过原文
        if (textSpan.querySelector('.original-text-result')) {
            console.log('⏳ 原文已显示，跳过');
            return;
        }
        
        // 验证是翻译后的消息
        const msgContent = textSpan.textContent.trim();
        if (!msgContent.includes(translatedText.substring(0, 20))) {
            console.log('⚠️ 消息内容不匹配，跳过');
            return;
        }

        // 校验：如果原文与译文完全一致，则不显示原文节点
        if (originalText.trim() === translatedText.trim()) {
            console.log('ℹ️ 原文与译文一致，跳过显示原文');
            // 仍然保存到数据库，以便后续恢复状态
            await saveSentMessage(translatedText, originalText);
            return;
        }
        
        // 保存原文到本地存储（IndexedDB）
        // 使用归一化后的译文作为键，提高恢复时的匹配率
        const normalizedTranslated = normalizeText(translatedText);
        await saveSentMessage(normalizedTranslated, originalText);
        console.log('💾 原文已保存到本地 (Key:', normalizedTranslated.substring(0, 20), '):', originalText);
        
        // 创建原文显示节点（与接收消息翻译UI一致）
        // 使用 span + display:block 以避免块级元素嵌套在 span 内导致的渲染冲突
        let originalNode = document.createElement('span');
        originalNode.className = 'original-text-result';
        originalNode.style.cssText = `
            display: block;
            font-size: 13px;
            color: #25D366;
            border-top: 1px dashed #ccc;
            padding-top: 5px;
            margin-top: 5px;
            font-style: italic;
        `;
        originalNode.textContent = originalText;
        
        textSpan.appendChild(originalNode);
        console.log('✅ 原文已显示:', originalText);
        
    } catch (error) {
        console.error('❌ 添加原文失败:', error);
    }
}

/**
 * 翻译已发送的消息并在消息下方显示译文
 * 用于场景: sendAutoTranslate: false 且 sendAutoNotTranslate: true
 * @param {string} originalText - 原始消息文本
 */
/**
 * 翻译已发送的消息并在消息下方显示译文
 * 用于场景: sendAutoTranslate: false 且 sendAutoNotTranslate: true
 * @param {string} originalText - 原始消息文本
 * @param {number} retryCount - 当前重试次数
 */
async function translateAndDisplayBelowSentMessage(originalText, retryCount = 0) {
    let loadingNode = null;
    let textSpan = null;
    const MAX_RETRIES = 3;
    
    try {
        console.log(`🌐 [Attempt ${retryCount + 1}] 开始查找已发送的消息:`, originalText.substring(0, 30));
        
        // 1. 查找发送的消息 (message-out 是发送的消息)
        const sentMessages = Array.from(document.querySelectorAll('.message-out'));
        if (sentMessages.length === 0) {
            if (retryCount < MAX_RETRIES) {
                console.log('⏳ 未找到发送消息，可能是 DOM 尚未更新，500ms 后重试...');
                setTimeout(() => translateAndDisplayBelowSentMessage(originalText, retryCount + 1), 500);
            } else {
                console.log('❌ 达到最大重试次数，放弃查找');
            }
            return;
        }
        
        // 2. 倒序遍历最后几条消息寻找匹配项 (防止乱序或消息堆叠)
        const searchRange = Math.min(sentMessages.length, 5);
        let matchedMessage = null;
        let normOriginal = normalizeText(originalText);

        for (let i = 1; i <= searchRange; i++) {
            const msgNode = sentMessages[sentMessages.length - i];
            const span = msgNode.querySelector('span[dir="ltr"], span[dir="rtl"]');
            if (!span) continue;

            // 优先使用 innerText 获取带换行的文本
            const spanText = span.innerText || span.textContent;
            const normMsg = normalizeText(spanText);
            if (normMsg.includes(normOriginal) || normOriginal.includes(normMsg)) {
                // 确保该消息还没添加翻译
                if (!span.querySelector('.translation-result')) {
                    matchedMessage = msgNode;
                    textSpan = span;
                    break;
                }
            }
        }

        if (!matchedMessage) {
            if (retryCount < MAX_RETRIES) {
                console.log('⏳ 尚未在 DOM 中找到内容匹配的消息，500ms 后重试...');
                setTimeout(() => translateAndDisplayBelowSentMessage(originalText, retryCount + 1), 500);
            } else {
                console.log('⚠️ 最终未找到匹配的可翻译消息');
            }
            return;
        }
        
        // 3. 立即创建并显示翻译图标 (Before Translation)
        // 检查是否已经存在图标
        let iconContainer = textSpan.querySelector('.translate-icon-btn');
        let translationNode = textSpan.querySelector('.translation-result'); // 预先查找引用

        if (!iconContainer) {
            iconContainer = document.createElement('span');
            iconContainer.className = 'translate-icon-btn';
            iconContainer.style.cssText = `
                display: inline-flex;
                align-items: center;
                margin-left: 5px;
                vertical-align: middle;
                cursor: pointer;
                color: #25D366;
                position: relative;
                z-index: 10;
            `;
            iconContainer.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 8l6 6"></path>
                <path d="M4 14l6-6 2-3"></path>
                <path d="M2 5h12"></path>
                <path d="M7 2h1"></path>
                <path d="M22 22l-5-10-5 10"></path>
                <path d="M14 18h6"></path>
            </svg>`;
            
            // 先追加图标到原文后面
            textSpan.appendChild(iconContainer);
        }

        // 定义点击事件
        iconContainer.onclick = async (e) => {
            e.stopPropagation();
            
            // 添加旋转动画
            iconContainer.style.transition = 'transform 0.5s ease';
            iconContainer.style.transform = 'rotate(360deg)';
            
            // 获取当前语言配置
            const currentFrom = globalConfig?.sendAutoNotSourceLang || 'en';
            const currentTo = globalConfig?.sendAutoNotTargetLang || 'zh';
            
            try {
                console.log('🔄 用户点击图标，开始重新翻译:', originalText.substring(0, 20));
                const res = await translateTextAPI(originalText, currentFrom, currentTo);
                
                if (res && res.success) {
                    // 如果还没有翻译结果节点，则创建一个
                    if (!translationNode) {
                        translationNode = document.createElement('span');
                        translationNode.className = 'translation-result';
                        translationNode.style.cssText = `
                            display: block;
                            font-size: 13px;
                            color: #25D366;
                            border-top: 1px dashed #ccc;
                            padding-top: 5px;
                            margin-top: 5px;
                            font-style: italic;
                        `;
                        textSpan.appendChild(translationNode);
                    }
                    translationNode.textContent = res.data;
                    // 更新缓存 (使用归一化文本)
                    await saveTranslationCache(normalizeText(originalText), res.data, currentFrom, currentTo);
                    console.log('✅ 重新翻译成功并更新显示');
                }
            } catch (error) {
                console.error('❌ 重新翻译失败:', error);
            }
            
            // 重置动画
            setTimeout(() => {
                iconContainer.style.transition = 'none';
                iconContainer.style.transform = 'rotate(0deg)';
            }, 500);
        };
        
        // 3.5 创建并显示加载状态指示器
        loadingNode = document.createElement('span');
        loadingNode.className = 'translation-loading';
        loadingNode.style.cssText = `
            display: flex;
            font-size: 12px;
            color: #8696a0;
            border-top: 1px dashed #ccc;
            padding-top: 5px;
            margin-top: 5px;
            align-items: center;
            gap: 6px;
        `;
        loadingNode.innerHTML = `
            <span>翻译中</span>
            <div style="display: flex; gap: 3px;">
                <div style="width: 4px; height: 4px; border-radius: 50%; background: #8696a0; animation: bounce 1.4s infinite;"></div>
                <div style="width: 4px; height: 4px; border-radius: 50%; background: #8696a0; animation: bounce 1.4s infinite 0.2s;"></div>
                <div style="width: 4px; height: 4px; border-radius: 50%; background: #8696a0; animation: bounce 1.4s infinite 0.4s;"></div>
            </div>
        `;
        
        // 添加动画样式
        if (!document.getElementById('translation-loading-animation')) {
            const style = document.createElement('style');
            style.id = 'translation-loading-animation';
            style.textContent = `
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        textSpan.appendChild(loadingNode);
        
        // 4. 获取语言配置
        const fromLang = globalConfig?.sendAutoNotSourceLang || 'en';
        const toLang = globalConfig?.sendAutoNotTargetLang || 'zh';
        
        // 5. 调用翻译API (先查缓存 - 使用归一化文本查缓存)
        const normOriginalForCache = normalizeText(originalText);
        let translatedText = await getTranslationCache(normOriginalForCache, fromLang, toLang);
        if (!translatedText) {
            // 翻译时使用原文(含换行)，以获得更好翻译质量
            const result = await translateTextAPI(originalText, fromLang, toLang);
            if (result && result.success) {
                translatedText = result.data;
                // 保存缓存时使用归一化文本作为 key
                await saveTranslationCache(normOriginalForCache, translatedText, fromLang, toLang);
            }
        }

        // 移除指示器
        if (loadingNode && loadingNode.parentNode) loadingNode.remove();

        if (translatedText && normalizeText(translatedText) !== normalizeText(originalText)) {
            // 如果翻译结果节点不存在，则创建
            if (!translationNode) {
                translationNode = document.createElement('span');
                translationNode.className = 'translation-result';
                translationNode.style.cssText = `
                    display: block;
                    font-size: 13px;
                    color: #25D366;
                    border-top: 1px dashed #ccc;
                    padding-top: 5px;
                    margin-top: 5px;
                    font-style: italic;
                `;
                textSpan.appendChild(translationNode);
            }
            translationNode.textContent = translatedText;
            console.log('✅ 译文已追加');
        }
        
    } catch (error) {
        console.error('❌ 异步翻译过程出错:', error);
        if (loadingNode && loadingNode.parentNode) loadingNode.remove();
    }
}

// 翻译API函数 - 直接调用主进程的翻译服务
async function translateTextAPI(text, fromLang, toLang) {

    // alert("-------------翻译内容："+text);

    console.log(`调用翻译API: "${text.substring(0, 50)}..." ${fromLang} -> ${toLang}`);

    // 保护逻辑：如果是一个纯钱包地址，直接返回原文
    const trimmedText = text.trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(trimmedText) || /^T[a-zA-Z0-9]{33}$/.test(trimmedText)) {
        console.log('🛡️ 检测到纯钱包地址，跳过翻译API调用，直接返回原文');
        return { success: true, data: trimmedText };
    }

    try {
        const result = await window.electronAPI.translateText({
            text: text,
            local: fromLang,
            target: toLang
        });

        // 二次校验：如果原文包含钱包地址，而译文中的地址发生了变化，则恢复译文中的地址
        if (result && result.success && typeof result.data === 'string') {
            let processedResult = result.data;
            let originalAddresses = text.match(walletAddressRegex) || [];
            let translatedAddresses = result.data.match(walletAddressRegex) || [];
            
            // 如果地址数量一致但内容不一致，尝试按顺序替换回原地址
            if (originalAddresses.length > 0 && originalAddresses.length === translatedAddresses.length) {
                for (let i = 0; i < originalAddresses.length; i++) {
                    if (originalAddresses[i].toLowerCase() !== translatedAddresses[i].toLowerCase()) {
                        console.log(`🛡️ 监测到地址被篡改: ${translatedAddresses[i]} -> ${originalAddresses[i]}, 已自动修正`);
                        processedResult = processedResult.replace(translatedAddresses[i], originalAddresses[i]);
                    }
                }
                result.data = processedResult;
            }
        }

        return result;
    } catch (error) {
        console.error('翻译API调用失败:', error);
        throw error;
    }
}

// 显示敏感词警告提示
function showSensitiveWarning(message) {
    // 移除旧的警告（如果存在）
    const oldWarning = document.getElementById('sensitive-warning-node');
    if (oldWarning) {
        oldWarning.remove();
    }
    
    // 创建警告节点
    const warningNode = document.createElement('div');
    warningNode.id = 'sensitive-warning-node';
    warningNode.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 10px;
        right: 10px;
        background: rgba(255, 59, 48, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
        padding: 12px 16px;
        font-size: 14px;
        border: 1px solid rgba(255, 59, 48, 0.5);
        border-bottom: none;
        border-radius: 12px 12px 0 0;
        z-index: 999;
        box-shadow: 0 -4px 12px rgba(255, 59, 48, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideUpWarning 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    `;
    
    // 添加动画样式
    if (!document.getElementById('sensitive-warning-style')) {
        const style = document.createElement('style');
        style.id = 'sensitive-warning-style';
        style.textContent = `
            @keyframes slideUpWarning {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    warningNode.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 2px;">无法发送消息</div>
            <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
    `;
    
    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.position = 'relative';
        footer.appendChild(warningNode);
        
        // 3秒后自动移除警告
        setTimeout(() => {
            warningNode.style.animation = 'slideUpWarning 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse forwards';
            setTimeout(() => warningNode.remove(), 300);
        }, 3000);
    }
}


// 移除加载节点
function removeLoadingNode() {
    let loadingNode = document.getElementById('editDivLoadingNode');
    if (loadingNode) {
        loadingNode.remove();
    }
}

// 生成加载节点
function generateLoadingNode() {
    let loadingNode = document.createElement('div');
    loadingNode.style.display = 'flex';
    loadingNode.style.gap = '4px';
    loadingNode.style.padding = '5px';
    loadingNode.style.alignItems = 'center';
    loadingNode.innerHTML = `
        <span style="color: #666; font-size: 12px; white-space: nowrap">翻译中</span>
        <div style="display: flex; gap: 2px;">
            <div style="width: 4px; height: 4px; border-radius: 50%; background: #666; animation: bounce 1.4s infinite;"></div>
            <div style="width: 4px; height: 4px; border-radius: 50%; background: #666; animation: bounce 1.4s infinite 0.2s;"></div>
            <div style="width: 4px; height: 4px; border-radius: 50%; background: #666; animation: bounce 1.4s infinite 0.4s;"></div>
        </div>
    `;

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);

    return loadingNode;
}

// 节点操作函数
function operationNode(action, node, parentNode = undefined) {
    if (!node) return;

    if (action === 'add' && parentNode) {
        parentNode.appendChild(node);
    } else if (action === 'remove') {
        node.remove();
    }
}

// 使元素可拖拽
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const dragHandle = handle || element;

    dragHandle.onmousedown = dragMouseDown;
    dragHandle.style.cursor = 'move';

    function dragMouseDown(e) {
        e = e || window.event;
        // 如果点击的是关闭按钮，不触发拖拽
        if (e.target.innerHTML === '&times;') return;
        
        e.preventDefault();
        // 获取鼠标初始位置
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // 鼠标移动时调用
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // 计算新位置
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // 设置元素的新位置
        const newTop = (element.offsetTop - pos2);
        const newLeft = (element.offsetLeft - pos1);
        
        element.style.top = newTop + "px";
        element.style.left = newLeft + "px";
        
        // 清除可能干扰的样式
        element.style.transform = 'none';
        element.style.bottom = 'auto';
        element.style.margin = '0';
    }

    function closeDragElement() {
        // 停止移动时清除监听
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// 获取本地语言 (用户母语，接收消息的目标语言)
function getLocalLanguage() {
    console.log('接收目前', globalConfig?.receiveTargetLang);
     
    return globalConfig?.receiveTargetLang || localStorage.getItem('localLanguage') || 'zh';
}

// 获取目标语言 (对方语言，发送消息的目标语言)
function getTargetLanguage() {
    return globalConfig?.sendTargetLang || localStorage.getItem('targetLanguage') || 'en';
}

// 监控主节点
function monitorMainNode() {
    const observer = new MutationObserver((mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                const mainNode = document.getElementById('pane-side');
                if (mainNode) {
                    observer.disconnect();
                    observePaneSide(mainNode);
                    getLanguageList();
                    syncGlobalConfig(); // 初始同步
                    setInterval(syncGlobalConfig, 10000); // 每10秒同步一次
                    setInterval(() => {
                        processMessageList();
                        processImageMessageList(); 
                        processVoiceMessageList(); // 添加语音消息处理
                    }, 800);
                    startMediaPreviewMonitor();
                    startVoiceMessageMonitor(); // 启动语音消息监控
                    break;
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function observePaneSide(paneSideNode) {
        const observer = new MutationObserver((mutationsList) => {
            mutationsList.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
                    const targetNode = mutation.target;
                    if (targetNode.getAttribute('aria-selected') === 'true') {
                        removeLoadingNode();
                        updatePreviewUI(null);
                        lastPreviewedTranslation = '';
                        startMonitor();
                        addTranslateButtonWithSelect();
                    }
                }
            });
        });

        observer.observe(paneSideNode, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
    }

    // 用于跟踪正在处理中的消息，防止重复调用
    const processingMessages = new Set();

    // 处理消息列表翻译 - 只翻译对方发送的接收消息（英文 -> 中文）
    async function processMessageList() {
        // 恢复发送消息的原文显示（从本地存储）
        await restoreSentMessageOriginals();
        
        // 恢复发送消息的译文显示（从翻译缓存）
        await restoreSentMessageTranslations();
        
        // 检查全局接收自动翻译开关
        if (!globalConfig?.receiveAutoTranslate) {
            return;
        }

        // 直接查找接收消息中的文本 span
        // WhatsApp 结构: .message-in 包含消息内容，其中 span[dir] 包含实际文本
        let incomingMessages = document.querySelectorAll('.message-in span[dir="ltr"]:not([data-translate-status]), .message-in span[dir="rtl"]:not([data-translate-status])');
        
        // 只在有新消息时打印日志
        if (incomingMessages.length > 0) {
            console.log('📨 扫描接收消息，找到数量:', incomingMessages.length);
        }
        
        for (let span of incomingMessages) {
            // 跳过已经有翻译子节点的
            if (span.querySelector('.translation-result')) {
                span.setAttribute('data-translate-status', 'already-has-translation');
                continue;
            }
            
            // 跳过空消息或太短的消息
            let msg = span.textContent.trim();
            if (!msg || msg.length < 2) {
                span.setAttribute('data-translate-status', 'skipped-short');
                continue;
            }
            
            // 跳过父元素已有翻译状态的（避免嵌套span重复翻译）
            if (span.closest('[data-translate-status]')) {
                continue;
            }
            
            // 使用消息内容作为唯一标识，防止重复处理
            const msgKey = msg.substring(0, 100); // 取前100字符作为key
            if (processingMessages.has(msgKey)) {
                console.log('⏳ 消息正在处理中，跳过:', msgKey.substring(0, 30));
                continue;
            }
            
            console.log('📩 找到接收消息:', msg.substring(0, 50));
            await processMessageTranslation(span, msgKey);
        }
    }

    // 翻译接收的消息（英文 -> 中文）
    async function processMessageTranslation(span, msgKey) {
        let msg = span.textContent.trim();
        if (!msg) return;
        
        // 跳过太短的消息
        if (msg.length < 2) {
            span.setAttribute('data-translate-status', 'skipped-short');
            return;
        }

        // 立即标记为正在处理，防止重复调用
        span.setAttribute('data-translate-status', 'processing');
        processingMessages.add(msgKey);

        try {
            // 从目标语言（英文）翻译到本地语言（中文）
            const fromLang = getTargetLanguage(); // 英文
            const toLang = getLocalLanguage(); // 中文
            console.log('🌐 调用翻译API:', fromLang, '->', toLang);
            
            const result = await translateTextAPI(msg, fromLang, toLang);
            console.log('✅ 翻译结果:', result);

            if (result && result.success && result.data && result.data.trim() !== msg.trim()) {
                span.setAttribute('data-translate-status', 'translated');

                // 创建翻译结果显示节点
                let translationNode = document.createElement('span'); // Changed from div to span
                translationNode.className = 'translation-result';
                translationNode.style.cssText = `
                    display: block; /* Added display: block */
                    font-size: 13px;
                    color: #25D366;
                    border-top: 1px dashed #ccc;
                    padding-top: 5px;
                    margin-top: 5px;
                    font-style: italic;
                `;
                translationNode.textContent = '' + result.data;

                span.appendChild(document.createElement('br')); // Added <br>
                span.appendChild(translationNode);
                console.log('✅ 翻译结果已显示');
            } else if (result && result.success && result.data && result.data.trim() === msg.trim()) {
                span.setAttribute('data-translate-status', 'same');
                console.log('ℹ️ 译文与原文一致，跳过显示');
            } else if (result && !result.success) {
                span.setAttribute('data-translate-status', 'failed');
                console.warn('❌ 消息翻译失败 (业务):', result.msg);
            } else {
                span.setAttribute('data-translate-status', 'same');
            }
        } catch (error) {
            span.setAttribute('data-translate-status', 'failed');
            console.error('❌ 消息翻译失败:', error);
        } finally {
            // 处理完成后从Set中移除
            processingMessages.delete(msgKey);
        }
    }
}

// 添加翻译按钮及语言选择下拉框
function addTranslateButtonWithSelect() {
    let targetNode = document.querySelector('footer')?.firstChild?.firstChild?.firstChild?.firstChild?.firstChild;
    if (!targetNode) {
        console.error('未找到目标节点');
        return;
    }

    // 避免重复添加
    if (document.getElementById('fromImageLang')) return;

    // 创建容器
    const container = document.createElement('div');
    container.id = 'imageLangSelectionContainer';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0 5px;
       display:none;
    `;

    // 来源语言
    const { wrapper: fromWrapper, select: fromSelect } = createStyledSelectFooter('fromImageLangSelect', '来源:', fromImageLang);
    fromSelect.id = 'fromImageLang';
    fromSelect.onchange = (e) => { 
        fromImageLang = e.target.value;
        syncAllImageLangSelects('from', e.target.value);
    };

    // 箭头
    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.style.cssText = 'font-size: 12px; color: #8696a0; margin: 0 2px;';

    // 目标语言
    const { wrapper: targetWrapper, select: targetSelect } = createStyledSelectFooter('targetImageLangSelect', '目标:', targetImageLang);
    targetSelect.id = 'targetImageLang';
    targetSelect.onchange = (e) => { 
        targetImageLang = e.target.value;
        syncAllImageLangSelects('target', e.target.value);
    };

    container.appendChild(fromWrapper);
    container.appendChild(arrow);
    container.appendChild(targetWrapper);

    // 辅助函数：创建样式一致的下拉框
    function createStyledSelectFooter(className, labelText, defaultVal) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; align-items: center; gap: 3px;';
        
        const label = document.createElement('span');
        label.textContent = labelText;
        label.style.cssText = 'font-size: 11px; color: #667781;';
        
        const select = document.createElement('select');
        select.className = className;
        select.style.cssText = `
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 6px;
            padding: 2px 4px;
            font-size: 11px;
            outline: none;
            background: #f0f2f5;
            cursor: pointer;
            color: #111b21;
        `;
        select.value = defaultVal;
        
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        return { wrapper, select };
    }

    // 插入到翻译按钮前面 (当前 targetNode 是 flex 容器)
    targetNode.appendChild(container);

    // 填充数据
    populateLanguageSelects();

    // 创建按钮
    const button = document.createElement('button');
    button.id = 'footerTranslateButton';
    button.innerHTML = `🌐`;
    button.title = '图片翻译设置';
    button.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 5px;
        margin: 0 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        display:none;
    `;

    button.addEventListener('click', function() {
        window.electronAPI.showNotification({
            message: `当前图片翻译设置: ${fromSelect.options[fromSelect.selectedIndex].text} → ${targetSelect.options[targetSelect.selectedIndex].text}`,
            type: 'is-info'
        });
    });

    targetNode.appendChild(button);
}

// --- 图片翻译功能 ---

function processImageMessageList() {
    const imageMessages = document.querySelectorAll('.message-in img, .message-out img');
    imageMessages.forEach(img => {
        // 排除头像、表情和已处理的小图
        if (img.naturalWidth < 30 || img.closest('[data-testid="attached-gif"]') || img.closest('.selectable-text') || img.classList.contains('_amlt')) return;
        
        const imgParent = img.closest('div[role="button"]') || img.parentNode;
        if (!imgParent || imgParent.querySelector('.image-chat-translate-btn')) return;

        // 设置父容器相对定位，以便按钮悬浮在图片上
        if (getComputedStyle(imgParent).position === 'static') {
            imgParent.style.position = 'relative';
        }

        const btn = document.createElement('div');
        btn.className = 'image-chat-translate-btn';
        btn.innerHTML = `
            <span style="cursor: pointer; background: rgba(37, 211, 102, 0.85); color: white; padding: 4px 10px; border-radius: 15px; font-size: 12px; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease; user-select: none; backdrop-filter: blur(2px);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>
                图片翻译
            </span>
        `;
        btn.style.cssText = `
            position: absolute;
            bottom: 8px;
            right: 8px;
            z-index: 100;
            display:none;
        `;
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            translateImageInWhatsApp(img);
        };

        const span = btn.querySelector('span');
        span.onmouseover = () => { span.style.background = '#1da851'; span.style.transform = 'scale(1.05)'; };
        span.onmouseout = () => { span.style.background = 'rgba(37, 211, 102, 0.85)'; span.style.transform = 'scale(1)'; };

        imgParent.appendChild(btn);
    });
}

function startMediaPreviewMonitor() {
    const observer = new MutationObserver(() => {
        const dialog = document.querySelector('div[data-animate-media-viewer="true"]');
        // console.log('dialog', dialog);
        
        if (dialog) {
            const previewImg = dialog.querySelector('img[src^="blob:"]');
            if (previewImg && previewImg.naturalWidth > 100 && !document.querySelector('#image-translate-btn')) {
                addTranslateButtonToPreview(previewImg, dialog );
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function addTranslateButtonToPreview(imgElement, dialog) {
    if (document.querySelector('#image-translate-container')) return;

    // 智能默认值判断
    // 优先通过对话框或消息容器判断是发送还是接收
    const isIncoming = !!(imgElement.closest('.message-in') || 
                         document.querySelector('.message-in img[src="' + imgElement.src + '"]') ||
                         // 兜底：如果无法确定，根据全局配置或默认逻辑
                         (typeof lastPreviewedSource === 'undefined' ? false : true));
    console.log('isIncoming', isIncoming);
    
    // 设置初始全局变量
    if (isIncoming) {
        fromImageLang = 'en';
        targetImageLang = 'zh';
    } else {
        // 修改：即使是发送消息或预览图，也默认 en -> zh
        fromImageLang = 'en';
        targetImageLang = 'zh';
    }

    const container = document.createElement('div');
    container.id = 'image-translate-container';
    container.style.cssText = `
        position: fixed; 
        bottom: 35px; 
        right: 40px; 
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 16px;
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        padding: 10px 24px;
        border-radius: 50px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        border: 1px solid rgba(255, 255, 255, 0.4);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // 下拉框容器
    const langBox = document.createElement('div');
    langBox.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
    `;

    const createStyledSelect = (className, labelText, defaultVal) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            position: relative;
        `;
        
        const label = document.createElement('span');
        label.textContent = labelText;
        label.style.cssText = `
            font-size: 12px;
            color: #667781;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            width: 60px;
        `;
        
        // 隐藏的原生 select 用于数据存储和 populateLanguageSelects 兼容
        const select = document.createElement('select');
        select.className = className;
        // 提取 ID：去掉 Select 后缀，例如 fromImageLangSelect -> fromImageLang
        select.id = className.replace('Select', '');
        select.style.display = 'none';
        select.value = defaultVal;

        // 自定义触发按钮
        const trigger = document.createElement('div');
        trigger.style.cssText = `
            border: none;
            border-radius: 12px;
            padding: 6px 32px 6px 12px;
            font-size: 13px;
            background: #f0f2f5 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23667781' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center;
            cursor: pointer;
            color: #111b21;
            font-weight: 600;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            min-width: 100px;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);
            user-select: none;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        trigger.textContent = '加载中...';

        // 自定义弹窗列表
        const listContainer = document.createElement('div');
        listContainer.style.cssText = `
            position: absolute;
            bottom: 130%;
            left: 66px;
            width: 180px;
            max-height: 420px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(25px) saturate(190%);
            -webkit-backdrop-filter: blur(25px) saturate(190%);
            border-radius: 18px;
            box-shadow: 0 15px 50px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05);
            border: 1px solid rgba(255, 255, 255, 0.6);
            display: none;
            flex-direction: column;
            z-index: 10001;
            opacity: 0;
            transform: translateY(12px) scale(0.96);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        `;

        // 搜索框
        const searchBox = document.createElement('div');
        searchBox.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid rgba(0,0,0,0.04);
            background: rgba(255,255,255,0.4);
            position: sticky;
            top: 0;
            z-index: 2;
        `;
        const searchInput = document.createElement('input');
        searchInput.placeholder = '搜索语言...';
        searchInput.style.cssText = `
            width: 100%;
            border: 1px solid rgba(0,0,0,0.05);
            background: #fdfdfd;
            border-radius: 10px;
            padding: 7px 10px;
            font-size: 13px;
            outline: none;
            color: #111b21;
            box-shadow: 0 2px 5px rgba(0,0,0,0.02);
        `;
        searchBox.appendChild(searchInput);

        const itemsWrapper = document.createElement('div');
        itemsWrapper.style.cssText = `
            padding: 6px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;

        const updateList = (filter = '') => {
            itemsWrapper.innerHTML = '';
            const filteredOptions = Array.from(select.options).filter(opt => 
                !filter || opt.textContent.toLowerCase().includes(filter.toLowerCase())
            );

            if (filteredOptions.length === 0) {
                const noResult = document.createElement('div');
                noResult.style.cssText = 'padding: 20px; text-align: center; color: #8696a0; font-size: 13px;';
                noResult.textContent = '无结果';
                itemsWrapper.appendChild(noResult);
                return;
            }

            filteredOptions.forEach(opt => {
                const isSelected = opt.value === select.value;
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 10px 14px;
                    font-size: 14px;
                    border-radius: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.2s ease;
                    color: ${isSelected ? '#25D366' : '#111b21'};
                    background: ${isSelected ? 'rgba(37, 211, 102, 0.1)' : 'transparent'};
                    font-weight: ${isSelected ? '700' : '500'};
                `;
                item.textContent = opt.textContent;

                if (isSelected) {
                    item.innerHTML += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                }

                item.onmouseover = () => {
                    item.style.background = isSelected ? 'rgba(37, 211, 102, 0.15)' : 'rgba(0,0,0,0.04)';
                    if (!isSelected) item.style.transform = 'translateX(4px)';
                };
                item.onmouseout = () => {
                    item.style.background = isSelected ? 'rgba(37, 211, 102, 0.1)' : 'transparent';
                    item.style.transform = 'translateX(0)';
                };

                item.onclick = (e) => {
                    e.stopPropagation();
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change'));
                    updateUI();
                    closeList();
                };
                itemsWrapper.appendChild(item);
            });
        };

        const updateUI = () => {
            const selectedOpt = select.options[select.selectedIndex];
            trigger.textContent = selectedOpt ? selectedOpt.textContent : '选择语言';
            if (listContainer.style.display === 'flex') updateList(searchInput.value);
        };

        searchInput.oninput = (e) => updateList(e.target.value);

        const openList = () => {
            // 关闭所有正在打开的自定义弹窗
            document.querySelectorAll('.custom-popover-open').forEach(p => p._close());

            listContainer.style.display = 'flex';
            listContainer.classList.add('custom-popover-open');
            listContainer._close = closeList;
            
            updateList();

            requestAnimationFrame(() => {
                listContainer.style.opacity = '1';
                listContainer.style.transform = 'translateY(0) scale(1)';
            });

            setTimeout(() => searchInput.focus(), 100);
            
            // 自动滚动到当前选中的项
            const selected = itemsWrapper.querySelector('[style*="rgba(37, 211, 102, 0.1)"]');
            if (selected) selected.scrollIntoView({ block: 'center' });
        };

        const closeList = () => {
            listContainer.style.opacity = '0';
            listContainer.style.transform = 'translateY(12px) scale(0.96)';
            listContainer.classList.remove('custom-popover-open');
            setTimeout(() => {
                if (!listContainer.classList.contains('custom-popover-open')) {
                    listContainer.style.display = 'none';
                    searchInput.value = '';
                }
            }, 250);
        };

        trigger.onclick = (e) => {
            e.stopPropagation();
            if (listContainer.style.display === 'flex') closeList(); else openList();
        };

        document.addEventListener('click', (e) => {
            if (!listContainer.contains(e.target) && e.target !== trigger) closeList();
        });

        // 挂载更新钩子给 populateLanguageSelects 使用
        select._updateCustomUI = updateUI;

        listContainer.appendChild(searchBox);
        listContainer.appendChild(itemsWrapper);
        wrapper.appendChild(label);
        wrapper.appendChild(trigger);
        wrapper.appendChild(listContainer);
        wrapper.appendChild(select);
        return { wrapper, select };
    };

    // 来源语言
    const { wrapper: fromWrapper, select: fromSelect } = createStyledSelect('fromImageLangSelect', '来源', fromImageLang);
    fromSelect.onchange = (e) => { 
        fromImageLang = e.target.value;
        syncAllImageLangSelects('from', e.target.value);
    };

    // 箭头
    const arrow = document.createElement('div');
    arrow.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
    `;
    arrow.style.cssText = 'display: flex; align-items: center; opacity: 0.8;';

    // 目标语言
    const { wrapper: targetWrapper, select: targetSelect } = createStyledSelect('targetImageLangSelect', '目标', targetImageLang);
    targetSelect.onchange = (e) => { 
        targetImageLang = e.target.value;
       console.log('选中目标语音', e.target.value);
       
        
        syncAllImageLangSelects('target', e.target.value);
    };

    langBox.appendChild(fromWrapper);
    langBox.appendChild(arrow);
    langBox.appendChild(targetWrapper);

    // 翻译按钮
    const btn = document.createElement('div');
    btn.innerHTML = `
        <div style="cursor: pointer; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 10px 24px; border-radius: 30px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); user-select: none; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.35); border: 1px solid rgba(255,255,255,0.15);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>
            图片翻译
        </div>
    `;
    
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        translateImageInWhatsApp(imgElement);
    };

    const inner = btn.querySelector('div');
    inner.onmouseover = () => { 
        inner.style.transform = 'translateY(-2px) scale(1.02)'; 
        inner.style.boxShadow = '0 6px 20px rgba(37, 211, 102, 0.45)';
    };
    inner.onmouseout = () => { 
        inner.style.transform = 'translateY(0) scale(1)'; 
        inner.style.boxShadow = '0 4px 15px rgba(37, 211, 102, 0.35)';
    };

    container.appendChild(langBox);
    
    // 分割线
    const divider = document.createElement('div');
    divider.style.cssText = 'width: 1px; height: 28px; background: rgba(0,0,0,0.08); margin: 0 4px;';
    container.appendChild(divider);
    
    container.appendChild(btn);
    
    document.body.appendChild(container);

    // 填充数据并设置选中值
    populateLanguageSelects();
    // 补充设置值以确保智能默认生效
    setTimeout(() => {
        const f = container.querySelector('.fromImageLangSelect');
        const t = container.querySelector('.targetImageLangSelect');
        if (f) f.value = fromImageLang;
        if (t) t.value = targetImageLang;
    }, 50);

    const closeMonitor = setInterval(() => {
        if (!imgElement.isConnected || !document.querySelector('img[src^="blob:"]')) {
            container.remove();
            clearInterval(closeMonitor);
        }
    }, 1000);
}

function ensureHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve();
    return new Promise(async (resolve, reject) => {
        try {
            const scriptContent = await window.electronAPI.getScriptContent('html2canvas.min.js');
            if (scriptContent) {
                // 使用 Blob URL 注入脚本，以绕过 WhatsApp 的 CSP (Content Security Policy) 限制
                // 许多现代网站禁止直接向 <script> 注入 textContent (unsafe-inline)，但允许 blob: 源
                const blob = new Blob([scriptContent], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => {
                    URL.revokeObjectURL(url);
                    console.log('✅ html2canvas 加载成功 (via Blob URL)');
                    resolve();
                };
                script.onerror = (err) => {
                    URL.revokeObjectURL(url);
                    console.error('❌ html2canvas 加载失败:', err);
                    reject(err);
                };
                document.head.appendChild(script);
            } else { 
                reject(new Error('script content empty')); 
            }
        } catch (e) { 
            reject(e); 
        }
    });
}

async function translateImageInWhatsApp(imgElement) {
    try {
        window.electronAPI.showNotification({ message: '🖼️ 正在准备截取图片...', type: 'is-info' });

        if (!imgElement.complete || imgElement.naturalWidth === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        try { await ensureHtml2Canvas(); } catch (e) { console.warn('html2canvas fail:', e.message); }

        let imageData;
        if (window.html2canvas) {
            // 确定截图目标元素 (对话框或图片容器)
            const captureTarget = imgElement.closest('div[data-animate-media-viewer="true"]') || 
                                 imgElement.closest('div[role="button"]') || 
                                 imgElement.parentNode;
            
            console.log('📸 使用 html2canvas 截取:', captureTarget);
            
            try {
                const canvas = await html2canvas(captureTarget, {
                    useCORS: true, 
                    allowTaint: true, 
                    backgroundColor: '#000', 
                    scale: 2,
                    onclone: (clonedDoc) => {
                        const btns = clonedDoc.querySelectorAll('#image-translate-btn, .image-chat-translate-btn');
                        btns.forEach(b => b.style.display = 'none');
                    }
                });
                imageData = canvas.toDataURL('image/png', 0.9);
                if (imageData.length < 5000) throw new Error('Captured image seems to be empty');
            } catch (h2cError) {
                console.error('❌ html2canvas 截图失败:', h2cError);
                throw h2cError;
            }
        } else {
            console.warn('⚠️ html2canvas 不可用，回退至基础 Canvas');
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            canvas.getContext('2d').drawImage(imgElement, 0, 0);
            imageData = canvas.toDataURL('image/png');
        }
        
        window.electronAPI.showNotification({ message: '正在发起图片翻译请求...', type: 'is-info' });
 
        // 尝试从 DOM 中实时获取下拉框的值（以最新的 UI 为准）
        const fromSelect = document.getElementById('fromImageLang');
        const targetSelect = document.getElementById('targetImageLang');
        
        if (fromSelect) fromImageLang = fromSelect.value;
        if (targetSelect) targetImageLang = targetSelect.value;

        console.log('选中状态确认:', fromImageLang, targetImageLang);
          
        // 获取最终使用的语言
        const finalFromLang = fromImageLang;
        const finalTargetLang = targetImageLang;
        console.log('图片翻译参数', finalFromLang, finalTargetLang);
         
        const result = await window.electronAPI.translateImage({
            imageData: imageData,
            from: finalFromLang,
            target: finalTargetLang
        });
         console.log('图片翻译结果返回', result);
        if (result && result.success) {
            window.electronAPI.showNotification({ message: '✅ 图片翻译完成！', type: 'is-success' });
            const container = imgElement.closest('.message-in') || imgElement.closest('.message-out') || imgElement.closest('div[role="dialog"]') || imgElement.closest('div[data-animate-media-viewer="true"]');
            console.log('imgElement', imgElement);
            
            console.log('容器节点', container);
            
            if (container) {
                const old = container.querySelector('.image-translation-result');
                if (old) old.remove();

                const isDialog = container.getAttribute('role') === 'dialog' || container.getAttribute('data-animate-media-viewer') === 'true';
                const resNode = document.createElement('div');
                resNode.className = 'image-translation-result';
                      resNode.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2ed36a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 8l6 6"></path>
                    <path d="M4 14l6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="M22 22l-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                </svg>
                <span style="font-size: 11px; font-weight: 600; color: #2ed36a; text-transform: uppercase; letter-spacing: 0.5px;">译文预览</span>
            </div>
        `;
                if (isDialog) {
                    resNode.style.cssText = `
                        position: absolute;
                        bottom: 100px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 10001;
                        background: rgba(255, 255, 255, 0.95);
                        color: #333;
                        padding: 15px 25px;
                        border-radius: 12px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                        max-width: 80%;
                        max-height: 60%;
                        overflow-y: auto;
                        border-top: 4px solid #25D366;
                        backdrop-filter: blur(5px);
                    `;
                    // 使弹出框可拖拽
                    makeDraggable(resNode, resNode.firstElementChild);
                } else {
                    resNode.style.cssText = `
                        font-size: 14px; 
                        color: #25D366; 
                        background: rgba(0, 0, 0, 0.05); 
                        border-left: 3px solid #25D366; 
                        padding: 8px 12px; 
                        margin-top: 10px; 
                        border-radius: 4px; 
                        font-style: italic; 
                        word-break: break-all;
                    `;
                }
                
                const data = result.data;
                if (data && typeof data === 'object') {
                    // 图片处理
                    if (data.img || data.image || data.translated_image || data.url) {
                        const resImg = document.createElement('img');
                        resImg.src = data.img || data.image || data.translated_image || data.url;
                        resImg.style.cssText = 'max-width: 100%; border-radius: 4px; display: block; margin-bottom: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
                        resNode.appendChild(resImg);
                    }
                    
                    // 文本处理 - 增加更多可能的字段名
                    const textContent = data.sumDst || data.dst || data.translation || data.translated_text || data.translatedText || data.text || (typeof data === 'string' ? data : null);
                    
                    if (textContent) {
                        const textDiv = document.createElement('div');
                        textDiv.className = 'translation-text';

                        if (isDialog) {
                            textDiv.style.cssText = 'font-size: 16px; line-height: 1.6; color: #111;';
                            textDiv.innerHTML = String(textContent).replace(/\n/g, '<br>');
                        } else {
                            textDiv.style.cssText = 'font-weight: 500; color: #128C7E; line-height: 1.4;';
                            textDiv.textContent = textContent;
                        }
                        resNode.appendChild(textDiv);
                    } else if (resNode.childNodes.length === 0) {
                        // 回退：显示原始 JSON 的一部分或转换为字符串
                        resNode.textContent = typeof data === 'string' ? data : JSON.stringify(data).substring(0, 500);
                    }
                } else {
                    resNode.textContent = String(data);
                }

                if (isDialog) {
                    const closeBtn = document.createElement('div');
                    closeBtn.innerHTML = '&times;';
                    closeBtn.style.cssText = 'position: absolute; top: 10px; right: 15px; cursor: pointer; font-size: 24px; color: #999; font-weight: bold;';
                    closeBtn.onclick = () => resNode.remove();
                    resNode.appendChild(closeBtn);
                    container.appendChild(resNode);
                } else {
                    // 在聊天列表中，寻找最佳挂载位置
                    // 尝试挂载在图片所在的 div[role="button"] 后面
                    const imgContainer = imgElement.closest('div[role="button"]') || imgElement.parentNode;
                    if (imgContainer && imgContainer.parentNode === container) {
                         imgContainer.parentNode.insertBefore(resNode, imgContainer.nextSibling);
                    } else if (imgContainer && imgContainer.parentNode && imgContainer.parentNode.parentNode === container) {
                         imgContainer.parentNode.parentNode.insertBefore(resNode, imgContainer.parentNode.nextSibling);
                    } else {
                         // 兜底：直接添加到容器末尾
                         container.appendChild(resNode);
                    }
                }
            }
        } else {
            console.error('❌ 图片翻译失败:', result?.msg);
            window.electronAPI.showNotification({ message: `❌ 图片翻译失败: ${result?.msg || '服务异常'}`, type: 'is-danger' });
        }
    } catch (error) {
        console.error('❌ 图片翻译异常:', error);
        window.electronAPI.showNotification({ message: `❌ 图片翻译异常: ${error.message}`, type: 'is-danger' });
    }
}

// 设置按钮功能
(function() {
    var button = document.createElement('button');
    button.id = 'settings-button';
    button.innerHTML = '⚙️';
    button.style.cssText = `
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        border: none;
        background: #38A65A;
        color: white;
        padding: 10px;
        cursor: pointer;
        z-index: 1000;
        border-radius: 5px 0 0 5px;
        display:none
    `;

    button.addEventListener('click', function() {
        var element = document.querySelector('div#main');
        for (let key in element) {
            if (key.startsWith('__reactProps$')) {
                var reactProps = element[key];
                if(reactProps.children.key){
                    let userNum = reactProps.children.key;
                    window.electronAPI.showUserPortraitPanel({platform:'WhatsApp',phone_number:userNum});
                    console.log('用户画像:', userNum);
                }
                break;
            }
        }
    });

    document.body.appendChild(button);
})();

// 页面可见性监控
let isGlobalObserverEnabled = false;

function checkPageVisibility() {
    if (document.visibilityState === 'visible') {
        isGlobalObserverEnabled = false;
        console.log("页面处于前台");
    } else {
        isGlobalObserverEnabled = true;
        console.log("页面处于后台");
    }
}

document.addEventListener("visibilitychange", checkPageVisibility);
checkPageVisibility();

console.log('✅ WhatsApp翻译插件已加载完成');

// ==================== IndexedDB 存储发送消息原文 ====================

// 打开或创建存储发送消息原文的数据库
function openSentMessagesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WhatsAppSentMessagesDB', 1);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            // 创建对象存储，使用翻译后文本作为主键
            if (!db.objectStoreNames.contains('sentMessages')) {
                const store = db.createObjectStore('sentMessages', { keyPath: 'translatedText' });
                store.createIndex('originalText', 'originalText', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(`数据库打开失败: ${event.target.errorCode}`);
        };
    });
}

// 保存发送消息的原文
async function saveSentMessage(translatedText, originalText) {
    try {
        console.log('💾 准备保存到 IndexedDB:', { translatedText: translatedText.substring(0, 50), originalText });
        const db = await openSentMessagesDB();
        const transaction = db.transaction(['sentMessages'], 'readwrite');
        const store = transaction.objectStore('sentMessages');
        
        const message = {
            translatedText: translatedText,
            originalText: originalText,
            timestamp: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(message);
            request.onsuccess = () => {
                console.log('✅ IndexedDB 保存成功:', { translatedText: translatedText.substring(0, 50), originalText });
                resolve();
            };
            request.onerror = (event) => {
                console.error('❌ IndexedDB 保存失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('保存发送消息失败:', error);
    }
}

// 根据翻译后文本获取原文
async function getSentMessage(translatedText) {
    try {
        const db = await openSentMessagesDB();
        const transaction = db.transaction(['sentMessages'], 'readonly');
        const store = transaction.objectStore('sentMessages');
        
        return new Promise((resolve, reject) => {
            const request = store.get(translatedText);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (error) {
        console.error('获取发送消息失败:', error);
        return null;
    }
}

// 恢复发送消息的原文显示
async function restoreSentMessageOriginals() {
    try {
        // 查找所有发送的消息
        const sentMessages = document.querySelectorAll('.message-out span[dir="ltr"]:not([data-original-restored]), .message-out span[dir="rtl"]:not([data-original-restored])');
        
        if (sentMessages.length > 0) {
            console.log('🔍 扫描发送消息，找到数量:', sentMessages.length);
        }
        
        for (let span of sentMessages) {
            // 跳过已经有原文显示的
            if (span.querySelector('.original-text-result')) {
                span.setAttribute('data-original-restored', 'true');
                continue;
            }
            
            // 获取消息文本 (WhatsApp 消息节点可能包含时间戳子节点，需要小心提取)
            // 我们尝试只获取直接的文本内容，或者递归获取并清理
            let rawText = '';
            
            // 策略：尝试查找带有 dir 属性的直接文本 span，或者遍历子节点避开时间戳
            // 通常 span[dir] 是直接容器，但如果是复合内容，子节点会有很多
            // 这里我们使用 clone 节点并移除疑似时间戳的部分（通常在最后的 span 或 div 中）
            const clone = span.cloneNode(true);
            const timeNodes = clone.querySelectorAll('span, div[class*="time"], [class*="timestamp"]');
            timeNodes.forEach(node => node.remove());
            rawText = clone.innerText || clone.textContent;

            const msgText = normalizeText(rawText);
            if (!msgText || msgText.length < 1) {
                continue;
            }
            
            console.log('🔍 检索发送消息原文 (Key:', msgText.substring(0, 30), ')');
            
            // 从本地存储获取原文
            const record = await getSentMessage(msgText);
            
            if (record && record.originalText) {
                // 校验：如果原文与当前显示的译文完全一致，则不需要显示
                if (normalizeText(record.originalText) === msgText) {
                    span.setAttribute('data-original-restored', 'true');
                    continue;
                }

                // 创建原文显示节点
                let originalNode = document.createElement('span');
                originalNode.className = 'original-text-result';
                originalNode.style.cssText = `
                    display: block;
                    font-size: 13px;
                    color: #25D366;
                    border-top: 1px dashed #ccc;
                    padding-top: 5px;
                    margin-top: 5px;
                    font-style: italic;
                `;
                originalNode.textContent = record.originalText;
                
                span.appendChild(document.createElement('br'));
                span.appendChild(originalNode);
                span.setAttribute('data-original-restored', 'true');
                console.log('🔄 已成功恢复原文显示:', record.originalText.substring(0, 30));
            } else {
                // 移除模糊匹配逻辑，仅支持精确匹配。模糊匹配曾导致钱包地址碰撞（20位前缀相同导致误判）。
                // 标记为已检查，避免重复查询
                span.setAttribute('data-original-restored', 'checked');
            }
        }
    } catch (error) {
        console.error('恢复发送消息原文失败:', error);
    }
}

// 获取所有发送消息记录
async function getAllSentMessages() {
    try {
        const db = await openSentMessagesDB();
        const transaction = db.transaction(['sentMessages'], 'readonly');
        const store = transaction.objectStore('sentMessages');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = (event) => {
                console.log('📦 数据库中的所有记录:', event.target.result);
                resolve(event.target.result || []);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (error) {
        console.error('获取所有发送消息失败:', error);
        return [];
    }
}

// ==================== 翻译缓存 IndexedDB ====================

/**
 * 打开或创建翻译缓存数据库
 * 用于存储所有翻译结果,避免重复翻译
 */
function openTranslationCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WhatsAppTranslationCacheDB', 1);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            // 创建对象存储,使用复合键(原文+语言对)的hash作为主键
            if (!db.objectStoreNames.contains('translationCache')) {
                const store = db.createObjectStore('translationCache', { keyPath: 'cacheKey' });
                store.createIndex('originalText', 'originalText', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('langPair', 'langPair', { unique: false });
            }
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(`翻译缓存数据库打开失败: ${event.target.errorCode}`);
        };
    });
}

/**
 * 生成缓存键
 * @param {string} text - 原文
 * @param {string} fromLang - 源语言
 * @param {string} toLang - 目标语言
 * @returns {string} 缓存键
 */
function generateCacheKey(text, fromLang, toLang) {
    // 使用简单的字符串拼接作为键,实际项目中可以使用hash
    return `${fromLang}_${toLang}_${text}`;
}

/**
 * 保存翻译结果到缓存
 * @param {string} originalText - 原文
 * @param {string} translatedText - 译文
 * @param {string} fromLang - 源语言
 * @param {string} toLang - 目标语言
 */
async function saveTranslationCache(originalText, translatedText, fromLang, toLang) {
    try {
        const db = await openTranslationCacheDB();
        const transaction = db.transaction(['translationCache'], 'readwrite');
        const store = transaction.objectStore('translationCache');
        
        // 强化：在生成 Key 前进行归一化处理
        const normalizedOriginal = normalizeText(originalText);
        const cacheKey = generateCacheKey(normalizedOriginal, fromLang, toLang);
        
        const cacheData = {
            cacheKey: cacheKey,
            originalText: normalizedOriginal,
            translatedText: translatedText,
            fromLang: fromLang,
            toLang: toLang,
            langPair: `${fromLang}-${toLang}`,
            timestamp: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(cacheData);
            request.onsuccess = () => {
                console.log('💾 翻译缓存已保存:', {
                    original: originalText.substring(0, 30),
                    translated: translatedText.substring(0, 30),
                    langPair: `${fromLang}-${toLang}`
                });
                resolve();
            };
            request.onerror = (event) => {
                console.error('❌ 翻译缓存保存失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('保存翻译缓存失败:', error);
    }
}

/**
 * 从缓存获取翻译结果
 * @param {string} originalText - 原文
 * @param {string} fromLang - 源语言
 * @param {string} toLang - 目标语言
 * @returns {Promise<string|null>} 译文或null
 */
async function getTranslationCache(originalText, fromLang, toLang) {
    try {
        const db = await openTranslationCacheDB();
        const transaction = db.transaction(['translationCache'], 'readonly');
        const store = transaction.objectStore('translationCache');
        
        // 强化：在获取缓存前进行归一化处理
        const normalizedOriginal = normalizeText(originalText);
        const cacheKey = generateCacheKey(normalizedOriginal, fromLang, toLang);
        
        return new Promise((resolve, reject) => {
            const request = store.get(cacheKey);
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    console.log('✅ 翻译缓存命中:', {
                        original: originalText.substring(0, 30),
                        translated: result.translatedText.substring(0, 30),
                        age: Math.floor((Date.now() - result.timestamp) / 1000) + 's'
                    });
                    resolve(result.translatedText);
                } else {
                    // console.log('❌ 翻译缓存未命中:', originalText.substring(0, 30));
                    resolve(null);
                }
            };
            request.onerror = (event) => {
                console.error('查询翻译缓存失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('获取翻译缓存失败:', error);
        return null;
    }
}

/**
 * 根据原文查找翻译缓存（不限语言对）
 * @param {string} originalText 
 */
async function getTranslationByOriginalText(originalText) {
    try {
        const db = await openTranslationCacheDB();
        const transaction = db.transaction(['translationCache'], 'readonly');
        const store = transaction.objectStore('translationCache');
        const index = store.index('originalText');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(originalText);
            request.onsuccess = (event) => {
                const results = event.target.result;
                if (results && results.length > 0) {
                    // 按时间倒序排序，取最新的
                    results.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(results[0]);
                } else {
                    resolve(null);
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (error) {
        console.error('根据原文查找缓存失败:', error);
        return null;
    }
}

// 恢复发送消息的译文显示（针对 sendAutoTranslate: false 场景）
// 恢复发送消息的译文显示（针对 sendAutoTranslate: false 场景）
async function restoreSentMessageTranslations() {
    // 只有在开启“发送消息显示译文”时才执行
    if (!globalConfig?.sendAutoNotTranslate) return;

    try {
        // 查找所有发送的消息
        // 移除 data-translation-restored 限制，因为我们需要检查每一条消息是否缺少图标
        const sentMessages = document.querySelectorAll('.message-out span[dir="ltr"], .message-out span[dir="rtl"]');
        
        for (let span of sentMessages) {
            // 获取消息文本 (优先使用 innerText 以获取正确的换行)
            const spanText = span.innerText || span.textContent;
            const msgText = spanText.trim();
            if (!msgText || msgText.length < 1) continue;

            // 1. 检查并添加翻译图标 (如果不存在)
            let iconContainer = span.querySelector('.translate-icon-btn');
            if (!iconContainer) {
                iconContainer = document.createElement('span');
                iconContainer.className = 'translate-icon-btn';
                iconContainer.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    margin-left: 5px;
                    vertical-align: middle;
                    cursor: pointer;
                    color: #25D366;
                    position: relative;
                    z-index: 10;
                `;
                iconContainer.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 8l6 6"></path>
                    <path d="M4 14l6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="M22 22l-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                </svg>`;

                // 定义点击事件
                iconContainer.onclick = async (e) => {
                    e.stopPropagation();
                    
                    // 添加旋转动画
                    iconContainer.style.transition = 'transform 0.5s ease';
                    iconContainer.style.transform = 'rotate(360deg)';
                    
                    // 获取当前语言配置
                    const currentFrom = globalConfig?.sendAutoNotSourceLang || 'en';
                    const currentTo = globalConfig?.sendAutoNotTargetLang || 'zh';
                    
                    try {
                        console.log('🔄 用户点击图标，开始重新翻译(恢复消息):', msgText.substring(0, 20));
                        // 注意：这里使用 msgText (原始文本) 进行重译
                        const res = await translateTextAPI(msgText, currentFrom, currentTo);
                        
                        if (res && res.success) {
                            // 查找或创建译文节点
                            let translationNode = span.querySelector('.translation-result');
                            if (!translationNode) {
                                translationNode = document.createElement('span');
                                translationNode.className = 'translation-result';
                                translationNode.style.cssText = `
                                    display: block;
                                    font-size: 13px;
                                    color: #25D366;
                                    border-top: 1px dashed #ccc;
                                    padding-top: 5px;
                                    margin-top: 5px;
                                    font-style: italic;
                                `;
                                span.appendChild(document.createElement('br')); // Added <br>
                                span.appendChild(translationNode);
                            }
                            
                            translationNode.textContent = res.data;
                            // 更新缓存 (使用归一化文本，确保下次 restore 能找到)
                            await saveTranslationCache(normalizeText(msgText), res.data, currentFrom, currentTo);
                            console.log('✅ 重新翻译成功并更新显示');
                        }
                    } catch (error) {
                        console.error('❌ 重新翻译失败:', error);
                    }
                    
                    // 重置动画
                    setTimeout(() => {
                        iconContainer.style.transition = 'none';
                        iconContainer.style.transform = 'rotate(0deg)';
                    }, 500);
                };

                // 追加图标到原文后面
                span.appendChild(iconContainer);
            }

            // 2. 检查并恢复缓存的译文 (如果不存在)
            if (!span.querySelector('.translation-result')) {
                // 尝试从缓存获取
                const fromLang = globalConfig?.sendAutoNotSourceLang || 'en';
                const toLang = globalConfig?.sendAutoNotTargetLang || 'en';
                const normalizedMsgText = normalizeText(msgText);
                
                let cachedTrans = await getTranslationCache(normalizedMsgText, fromLang, toLang);
                
                // 如果精确匹配没找到，尝试只用原文查找
                if (!cachedTrans) {
                     if (normalizedMsgText.length > 1) {
                        const record = await getTranslationByOriginalText(normalizedMsgText);
                        if (record) cachedTrans = record.translatedText;
                     }
                }

                if (cachedTrans) {
                    const translationNode = document.createElement('span');
                    translationNode.className = 'translation-result';
                    translationNode.style.cssText = `
                        display: block;
                        font-size: 13px;
                        color: #25D366;
                        border-top: 1px dashed #ccc;
                        padding-top: 5px;
                        margin-top: 5px;
                        font-style: italic;
                    `;
                    span.appendChild(document.createElement('br')); // Added <br>
                    span.appendChild(translationNode);
                    translationNode.textContent = cachedTrans;
                    
                    span.setAttribute('data-translation-restored', 'true');
                    console.log('🔄 已从缓存恢复发送消息译文:', msgText.substring(0, 20));
                }
            }
        }
    } catch (e) {
        console.error('恢复发送消息译文失败:', e);
    }
}

// ==========================================================


// ===================== 语音翻译模块 (使用原生 API) =====================

// ===================== 语音翻译模块 (使用自动化捕获) =====================

// 处理语音消息列表，添加翻译按钮
function processVoiceMessageList() {
    // 查找所有语音消息 - 使用更通用的选择器
    const voiceMessages = document.querySelectorAll('span[data-icon="audio-play"], span[data-icon="audio-pause"]');
    
    // console.log('🔍 扫描到语音消息数量:', voiceMessages.length);
    
    voiceMessages.forEach((playIcon, index) => {
        // 尝试多种方式找到消息容器
        let messageNode = playIcon.closest('[data-id]'); // 常见消息容器
        let voiceContainer = playIcon.closest('div[role="button"]')?.parentElement || messageNode;
        
        if (!voiceContainer) {
            console.warn('⚠️ 未找到语音消息容器，索引:', index);
            return;
        }
        
        // 检查是否已添加翻译按钮
        if (voiceContainer.querySelector('.voice-translate-btn')) {
            return;
        }

        // 检测消息方向 (发送 vs 接收)
        // message-out 是发送的消息，message-in 是接收的消息
        const isOut = !!playIcon.closest('.message-out') || (messageNode && messageNode.classList.contains('message-out'));
        console.log(`✅ 为语音消息添加翻译按钮 [${isOut ? '发送' : '接收'}], 索引:`, index);
        
        // 创建容器包裹按钮，便于对齐
        const btnWrapper = document.createElement('div');
        btnWrapper.className = 'voice-translate-btn';
        btnWrapper.style.cssText = `
            margin-top: 5px; 
            display: flex; 
            width: 100%;
            justify-content: ${isOut ? 'flex-end' : 'flex-start'};
            ${isOut ? 'padding-right: 0;' : 'padding-left: 63px;'}
        `;

        // 创建按钮主体
        const translateBtn = document.createElement('span');
        translateBtn.style.cssText = `
            cursor: pointer; 
            background: rgba(37, 211, 102, 0.9); 
            color: white; 
            padding: 4px 12px; 
            border-radius: 15px; 
            font-size: 12px; 
            font-weight: 500; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.2); 
            display: inline-flex; 
            align-items: center; 
            gap: 4px; 
            transition: all 0.2s ease; 
            user-select: none;
            margin-${isOut ? 'right' : 'left'}: 5px;
        `;
        translateBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            语音翻译
        `;
        
        translateBtn.onmouseover = () => {
            translateBtn.style.background = '#1da851';
            translateBtn.style.transform = 'scale(1.05)';
        };
        translateBtn.onmouseout = () => {
            translateBtn.style.background = 'rgba(37, 211, 102, 0.9)';
            translateBtn.style.transform = 'scale(1)';
        };
        
        btnWrapper.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await translateVoiceMessage(voiceContainer, playIcon, isOut);
        };
        
        btnWrapper.appendChild(translateBtn);
        voiceContainer.appendChild(btnWrapper);
    });
}

// 启动语音消息监控
function startVoiceMessageMonitor() {
    console.log('🎤 启动语音消息监控');
    
    // 定时扫描列表添加按钮
    setInterval(processVoiceMessageList, 3000);
}

// 开始录制音频 (使用浏览器原生 MediaRecorder 并转换为 WAV)
async function startAudioRecording(audioElement) {
    try {
        const containerKey = getCanonicalVoiceContainer(audioElement);
        
        // 如果已经有录制在进行，先停止它
        if (currentRecorder && currentRecorder.state !== 'inactive') {
            stopAudioRecording();
        }

        console.log('🔴 开始录制音频 (原生 MediaRecorder), Key:', containerKey);
        currentAudioElement = audioElement;
        if (containerKey) recordingStateMap.set(containerKey, 'recording');
        
        // 检查是否已经为this audio element创建了source
        let cached = audioSourceMap.get(audioElement);
        let audioContext, source, destination;
        
        if (cached) {
            // 重用已有的 audio context 和 source
            audioContext = cached.audioContext;
            source = cached.source;
            destination = cached.destination;
            console.log('♻️ 重用已有的 AudioContext 和 MediaElementSource');
        } else {
            // 首次创建
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(audioElement);
            destination = audioContext.createMediaStreamDestination();
            
            // 连接音频节点
            source.connect(destination);
            source.connect(audioContext.destination); // 同时播放
            
            // 缓存起来
            audioSourceMap.set(audioElement, { audioContext, source, destination });
            console.log('✅ 创建新的 AudioContext 和 MediaElementSource');
        }
        
        // 使用浏览器原生 MediaRecorder
        const options = { mimeType: 'audio/webm' };
        currentRecorder = new MediaRecorder(destination.stream, options);
        
        audioChunks = [];
        
        currentRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        currentRecorder.onstop = async () => {
            // 合并所有音频块
            const webmBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('✅ WebM 录制完成，大小:', webmBlob.size, 'bytes', '开始转换为 WAV...');
            
            try {
                // 将 WebM 转换为 WAV
                recordedAudioBlob = await convertWebMToWAV(webmBlob);
                console.log('✅ WAV 转换完成，大小:', recordedAudioBlob.size, 'bytes');

                // 自动保存到本地和缓存
                await saveRecordingToCache(audioElement, recordedAudioBlob);

            } catch (error) {
                console.error('❌ WAV 转换失败:', error);
                // 如果转换失败，使用原始 webm
                recordedAudioBlob = webmBlob;
            }
        };
        
        currentRecorder.start();
        console.log('✅ MediaRecorder 录制已启动');
        
        // 监听音频结束事件
        audioElement.addEventListener('ended', () => {
            console.log('🏁 音频播放结束，正在停止录制...');
            stopAudioRecording();
        }, { once: true });
        
        audioElement.addEventListener('pause', () => {
            // 如果是用户暂停，我们也可以选择停止或保持当前录制
            // WhatsApp 暂停通常意味着录制应该告一段落
            if (audioElement.currentTime >= audioElement.duration - 0.2) {
                 stopAudioRecording();
            }
        }, { once: true });
        
    } catch (error) {
        console.error('❌ 录制音频失败:', error);
        // window.electronAPI.showNotification({
        //     message: `录制失败: ${error.message}`,
        //     type: 'is-danger'
        // });
    }
}

// 停止录音
function stopAudioRecording() {
    if (currentRecorder && currentRecorder.state !== 'inactive') {
        const key = getCanonicalVoiceContainer(currentAudioElement);
        if (key && recordingStateMap.get(key) === 'recording') {
            recordingStateMap.set(key, 'processing');
        }
        currentRecorder.stop();
        console.log('⏹️ MediaRecorder 已手动或自动停止');
    }
}

// 将录制内容保存至缓存系统，与 autoCaptureVoice 兼容
async function saveRecordingToCache(audioElement, blob) {
    try {
        const containerKey = getCanonicalVoiceContainer(audioElement);
        if (!containerKey) {
            console.warn('⚠️ [Save] 无法找到关联的消息容器');
            return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const base64 = bufferToBase64(arrayBuffer);
        
        const res = await window.electronAPI.saveCapturedAudio({ 
            audioData: base64, 
            format: 'pcm' 
        });

        if (res && res.success) {
            audioCacheMap.set(containerKey, {
                path: res.path,
                time: Date.now()
            });
            recordingStateMap.set(containerKey, 'done');
            console.log('✅ [Save] 录制音频已保存至本地:', res.path, 'Key:', containerKey);
            voiceRecordingData = null
            voiceRecordingData =  { 
                 path: res.path,
                time: Date.now()
            }
            // [AUTO] 录制完成后自动触发翻译
            const voiceContainer = (typeof containerKey === 'string') ? 
                document.querySelector(`[data-id="${containerKey}"]`) : 
                containerKey;
            
            if (voiceContainer) {
                console.log('🚀 [Auto-Translate] 录制完成，正在启动自动翻译...');
                translateVoiceMessage(voiceContainer).catch(err => {
                    console.error('❌ [Auto-Translate] 自动翻译启动失败:', err);
                });
            }
        } else {
            recordingStateMap.delete(containerKey);
        }
    } catch (e) {
        console.error('❌ [Save] 保存录音失败:', e);
        const key = getCanonicalVoiceContainer(audioElement);
        if (key) recordingStateMap.delete(key);
    }
}

// WebM 转 WAV/PCM 的转换函数
async function convertWebMToWAV(webmBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();
        
        fileReader.onload = async (e) => {
            try {
                // 解码 WebM 音频数据
                const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                
                console.log(`🔊 原始音频信息: ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}声道`);
                
                // 强制进行重采样到 16000Hz 单声道 (百度语音翻译的核心要求)
                const targetRate = 16000;
                console.log(`🔊 正在进行音频重采样: ${audioBuffer.sampleRate}Hz -> ${targetRate}Hz (Mono)`);
                const resampledBuffer = await resampleAudioBuffer(audioBuffer, targetRate);
                
                // 存储时长供后续检查
                resampledBuffer._user_duration = audioBuffer.duration;
                
                // 转换为 PCM (Raw，不带 WAV 头，通常更兼容百度的语音请求)
                const pcmBlob = audioBufferToRawPcm(resampledBuffer);
                resolve(pcmBlob);
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(webmBlob);
    });
}

// AudioBuffer 转 16-bit PCM (Raw)
function audioBufferToRawPcm(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;
    
    // 写入交错的音频数据
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }
    
    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    
    const blob = new Blob([buffer], { type: 'audio/pcm' });
    blob.duration = audioBuffer._user_duration; // 透传时长
    return blob;
}

// 音频重采样函数
async function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    const numberOfChannels = 1; // 强制单声道，百度语音识别/翻译对单声道支持最好
    const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        Math.ceil(audioBuffer.duration * targetSampleRate),
        targetSampleRate
    );

    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start();

    return await offlineContext.startRendering();
}

// ==================== 语音翻译核心逻辑 (V9: Lang Normalization + Raw PCM + Diagnostics) ====================

// 诊断函数：检查 ArrayBuffer 是否全为 0 (静音)
function isBufferAllZeros(buffer) {
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
        if (view[i] !== 0) return false;
    }
    return true;
}

// 诊断函数：计算音频统计信息 (峰值、均效值、时长)
function getAudioStats(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    let peak = 0;
    let sumSq = 0;
    
    for (let i = 0; i < data.length; i++) {
        const val = Math.abs(data[i]);
        if (val > peak) peak = val;
        sumSq += val * val;
    }
    
    const rms = Math.sqrt(sumSq / data.length);
    return {
        peak: peak.toFixed(4),
        rms: rms.toFixed(4),
        duration: audioBuffer.duration.toFixed(2)
    };
}

// 归一化语言代码 (针对百度等 API)
function normalizeLangCode(code) {
    if (!code) return 'zh';
    const mapping = {
        'zh-cn': 'zh',
        'zh-tw': 'zh',
        'zh-hk': 'zh',
        'en-us': 'en',
        'en-gb': 'en'
    };
    const lower = code.toLowerCase();
    return mapping[lower] || (lower.split('-')[0]) || 'zh';
}

// 延迟函数
const delay = ms => new Promise(res => setTimeout(res, ms));

// 获取待翻译音频的原始 Buffer (Localized Search)
async function getVoiceAudioBuffer(voiceContainer, playIcon) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    // 1. 在当前容器内深度搜索音频元素
    let audioElement = voiceContainer.querySelector('audio');
    
    // 2. 如果没找到，尝试点击播放按钮以触发 WhatsApp 加载音频对象
    if (!audioElement) {
        console.log('🧐 未在气泡内找到音频元素，尝试触发播放以加载...');
        playIcon.click();
        await delay(800); // 等待 DOM 渲染和音频加载
        audioElement = voiceContainer.querySelector('audio');
    }

    // 3. 最终尝试使用全局嗅探到的对象 (作为兜底)
    if (!audioElement) {
        audioElement = window._wp_playing_audio;
    }

    if (!audioElement || !audioElement.src) {
        console.error('❌ 无法定位音频源');
        return null;
    }

    try {
        console.log('🔗 抓取音频源:', audioElement.src);
        const response = await fetch(audioElement.src);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        
        if (isBufferAllZeros(arrayBuffer)) {
            console.error('❌ 警告：抓取到的原始音频数据全为静音(00)！');
            throw new Error('捕获到的音频源文件为空，请尝试刷新页面后重新点击播放');
        }

        // 解码
        return await new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, resolve, (err) => {
                console.error('❌ 解码失败:', err);
                reject(new Error('无法解析音频格式'));
            });
        });
    } catch (e) {
        throw e;
    }
}

// 翻译语音消息
async function translateVoiceMessage(voiceContainer, playIcon, isOut) {
    try {
        console.log('🌐 发起语音翻译 (V12: State-Aware)');
        
        const containerKey = getCanonicalVoiceContainer(voiceContainer);
        console.log('🔍 [Translate] Container Key:', containerKey);

        // 1. 检查是否正在录制或处理中 (解决竞态问题)
        let state = recordingStateMap.get(containerKey);
        if (state === 'recording' || state === 'processing') {
            console.log(`⏳ [Translate] 正在${state === 'recording' ? '录制' : '处理'}中，请稍候...`);
            window.electronAPI.showNotification({
                message: '音频正在处理中，请稍后再次点击',
                type: 'is-info'
            });
            return;
        }

        // 2. 检查是否有本地缓存
        let cached = audioCacheMap.get(containerKey);
        
        // 3. 如果没有缓存，尝试寻找 audio 元素并执行“静默抓取”
        if (!cached || !cached.path) {
            console.log('🔍 [Translate] 未找到录音缓存，尝试直接从 DOM 抓取...');
            
            // 查找容器内的 audio 元素
            let audioElement = voiceContainer.querySelector('audio');
            if (!audioElement) {
                const messageNode = voiceContainer.closest('[data-id]');
                audioElement = messageNode?.querySelector('audio');
            }

            if (audioElement && audioElement.src) {
                console.log('🎙️ [Translate] 发现 audio 元素，开始执行自动抓取...');
                window.electronAPI.showNotification({
                    message: '正在极速抓取音频数据...',
                    type: 'is-info'
                });
                
                await autoCaptureVoice(audioElement);
                cached = audioCacheMap.get(containerKey) || voiceRecordingData;
            }
        }

        // 4. 最终检查结果
        let audioSourceInfo = null;
        if ((cached && cached.path) || voiceRecordingData?.path ) {
            const finalPath = cached?.path || voiceRecordingData?.path;
            console.log('📁 [Translate] 使用文件:', finalPath);
            audioSourceInfo = { voicePath: finalPath };
        } else {
            console.log('🔍 [Translate] 仍未找到音频，提示用户播放');
            window.electronAPI.showNotification({
                message: '请点击播放语音以完成自动录制',
                type: 'is-warning'
            });
            return;
        }

        // 调用翻译 API
        const tenantConfig = await window.electronAPI.getTenantConfig();
         let  fromLang = null;
         let   toLang =null
        if(isOut) { 
         fromLang = getLocalLanguage(); 
         toLang =  getTargetLanguage();
        }else { 
          fromLang = getTargetLanguage(); 
          toLang = getLocalLanguage();   
        }

        console.log(`🌐 正在请求翻译: ${fromLang} -> ${toLang}`);

        const translateRes = await window.electronAPI.translateVoice({
            voicePath: audioSourceInfo.voicePath,
            from: normalizeLangCode(fromLang),
            target: normalizeLangCode(toLang),
            tenantId: tenantConfig?.tenantId
        });
         console.log(`🌐99999999 正在响应语音翻译结果: `,translateRes);
        if (translateRes && translateRes.success) {
            console.log('✅ 语音翻译成功:', translateRes.data);
            displayVoiceTranslation(voiceContainer, translateRes.data);
        } else {
            throw new Error(translateRes?.msg || '翻译服务返回失败');
        }

    } catch (error) {
        console.error('❌ 语音翻译流程出错:', error);
        window.electronAPI.showNotification({
            message: `语音翻译失败: ${error.message}`,
            type: 'is-danger'
        });
    }
}

// 内部使用的 PCM 转换 (无文件头)
function audioBufferToRawBuffer(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }
    
    let offset = 0;
    let pos = 0;
    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    return buffer;
}

// 显示语音翻译结果
function displayVoiceTranslation(voiceContainer, translationData) {
    // 移除旧的翻译结果
    const oldResult = voiceContainer.querySelector('.voice-translation-result');
    if (oldResult) oldResult.remove();
    
    // 检测方向
    const isOut = !!voiceContainer.closest('.message-out');
    
    // 创建翻译结果显示节点
    const resultNode = document.createElement('span'); // Changed from div to span
    resultNode.className = 'voice-translation-result';
    resultNode.style.cssText = `
        display: block; /* Added display: block */
        font-size: 13px;
        color: #25D366;
        background: rgba(37, 211, 102, 0.1);
        border-${isOut ? 'right' : 'left'}: 3px solid #25D366;
        padding: 8px 12px;
        margin-top: 8px;
        border-radius: 4px;
        font-style: italic;
        word-break: break-word;
        text-align: ${isOut ? 'right' : 'left'};
        align-self: ${isOut ? 'flex-end' : 'flex-start'};
        max-width:80%;
        margin-left: ${isOut ? '10px' : '63px'};
        margin-right: ${isOut ? '0' : '10px'};

    `;
    
    // 处理翻译数据
    let sourceTextra = '';
    let translationText = '';
    
    try {
        if (typeof translationData === 'string') {
            translationText = translationData;
        } else if (translationData.text || translationData.translation || translationData.result) {
            translationText = translationData.text || translationData.translation || translationData.result;
            sourceTextra = translationData.source || translationData.src || '';
        } else {
            const voiceTranslationData = translationData.data || translationData;
            translationText = voiceTranslationData.target || voiceTranslationData.translation || '';
            sourceTextra = voiceTranslationData.source || voiceTranslationData.src || '';
            console.log('📊 [Display] 语音数据详情:', voiceTranslationData);
        }
    } catch (e) {
        console.error('❌ 解析翻译数据失败:', e);
        translationText = JSON.stringify(translationData);
    }
    
    resultNode.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 8l6 6"></path>
                <path d="M4 14l6-6 2-3"></path>
                <path d="M2 5h12"></path>
                <path d="M7 2h1"></path>
                <path d="M22 22l-5-10-5 10"></path>
                <path d="M14 18h6"></path>
            </svg>
            <span style="font-size: 11px; font-weight: 600; color: #25D366; text-transform: uppercase; letter-spacing: 0.5px;">语音翻译</span>
        </div>
        ${sourceTextra ? `<div style="color: #666; font-size: 12px; margin-bottom: 6px; border-bottom: 1px dashed rgba(37, 211, 102, 0.3); padding-bottom: 4px; font-style: normal;">${sourceTextra}</div>` : ''}
        <div style="color: #128C7E; line-height: 1.4; font-weight: 450;">${translationText}</div>
    `;
    
    // 确保我们是在消息气泡容器上进行操作
    if (voiceContainer.tagName === 'AUDIO') {
        const betterContainer = getCanonicalVoiceContainer(voiceContainer);
        if (betterContainer && betterContainer.tagName !== 'AUDIO') {
            voiceContainer = betterContainer;
        } else if (voiceContainer.parentElement) {
            voiceContainer = voiceContainer.parentElement;
        }
    }

    // 插入到容器中
    const translateBtn = voiceContainer.querySelector('.voice-translate-btn');
    console.log('translateBtn', translateBtn, voiceContainer);
    
    if (translateBtn) {
        translateBtn.after(resultNode);
    } else {
        voiceContainer.appendChild(resultNode);
    }
    console.log('✅ 翻译结果已显示');
}

console.log('🎤 语音翻译功能已加载');