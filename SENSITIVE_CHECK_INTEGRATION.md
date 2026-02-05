# 敏感词检测功能集成完成

## 概述

已成功将敏感词检测功能集成到 Electron 应用中，通过 IPC 通信实现前端脚本与后端 API 的交互。

## 架构流程

```
WhatsApp.js (渲染进程)
    ↓ 检测到 URL/BTC
    ↓ window.electronAPI.checkSensitiveContent()
    ↓
electron/preload/bridge.js
    ↓ ipcRenderer.invoke('check-sensitive-content')
    ↓
electron/index.js (主进程)
    ↓ ipcMain.handle('check-sensitive-content')
    ↓ checkSensitiveContent()
    ↓
electron/api/index.js
    ↓ request.post('/app/sensitive/check')
    ↓
后端 API
    ↓ 返回检测结果
    ↓
适配数据格式
    ↓
返回给渲染进程
```

## 修改的文件

### 1. electron/utils/ValidationUtils.js
**功能：** 本地验证工具模块

**新增文件，包含函数：**
```javascript
validateUrls(text)          // URL 验证（使用 validator 库）
validateBtcAddresses(text)  // BTC 地址验证（使用原生算法）
validateEthAddresses(text)  // ETH 地址验证（正则表达式）
validateContent(text)       // 综合验证
```

**验证方法：**
- **URL 验证**：使用 `validator` 库进行精确验证
- **BTC 地址验证**：
  - Legacy/P2SH：Base58 解码 + 双 SHA256 校验和验证
  - Bech32：Bech32 解码 + 多项式校验和验证
  - 使用 Node.js 原生 `crypto` 模块，无需外部依赖
- **ETH 地址验证**：正则表达式匹配 `0x` + 40 位十六进制

**优势：**
- 无 ES Module 兼容性问题
- 使用原生算法，性能更好
- 完整的校验和验证，准确率高
**功能：** 封装后端 API 调用

**新增函数：**
```javascript
async function checkSensitiveContent(content)
```

**主要逻辑：**
- 调用后端接口 `/app/sensitive/check`
- 适配后端返回的数据格式
- 判断 `response.data.sensitiveWord` 是否存在
- 返回统一的数据格式给主进程

**数据适配：**
```javascript
// 后端返回格式
{
  "msg": "存在敏感词",
  "code": 200,
  "data": {
    "sensitiveWord": "敏感词内容",
    "sensitiveId": "xxx"
  }
}

// 适配后的格式
{
  "success": true,
  "data": {
    "isSensitive": true,
    "reason": "内容包含敏感词",
    "details": {
      "type": "keyword",
      "sensitiveWord": "敏感词内容",
      "sensitiveId": "xxx"
    }
  }
}
```

### 2. electron/api/index.js
**功能：** 注册 IPC 处理器

**新增代码：**
```javascript
// 导入函数
const {translateText, getLanguages, checkSensitiveContent} = require('./api/index')

// 注册处理器
ipcMain.handle('check-sensitive-content', async (event, args) => {
  const { content } = args;
  return checkSensitiveContent(content);
});
```

### 3. electron/index.js
**功能：** 暴露 API 给渲染进程

