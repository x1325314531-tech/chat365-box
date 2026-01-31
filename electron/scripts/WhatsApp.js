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

        console.log('✅ 事件监听器已添加');
    } else {
        console.error('❌ 未找到输入框元素，2秒后重试');
        setTimeout(startMonitor, 2000);
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

// 执行翻译流程
async function executeTranslationFlow(inputText) {
    try {
        console.log('🔄 开始翻译流程，原文:', inputText);

        // 显示加载状态
        const loadingNode = generateLoadingNode();
        loadingNode.id = 'editDivLoadingNode';
        operationNode('add', loadingNode, document.querySelector('footer div[contenteditable="true"]')?.parentNode?.parentNode);

        // 调用翻译API
        console.log('📝 调用翻译API...');
        const translatedText = await translateTextAPI(inputText, getLocalLanguage(), getTargetLanguage());
        console.log('✅ 翻译结果:', translatedText);

        if (!translatedText) {
            throw new Error('翻译结果为空');
        }

        // 确保输入框有焦点
        let editableDiv = document.querySelector('footer div[aria-owns="emoji-suggestion"][contenteditable="true"]');
        if (editableDiv) {
            editableDiv.focus();
        }

        // 使用 Electron 原生键盘模拟 - 这会绕过 Lexical 的 DOM 保护
        console.log('⌨️ 使用原生键盘模拟输入...');
        const result = await window.electronAPI.simulateTyping({
            text: translatedText,
            clearFirst: true  // 先清空（Ctrl+A + Backspace）
        });

        if (result && result.success) {
            console.log('✅ 原生键盘输入成功');
        } else {
            console.error('❌ 原生键盘输入失败:', result?.error);
        }

        // 移除加载状态
        operationNode('remove', loadingNode);

        // 检查输入框内容
        await new Promise(resolve => setTimeout(resolve, 100));
        const currentContent = editableDiv?.textContent;
        console.log('📌 输入后内容:', currentContent);

        // 发送消息
        setTimeout(() => {
            sendMsg();
            console.log('📤 消息已发送');
            
            // 消息发送后，添加原文显示到发送的消息上
            setTimeout(() => {
                addOriginalTextToSentMessage(inputText, translatedText);
            }, 500);
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
                    setInterval(processMessageList, 500);
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
            
            const translatedText = await translateTextAPI(msg, fromLang, toLang);
            console.log('✅ 翻译结果:', translatedText);

            if (translatedText && translatedText !== msg) {
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
                translationNode.textContent = '' + translatedText;

                span.appendChild(translationNode);
                console.log('✅ 翻译结果已显示');
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