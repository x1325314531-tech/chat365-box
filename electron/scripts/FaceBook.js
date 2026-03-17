/**
 * FaceBook Messenger Translation & Management Script
 * Aligned with WhatsApp.js & Zalo.js patterns
 */

// ========== 全局变量与常量 ==========
let globalConfig = null;
let languages = [];
let previewNode = null;
let lastPreviewedTranslation = '';
let lastPreviewedSource = '';

// DOM 选择器配置 (Facebook Messenger 增强版)
const SELECTORS = {
    MAIN_PANEL: ['[role="main"]', '.x78zum5.x1q0g3np.x1a02dak', 'body'],
    SIDE_PANEL: ['[role="navigation"]', '[aria-label="Chats"]', '[role="grid"]'],
    MESSAGE_INPUT: ['[role="textbox"][contenteditable="true"]', '[aria-label="Message"]'],
    SEND_BUTTON: ['[aria-label="Send"]', '[aria-label="Press enter to send"]', 'svg[aria-label*="Send"]'],
    INCOMING_MSG: ['[data-testid="message-container"]:not(.x78zum5.x1q0g3np.x1a02dak)', '.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6'], 
    OUTGOING_MSG: ['[data-testid="message-container"].x1n2onr6', '.x1n2onr6[role="row"]'],
    MSG_TEXT_SPAN: ['div[dir="auto"]', 'span[dir="auto"]', '.x193iq5w.xeuugli.x13faqbe'],
    CONVERSATION_LIST_ITEM: ['[role="row"]', '[role="gridcell"]', '[aria-label*="Chat with"]']
};

/**
 * 通用选择器查找工具
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
 * 通用选择器查找所有
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

/**
 * 文本归一化
 */
function normalizeText(text) {
    if (!text) return '';
    return text.toString()
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .trim();
}

// ========== IndexedDB 持久化模块 ==========

function openDB(dbName, storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'cacheKey' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(`DB Error: ${dbName} - ${e.target.errorCode}`);
    });
}

/**
 * 保存翻译缓存
 */
async function saveTranslationCache(originalText, translatedText, fromLang, toLang) {
    try {
        const db = await openDB('FBTranslationCacheDB', 'cache');
        const transaction = db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const normOriginal = normalizeText(originalText);
        const cacheKey = `${fromLang}_${toLang}_${normOriginal}`;
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                cacheKey,
                originalText: normOriginal,
                translatedText,
                fromLang,
                toLang,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('❌ [FB] Save cache failed:', e);
    }
}

/**
 * 获取翻译缓存
 */
