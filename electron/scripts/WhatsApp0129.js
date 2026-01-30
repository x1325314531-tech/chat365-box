// whatsapp-content.js

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
        console.log('🔄 开始翻译流程');

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

        // 替换输入框内容
        // 替换输入框内容
        let editableDiv = document.querySelector('footer div[aria-owns="emoji-suggestion"][contenteditable="true"]');
        if (editableDiv) {
            // 聚焦输入框
            editableDiv.focus();
                  
            // 全选并删除原有内容 (更彻底的清除方式)
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);

            // 使用 execCommand 模拟输入，触发 React 状态更新
            // 对于长文本，insertText 有时更可靠
            document.execCommand('insertText', false, translatedText);
            
            // 再次触发 input 事件以确保万无一失
            // editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // 移除加载状态
        operationNode('remove', loadingNode);

        // 延迟发送，让用户看到翻译结果
        setTimeout(() => {
            sendMsg();
            console.log('📤 消息已发送');
        }, 500);

    } catch (error) {
        console.error('❌ 翻译过程出错:', error);

        // 移除加载状态
        operationNode('remove', document.getElementById('editDivLoadingNode'));

        // 翻译失败，直接发送原文
        sendMsg();
    }
}

// 翻译API函数 - 直接调用主进程的翻译服务
async function translateTextAPI(text, fromLang, toLang) {

    alert("-------------翻译内容："+text);

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

// 获取本地语言
function getLocalLanguage() {
    const storedLanguage = localStorage.getItem('localLanguage');
    return storedLanguage || 'zh';
}

// 获取目标语言
function getTargetLanguage() {
    const storedLanguage = localStorage.getItem('targetLanguage');
    return storedLanguage || 'en';
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

    // 处理消息列表翻译（简化版）
    async function processMessageList() {
        let messageSpans = document.querySelectorAll('span[dir] > span:not([data-translate-status])');
        let filteredSpans = Array.from(messageSpans).filter(span => {
            return span.closest('div[role="application"]') !== null;
        });

        for (let span of filteredSpans) {
            await processMessageTranslation(span);
        }
    }

    async function processMessageTranslation(span) {
        let msg = span.textContent.trim();
        if (!msg) return;

        span.setAttribute('data-translate-status', 'processing');

        try {
            const translatedText = await translateTextAPI(msg, getTargetLanguage(), getLocalLanguage());

            if (translatedText) {
                span.setAttribute('data-translate-status', 'translated');

                // 创建翻译结果显示节点
                let translationNode = document.createElement('div');
                translationNode.style.cssText = `
                    font-size: 12px;
                    color: #666;
                    border-top: 1px dashed #ccc;
                    padding-top: 5px;
                    margin-top: 5px;
                `;
                translationNode.textContent = translatedText;

                span.appendChild(translationNode);
            }
        } catch (error) {
            span.setAttribute('data-translate-status', 'failed');
            console.error('消息翻译失败:', error);
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