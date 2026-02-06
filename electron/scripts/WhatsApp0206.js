// whatsapp-content.js
// 版本：2026-01-30 v2 - 添加 IndexedDB 存储发送消息原文
console.log('🔧 WhatsApp.js 脚本版本: 2026-01-30 v2 (含原文持久化)');

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
        if (config) {
            globalConfig = config;
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
    const init = () => {
        const mainNode = document.getElementById('pane-side');
        if (mainNode && !mainNode.hasAttribute('data-monitor-init')) {
            mainNode.setAttribute('data-monitor-init', 'true');
            observePaneSide(mainNode);
            getLanguageList();
            syncGlobalConfig(); // 初始同步
            setInterval(syncGlobalConfig, 10000); // 每10秒同步一次
            setInterval(() => {
                processMessageList();
                processImageMessageList(); // 处理消息列表中的图片翻译
            }, 500);
            
            // 恢复监控
            startMediaPreviewMonitor(); 
            monitorAttachmentMenu();
            return true;
        }
        return false;
    };

    // 尝试立即初始化，如果不成功则启动观察器
    if (!init()) {
        const observer = new MutationObserver((mutationsList, observer) => {
            if (init()) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

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
}

// 处理消息列表中的图片，添加翻译按钮
function processImageMessageList() {
    // 查找包含图片的发送和接收消息
    const imageMessages = document.querySelectorAll('.message-in img, .message-out img');
    
    imageMessages.forEach(img => {
        // 排除头像和表情/图标
        if (img.naturalWidth < 30 || img.closest('[data-testid="attached-gif"]') || img.closest('.selectable-text') || img.classList.contains('_amlt')) return;
        
        // 查找容器
        const messageContainer = img.closest('.message-in') || img.closest('.message-out');
        if (!messageContainer) return;

        // 如果已经添加过按钮，跳过
        if (messageContainer.querySelector('.image-chat-translate-btn')) return;

        // 创建翻译按钮
        const btnContainer = document.createElement('div');
        btnContainer.className = 'image-chat-translate-btn';
        btnContainer.style.cssText = `
            margin-top: 8px;
            display: flex;
            justify-content: flex-end;
            padding: 2px 10px;
            width: 100%;
            box-sizing: border-box;
        `;
        
        const btn = document.createElement('div');
        btn.innerHTML = `
            <span style="cursor: pointer; background: rgba(37, 211, 102, 0.9); color: white; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease; user-select: none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>
                图片翻译
            </span>
        `;
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            translateImageInWhatsApp(img);
        };

        const innerSpan = btn.querySelector('span');
        innerSpan.onmouseover = () => {
            innerSpan.style.background = '#1da851';
            innerSpan.style.transform = 'scale(1.02)';
        };
        innerSpan.onmouseout = () => {
            innerSpan.style.background = 'rgba(37, 211, 102, 0.9)';
            innerSpan.style.transform = 'scale(1)';
        };

        btnContainer.appendChild(btn);
        
        // 注入到图片父容器中
        const imgParent = img.closest('div[role="button"]') || img.parentNode;
        imgParent.appendChild(btnContainer);
    });
}

// 监听附件菜单点击
function monitorAttachmentMenu() {
    document.body.addEventListener('click', (e) => {
        console.log('事件监听', e);
        
        const target = e.target;
        const menuItem = target.closest('li') || target.closest('div[role="menuitem"]');
        console.log('menuItem', menuItem);
        if (menuItem) {
            const text = menuItem.textContent.trim();
            const icon = menuItem.querySelector('span[data-icon]');
            const iconName = icon ? icon.getAttribute('data-icon') : '';
               console.log('text', text);
            // 匹配 "照片和视频"
            if (text === '照片和视频' || iconName.includes('image') || iconName.includes('media')) {
                console.log('📎 用户点击了 "照片和视频" 附件菜单');
            } else if (text === '文档' || iconName.includes('document')) {
                console.log('📎 用户点击了 "文档" 附件菜单');
            }
        }
    }, true); 
}

// 监听媒体预览界面 (截图二对应逻辑)
function startMediaPreviewMonitor() {
    console.log('📡 启动图片预览监控');
    const observer = new MutationObserver((mutations) => {
        // 查找预览容器或工具栏
        const dialog = document.querySelector('div[role="dialog"]');
        const mediaToolbar = document.querySelector('span[data-icon="wds-ic-image-rotate-right"]') || 
                           document.querySelector('span[data-icon="wds-ic-image-stickers"]') ||
                           document.querySelector('span[data-icon="x"]');
        
        if (mediaToolbar || dialog) {
            const previewImg = document.querySelector('img[src^="blob:"]');
            if (previewImg) {
                // 确保尺寸合适且未注入按钮
                if (previewImg.naturalWidth > 100 && !document.querySelector('#image-translate-btn')) {
                    console.log('🖼️ 检测到图片预览界面，准备注入翻译按钮');
                    addTranslateButtonToPreview(previewImg);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function addTranslateButtonToPreview(imgElement) {
    if (document.querySelector('#image-translate-btn')) return;

    console.log('➕ 正在注入图片翻译按钮...');
    const btn = document.createElement('div');
    btn.id = 'image-translate-btn';
    btn.innerHTML = `
        <div style="cursor: pointer; background: #25D366; color: white; padding: 10px 20px; border-radius: 25px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; user-select: none;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>
            图片翻译
        </div>
    `;
    
    // 悬浮在右上角
    btn.style.cssText = `
        position: fixed;
        top: 70px;
        right: 40px;
        z-index: 10000;
    `;
    
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        translateImageInWhatsApp(imgElement);
    };

    const innerBtn = btn.querySelector('div');
    innerBtn.onmouseover = () => innerBtn.style.transform = 'scale(1.05)';
    innerBtn.onmouseout = () => innerBtn.style.transform = 'scale(1)';
    
    document.body.appendChild(btn);
    console.log('✅ 翻译按钮注入成功');

    // 定时检查预览界面是否关闭
    const closeMonitor = setInterval(() => {
        if (!imgElement.isConnected || !document.querySelector('img[src^="blob:"]')) {
            console.log('🗑️ 图片预览已关闭，移除翻译按钮');
            btn.remove();
            clearInterval(closeMonitor);
        }
    }, 1000);
}

// 注入 html2canvas 库 (现在由主进程同步注入，此处仅作为检查)
function ensureHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve();
    // 如果没注入，尝试动态从主进程获取并执行
    return new Promise(async (resolve, reject) => {
        try {
            console.log('📡 尝试从主进程动态获取 html2canvas...');
            const scriptContent = await window.electronAPI.getScriptContent('html2canvas.min.js');
            if (scriptContent) {
                const script = document.createElement('script');
                script.textContent = scriptContent;
                document.head.appendChild(script);
                console.log('✅ html2canvas 动态注入成功');
                resolve();
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
        console.log('🖼️ 准备提取图象数据进行翻译...');
        
        window.electronAPI.showNotification({
            message: '🖼️ 正在准备截取图片...',
            type: 'is-info'
        });

        // 确保图片加载完成
        if (!imgElement.complete || imgElement.naturalWidth === 0) {
            // 给一点时间加载
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 尝试确保 html2canvas 可用
        try {
            await ensureHtml2Canvas();
        } catch (e) {
            console.warn('⚠️ html2canvas 准备失败:', e.message);
        }

        let imageData;
        if (window.html2canvas) {
            // 确定截图目标元素
            const captureTarget = imgElement.closest('div[role="dialog"]') || 
                                 imgElement.closest('div[role="button"]') || 
                                 imgElement.parentNode;
            
            console.log('📸 使用 html2canvas 截取:', captureTarget);
            
            try {
                const canvas = await html2canvas(captureTarget, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#000',
                    scale: 2, // 提高质量以解决 recog empty 问题
                    logging: false,
                    onclone: (clonedDoc) => {
                        // 可以在克隆的文档中隐藏按钮等不需要的内容
                        const btn = clonedDoc.querySelector('#image-translate-btn') || 
                                    clonedDoc.querySelector('.image-chat-translate-btn');
                        if (btn) btn.style.display = 'none';
                    }
                });
                imageData = canvas.toDataURL('image/png', 0.9);
                console.log('✅ html2canvas 截图完成, 长度:', imageData.length);
                
                // 检查是否截图到了有效内容 (如果全是黑色或太小)
                if (imageData.length < 5000) {
                    throw new Error('Captured image seems to be empty');
                }
            } catch (h2cError) {
                console.error('❌ html2canvas 截图失败:', h2cError);
                throw h2cError; // 让 fallback 处理
            }
        } else {
            // 回退到基础 Canvas 模式
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);
            imageData = canvas.toDataURL('image/png');
        }
        
        window.electronAPI.showNotification({
            message: '🖼️ 正在发起图片翻译请求...',
            type: 'is-info'
        });

        const fromLang = getLocalLanguage();
        const toLang = getTargetLanguage();

        // 调用 IPC Bridge
        const result = await window.electronAPI.translateImage({
            imageData: imageData,
            from: fromLang,
            target: toLang
        });

        if (result && result.success) {
            console.log('✅ 图片翻译成功:', result.data);
            window.electronAPI.showNotification({
                message: '✅ 图片翻译完成！',
                type: 'is-success'
            });

            // 在图片下方显示翻译结果
            const messageContainer = imgElement.closest('.message-in') || imgElement.closest('.message-out') || imgElement.closest('div[role="dialog"]');
            if (messageContainer) {
                // 移除旧的翻译结果（如果存在）
                const oldResult = messageContainer.querySelector('.image-translation-result');
                if (oldResult) oldResult.remove();

                const resultNode = document.createElement('div');
                resultNode.className = 'image-translation-result';
                resultNode.style.cssText = `
                    font-size: 14px;
                    color: #25D366;
                    background: rgba(0, 0, 0, 0.05);
                    border-left: 3px solid #25D366;
                    padding: 8px 12px;
                    margin-top: 10px;
                    border-radius: 4px;
                    font-style: italic;
                    word-break: break-all;
                    line-height: 1.4;
                `;
                
                // 处理不同类型的返回数据
                if (typeof result.data === 'string') {
                    resultNode.textContent = result.data;
                } else if (result.data && result.data.sumDst) {
                    // 优先显示完整翻译文本 sumDst
                    resultNode.textContent = result.data.sumDst;
                } else if (result.data && result.data.translation) {
                    resultNode.textContent = result.data.translation;
                } else {
                    resultNode.textContent = typeof result.data === 'object' ? JSON.stringify(result.data) : result.data;
                }

                // 寻找注入点
                const btnContainer = messageContainer.querySelector('.image-chat-translate-btn') || imgElement.parentNode;
                if (btnContainer.nextSibling) {
                    messageContainer.insertBefore(resultNode, btnContainer.nextSibling);
                } else {
                    messageContainer.appendChild(resultNode);
                }
            }
        } else {
            console.error('❌ 图片翻译失败:', result?.msg);
            window.electronAPI.showNotification({
                message: `❌ 图片翻译失败: ${result?.msg || '服务异常'}`,
                type: 'is-danger'
            });
        }
    } catch (error) {
        console.error('❌ 图片翻译过程中发生异常:', error);
        window.electronAPI.showNotification({
            message: `❌ 图片翻译异常: ${error.message}`,
            type: 'is-danger'
        });
    }
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
            processingMessages.delete(msgKey);
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