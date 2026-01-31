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
function printElementEvery5Seconds() {
    setInterval(() => {
        const element = document.querySelector("#new-menu > div")
        if (element) {
            window.electronAPI.sendMsg({platform:'TelegramK',online: true}).then(res=>{
                // console.log('用户已登录：',res)
            })
        } else {
            window.electronAPI.sendMsg({platform:'TelegramK',online: false}).then(res=>{
                // console.log('用户未登录：',res)
            })
        }
    }, 5000); // 每隔5000毫秒（5秒）调用一次
}
// 调用函数
printElementEvery5Seconds();
function observeNewMessages() {
    // 选择包含所有消息的父元素
    const targetNode = document.querySelector('ul.chatlist');

    if (!targetNode) {
        console.log('无法找到消息列表父节点');
        return;
    }

    // 用于存储已经被监听的未读消息节点，防止重复监听
    const observedNodes = new Set();

    // MutationObserver 回调函数
    const callback = function(mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // 遍历新增的子节点
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        // 使用 `closest` 找到最近的 `a` 标签
                        const aTagNode = node.closest('a');
                        if (aTagNode) {
                            // console.log('aTagNode节点：', aTagNode);
                            const isMuted = aTagNode.classList.contains('is-muted'); // 判断是否是静音对话
                            // 如果没有静音类，表示这是未静音的消息
                            if (!isMuted) {
                                // 查找未读消息数的节点
                                const unreadBadge = aTagNode.querySelector('div.dialog-subtitle-badge-unread');
                                if (unreadBadge && !observedNodes.has(unreadBadge)) {
                                    // console.log('新的未读消息：',unreadBadge)
                                    // 添加对消息数量的监听，并防止重复监听
                                    observedNodes.add(unreadBadge);  // 记录已经监听的节点
                                    notify()
                                }
                            }
                        }
                    }
                });
            }
        }
    };

    // 创建 MutationObserver 实例
    const observer = new MutationObserver(callback);

    // 开始观察 `ul.chatlist` 节点的子节点变化
    observer.observe(targetNode, { childList: true, subtree: true });

}
function notify() {
    console.log('收到新消息：')
}
monitorMainNode()
//初始化语言列表
function getLanguageList() {
    window.electronAPI.languageList().then((response) => {
        languages = response.data;
    })
}
// 该函数将在页面内执行，用于监听 #main 节点的加载和子节点变化
function monitorMainNode() {
    // 监听整个 body 的 DOM 变化，等待 #main 节点的出现
    const observer = new MutationObserver((mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // 左侧会话列表节点
                const mainNode = document.getElementById('chatlist-container');
                if (mainNode) {
                    // 停止对 body 的观察，避免不必要的性能开销
                    observer.disconnect();
                    // 开始监听 #main 节点的子节点变化
                    observePaneSide(mainNode);
                    removeLoadingNode()
                    startMonitor()
                    getLanguageList()
                    // 调用主函数，开始观察
                    observeNewMessages();
                    //定时查找消息节点列表
                    syncGlobalConfig(); // 初始同步
                    setInterval(syncGlobalConfig, 10000); // 每10秒同步一次
                    setInterval(processMessageList,500)
                    break;
                }
            }
        }
    });
    // 开始观察 body 的子节点变化
    observer.observe(document.body, { childList: true, subtree: true });

    // 监听 pane-side 子节点的 aria-selected 变化
    function observePaneSide(paneSideNode) {
        setTimeout(()=>{
            removeLoadingNode()
            startMonitor()
            addTranslateButtonWithSelect()
            console.log('开始监听左侧消息会话节点变化：', paneSideNode);
        },3000)

        const observer = new MutationObserver((mutationsList) => {
            mutationsList.forEach(function(mutation) {
                // 判断是否是class属性的变化
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (mutation.target.tagName.toLowerCase() === 'a'){
                        if (mutation.target.classList.contains('active')) {
                            //左侧会话列表选中
                            startMonitor()
                            addTranslateButtonWithSelect()
                        }
                    }
                }
            });
        });

        // const config = { childList: true, subtree: true };
        // 配置MutationObserver的选项
        const config = {
            attributes: true,      // 观察属性的变化
            childList: true,       // 观察子节点的添加或删除
            subtree: true,         // 观察目标节点及其后代节点
            attributeFilter: ['class']  // 只观察class属性的变化
        };
        // 监听 pane-side 节点
        observer.observe(paneSideNode, config);
    }

    // 处理消息列表翻译
    async function processMessageList() {
        let messageSpans = document.querySelectorAll('div.message.spoilers-container[dir]:not([data-translate-status])');
        // 过滤：检查每个 span 是否位于 role="application" 的 div 之下
        let filteredSpans = Array.from(messageSpans).filter(span => {
            let parent = span.closest('div.scrollable.scrollable-y'); // 查找最近的父级 div[role="application"]
            return parent !== null;  // 如果找到了，则保留该 span
        });

        // 先标记所有需要处理的消息为 'processing' 状态
        for (let span of filteredSpans) {
            markMessageAsProcessing(span);  // 立即标记并触发重绘
        }
        for (let span of filteredSpans) {
            // 异步调用翻译函数
            processMessageTranslation(span);  // 异步处理翻译
            new Promise(resolve => setTimeout(resolve, 500))
        }

    }

    // 标记消息为处理中，防止重复处理，确保立即生效
    function markMessageAsProcessing(span) {
        span.setAttribute('data-translate-status', 'processing');
        // 触发重新渲染，确保属性变更立即生效
        span.offsetHeight;  // 强制浏览器重新计算布局，确保属性更改立即生效
    }

    function generateTranslateNode(msg = '') {
        // 创建一个新的自定义元素
        let customElement = document.createElement('div');
        customElement.classList.add('custom-translate-node'); // 使用类名控制样式
        customElement.textContent = msg;

        // 动态添加样式
        let style = document.createElement('style');
        style.innerHTML = `
    .custom-translate-node {
        font-size: 12px;
        padding-top: 5px;
        padding-bottom: 12px;
        margin-top: 5px;
        border-top: 1px dashed #ccc;  /* 默认浅色模式的虚线 */
        display: block;
        opacity: 0;
        transform: translateX(0px); /* 初始左移 20px，防止超出容器太多 */
        animation: waveIn 1s ease forwards; /* 应用动画 */
        overflow: hidden; /* 确保动画不会超出当前组件的可视区域 */
    }

    /* 定义从左到右的动画 */
    @keyframes waveIn {
        0% {
            opacity: 0;
            transform: translateX(0px); /* 从左侧偏移 20px */
        }
        100% {
            opacity: 1;
            transform: translateX(0); /* 最终位置恢复到初始位置 */
        }
    }

    /* 浅色模式样式 */
    @media (prefers-color-scheme: light) {
        .custom-translate-node {
            color: blue;  /* 浅色模式字体颜色 */
            border-top: 1px dashed #ccc; /* 浅色模式下的边框 */
        }
    }

    /* 深色模式样式 */
    @media (prefers-color-scheme: dark) {
        .custom-translate-node {
            color: lightblue;  /* 深色模式字体颜色 */
            border-top: 1px dashed #444; /* 深色模式下的边框 */
        }
    }
`;
        document.head.appendChild(style);

        return customElement;
    }

    // 异步处理翻译逻辑
    async function processMessageTranslation(span) {
        let msg = undefined;
        let msgSpan = span.querySelector('span.translatable-message');
        if (msgSpan) {
            msg = msgSpan.textContent;
        }else {
            msg = Array.from(span.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)  // 只保留文本节点
                .map(node => node.textContent.trim())              // 去除每个文本节点的多余空格
                .join('');
        }
        if (msg === '') return;  // 如果消息为空，直接退出
        // 插入加载中的节点
        let loadingNode = generateLoadingNode();
        operationNode('add',loadingNode,span)
        let translatedText = undefined;
        try {
            // 查询缓存中是否存在翻译结果
            let message = await getMessage(msg, getLocalLanguage());
            if (message) {
                translatedText = message.translatedText;
            } else {
                // 异步翻译消息
                translatedText = await translateText(msg, getLocalLanguage());
            }

            // 如果翻译结果为空，抛出错误
            if (!translatedText) {
                throw new Error("翻译结果为空");
            }

            // 移除加载中的节点
            operationNode('remove',loadingNode)

            // 标记该消息已翻译，并添加相关属性
            span.setAttribute('data-translate-status', 'Translated');
            span.setAttribute('data-language-type', getLocalLanguage());

            // 缓存翻译结果到数据库
            saveMessage(msg, translatedText, getLocalLanguage());

            // 插入翻译结果到页面
            let translationNode = generateTranslateNode(translatedText);
            operationNode('add',translationNode,span)

        } catch (error) {
            // 错误处理：移除加载中的节点
            operationNode('remove',loadingNode)

            // 错误处理：标记翻译失败，并提供反馈
            span.setAttribute('data-translate-status', 'failed');

            // 可以选择插入“翻译失败”提示节点（可选）
            // let errorNode = document.createElement('div');
            // errorNode.textContent = '翻译失败';
            // errorNode.style.color = 'red';  // 错误提示样式
            // span.appendChild(errorNode);
            // operationNode('add',errorNode,span)
        }
    }
}
function startMonitor() {
    // 获取可编辑的 div 消息输入框 元素
    let editableDiv = document.querySelector('div[contenteditable="true"]')
    if (editableDiv) {
        // 确保只添加一次事件监听器，防止重复添加
        editableDiv.removeEventListener('keydown', handleKeydown, true);  // 先移除旧的监听器
        editableDiv.addEventListener('keydown', handleKeydown, true);  // 再添加新的监听器
    }
}
// 回车键监听函数
function handleKeydown(event) {
    let editableDiv = document.querySelector('div[contenteditable="true"]');
    if (event.key === 'Enter' && !event.shiftKey) {
        let loadingNode = document.getElementById('editDivLoadingNode');
        if (loadingNode) {
            console.log('消息正在处理:');
            // 阻止默认行为
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();  // 防止事件继续传递到插件
            return;
        }
        let contents = editableDiv.textContent.split('\n');
        if (contents.length<=1) {
            let string = contents[0];
            if (string.trim() === '' || string.trim() === undefined) {
                console.log('消息为空:');
                // 阻止默认行为
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();  // 防止事件继续传递到插件
                return;
            }
        }
        // 显示加载中的节点
        loadingNode = generateLoadingNode();
        loadingNode.id = 'editDivLoadingNode';
        operationNode('add', loadingNode, editableDiv.parentNode);
        getContentWithLineBreaks(contents).then(msgArr => {
            // 如果msgArr为空或者所有翻译内容都为空则不调用sendMsg
            if (msgArr.length > 0 && msgArr.some(item => item.translated)) {
                // 用换行符拼接翻译后的内容
                editableDiv.textContent = msgArr
                    .map(item => item.translated)  // 提取 `translated` 字段
                    .filter(text => text !== null && text.trim() !== "")  // 过滤掉 null 值和空翻译
                    .join('\n');

                sendMsg();
            } else {
                console.warn('翻译结果为空，不发送消息。');
            }
            // 无论翻译是否成功，都移除loadingNode
            operationNode('remove', loadingNode);
        });

        // 阻止默认行为
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();  // 防止事件继续传递到插件
    }
}
//模拟发送消息
function sendMsg() {
    // 假设你要替换的按钮是发送按钮
    // let sendButton = document.querySelector('button.x1c4vz4f.x2lah0s.xdl72j9.xfect85.x1iy03kw.x1lfpgzf');
    let sendButton = document.querySelectorAll('button.send.btn-icon.rp.btn-circle.btn-send.animated-button-icon')[0]
    let loadingNode = document.getElementById('editDivLoadingNode')
    if (loadingNode){
        loadingNode.remove()
    }
    if (sendButton) {
        sendButton.click();
    }else {
        console.log('发送按钮不存在！')
    }
}
//移除加载节点
function removeLoadingNode() {
    let loadingNode = document.getElementById('editDivLoadingNode');
    if (loadingNode) {
        loadingNode.remove();
    }
}
//添加翻译语言选项
function addTranslateButtonWithSelect() {
    let btn = document.getElementById('customLanguageNode');
    if (btn){
        return;
    }
    let targetNode = document.querySelector('.toggle-emoticons');
    if (!document.querySelector('.toggle-emoticons')){
        console.log('目标按钮不存在：无法新增翻译按钮！')
        return;
    }
    let customNode = document.querySelector('.toggle-emoticons').cloneNode(true);
    customNode.firstChild.remove();
    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
    .translate-btn {
        font-size: 16px;
        cursor: pointer;
        border: none;
        border-radius: 50%;
        color: #fff;
        transition: background-color 0.2s ease;
    }
    .custom-svg path {
        fill: gray;
        pointer-events: none;  /* 确保SVG不会阻挡点击 */
    }
    .select-box-popup {
        position: absolute;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        padding: 10px;
        background-color: #fff;
        width: 200px;
        display: none;
        z-index: 1000;
    }
    .select-box-popup.visible {
        display: block;
    }
    .select-box {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 5px;
        margin-bottom: 10px;
        cursor: pointer;
        background-color: #f9f9f9;
    }
    .select-box:hover {
        background-color: #f0f0f0;
    }
    .language-list {
        display: none;
        position: absolute;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        max-height: 150px;
        overflow-y: auto;
        z-index: 1001;
    }
    .language-list.visible {
        display: block;
    }
    .language-option {
        padding: 8px;
        cursor: pointer;
    }
    .language-option:hover {
        background-color: #f0f0f0;
    }

    /* 浅色模式 */
    @media (prefers-color-scheme: light) {
        .select-box-popup {
            background-color: #fff;
            color: #000;
            border: 1px solid #ccc;
        }
        .select-box {
            background-color: #f9f9f9;
            color: #000;
        }
        .select-box:hover {
            background-color: #f0f0f0;
        }
        .language-list {
            background-color: #fff;
            color: #000;
        }
        .language-option:hover {
            background-color: #f0f0f0;
        }
    }

    /* 深色模式 */
    @media (prefers-color-scheme: dark) {
        .select-box-popup {
            background-color: #333;
            color: #fff;
            border: 1px solid #555;
        }
        .select-box {
            background-color: #444;
            color: #fff;
        }
        .select-box:hover {
            background-color: #555;
        }
        .language-list {
            background-color: #444;
            color: #fff;
        }
        .language-option:hover {
            background-color: #555;
        }
        .custom-svg path {
            fill: lightgray;
            pointer-events: none;  /* 确保SVG不会阻挡点击 */
        }
    }
    `;
    document.head.appendChild(style);

    // 创建按钮
    const button = document.createElement('button');
    customNode.id = 'customLanguageNode';
    button.classList.add('translate-btn');
    // 插入自定义 SVG 图标到按钮
    const svgIcon = `<svg t="1728245126352" class="custom-svg" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
     p-id="11370" data-spm-anchor-id="a313x.search_index.0.i11.241d3a812zSb3L" width="26" height="26">
    <path
        d="M846.04 866.77c-17.08 2.03-32.57-10.18-34.59-27.26-0.22-1.9-0.27-3.81-0.15-5.71v-123c0-33.73-22.17-33.73-30.53-33.73-21.28-0.46-38.91 16.43-39.36 37.72-0.01 0.46-0.01 0.92 0 1.37v117.66c-0.76 18.9-16.71 33.61-35.61 32.84-17.83-0.72-32.12-15.01-32.84-32.84V647.68c-1.23-17.23 11.74-32.19 28.97-33.41 1.69-0.12 3.39-0.1 5.08 0.05a31.953 31.953 0 0 1 31.33 17.76 89.435 89.435 0 0 1 54.99-17.76c54.11 0 86.45 33.59 86.45 90.03V833.8a32.25 32.25 0 0 1-8.88 23.72 34.026 34.026 0 0 1-24.82 9.33l-0.04-0.08z m-233.12-7.46h-134.7c-42.77 0-61.85-18.96-61.85-61.57V608.07c0-42.52 19.09-61.57 61.85-61.57h128.74c17.92 0 32.45 14.53 32.45 32.45s-14.53 32.45-32.45 32.45H490.73c-1.22-0.08-2.45 0.09-3.6 0.5 0.13 0-0.15 0.8-0.15 2.89v52.58h106c16.33-1.66 30.91 10.24 32.57 26.57 0.17 1.68 0.2 3.37 0.08 5.06 0.98 16.66-11.73 30.97-28.4 31.95-1.41 0.08-2.83 0.07-4.24-0.05H486.9V791c-0.04 1.06 0.08 2.13 0.35 3.15 1.12 0.15 2.25 0.23 3.38 0.24h122.31c16.96-1.07 31.58 11.81 32.65 28.76 0.07 1.16 0.08 2.33 0.02 3.5 1.35 16.68-11.07 31.3-27.75 32.65-1.64 0.13-3.28 0.13-4.92 0h-0.02zM327.54 482.85c-17.36 2.36-33.34-9.8-35.7-27.16-0.3-2.21-0.37-4.44-0.2-6.67V370.5h-85.27c-45.86 0-66.31-20.52-66.31-66.31v-93.87c0-45.58 20.52-65.9 66.31-65.9h85.27v-31.53c-1.38-17.11 11.37-32.11 28.48-33.49 1.92-0.15 3.84-0.13 5.76 0.07 30.26 0 36.63 18.17 36.63 33.42v31.59h86.09c45.86 0 66.33 20.34 66.33 65.88v93.89c0 45.86-20.52 66.29-66.33 66.29h-86.05v78.52c1.25 17.47-11.9 32.65-29.37 33.91-1.88 0.13-3.76 0.1-5.63-0.1v-0.02zM217.21 211.27c-6.47 0-7.07 0.6-7.07 7.07v78.2c0 6.53 0.6 7.15 7.07 7.15h74.43v-92.42h-74.43z m145.35 92.38h75.29c6.29 0 7.09-0.8 7.09-7.07v-78.25c0-6.29-0.8-7.09-7.09-7.09h-75.31v92.42h0.02z m151.42 655.91C266.43 958.82 66.36 757.55 67.1 510c0.1-35 4.31-69.86 12.52-103.88 4.81-19 23.92-30.68 43.03-26.29 19.1 4.61 30.86 23.81 26.29 42.91-48.93 202.33 75.42 406.01 277.75 454.94a376.924 376.924 0 0 0 87.29 10.56c19.69 0.02 35.64 15.99 35.63 35.69-0.02 19.67-15.96 35.61-35.63 35.63z m398.49-310.05c-19.69 0-35.66-15.96-35.66-35.65 0-2.95 0.37-5.9 1.09-8.76 51.31-201.82-70.7-407.02-272.52-458.33-29.89-7.6-60.59-11.5-91.43-11.62-19.68 0-35.64-15.95-35.64-35.63 0-19.68 15.95-35.64 35.63-35.64h0.01c247.57 0.76 447.65 202.08 446.89 449.65-0.11 36.8-4.76 73.44-13.83 109.1-4 15.8-18.23 26.88-34.54 26.88z"
        fill="#bfbfbf" p-id="11371"></path>
    </svg>
`;

    // 将 SVG 图标添加到按钮中
    button.innerHTML = svgIcon;
    button.classList.add('tgico')
    button.classList.add('button-icon')
    customNode.appendChild(button)
    targetNode.insertAdjacentElement('afterend',customNode)

    // 创建弹窗
    const popup = document.createElement('div');
    popup.id = 'custom-popup';
    popup.classList.add('select-box-popup');
    // 本地语言选择框
    const localLangBox = document.createElement('div');
    localLangBox.classList.add('select-box');

    localLangBox.textContent = "Local：" + languages.find(lang => lang.code === getLocalLanguage()).displayName;

    // 目标语言选择框
    const targetLangBox = document.createElement('div');
    targetLangBox.classList.add('select-box');
    targetLangBox.textContent = "Target：" + languages.find(lang => lang.code === getTargetLanguage()).displayName;

    popup.appendChild(localLangBox);
    popup.appendChild(targetLangBox);

    document.body.appendChild(popup);

    // 点击按钮时显示弹窗
    customNode.addEventListener('click', function (event) {
        event.stopPropagation();
        popup.classList.toggle('visible');
        positionPopup(customNode, popup);
    });
    // 点击页面其他地方时隐藏弹窗
    document.addEventListener('click', function (event) {
        // 判断点击的元素是否是弹窗或按钮，或者是语言列表中的元素
        if (!popup.contains(event.target) &&
            !customNode.contains(event.target) &&
            !event.target.classList.contains('language-option')) {
            // 如果点击的不是弹窗、按钮或语言选项，则隐藏弹窗和语言列表
            popup.classList.remove('visible');
            hideLanguageLists(); // 隐藏语言列表
        }
    });

    // 本地语言列表
    const localLangList = createLanguageList(languages, function(selectedLang) {
        localLangBox.textContent = "Local：" + languages.find(lang => lang.code === getLocalLanguage()).displayName;
    }, 'localLanguage-tg');  // 存储到 localStorage 的 localLanguage 键

    // 目标语言列表
    const targetLangList = createLanguageList(languages, function(selectedLang) {
        targetLangBox.textContent = "Target：" + languages.find(lang => lang.code === getTargetLanguage()).displayName;
    }, 'targetLanguage-tg');  // 存储到 localStorage 的 targetLanguage 键

    document.body.appendChild(localLangList);
    document.body.appendChild(targetLangList);

    // 点击本地语言选择框时显示列表
    localLangBox.addEventListener('click', function(event) {
        event.stopPropagation();
        toggleLanguageList(localLangList, localLangBox);
        targetLangList.classList.remove('visible'); // 隐藏目标语言选择框的列表
    });

    // 点击目标语言选择框时显示列表
    targetLangBox.addEventListener('click', function(event) {
        event.stopPropagation();
        toggleLanguageList(targetLangList, targetLangBox);
        localLangList.classList.remove('visible'); // 隐藏本地语言选择框的列表
    });

    // 创建语言列表函数
    function createLanguageList(languages, onSelect, storageKey) {
        const list = document.createElement('div');
        list.classList.add('language-list');

        languages.forEach(language => {
            const option = document.createElement('div');
            option.classList.add('language-option');
            option.textContent = language.displayName; // 显示语言的名称
            option.dataset.languageCode = language.code; // 存储语言的代码

            option.addEventListener('click', function() {
                let oldStr = getLocalLanguage();
                // 根据传入的 storageKey，保存到 localStorage 中的不同键
                localStorage.setItem(storageKey, language.code);
                onSelect(language.name); // 回调函数中使用语言名称
                list.classList.remove('visible'); // 只隐藏当前的语言选择列表
                if(storageKey === 'localLanguage-tg') {
                    let newStr = getLocalLanguage();
                    localLangBox.textContent = "Local：" + languages.find(lang => lang.code === getLocalLanguage()).displayName;
                    if (oldStr !== newStr) {
                        //查询所有的自定节点并删除
                        let customNodes = document.querySelectorAll('div[class="custom-translate-node"]');
                        customNodes.forEach((customNode)=>{
                            let span = customNode.parentNode;
                            span.removeAttribute('data-language-type');
                            span.removeAttribute('data-translate-status');
                            operationNode('remove', customNode);
                        })
                    }
                }else {
                    targetLangBox.textContent = "Target：" + languages.find(lang => lang.code === getTargetLanguage()).displayName;
                }
            });
            list.appendChild(option);
        });
        return list;
    }

    // 切换语言列表显示
    function toggleLanguageList(list, selectBox) {
        if (list.classList.contains('visible')) {
            list.classList.remove('visible');
        } else {
            positionList(selectBox, list); // 将语言列表显示在选择框上方
            list.classList.add('visible');
        }
    }

    // 隐藏所有语言列表
    function hideLanguageLists() {
        localLangList.classList.remove('visible');
        targetLangList.classList.remove('visible');
    }

    // 设置弹窗位置
    function positionPopup(button, popup) {
        const rect = button.getBoundingClientRect();
        const top = rect.top - popup.offsetHeight - 5 + window.scrollY;
        const left = rect.left + window.scrollX;
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    }

    // 设置语言列表的位置，语言列表的底部贴在选择框的顶部
    function positionList(selectBox, list) {
        const rect = selectBox.getBoundingClientRect(); // 获取选择框的位置信息
        const listHeight = selectBox.offsetHeight; // 获取语言列表的高度
        const top = rect.top - 152 + window.scrollY;  // 列表的底部贴在选择框的顶部
        const left = rect.left + selectBox.offsetWidth + window.scrollX;  // 水平对齐选择框的左边缘
        list.style.position = 'absolute';
        list.style.top = `${top}px`;  // 设置列表的顶部位置
        list.style.left = `${left}px`;  // 设置列表的左边位置
    }
}
async function translateText(text, targetLanguage) {
    const args = {
        local: getLocalLanguage(),  // 假设源语言为中文，可以根据需求动态设置
        target: targetLanguage,
        text: text,
    };
    return window.electronAPI.translateText(args)
}
async function getContentWithLineBreaks(contents) {
    // 用于存储翻译后的文本内容数组
    let contentPromises = contents.map(async (text, index) => {
        text = text.trim();  // 去掉每个字符串的前后空格
        if (text !== "") {  // 如果不是空字符串
            // 如果缓存中没有，调用 API 翻译
            let translatedText = await translateText(text, getTargetLanguage());
            // 如果翻译成功，保存结果到缓存
            if (translatedText) {
                saveMessage(text, translatedText, getTargetLanguage());
            }
            // 返回翻译结果和原始文本
            return {
                original: text,  // 原始文本
                translated: translatedText,  // 翻译后的文本
                index: index  // 段落的索引（用于保持顺序）
            };
        }
    });

    // 使用 Promise.all 等待所有翻译任务完成后返回结果
    const content = await Promise.all(contentPromises);

    // 过滤掉 undefined 值（因为有可能某些字符串为空）
    return content.filter(item => item !== undefined);
}
function generateLoadingNode() {
    // 创建一个容器节点
    let loadingNode = document.createElement('div');
    loadingNode.style.display = 'flex';  // 使用 flex 布局横向排列波浪点
    loadingNode.style.gap = '4px';  // 每个波浪点之间的间隔
    loadingNode.style.paddingTop = '5px';  // 上边距
    loadingNode.style.marginTop = '5px';  // 外边距

    // 创建 3 个波浪点，形成波浪效果
    for (let i = 0; i < 3; i++) {
        let waveDot = document.createElement('div');
        waveDot.classList.add('wave-dot');  // 使用类名来控制样式
        waveDot.style.animationDelay = `${i * 0.2}s`;  // 延迟每个点的动画开始时间
        loadingNode.appendChild(waveDot);
    }

    // 动画效果的 CSS 样式
    let style = document.createElement('style');
    style.innerHTML = `
        /* 通用波浪点样式 */
        .wave-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: wave 1.2s ease-in-out infinite;
        }

        /* 动画效果 */
        @keyframes wave {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.5); opacity: 1; }
        }

        /* 浅色模式下的样式 */
        @media (prefers-color-scheme: light) {
            .wave-dot {
                background-color: blue;  /* 浅色模式下的波浪点颜色 */
            }
        }

        /* 深色模式下的样式 */
        @media (prefers-color-scheme: dark) {
            .wave-dot {
                background-color: lightblue;  /* 深色模式下的波浪点颜色 */
            }
        }
    `;
    document.head.appendChild(style);

    return loadingNode;
}
// 节点操作函数，增加或是删除，并且每次只能调用一次，必须等待渲染完毕后才允许下次调用
function operationNode(action, node, parentNode = undefined) {
    if (action === null || !node) {
        // 如果操作无效，直接解锁
        return;
    }
    let scrollContainer = document.querySelector('#column-center div.scrollable.scrollable-y');

    // 添加或删除节点
    if (action === 'add') {
        if (!parentNode) {
            // 如果没有传递父节点，则默认不操作
            return;
        }
        parentNode.appendChild(node);
        if (scrollContainer) {
            requestAnimationFrame(() => {
                document.querySelector('#column-center div.scrollable.scrollable-y').scrollTop += node.offsetHeight;
            })
        }
    }
    if (action === 'remove') {
        if (scrollContainer) {
            requestAnimationFrame(() => {
                document.querySelector('#column-center div.scrollable.scrollable-y').scrollTop -= node.offsetHeight;
            })
        }
        node.remove();
    }
}
// 获取存储的语言 (用户母语，接收消息的目标语言)
function getLocalLanguage() {
    return globalConfig?.receiveTargetLang || localStorage.getItem('localLanguage-tg') || 'zh';
}
// 获取存储的语言 (对方语言，发送消息的目标语言)
function getTargetLanguage() {
    return globalConfig?.sendTargetLang || localStorage.getItem('targetLanguage-tg') || 'en';
}
// 打开或创建数据库，并在升级时使用复合主键
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TelegramDB', 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;

            // 如果对象存储不存在，创建一个新的，使用 'originalText' 和 'language' 作为复合主键
            if (!db.objectStoreNames.contains('messages')) {
                const store = db.createObjectStore('messages', { keyPath: ['originalText', 'language'] });
                store.createIndex('originalText', 'originalText', { unique: false });
                store.createIndex('language', 'language', { unique: false });
            }
        };

        request.onsuccess = function(event) {
            resolve(event.target.result); // 返回数据库实例
        };

        request.onerror = function(event) {
            reject(`数据库打开失败: ${event.target.errorCode}`);
        };
    });
}

// 检查是否已经存在翻译记录并存储
async function saveMessage(originalText, translatedText, language) {
    const db = await openDatabase();

    // 1. 先检查是否存在相同的 originalText 和 language 的记录
    const existingMessage = await getMessage(originalText, language);

    if (existingMessage) {
        return Promise.resolve(); // 已存在，直接返回
    }

    // 2. 如果不存在，则开启新的事务存储新记录
    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');

    const message = {
        originalText,         // 原始文本
        translatedText,       // 翻译后的文本
        language              // 语言类型
    };

    return new Promise((resolve, reject) => {
        const request = store.put(message); // 使用 put 来插入或更新消息记录
        request.onsuccess = function() {
            resolve();
        };

        request.onerror = function(event) {
            console.error('存储消息失败', event.target.error);
            reject(event.target.error);
        };
    });
}

// 根据 originalText 和 language 获取翻译记录
async function getMessage(originalText, language) {
    const db = await openDatabase();
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');

    return new Promise((resolve, reject) => {
        // 通过主键组合（originalText, language）直接查询
        const request = store.get([originalText, language]);

        request.onsuccess = function(event) {
            const record = event.target.result;

            if (record) {
                resolve(record); // 找到匹配的记录，返回
            } else {
                resolve(null); // 没有找到匹配的记录
            }
        };

        request.onerror = function(event) {
            reject(`获取消息失败: ${event.target.errorCode}`);
        };
    });
}