**新增代码：**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... 其他 API
  checkSensitiveContent: (args) => {
    return ipcRenderer.invoke('check-sensitive-content', args);
  }
});
```

### 4. electron/preload/bridge.js
**功能：** 在消息发送前检测敏感内容

**修改内容：**
- 将 `fetch` 调用改为 `window.electronAPI.checkSensitiveContent()`
- 使用 Electron IPC 通信代替直接的 HTTP 请求

**修改前：**
```javascript
const response = await fetch('http://localhost:3000/app/sensitive/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text })
});
const result = await response.json();
```

**修改后：**
```javascript
const result = await window.electronAPI.checkSensitiveContent({ content: text });
```

### 5. electron/scripts/WhatsApp.js

### 场景 1：检测到敏感词

**1. 用户输入：**
```
"这是一条包含薄熙来的消息"
```

**2. 本地检测：**
- URL 检测：否
- BTC 检测：否
- 跳过后端验证（可选：也可以调用后端检测所有内容）

**3. 后端返回：**
```json
{
  "msg": "存在敏感词",
  "code": 200,
  "data": {
    "sensitiveWord": "薄熙来",
    "sensitiveId": null
  }
}
```

**4. 适配后返回给渲染进程：**
```json
{
  "success": true,
  "data": {
    "isSensitive": true,
    "reason": "存在敏感词",
    "details": {
      "type": "keyword",
      "sensitiveWord": "薄熙来",
      "sensitiveId": null
    }
  }
}
```

**5. 用户体验：**
- 阻止消息发送
- 显示红色警告："⚠️ 存在敏感词"
- 显示系统通知
- 3 秒后警告消失

### 场景 2：检测到 URL

**1. 用户输入：**
```
"访问 http://example.com 查看详情"
```

**2. 本地检测：**
- URL 检测：是
- 调用后端验证

**3. 后端返回（假设 URL 在黑名单）：**
```json
{
  "msg": "存在敏感词",
  "code": 200,
  "data": {
    "sensitiveWord": "http://example.com",
    "sensitiveId": "url-001"
  }
}
```

**4. 用户体验：**
- 阻止消息发送
- 显示警告："⚠️ 存在敏感词"

### 场景 3：正常消息

**1. 用户输入：**
```
"这是一条正常的消息"
```

**2. 本地检测：**
- URL 检测：否
- BTC 检测：否
- 跳过后端验证

**3. 用户体验：**
- 消息正常发送
- 如果启用翻译，先翻译再发送

## 优势

### 1. 安全性
- 使用 Electron IPC 通信，避免跨域问题
- 不暴露后端 API 地址给渲染进程
- 主进程统一管理 API 调用

### 2. 可维护性
- API 调用集中在 `electron/api/index.js`
- 数据格式适配在一处完成
- 便于后续修改和扩展

### 3. 性能
- 本地预检测，减少不必要的网络请求
- 异步处理，不阻塞 UI
- 错误容错，检测失败不影响正常使用

### 4. 扩展性
- 易于添加新的检测类型（如电话号码、邮箱等）
- 可以轻松切换后端 API
- 支持多种敏感内容检测规则

## 配置选项

### 修改后端 API 地址
在 `electron/utils/request.js` 中修改基础 URL：
```javascript
const baseURL = 'http://your-api-url';
```

### 调整检测规则
在 `electron/scripts/WhatsApp.js` 的 `checkSensitiveContent` 函数中修改正则表达式：
```javascript
// 添加更多 URL 格式
const urlRegex = /your-custom-regex/gi;

// 添加其他加密货币地址
const ethRegex = /0x[a-fA-F0-9]{40}/g;
```

### 是否对所有消息进行检测
当前实现：只有检测到 URL 或 BTC 地址才调用后端

如需对所有消息进行检测，修改逻辑：
```javascript
// 移除条件判断，直接调用后端
const result = await window.electronAPI.checkSensitiveContent({ content: text });
```

## 测试建议

### 1. 单元测试
测试 `electron/api/index.js` 中的数据适配逻辑：
```javascript
// 测试存在敏感词的情况
// 测试不存在敏感词的情况
// 测试网络错误的情况
```

### 2. 集成测试
测试完整的检测流程：
```javascript
// 测试 URL 检测
// 测试 BTC 地址检测
// 测试敏感词检测
// 测试正常消息
```

### 3. 用户体验测试
- 检测响应时间是否合理（< 1 秒）
- 警告提示是否清晰
- 错误处理是否友好

## 故障排除

### 问题 1：检测不生效
**可能原因：**
- 后端 API 未启动
- IPC 通信失败
- 数据格式不匹配

**解决方法：**
1. 检查后端服务状态
2. 查看主进程日志：`electron/logs/`
3. 检查 `electron/api/index.js` 中的日志输出

### 问题 2：误报率高
**可能原因：**
- 正则表达式过于宽松
- 后端敏感词库过于严格

**解决方法：**
1. 调整正则表达式
2. 优化后端敏感词库
3. 添加白名单机制

### 问题 3：影响发送速度
**可能原因：**
- 后端接口响应慢
- 网络延迟

**解决方法：**
1. 优化后端接口性能
2. 添加超时处理
3. 考虑使用缓存

## 后续优化建议

1. **添加缓存机制**
   - 缓存检测结果，避免重复检测相同内容

2. **批量检测**
   - 支持一次检测多条消息

3. **离线检测**
   - 在本地维护敏感词库，支持离线检测

4. **用户反馈**
   - 允许用户对误判进行反馈

5. **统计分析**
   - 记录检测日志，分析敏感内容趋势

## 版本信息

- 创建日期：2026-02-05
- 版本：2.0.0
- 更新内容：集成到 Electron IPC 架构
- 兼容性：Electron 所有版本
