/**
 * Zalo Translation Script
 * Refactored based on WhatsApp.js patterns
 */

// ========== 全局变量与常量 ==========
console.error("🚀🚀🚀 ZALO SCRIPT STARTING 🚀🚀🚀");
try {
    const div = document.createElement('div');
    div.innerHTML = 'Zalo Script Injected!';
    div.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;background:red;color:white;padding:10px;font-size:20px;font-weight:bold;';
    if (document.body) document.body.appendChild(div);
} catch(e) {}

(function() {
if (window._zalo_injected) return;
window._zalo_injected = true;

// 劫持 console.log 以绕过 Zalo 的屏蔽
const _log = console.warn.bind(console);
const consoleLog = _log; // 将内部所有用到 console.log 的地方如果需要可以改掉，或者直接重写
console.log = console.warn;

let globalConfig = null;
let languages = [];
let processingMessages = new Set();
let previewNode = null;
let lastPreviewedTranslation = '';
let lastPreviewedSource = '';

// DOM 选择器配置 (Zalo Web 增强版)
const SELECTORS = {
    MAIN_PANEL: ['#layout-container', '#main-page','#chatView', '.main-container', 'body'],
    SIDE_PANEL: ['#contact-list', '.contact-list', '#side-nav', '.side-panel', 'aside', '#nav-tab-contact'],
    MESSAGE_INPUT: ['#rich-input', '#richInput', '.chat-input', '[contenteditable="true"]', '#input_pc', '[data-trailer="Zalo"]'],
    SEND_BUTTON: ['[icon*="Sent"]', '[icon="Sent-msg_24_Line"]', '.send-msg-btn', '[title*="Send"]', '[title*="Gửi"]', '[translate-title*="SEND"]', '.btn-send-msg', '.send-btn', 'button.btn-send', '.chat-input__send-btn', '[zalo-test-id="send-btn"]', '.fa-paper-plane-o', '.it-send-msg', '.fa-Sent-msg_24_Line'],
    INCOMING_MSG: ['.msg-item.fan-receiver', '.message-in', '.msg-info-received', '[class*="msg-item"][class*="receiver"]'],
    OUTGOING_MSG: ['.msg-item.fan-sender', '.message-out', '.msg-info-sent', '[class*="msg-item"][class*="sender"]'],
    MSG_TEXT_SPAN: ['.text', '.message-text', '.content-text', '.msg-content', '.plain-text', 'div[class*="content"] > span'],
    CONVERSATION_LIST_ITEM: ['.conv-item', '.contact-item', '[class*="item"]', '.list-item', '.chat-item']
};

/**
 * 通用选择器查找工具 (尝试多个选择器)
 */
function querySelectorAny(selectors, context = document) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const s of list) {
        const el = context.querySelector(s);
        if (el) return el;
    }
    return null;
}

/**
 * 通用选择器查找工具 (查询所有)
 */
function querySelectorAllAny(selectors, suffix = '') {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const results = [];
    const seen = new Set();
    for (const s of list) {
        const nodes = document.querySelectorAll(s + suffix);
        nodes.forEach(node => {
            if (!seen.has(node)) {
                results.push(node);
                seen.add(node);
            }
        });
    }
    return results;
}

// ========== 基础工具函数 ==========

/**
 * 文本归一化
 */
function normalizeText(text) {
    if (!text) return '';
    return text.trim()
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, '\n')
        .replace(/\s+/g, ' ');
}

// ========== IndexedDB 持久化模块 ==========

/**
 * 打开或创建已发送消息数据库
 */
function openSentMessagesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ZaloSentMessagesDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('sentMessages')) {
                const store = db.createObjectStore('sentMessages', { keyPath: 'translatedText' });
                store.createIndex('originalText', 'originalText', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(`SentDB Error: ${e.target.errorCode}`);
    });
}

/**
 * 保存已发送消息原文
 */
