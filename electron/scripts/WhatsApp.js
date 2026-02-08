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

        console.log('🎵 [Sniffer] HTMLMediaElement.play() 捕获:', this.src);
        window._wp_playing_audio = this;
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
        const element = document.querySelector("#app > div > div.two._aigs.x1n2onr6.x13vifvy.x17qophe.x78zum5.xh8yej3.x5yr21d.x6ikm8r.x10wlt62.x1iek97a.x1w3jsh0.xf8xn22.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1g0ag68.xcgwb2z.x4afe7t.x1alahoq.x1j6awrg.x1m1drc7.x1n449xj.x162n7g1.xitxdhh.x134s4mn.x1s928wv.x1setqd9 > header > div > div > div > div > span > div > div.x1c4vz4f.xs83m0k.xdl72j9.x1g77sc7.xeuugli.x2lwn1j.xozqiw3.x1oa3qoh.x12fk4p8.xyorhqc > div:nth-child(1) > div")
        if (element) {
            const avatar = document.querySelector("#app > div > div.two._aigs.x1n2onr6.x13vifvy.x17qophe.x78zum5.xh8yej3.x5yr21d.x6ikm8r.x10wlt62.x1iek97a.x1w3jsh0.xf8xn22.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1g0ag68.xcgwb2z.x4afe7t.x1alahoq.x1j6awrg.x1m1drc7.x1n449xj.x162n7g1.xitxdhh.x134s4mn.x1s928wv.x1setqd9 > header > div > div > div > div > span > div > div.x1c4vz4f.xs83m0k.xdl72j9.x1g77sc7.xeuugli.x2lwn1j.xozqiw3.x1oa3qoh.x12fk4p8.xyorhqc > div:nth-child(2) > div > div > div > div > img")
            const url = avatar?.src || '';
            window.electronAPI.sendMsg({platform:'WhatsApp',online: true,avatarUrl:url}).then(res=>{
                console.log('用户已登录：',res)
            })
        } else {
            window.electronAPI.sendMsg({platform:'WhatsApp',online: false,avatarUrl: ''}).then(res=>{
                console.log('用户未登录：',res)
            })
        }
    }, 5000);
}

let languages = []
let globalConfig = null;
let lastPreviewedTranslation = '';
let lastPreviewedSource = '';
let previewNode = null;

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
        const tenantConfig = await window.electronAPI.getTenantConfig()
        if (config) {
            globalConfig =  { ...config, ...tenantConfig}
            console.log('🔄 全局配置同步成功:', globalConfig);
        }
    } catch (e) {
        console.error('❌ 同步全局配置失败:', e);

    }
}

function notify() {
    window.electronAPI.newMsgNotify({platform:'WhatsApp'})
}

monitorMainNode()