async function getTranslationCache(originalText, fromLang, toLang) {
    try {
        const db = await openDB('FBTranslationCacheDB', 'cache');
        const transaction = db.transaction(['cache'], 'readonly');
        const store = transaction.objectStore('cache');
        const normOriginal = normalizeText(originalText);
        const cacheKey = `${fromLang}_${toLang}_${normOriginal}`;
        
        return new Promise((resolve, reject) => {
            const request = store.get(cacheKey);
            request.onsuccess = (e) => resolve(e.target.result?.translatedText || null);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        return null;
    }
}

/**
 * 保存已发送消息（用于回显还原）
 */
async function saveSentMessage(translatedText, originalText) {
    try {
        const db = await openDB('FBSentMessagesDB', 'sent');
        const transaction = db.transaction(['sent'], 'readwrite');
        const store = transaction.objectStore('sent');
        const normTranslated = normalizeText(translatedText);
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                cacheKey: normTranslated,
                translatedText: normTranslated,
                originalText,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.error('❌ [FB] Save sent record failed:', e);
    }
}

/**
 * 获取已发送消息的原文
 */
async function getSentMessage(translatedText) {
    try {
        const db = await openDB('FBSentMessagesDB', 'sent');
        const transaction = db.transaction(['sent'], 'readonly');
        const store = transaction.objectStore('sent');
        const normTranslated = normalizeText(translatedText);
        
        return new Promise((resolve, reject) => {
            const request = store.get(normTranslated);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        return null;
    }
}

// ========== 基础配置与同步模块 ==========

function getLocalLanguage() {
    return globalConfig?.receiveTargetLang || localStorage.getItem('localLanguage-fb') || 'zh';
}

function getTargetLanguage() {
    return globalConfig?.sendTargetLang || localStorage.getItem('targetLanguage-fb') || 'en';
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function syncGlobalConfig() {
    try {
        const config = await window.electronAPI.getTranslateConfig();
        if (config) globalConfig = { ...config };
    } catch (e) {
        console.error('❌ [FB] Sync config failed:', e);
    }
}

async function initLanguageList() {
    try {
        const res = await window.electronAPI.languageList();
        if (res?.data) languages = res.data;
    } catch (e) {}
}

async function translateTextAPI(text, from, target) {
    try {
        return await window.electronAPI.translateText({ local: from, target: target, text: text });
    } catch (e) {
        return { success: false, msg: e.message };
    }
}
// ========== 状态上报与采集模块 (Heartbeat) ==========

/**
 * 获取未读计数
 */
function getUnreadCount() {
    let titleCount = 0;
    let domCount = 0;
    try {
        // 1. 标题抓取
        const title = document.title;
        const match = title.match(/\((\d+)\)/);
        if (match) titleCount = parseInt(match[1]);

        // 2. DOM 抓取 (Messenger 特征)
        const unreadNodes = document.querySelectorAll('[aria-label*="unread"], [aria-label*="未读"]');
        unreadNodes.forEach(node => {
            const txt = node.innerText || node.getAttribute('aria-label');
            const num = txt.match(/\d+/);
            if (num) domCount += parseInt(num[0]);
        });
    } catch (e) {}
    return Math.max(titleCount, domCount);
}

/**
 * 状态心跳
 */
function startStatusHeartbeat() {
    console.log('💓 [FB] Heartbeat started...');
    setInterval(async () => {
        const isLogged = !!querySelectorAny(SELECTORS.SIDE_PANEL) || !!querySelectorAny(SELECTORS.MESSAGE_INPUT);
        
        if (isLogged) {
            const unread = getUnreadCount();
            const avatar = document.querySelector('image, img[src*="profile"], [role="img"] img')?.src || '';
            const myId = localStorage.getItem('last_user_id') || ''; // 兜底方案

            window.electronAPI.sendMsg({
                platform: 'FaceBook',
                online: true,
                avatarUrl: avatar,
                myPhone: myId,
                unreadCount: unread
            });
        } else {
            window.electronAPI.sendMsg({ platform: 'FaceBook', online: false });
        }
    }, 5000);
}

// ========== UI 交互增强模块 ==========

/**
 * 显示/隐藏“翻译中”状态
 */
function toggleTranslatingStatus(show) {
    let statusNode = document.getElementById('fbTranslatingStatus');
    if (show) {
        if (!statusNode) {
            statusNode = document.createElement('div');
            statusNode.id = 'fbTranslatingStatus';
            statusNode.style.cssText = `
                display: flex; align-items: center; gap: 6px; color: #0084ff;
                font-size: 13px; margin: 5px 10px; font-weight: 500;
            `;
            statusNode.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" style="animation: fb-spin 1s linear infinite;">
                    <circle cx="12" cy="12" r="10"></circle><path d="M12 2 a10 10 0 0 1 10 10"></path>
                </svg>
                <span>正在翻译...</span>
                <style>@keyframes fb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
            `;
            const inputArea = querySelectorAny(SELECTORS.MESSAGE_INPUT)?.closest('.x78zum5.xdt5ytf.x1iyjqo2');
            if (inputArea) inputArea.parentElement.insertBefore(statusNode, inputArea);
        }
        statusNode.style.display = 'flex';
    } else if (statusNode) {
        statusNode.style.display = 'none';
    }
}

/**
 * 预览预览 UI
 */
function updatePreviewUI(text) {
    if (!previewNode) {
        previewNode = document.createElement('div');
        previewNode.id = 'fbTranslationPreview';
        previewNode.style.cssText = `
            background: #f0f7ff; color: #0084ff; padding: 10px; border-radius: 8px;
            margin: 5px 10px; font-size: 13px; border: 1px dashed #0084ff; display: none;
        `;
        const container = querySelectorAny(SELECTORS.MESSAGE_INPUT)?.parentElement;
        if (container) container.insertBefore(previewNode, container.firstChild);
    }

    if (text) {
        previewNode.innerHTML = `<strong>预览:</strong> ${text}<div style="font-size:11px; color:#888; margin-top:2px;">按 Enter 发送</div>`;
        previewNode.style.display = 'block';
    } else {
        previewNode.style.display = 'none';
    }
}

/**
 * 模拟打字发送
 */
async function sendMsg() {
    const btn = querySelectorAny(SELECTORS.SEND_BUTTON);
    if (btn) {
        btn.click();
    } else {
        const input = querySelectorAny(SELECTORS.MESSAGE_INPUT);
        if (input) {
            const e = { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true };
            input.dispatchEvent(new KeyboardEvent('keydown', e));
        }
    }
}

/**
 * 敏感词检测
 */
async function checkSensitiveContent(text) {
    try {
        const config = await window.electronAPI.getTranslateConfig();
        const res = await window.electronAPI.checkSensitiveContent({ content: text, tenantConfig: config });
        return res?.success && res.data ? res.data : { isSensitive: false };
    } catch (e) {
        return { isSensitive: false };
    }
}

/**
 * 执行翻译流程 (核心劫持逻辑)
 */
async function executeTranslationFlow(inputText) {
    try {
        console.log('🔄 [FB] Starting translation flow:', inputText);
        
        // 1. 敏感词检测
        const sensitive = await checkSensitiveContent(inputText);
        if (sensitive?.isSensitive) {
            window.electronAPI.showNotification({ message: `🚫 Sensitive Intercepted: ${sensitive.reason}`, type: 'is-danger' });
            return;
        }

        if (!globalConfig?.sendAutoTranslate) {
            sendMsg();
            return;
        }

        // 2. 调用翻译
        toggleTranslatingStatus(true);
        const res = await translateTextAPI(inputText, getLocalLanguage(), getTargetLanguage());
        toggleTranslatingStatus(false);
        
        // 3. 组合发送格式
        let finalInput = inputText;
        let success = false;
        if (res && res.success) {
            finalInput = `${res.data}\n${inputText}`; // 译文\n原文
            success = true;
        }

        const typResult = await window.electronAPI.simulateTyping({
            text: finalInput,
            clearFirst: true
        });

        if (typResult?.success) {
            if (globalConfig?.translatePreview && success) {
                updatePreviewUI(finalInput);
                lastPreviewedTranslation = finalInput;
                lastPreviewedSource = inputText;
            } else {
                setTimeout(() => {
                    sendMsg();
                    if (success) saveSentMessage(finalInput, inputText);
                }, 200);
            }
        }
    } catch (e) {
        toggleTranslatingStatus(false);
        console.error('❌ [FB] Translation flow error:', e);
    }
}

/**
 * 处理键盘事件
 */
async function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        const input = querySelectorAny(SELECTORS.MESSAGE_INPUT);
        const text = input?.innerText?.trim() || input?.textContent?.trim();
        if (!text) return;

        // 如果处于预览状态且再次 Enter
        if (previewNode?.style.display === 'block' && text === lastPreviewedTranslation) {
            e.preventDefault();
            sendMsg();
            saveSentMessage(lastPreviewedTranslation, lastPreviewedSource);
            updatePreviewUI(null);
            return;
        }

        if (globalConfig?.sendAutoTranslate) {
            e.preventDefault();
            executeTranslationFlow(text);
        }
    } else if (previewNode?.style.display === 'block') {
        updatePreviewUI(null);
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
    }
}

/**
 * 生成翻译结果节点
 */
function createTranslationNode(translatedText) {
    const node = document.createElement('div');
    node.className = 'fb-translation-result';
    node.style.cssText = `
        display: block; font-size: 13px; color: #0084ff; border-top: 1px dashed #ccc;
        padding-top: 4px; margin-top: 4px; font-style: italic; word-break: break-word;
    `;
    node.textContent = translatedText;
    return node;
}

/**
 * 添加手动翻译按钮
 */
function addManualTranslateIcon(container, originalText) {
    if (container.querySelector('.fb-translate-icon')) return;

    const icon = document.createElement('span');
    icon.className = 'fb-translate-icon';
    icon.style.cssText = `
        display: inline-flex; cursor: pointer; margin-left: 5px;
        color: #0084ff; vertical-align: middle; opacity: 0.7;
    `;
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"></path></svg>`;
    
    icon.onclick = async (e) => {
        e.stopPropagation();
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.5s';
        
        const res = await translateTextAPI(originalText, getTargetLanguage(), getLocalLanguage());
        if (res && res.success) {
            container.appendChild(createTranslationNode(res.data));
            await saveTranslationCache(originalText, res.data, getTargetLanguage(), getLocalLanguage());
            icon.remove();
        }
    };
    container.appendChild(icon);
}

/**
 * 恢复已发送消息的原文/译文显示
 */
async function restoreSentMessageOriginals() {
    const sentItems = querySelectorAllAny(SELECTORS.OUTGOING_MSG, ':not([data-fb-restored])');
    
    for (let msgContainer of sentItems) {
        const textSpan = querySelectorAny(SELECTORS.MSG_TEXT_SPAN, msgContainer);
        if (!textSpan) continue;

        const msgText = normalizeText(textSpan.innerText || textSpan.textContent);
        if (!msgText) {
            msgContainer.setAttribute('data-fb-restored', 'empty');
            continue;
        }

        // 检查是否已经包含了组合信息 (译文\n原文)
        if (msgText.includes('\n')) {
             msgContainer.setAttribute('data-fb-restored', 'already-combined');
             continue;
        }

        const record = await getSentMessage(msgText);
        if (record && record.originalText) {
            if (!textSpan.querySelector('.fb-original-text')) {
                const node = document.createElement('div');
                node.className = 'fb-original-text';
                node.style.cssText = `display: block; font-size: 13px; color: #727272; border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 4px; font-style: italic;`;
                node.textContent = record.originalText;
                textSpan.appendChild(node);
            }
            msgContainer.setAttribute('data-fb-restored', 'true');
        } else {
            msgContainer.setAttribute('data-fb-restored', 'checked');
        }
    }
}

/**
 * 扫描接收消息并翻译
 */
async function processMessageList() {
    await restoreSentMessageOriginals();

    const incomingItems = querySelectorAllAny(SELECTORS.INCOMING_MSG, ':not([data-fb-trans])');
    
    for (let msgContainer of incomingItems) {
        const textSpan = querySelectorAny(SELECTORS.MSG_TEXT_SPAN, msgContainer);
        if (!textSpan) continue;

        const originalText = normalizeText(textSpan.innerText || textSpan.textContent);
        if (!originalText) {
            msgContainer.setAttribute('data-fb-trans', 'skipped-empty');
            continue;
        }

        msgContainer.setAttribute('data-fb-trans', 'processing');

        try {
            const fromLang = getTargetLanguage();
            const toLang = getLocalLanguage();
            
            let translated = await getTranslationCache(originalText, fromLang, toLang);
            
            if (translated) {
                textSpan.appendChild(createTranslationNode(translated));
                msgContainer.setAttribute('data-fb-trans', 'cached');
            } else if (globalConfig?.receiveAutoTranslate) {
                const res = await translateTextAPI(originalText, fromLang, toLang);
                if (res && res.success) {
                    textSpan.appendChild(createTranslationNode(res.data));
                    await saveTranslationCache(originalText, res.data, fromLang, toLang);
                    msgContainer.setAttribute('data-fb-trans', 'translated');
                } else {
                    addManualTranslateIcon(textSpan, originalText);
                    msgContainer.setAttribute('data-fb-trans', 'failed');
                }
            } else {
                addManualTranslateIcon(textSpan, originalText);
                msgContainer.setAttribute('data-fb-trans', 'manual');
            }
        } catch (e) {
            msgContainer.setAttribute('data-fb-trans', 'error');
        }
    }
}

/**
 * 监听全局 DOM 变化
 */
function initGlobalDomObserver() {
    console.log('👀 [FB] Start Global DOM Observer...');
    const observer = new MutationObserver(async (mutations) => {
        let hasNewMsg = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                hasNewMsg = true;
                break;
            }
        }
        if (hasNewMsg) {
             processMessageList();
             bindInputEvents();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * 监听会话切换
 */
function monitorConversationChange() {
    document.body.addEventListener('click', async (e) => {
        const item = e.target.closest(SELECTORS.CONVERSATION_LIST_ITEM.join(','));
        if (item) {
            updatePreviewUI(null);
            setTimeout(bindInputEvents, 1000);
        }

        // 拦截发送按钮
        const sendBtn = e.target.closest(SELECTORS.SEND_BUTTON.join(','));
        if (sendBtn) {
            const input = querySelectorAny(SELECTORS.MESSAGE_INPUT);
            const text = input?.innerText?.trim() || input?.textContent?.trim();
            if (text && globalConfig?.sendAutoTranslate) {
                if (previewNode?.style.display === 'block' && text === lastPreviewedTranslation) return;
                e.preventDefault();
                e.stopPropagation();
                executeTranslationFlow(text);
            }
        }
    }, true);
}

/**
 * 初始化 FB 特性
 */
async function initFBFeatures() {
    console.log('🚀 [FB] Initializing features...');
    await syncGlobalConfig();
    await initLanguageList();
    
    startStatusHeartbeat();
    initGlobalDomObserver();
    monitorConversationChange();
    bindInputEvents();
    
    setInterval(processMessageList, 2000);
    setInterval(syncGlobalConfig, 10000);
}

/**
 * 监控主节点加载
 */
function monitorMainNode() {
    const checkTimer = setInterval(() => {
        const mainNode = querySelectorAny(SELECTORS.MAIN_PANEL);
        if (mainNode) {
            clearInterval(checkTimer);
            initFBFeatures();
        }
    }, 1500);
}

// 启动
monitorMainNode();