async function saveSentMessage(translatedText, originalText) {
    try {
        const db = await openSentMessagesDB();
        const transaction = db.transaction(['sentMessages'], 'readwrite');
        const store = transaction.objectStore('sentMessages');
        return new Promise((resolve, reject) => {
            const request = store.put({
                translatedText,
                originalText,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('❌ [Zalo] 保存已发送记录失败:', e);
    }
}

/**
 * 根据译文获取原文
 */
async function getSentMessage(translatedText) {
    try {
        const db = await openSentMessagesDB();
        const transaction = db.transaction(['sentMessages'], 'readonly');
        const store = transaction.objectStore('sentMessages');
        return new Promise((resolve, reject) => {
            const request = store.get(translatedText);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('❌ [Zalo] 获取已发送记录失败:', e);
        return null;
    }
}

/**
 * 打开或创建翻译缓存数据库
 */
function openTranslationCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ZaloTranslationCacheDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('translationCache')) {
                const store = db.createObjectStore('translationCache', { keyPath: 'cacheKey' });
                store.createIndex('originalText', 'originalText', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(`CacheDB Error: ${e.target.errorCode}`);
    });
}

/**
 * 获取缓存键
 */
function generateCacheKey(text, fromLang, toLang) {
    return `${fromLang}_${toLang}_${text}`;
}

/**
 * 保存翻译到缓存
 */
async function saveTranslationCache(originalText, translatedText, fromLang, toLang) {
    try {
        const db = await openTranslationCacheDB();
        const transaction = db.transaction(['translationCache'], 'readwrite');
        const store = transaction.objectStore('translationCache');
        const normalizedOriginal = normalizeText(originalText);
        const cacheKey = generateCacheKey(normalizedOriginal, fromLang, toLang);
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                cacheKey,
                originalText: normalizedOriginal,
                translatedText,
                fromLang,
                toLang,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('❌ [Zalo] 保存翻译缓存失败:', e);
    }
}

/**
 * 从缓存获取翻译
 */
async function getTranslationCache(originalText, fromLang, toLang) {
    try {
        const db = await openTranslationCacheDB();
        const transaction = db.transaction(['translationCache'], 'readonly');
        const store = transaction.objectStore('translationCache');
        const normalizedOriginal = normalizeText(originalText);
        const cacheKey = generateCacheKey(normalizedOriginal, fromLang, toLang);
        
        return new Promise((resolve, reject) => {
            const request = store.get(cacheKey);
            request.onsuccess = (e) => resolve(e.target.result?.translatedText || null);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('❌ [Zalo] 获取翻译缓存失败:', e);
        return null;
    }
}

// ========== 基础配置与语言函数 ==========

/**
 * 获取本地语言 (用户母语)
 */
function getLocalLanguage() {
    return globalConfig?.receiveTargetLang || localStorage.getItem('localLanguage-zl') || 'zh';
}

/**
 * 获取对方语言 (发送目标语言)
 */
function getTargetLanguage() {
    return globalConfig?.sendTargetLang || localStorage.getItem('targetLanguage-zl') || 'en';
}

/**
 * 延迟函数
 */
const delay = ms => new Promise(res => setTimeout(res, ms));

// ========== 配置同步模块 ==========

/**
 * 同步全局配置
 */
async function syncGlobalConfig() {
    try {
        const config = await window.electronAPI.getTranslateConfig();
        if (config) {
            globalConfig = { ...config };
            console.log('🔄 [Zalo] 全局配置同步:', globalConfig);
        }
    } catch (e) {
        console.error('❌ [Zalo] 同步全局配置失败:', e);
    }
}

/**
 * 初始化语言列表
 */
async function initLanguageList() {
    try {
        const response = await window.electronAPI.languageList();
        if (response && response.data) {
            languages = response.data;
            console.log('🌐 [Zalo] 语言列表加载完成:', languages.length);
        }
    } catch (e) {
        console.error('❌ [Zalo] 加载语言列表失败:', e);
    }
}

// ========== 状态上报与采集模块 (对标 WhatsApp) ==========

/**
 * 获取未读计数
 */
function getUnreadCount() {
    let titleCount = 0;
    let domCount = 0;
    try {
        // 1. 从标题获取 (数字) Zalo
        const title = document.title;
        const match = title.match(/\((\d+)\)/);
        if (match && match[1]) {
            titleCount = parseInt(match[1], 10);
        }

        // 2. 从 DOM 获取 (侧边栏红色徽标)
        const badges = document.querySelectorAll('.v2-badge, .tab-unread, .nav-item-unread');
        badges.forEach(badge => {
            const val = parseInt(badge.textContent || '', 10);
            if (!isNaN(val)) domCount += val;
        });
    } catch (e) {}
    return Math.max(titleCount, domCount);
}

/**
 * 获取账号标识 (Zalo 手机号或 ID)
 */
function getMyId() {
    try {
        // 尝试从本地存储或 DOM 提取
        return localStorage.getItem('last_user_id') || '';
    } catch (e) {
        return '';
    }
}

/**
 * 启动状态心跳
 */
function startStatusHeartbeat() {
    console.log('💓 [Zalo] 启动状态上报心跳...');
    setInterval(() => {
        const isLogged = !!querySelectorAny(SELECTORS.SIDE_PANEL) || !!querySelectorAny(SELECTORS.MESSAGE_INPUT);
        
        if (isLogged) {
            // 尝试获取头像
            const avatarImg = document.querySelector('.my-avatar img, .setting-info img, img[src*="avatar"]');
            const avatarUrl = avatarImg?.src || '';
            const myId = getMyId();
            const unreadCount = getUnreadCount();

            window.electronAPI.sendMsg({
                platform: 'Zalo',
                online: true,
                avatarUrl: avatarUrl,
                myPhone: myId,
                unreadCount: unreadCount
            }).then(res => {
                console.log('🚀 [Zalo] 状态上报（在线）:', { unreadCount, myId });
            });
        } else {
            window.electronAPI.sendMsg({
                platform: 'Zalo',
                online: false,
                avatarUrl: '',
                myPhone: '',
                unreadCount: 0
            }).then(res => {
                console.log('🚀 [Zalo] 状态上报（离线）');
            });
        }
    }, 5000);
}

// ========== 核心工具函数实现 ==========

/**
 * 翻译文本 API
 */
async function translateTextAPI(text, from, target) {
    try {
        const args = {
            local: from,
            target: target,
            text: text,
        };
        return await window.electronAPI.translateText(args);
    } catch (e) {
        console.error('❌ [Zalo] API 调用异常:', e);
        return { success: false, msg: e.message };
    }
}

/**
 * 生成翻译结果节点 (对标 WhatsApp 样式)
 */
function createTranslationNode(translatedText, isManual = false) {
    const translationNode = document.createElement('div');
    translationNode.className = 'translation-result';
    translationNode.style.cssText = `
        display: block;
        font-size: 13px;
        color: #0084ff;
        border-top: 1px dashed #ccc;
        padding-top: 4px;
        margin-top: 4px;
        font-style: italic;
        word-break: break-word;
    `;
    translationNode.textContent = translatedText;
    return translationNode;
}

/**
 * 添加手动翻译按钮
 */
function addManualTranslateIcon(container, originalText) {
    if (container.querySelector('.zl-translate-icon')) return;

    const icon = document.createElement('span');
    icon.className = 'zl-translate-icon';
    icon.style.cssText = `
        display: inline-flex;
        cursor: pointer;
        margin-left: 5px;
        color: #0084ff;
        vertical-align: middle;
        opacity: 0.7;
    `;
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>`;
    
    icon.onclick = async (e) => {
        e.stopPropagation();
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.5s';
        
        const res = await translateTextAPI(originalText, getTargetLanguage(), getLocalLanguage());
        if (res && res.success) {
            const node = createTranslationNode(res.data, true);
            container.appendChild(node);
            await saveTranslationCache(originalText, res.data, getTargetLanguage(), getLocalLanguage());
            icon.remove();
        }
    };
    container.appendChild(icon);
}

// ========== 发送消息模块 (对标 WhatsApp) ==========

// ========== 发送消息模块 (对标 WhatsApp) ==========

/**
 * 触发 Zalo 发送按钮点击 (终极增强版)
 */
/**
 * 触发 Zalo 发送按钮点击 (终极鲁棒版 v3)
 */
/**
 * 触发 Zalo 发送按钮点击 (终极鲁棒版 v4)
 */
function sendMsg() {
    console.log('🚀 [Zalo] 开始尝试激发发送...');
    
    // 1. 尝试从全局选择器池中查找
    // let btn = querySelectorAny(SELECTORS.SEND_BUTTON);
     let btn = document.querySelector('#chat-box-input-container-id div[icon="Sent-msg_24_Line"]')?.parentNode;
    console.log('🚀 [Zalo] 开始尝试激发发送按钮...1',btn );
    // 2. 尝试从特定的输入容器内查找 (修正类名: .chat-input-container)
    if (!btn) {
        const footers = document.querySelectorAll('.chat-input-container, #chat-input-container, footer');
        for (const f of footers) {
            btn = f.querySelector('[icon*="Sent"]') || f.querySelector('.send-msg-btn') || f.querySelector('[title*="Send"]');
            console.log('🚀 [Zalo] 开始尝试激发发送按钮...2',btn );
            if (btn) break;
        }
    }
    
    // 3. 全局特征扫描兜底 (包含图标类名溯源)
    if (!btn) {
        console.log('🔍 [Zalo] 局部扫描未命中，启动全局深度特征扫描...');
        const candidates = document.querySelectorAll('div, button, span, i, svg');
        const keywords = ['Gửi', '发送', 'Send'];
        for (const c of candidates) {
            const txt = c.innerText?.trim() || '';
            const title = c.getAttribute('title')?.trim() || '';
            const label = c.getAttribute('aria-label')?.trim() || '';
            const iconAttr = c.getAttribute('icon')?.trim() || '';
            const cls = c.className || '';
            
            if (keywords.includes(txt) || keywords.includes(title) || keywords.includes(label) || 
                iconAttr.includes('Sent') || cls.includes('Sent-msg')) {
                    console.log('🚀 [Zalo] 开始尝试激发发送按钮...3',btn );
                btn = c;
                break;
            }
        }
    }
    console.log('🚀 [Zalo] 存在发送按钮',btn );
    if (btn) {
        // 自动向上寻找真正的点击容器 (button 或 role="button")
        const actualBtn = btn.closest('button, div[role="button"]') || btn;
        console.log('✅ [Zalo] 已定位发送按钮:', {
            foundNode: btn.tagName,
            foundClass: btn.className,
            clickTarget: actualBtn.tagName
        });
        
        // 执行物理点击
        actualBtn.click();
        
        // 补全交互序列
        actualBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        actualBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        
    } else {
        console.warn('⚠️ [Zalo] 深度探测后仍未找到发送按钮，激活全周期 Enter 仿真发送');
        const input = querySelectorAny(SELECTORS.MESSAGE_INPUT);
        if (input) {
            const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
            input.dispatchEvent(new KeyboardEvent('keydown', opts));
            input.dispatchEvent(new KeyboardEvent('keypress', opts));
            input.dispatchEvent(new KeyboardEvent('keyup', opts));
        }
    }
}

/**
 * 显示/隐藏“翻译中”状态
 */
function toggleTranslatingStatus(show) {
    let statusNode = document.getElementById('zlTranslatingStatus');
    if (show) {
        if (!statusNode) {
            statusNode = document.createElement('span');
            statusNode.id = 'zlTranslatingStatus';
            statusNode.style.cssText = `
                color: #0084ff;
                font-size: 13px;
                margin-left: 10px;
                display: flex;
                align-items: center;
                gap: 5px;
                animation: zlFadeIn 0.3s ease;
            `;
            statusNode.innerHTML = `
                <svg class="zl-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation: zlRotate 1s linear infinite;">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>正在翻译...</span>
            `;
            
            // 注入动画样式
            if (!document.getElementById('zlStatusStyles')) {
                const style = document.createElement('style');
                style.id = 'zlStatusStyles';
                style.textContent = `
                    @keyframes zlRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes zlFadeIn { from { opacity: 0; } to { opacity: 1; } }
                `;
                document.head.appendChild(style);
            }

            const leftLayout = document.querySelector('.chat-input-container__left-layout');
            if (leftLayout) {
                leftLayout.appendChild(statusNode);
            }
        }
        statusNode.style.display = 'flex';
    } else {
        if (statusNode) statusNode.style.display = 'none';
    }
}

/**
 * 更新预览 UI
 */
function updatePreviewUI(text) {
    if (!previewNode) {
        previewNode = document.createElement('div');
        previewNode.id = 'zlTranslationPreviewNode';
        previewNode.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            color: #1c1e21;
            padding: 10px;
            font-size: 13px;
            border: 1px solid #0084ff;
            border-bottom: none;
            border-radius: 8px 8px 0 0;
            z-index: 999;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
            display: none;
        `;
        const footer = document.querySelector('.chat-input-container') || 
                       querySelectorAny(SELECTORS.MESSAGE_INPUT)?.parentElement;
        if (footer) {
            footer.style.position = 'relative';
            footer.appendChild(previewNode);
        }
    }

    if (text) {
        previewNode.innerHTML = `
            <div style="font-weight: bold; color: #0084ff; margin-bottom: 4px;">译文预览:</div>
            <div>${text}</div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">按 Enter 发送，修改清空</div>
        `;
        previewNode.style.display = 'block';
    } else {
        previewNode.style.display = 'none';
    }
}

/**
 * 执行翻译流程 (核心劫持逻辑)
 */
async function executeTranslationFlow(inputText) {
    try {
        console.log('🔄 [Zalo] 开始翻译流程:', inputText);
        
        // 1. 敏感词检测
        const sensitive = await checkSensitiveContent(inputText);
        if (sensitive?.isSensitive) {
            window.electronAPI.showNotification({ message: `🚫 敏感词拦截: ${sensitive.reason}`, type: 'is-danger' });
            return;
        }

        const isAutoTranslate = globalConfig?.sendAutoTranslate; // 模式 1: 发译文
        const isShowTransBelow = globalConfig?.sendAutoNotTranslate; // 模式 2: 发原文，显译文
           
        // 如果两个都没开，直接发送 (按理说不应该进入此函数)
        if (!isAutoTranslate && !isShowTransBelow) {
            sendMsg();
            return;
        }
       
        // 2. 调用翻译
        toggleTranslatingStatus(true);
        const res = await translateTextAPI(inputText, getLocalLanguage(), getTargetLanguage());
        toggleTranslatingStatus(false);
        
        if (isAutoTranslate) {
            // 模式 1: 组合译文+原文
            let finalInput = inputText;
            let success = false;
            if (res && res.success) {
                // finalInput = `${res.data}\n${inputText}`; // 格式：译文 \n 原文
                finalInput = `${res.data}`
                success = true;
            }

            const typResult = await window.electronAPI.simulateTyping({
                text: finalInput,
                clearFirst: true
            });

            if (typResult && typResult.success) {
                if (globalConfig?.translatePreview && success) {
                    updatePreviewUI(finalInput);
                    lastPreviewedTranslation = finalInput;
                    lastPreviewedSource = inputText;
                } else {
                    setTimeout(() => {
                        sendMsg();
                         debugger
                        if (success) saveSentMessage(finalInput, inputText);
                    }, 200);
                }
            }
        } else if (isShowTransBelow) {
            // 模式 2: 直接发送原文，但保存映射用于回显译文
            if (res && res.success) {
                await saveSentMessage(inputText, res.data); // Key=原文(气泡内容), Value=译文(下方显示)
            }
            sendMsg();
        }
    } catch (e) {
        toggleTranslatingStatus(false);
        console.error('❌ [Zalo] 翻译流程异常:', e);
    }
}

/**
 * 处理键盘事件
 */
async function handleKeyDown(e) {
    // 仅处理 Enter 且不带 Shift

    if (e.key === 'Enter' && !e.shiftKey) {
        const input = document.querySelector(SELECTORS.MESSAGE_INPUT);
        const text = input?.innerText?.trim();
      
        if (!text) return;

        // 如果处于预览状态且按下 Enter
        if (previewNode && previewNode.style.display === 'block') {
            if (text === lastPreviewedTranslation) {
                e.preventDefault();
                
                sendMsg();
                saveSentMessage(lastPreviewedTranslation, lastPreviewedSource);
                updatePreviewUI(null);
                return;
            } else {
                updatePreviewUI(null);
            }
        }

        // 场景 1 & 2: 劫持发送
        if (globalConfig?.sendAutoTranslate || globalConfig?.sendAutoNotTranslate) {
            e.preventDefault();
            executeTranslationFlow(text);
            return;
        }       
    } else {
        // 输入变化时关闭预览
        if (previewNode?.style.display === 'block') {
            updatePreviewUI(null);
        }
    }
}

/**
 * 绑定输入事件
 */
function bindInputEvents() {
    const input = querySelectorAny(SELECTORS.MESSAGE_INPUT);
    if (input) {
        input.removeEventListener('keydown', handleKeyDown);
        input.addEventListener('keydown', handleKeyDown);
        console.log('✅ [Zalo] 输入框事件已重新绑定');
    }
}

/**
 * 敏感词检测
 */
async function checkSensitiveContent(text) {
    try {
        const config = await window.electronAPI.getTranslateConfig();
        const res = await window.electronAPI.checkSensitiveContent({ 
            content: text, 
            tenantConfig: config 
        });
        return res?.success && res.data ? res.data : { isSensitive: false };
    } catch (e) {
        console.error('❌ [Zalo] 敏感词检测失败:', e);
        return { isSensitive: false };
    }
}

/**
 * 恢复已发送消息的原文显示
 */
async function restoreSentMessageOriginals() {
    const sentItems = querySelectorAllAny(SELECTORS.OUTGOING_MSG, ':not([data-zl-restored])');
    
    for (let msgContainer of sentItems) {
        const actualTextSpan = querySelectorAny(SELECTORS.MSG_TEXT_SPAN, msgContainer);
        if (!actualTextSpan) continue;

        const clone = actualTextSpan.cloneNode(true);
        const msgText = normalizeText(clone.innerText || clone.textContent);
        if (!msgText) continue;

        const record = await getSentMessage(msgText);
        if (record && record.originalText) {
            // 如果译文本身就包含了原文（例如“译文\n原文”格式），则不重复添加
            if (msgText.includes(normalizeText(record.originalText))) {
                msgContainer.setAttribute('data-zl-restored', 'already-included');
                continue;
            }
            
            if (!actualTextSpan.querySelector('.original-text-result')) {
                const node = document.createElement('div');
                node.className = 'original-text-result';
                node.style.cssText = `
                    display: block;
                    font-size: 13px;
                    color: #727272;
                    border-top: 1px dashed #ccc;
                    padding-top: 4px;
                    margin-top: 4px;
                    font-style: italic;
                `;
                node.textContent = record.originalText;
                actualTextSpan.appendChild(node);
            }
            msgContainer.setAttribute('data-zl-restored', 'true');
        } else {
            msgContainer.setAttribute('data-zl-restored', 'checked');
        }
    }
}

// ========== 接收消息翻译模块 ==========

/**
 * 扫描消息列表并翻译
 */
async function processMessageList() {
    // 1. 恢复发送消息的原文/译文状态
    await restoreSentMessageOriginals();

    // 2. 处理接收消息
    const incomingItems = querySelectorAllAny(SELECTORS.INCOMING_MSG, ':not([data-zl-trans])');
    
    for (let msgContainer of incomingItems) {
        // 防止由于异步导致的重复处理
        if (msgContainer.getAttribute('data-zl-trans')) continue;
        msgContainer.setAttribute('data-zl-trans', 'processing');

        const textSpan = querySelectorAny(SELECTORS.MSG_TEXT_SPAN, msgContainer);
        if (!textSpan) {
            msgContainer.setAttribute('data-zl-trans', 'no-text');
            continue;
        }

        const originalText = normalizeText(textSpan.innerText || textSpan.textContent);
        if (!originalText || originalText.length < 1) {
            msgContainer.setAttribute('data-zl-trans', 'empty');
            continue;
        }

        try {
            const fromLang = getTargetLanguage(); 
            const toLang = getLocalLanguage();    
            
            // 优先查询缓存
            let cachedResult = await getTranslationCache(originalText, fromLang, toLang);
            
            if (cachedResult) {
                const node = createTranslationNode(cachedResult);
                textSpan.appendChild(node);
                msgContainer.setAttribute('data-zl-trans', 'cached');
            } else if (globalConfig?.receiveAutoTranslate) {
                // 执行自动翻译
                const res = await translateTextAPI(originalText, fromLang, toLang);
                if (res && res.success) {
                    const node = createTranslationNode(res.data);
                    textSpan.appendChild(node);
                    await saveTranslationCache(originalText, res.data, fromLang, toLang);
                    msgContainer.setAttribute('data-zl-trans', 'done');
                } else {
                    addManualTranslateIcon(textSpan, originalText);
                    msgContainer.setAttribute('data-zl-trans', 'manual-ready');
                }
            } else {
                // 未开启自动翻译，提供手动按钮
                addManualTranslateIcon(textSpan, originalText);
                msgContainer.setAttribute('data-zl-trans', 'manual-only');
            }
        } catch (e) {
            console.error('❌ [Zalo] 翻译处理失败:', e);
            msgContainer.setAttribute('data-zl-trans', 'error');
        }
    }
}

/**
 * 监控会话切换 (全局兜底版)
 */
function monitorConversationChange() {
    console.log('👀 [Zalo] 启动全局会话切换监控...');
    
    // 直接在 body 上监听点击，以应对动态变化的侧边栏
    document.body.addEventListener('click', async (e) => {
        const selectors = SELECTORS.CONVERSATION_LIST_ITEM.join(',');
        const item = e.target.closest(selectors);
        if (item) {
            console.log('👥 [Zalo] 检测到可能的会话切换点击');
            updatePreviewUI(null);
            // 给 Zalo 渲染时间，然后尝试重新绑定输入框
            for (let t of [300, 800, 1500]) {
                await delay(t);
                bindInputEvents();
            }
            return;
        }

        // --- 劫持发送按钮点击 ---
        let sendBtn = null;
        for (const s of SELECTORS.SEND_BUTTON) {
            if (e.target.matches(s) || e.target.closest(s)) {
                sendBtn = e.target.closest(s) || e.target;
                break;
            }
        }

        if (sendBtn) {
            const input = querySelectorAny(SELECTORS.MESSAGE_INPUT);
            const text = input?.innerText?.trim();
            
            if (text && (globalConfig?.sendAutoTranslate || globalConfig?.sendAutoNotTranslate)) {
                // 如果是预览确认状态
                if (previewNode?.style.display === 'block' && text === lastPreviewedTranslation) {
                    console.log('✅ [Zalo] 预览已确认，放行发送');
                    lastPreviewedTranslation = '';
                    lastPreviewedSource = '';
                    updatePreviewUI(null);
                    return; 
                }
                
                console.log('🚫 [Zalo] 拦截发送按钮点击，启动翻译流程...');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                executeTranslationFlow(text);
            }
        }
    }, true);

    // 依然周期性尝试寻找侧边栏，仅用于日志建议
    let found = false;
    const checkSide = setInterval(() => {
        if (querySelectorAny(SELECTORS.SIDE_PANEL)) {
            console.log('✅ [Zalo] 已定位到侧边栏节点');
            found = true;
            clearInterval(checkSide);
        }
    }, 5000);
    setTimeout(() => { if(!found) clearInterval(checkSide); }, 30000);
}

// ========== 核心初始化逻辑 ==========

/**
 * 初始化 Zalo 特性
 */
async function initZaloFeatures() {
    console.log('🚀 [Zalo] 正在初始化翻译特性...');
    
    await syncGlobalConfig();
    await initLanguageList();
    
    // 1. 扫描右侧消息流
    setInterval(processMessageList, 1000);

    // 2. 监听会话切换，动态绑定输入监听
    monitorConversationChange();
    
    // 3. 初始绑定
    bindInputEvents();
    
    // 4. 定时同步配置
    setInterval(syncGlobalConfig, 10000);

    // 5. 启动状态上报
    startStatusHeartbeat();

    console.log('✅ [Zalo] 翻译特性初始化完成');
}

/**
 * 监控主节点加载 (增强版)
 */
function monitorMainNode() {
    console.log('👀 [Zalo] 正在深度监控主界面加载...');
    const startTime = Date.now();
    const timeout = 60000;

    const checkTimer = setInterval(() => {
        // 对于 Zalo，只要有 body 且不是空的，其实就可以尝试初始化
        const mainNode = querySelectorAny(SELECTORS.MAIN_PANEL);
        const hasInput = querySelectorAny(SELECTORS.MESSAGE_INPUT);
        
        if (mainNode || hasInput) {
            clearInterval(checkTimer);
            console.log('✅ [Zalo] 探测到主界面节点:', mainNode?.tagName || 'InputFound');
            initZaloFeatures();
        } else if (Date.now() - startTime > timeout) {
            clearInterval(checkTimer);
            console.warn('⚠️ [Zalo] 探测超时，强制启动初始化流程');
            initZaloFeatures();
        }
    }, 1500);
}

// 启动
monitorMainNode();
console.log('Zalo');
})();