// 初始化语言列表
function getLanguageList() {
    window.electronAPI.languageList().then((response) => {
        languages = response.data;
        console.log('语言列表加载完成:', languages.length, '种语言');
    }).catch(error => {
        console.error('加载语言列表失败:', error);
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
        editableDiv.removeEventListener('keydown', handleKeyDown);

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

// 分离事件处理函数，便于管理
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.ctrlKey) {
        console.log('⏺️ Enter键按下，开始处理翻译');

        // 检查全局发送自动翻译开关
        if (!globalConfig?.sendAutoTranslate) {
            console.log('🔇 发送自动翻译未开启，跳过拦截');
            return;
        }

        // 立即阻止事件传播
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // 检查是否正在处理中
        let loadingNode = document.getElementById('editDivLoadingNode');
        if (loadingNode) {
            console.log('⏳ 已有处理中的请求，跳过');
            return;
        }

        // 获取输入框内容
        const inputText = getInputContent();
        console.log('输入内容:', inputText);

        if (!inputText.trim()) {
            console.log('❌ 输入内容为空');
            return;
        }

        // --- 翻译预览逻辑 ---
        if (globalConfig?.translatePreview && lastPreviewedTranslation) {
            if (inputText.trim() === lastPreviewedTranslation.trim()) {
                console.log('✅ 预览已确认，发送消息');
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

        // 判断是否纯表情
        const hasSpan = document.querySelector('footer div[contenteditable="true"]')?.querySelector('span');
        if (hasSpan && !inputText.trim()) {
            console.log('😀 纯表情，直接发送');
            sendMsg();
            return;
        }

        // 执行翻译流程
        executeTranslationFlow(inputText);
    }
}

// 获取输入框内容的函数
function getInputContent() {
    let editableDiv = document.querySelector('footer div[aria-owns="emoji-suggestion"][contenteditable="true"]');
    return editableDiv ? editableDiv.textContent || editableDiv.innerText : '';
}

// 敏感词检测函数
async function checkSensitiveContent(text) {
    try {
        console.log('🔍 开始敏感词检测:', text);
        
        // 使用 electronAPI 调用后端接口（包含 validator 和 bitcoin-address-validation 验证）
        const result = await window.electronAPI.checkSensitiveContent({ content: text });
        console.log('后端验证结果:', result);
        
        if (result && result.success) {
            // 检查本地验证结果
            if (result.localValidation) {
                console.log('本地验证详情:', result.localValidation);
                if (result.localValidation.hasSensitiveContent) {
                    console.log('检测到:', {
                        URLs: result.localValidation.urls,
                        BTC地址: result.localValidation.btcAddresses,
                        ETH地址: result.localValidation.ethAddresses
                    });
                }
            }
            
            // 检查后端是否返回敏感词
            if (result.data && result.data.sensitiveWord) {
                return {
                    isSensitive: true,
                    reason: `内容包含敏感词: ${result.data.sensitiveWord}`,
                    details: {
                        type: 'keyword',
                        sensitiveWord: result.data.sensitiveWord,
                        localValidation: result.localValidation
                    }
                };
            }
        }
        
        return {
            isSensitive: false,
            reason: '',
            details: {}
        };
        
    } catch (error) {
        console.error('❌ 敏感词检测失败:', error);
        // 检测失败时，为了安全起见，允许发送
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
        
        // 保存原文到本地存储（IndexedDB）
        await saveSentMessage(translatedText, originalText);
        console.log('💾 原文已保存到本地:', originalText);
        
        // 创建原文显示节点（与接收消息翻译UI一致）
        let originalNode = document.createElement('div');
        originalNode.className = 'original-text-result';
        originalNode.style.cssText = `
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

// 翻译API函数 - 直接调用主进程的翻译服务
async function translateTextAPI(text, fromLang, toLang) {

    // alert("-------------翻译内容："+text);

    console.log(`调用翻译API: "${text.substring(0, 50)}..." ${fromLang} -> ${toLang}`);

    try {
        const result = await window.electronAPI.translateText({
            text: text,
            local: fromLang,
            target: toLang
        });

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

            if (result && result.success && result.data !== msg) {
                span.setAttribute('data-translate-status', 'translated');

                // 创建翻译结果显示节点
                let translationNode = document.createElement('div');
                translationNode.className = 'translation-result';
                translationNode.style.cssText = `
                    font-size: 13px;
                    color: #25D366;
                    border-top: 1px dashed #ccc;
                    padding-top: 5px;
                    margin-top: 5px;
                    font-style: italic;
                `;
                translationNode.textContent = '' + result.data;

                span.appendChild(translationNode);
                console.log('✅ 翻译结果已显示');
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

// 添加翻译按钮（简化版）
function addTranslateButtonWithSelect() {
    let targetNode = document.querySelector('footer')?.firstChild?.firstChild?.firstChild?.firstChild?.firstChild;
    if (!targetNode) {
        console.error('未找到目标节点');
        return;
    }

    // 创建按钮
    const button = document.createElement('button');
    button.innerHTML = `🌐`;
    button.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 5px;
        margin: 0 5px;
    `;

    button.addEventListener('click', function() {
        alert(`当前翻译设置:\n源语言: ${getLocalLanguage()}\n目标语言: ${getTargetLanguage()}`);
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
    if (document.querySelector('#image-translate-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'image-translate-btn';
    btn.innerHTML = `
        <div style="cursor: pointer; background: #25D366; color: white; padding: 10px 20px; border-radius: 25px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 1555px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; user-select: none;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>
            图片翻译
        </div>
    `;
     if(dialog) {
        btn.style.cssText = `position: fixed; bottom: 35px; right: 60px; z-index: 10000;`;
     }else { 
         btn.style.cssText = `display:none`;
     }
   
    
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        translateImageInWhatsApp(imgElement);
    };

    const inner = btn.querySelector('div');
    inner.onmouseover = () => inner.style.transform = 'scale(1.05)';
    inner.onmouseout = () => inner.style.transform = 'scale(1)';
    
    document.body.appendChild(btn);

    const closeMonitor = setInterval(() => {
        if (!imgElement.isConnected || !document.querySelector('img[src^="blob:"]')) {
            btn.remove();
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

        const result = await window.electronAPI.translateImage({
            imageData: imageData,
            from: getLocalLanguage(),
            target: getTargetLanguage()
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
            
            // 获取消息文本
            const msgText = span.textContent.trim();
            if (!msgText || msgText.length < 2) {
                continue;
            }
            
            console.log('🔍 检查发送消息:', msgText.substring(0, 50));
            
            // 从本地存储获取原文
            const record = await getSentMessage(msgText);
            console.log('📦 查询结果:', record);
            
            if (record && record.originalText) {
                // 创建原文显示节点
                let originalNode = document.createElement('div');
                originalNode.className = 'original-text-result';
                originalNode.style.cssText = `
                    font-size: 13px;
                    color: #25D366;
                    border-top: 1px dashed #ccc;
                    padding-top: 5px;
                    margin-top: 5px;
                    font-style: italic;
                `;
                originalNode.textContent = record.originalText;
                
                span.appendChild(originalNode);
                span.setAttribute('data-original-restored', 'true');
                console.log('🔄 已恢复原文显示:', record.originalText);
            } else {
                // 尝试遍历数据库查找匹配
                const allRecords = await getAllSentMessages();
                let found = false;
                for (let rec of allRecords) {
                    // 检查消息文本是否包含存储的翻译文本（以处理可能的格式差异）
                    if (msgText.includes(rec.translatedText.substring(0, 20)) || 
                        rec.translatedText.includes(msgText.substring(0, 20))) {
                        console.log('🔄 通过模糊匹配找到原文:', rec.originalText);
                        
                        let originalNode = document.createElement('div');
                        originalNode.className = 'original-text-result';
                        originalNode.style.cssText = `
                            font-size: 13px;
                            color: #25D366;
                            border-top: 1px dashed #ccc;
                            padding-top: 5px;
                            margin-top: 5px;
                            font-style: italic;
                        `;
                        originalNode.textContent = rec.originalText;
                        
                        span.appendChild(originalNode);
                        span.setAttribute('data-original-restored', 'true');
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // 标记为已检查，避免重复查询
                    span.setAttribute('data-original-restored', 'checked');
                }
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

// ===================== 语音翻译模块 (使用原生 API) =====================

// 全局变量
let currentRecorder = null;
let currentAudioElement = null;
let recordedAudioBlob = null;
let audioChunks = [];
let audioSourceMap = new WeakMap(); // 缓存 audio 元素和对应的 source node

// 处理语音消息列表，添加翻译按钮
function processVoiceMessageList() {
    // 查找所有语音消息 - 使用更通用的选择器
    const voiceMessages = document.querySelectorAll('span[data-icon="audio-play"], span[data-icon="audio-pause"]');
    
    console.log('🔍 扫描到语音消息数量:', voiceMessages.length);
    
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            语音翻译 ${isOut}
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
            await translateVoiceMessage(voiceContainer, playIcon);
        };
        
        btnWrapper.appendChild(translateBtn);
        voiceContainer.appendChild(btnWrapper);
    });
}

// 启动语音消息监控
function startVoiceMessageMonitor() {
    console.log('🎤 启动语音消息监控');
    
    // 监听播放按钮点击事件
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const playIcon = target.closest('span[data-icon="audio-play"]') || target.closest('span[data-icon="audio-pause"]');
        
        if (playIcon) {
            console.log('🎵 检测到语音播放按钮点击');
            // 查找对应的 audio 元素
            setTimeout(() => {
                // 优先使用嗅探器捕获到的音频
                let audioElement = window._wp_playing_audio;
                
                // 如果嗅探器没拿到或者已暂停，尝试通过 DOM 树查找
                if (!audioElement || audioElement.paused) {
                    const audios = Array.from(document.querySelectorAll('audio'));
                    audioElement = audios.find(a => !a.paused && a.currentTime > 0) || audios[0];
                }
                
                if (audioElement) {
                    console.log('🎧 [Monitor] 确定音频播放元素:', audioElement);
                    currentAudioElement = audioElement;
                    startAudioRecording(audioElement);
                } else {
                    console.warn('⚠️ [Monitor] 未能找到任何音频播放元素');
                }
            }, 500); // 稍微增加延迟，确保 play() 被调用并被拦截
        }
    }, true);
}

// 开始录制音频 (使用浏览器原生 MediaRecorder 并转换为 WAV)
async function startAudioRecording(audioElement) {
    try {
        console.log('🔴 开始录制音频 (原生 MediaRecorder)');
        
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
            stopAudioRecording();
        }, { once: true });
        
        audioElement.addEventListener('pause', () => {
            if (audioElement.currentTime >= audioElement.duration - 0.1) {
                stopAudioRecording();
            }
        }, { once: true });
        
    } catch (error) {
        console.error('❌ 录制音频失败:', error);
        window.electronAPI.showNotification({
            message: `录制失败: ${error.message}`,
            type: 'is-danger'
        });
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
async function translateVoiceMessage(voiceContainer, playIcon) {
    try {
        console.log('🌐 发起语音翻译 (V9: Lang Normalization + Raw PCM)');
        
        window.electronAPI.showNotification({
            message: '深度分析音频中...',
            type: 'is-info'
        });

        // 1. 获取解压后的音频 Buffer (直接抓取，不使用不可靠的 MediaRecorder)
        const audioBuffer = await getVoiceAudioBuffer(voiceContainer, playIcon);
        if (!audioBuffer) {
            throw new Error('未检测到有效的语音数据，请确保语音已加载并播放');
        }

        // 2. 深度质量检查
        const stats = getAudioStats(audioBuffer);
        console.log('📊 [Audio Stats]:', stats);

        if (parseFloat(stats.duration) < 0.8) {
            throw new Error(`音频太短 (${stats.duration}s)，无法识别`);
        }
        
        if (parseFloat(stats.peak) < 0.005) {
            throw new Error(`音频音量过低或接近静音 (Peak: ${stats.peak})，请重新播放或增大音量`);
        }

        // 3. 重采样到 16kHz Mono
        const targetRate = 16000;
        const resampledBuffer = await resampleAudioBuffer(audioBuffer, targetRate);
        
        // 4. 转换为 Raw PCM (无文件头) - 最高兼容性
        const pcmBuffer = audioBufferToRawBuffer(resampledBuffer);
        
        // 5. 语言代码归一化 (解决 zh-TW 导致的 20200)
        const fromLang = normalizeLangCode(getTargetLanguage());
        const targetLang = normalizeLangCode(getLocalLanguage());
        console.log(`🌍 语言参数: ${fromLang} -> ${targetLang}`);

        // 6. 转换为 Base64
        const blob = new Blob([pcmBuffer], { type: 'audio/pcm' });
        const reader = new FileReader();
        reader.onload = async () => {
            const audioDataBase64 = reader.result;
            
            console.log(`📤 发送请求 (PCM 16kHz Mono)...`);
            const result = await window.electronAPI.translateVoice({
                audioData: audioDataBase64, 
                from: fromLang,
                target: targetLang,
                format: 'pcm',
                rate: 16000
            });
            
            const isSuccess = result && (result.success === true || (result.data && (result.data.code === 200 || result.data.error_code === "0" || result.data.error_code === 0)));
            
            if (isSuccess) {
                displayVoiceTranslation(voiceContainer, result.data || result);
                window.electronAPI.showNotification({ message: '翻译成功', type: 'is-success' });
            } else {
                const errorMsg = result?.msg || result?.message || (result?.data ? JSON.stringify(result.data) : '翻译服务无响应');
                throw new Error(errorMsg);
            }
        };
        
        reader.onerror = () => {
            throw new Error('读取音频流失败');
        };
        
        reader.readAsDataURL(blob);

    } catch (error) {
        console.error('❌ 翻译失败详情:', error);
        window.electronAPI.showNotification({
            message: `翻译失败: ${error.message}`,
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
    const resultNode = document.createElement('div');
    resultNode.className = 'voice-translation-result';
    resultNode.style.cssText = `
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
    `;
    
    // 处理翻译数据
    let translationText = '';
    if (typeof translationData === 'string') {
        translationText = translationData;
    } else if (translationData.text || translationData.translation || translationData.result) {
        translationText = translationData.text || translationData.translation || translationData.result;
    } else {
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
        <div style="color: #128C7E; line-height: 1.4; font-weight: 450;">${translationText}</div>
    `;
    
    voiceContainer.appendChild(resultNode);
    console.log('✅ 翻译结果已显示');
}

console.log('🎤 语音翻译功能已加载');