# WhatsApp 敏感内容检测功能

## 功能概述

在 WhatsApp 消息发送前，自动检测消息内容是否包含敏感信息（URL 地址、BTC 地址等），如果检测到敏感内容，将阻止消息发送并显示警告。

## 检测内容

### 1. URL 地址检测
使用正则表达式检测以下格式的 URL：
- `http://` 或 `https://` 开头的完整 URL
- `www.` 开头的域名
- 常见顶级域名：`.com`, `.net`, `.org`, `.io`, `.co`, `.cn`, `.xyz`, `.info`, `.biz`, `.me`, `.app`, `.dev`, `.tech`

**检测正则表达式：**
```javascript
/(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|co|cn|xyz|info|biz|me|app|dev|tech)[^\s]*)/gi
```

### 2. BTC 地址检测
检测比特币地址格式并验证校验和：
- **Legacy 地址 (P2PKH)**：以 `1` 开头，26-35 个字符，使用 Base58 编码和双 SHA256 校验和
- **P2SH 地址**：以 `3` 开头，26-35 个字符，使用 Base58 编码和双 SHA256 校验和
- **Bech32 地址 (SegWit)**：以 `bc1` 开头，39-59 个字符，使用 Bech32 编码和校验和

**检测正则表达式：**
```javascript
/\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/g
```

**验证方法：**
- Legacy/P2SH：Base58 解码 + 双 SHA256 校验和验证
- Bech32：Bech32 解码 + 多项式校验和验证

## 工作流程

```
用户输入消息
    ↓
按下 Enter 键
    ↓
拦截发送事件
    ↓
执行敏感词检测
    ↓
检测到 URL 或 BTC？
    ├─ 是 → 调用后端接口验证
    │         ↓
    │    接口返回敏感？
    │    ├─ 是 → 阻止发送 + 显示警告
    │    └─ 否 → 继续翻译流程
    │
    └─ 否 → 继续翻译流程
```

## API 接口

### 敏感词检测接口

**请求：**
```
POST /app/sensitive/check
Content-Type: application/json

{
  "content": "要检测的消息内容"
}
```

**响应格式（存在敏感词）：**
```json
{
  "msg": "存在敏感词",
  "code": 200,
  "data": {
    "createBy": null,
    "createTime": null,
    "updateBy": null,
    "updateTime": null,
    "remark": null,
    "tenantId": null,
    "delFlag": null,
    "sensitiveId": null,
    "sensitiveWord": "敏感词内容",
    "status": null
  }
}
```

**响应格式（不存在敏感词）：**
```json
{
  "msg": "检测通过",
  "code": 200,
  "data": null
}
```

**响应字段说明：**
- `code`: 状态码，200 表示成功
- `msg`: 响应消息
- `data`: 敏感词信息
  - `sensitiveWord`: 检测到的敏感词
  - `sensitiveId`: 敏感词 ID
  - 其他字段为系统字段

**前端适配后的数据格式：**
```json
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

## 实现位置

### 前端脚本
**文件：** `electron/scripts/WhatsApp.js`

#### 1. 敏感词检测函数
```javascript
async function checkSensitiveContent(text)
```
- 位置：第 250 行左右
- 功能：检测文本中的 URL 和 BTC 地址
- 返回：`{ isSensitive, reason, details }`

#### 2. 执行翻译流程（集成检测）
```javascript
async function executeTranslationFlow(inputText)
```
- 位置：第 320 行左右
- 功能：在翻译前先执行敏感词检测
- 如果检测到敏感内容，阻止发送并显示警告

#### 3. 显示警告函数
```javascript
function showSensitiveWarning(message)
```
- 位置：第 540 行左右
- 功能：在输入框上方显示红色警告提示
- 自动在 3 秒后消失

## 用户体验

### 正常流程
1. 用户输入普通消息
2. 按下 Enter 键
3. 消息正常发送（如果启用翻译，会先翻译）

### 检测到敏感内容
1. 用户输入包含 URL 或 BTC 地址的消息
2. 按下 Enter 键
3. 系统检测到敏感内容
4. 调用后端接口验证
5. 如果确认为敏感内容：
   - 阻止消息发送
   - 显示红色警告提示框
   - 显示系统通知
   - 3 秒后警告自动消失
6. 用户可以修改消息内容后重新发送

### 警告 UI 样式
```
┌─────────────────────────────────────┐
│ ⚠️ 无法发送消息                      │
│ 内容包含敏感 URL 地址                │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ [输入框]                             │
└─────────────────────────────────────┘
```

## 配置选项

### 后端接口地址
默认：`http://localhost:3000/app/sensitive/check`

如需修改，请在 `checkSensitiveContent` 函数中更新：
```javascript
const response = await fetch('http://your-api-url/app/sensitive/check', {
    // ...
});
```

### 检测规则
可以在 `checkSensitiveContent` 函数中修改正则表达式来调整检测规则：

```javascript
// 添加更多顶级域名
const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|新增域名)[^\s]*)/gi;

// 添加其他加密货币地址检测
const ethRegex = /0x[a-fA-F0-9]{40}/g; // 以太坊地址
```

## 错误处理

### 1. 网络请求失败
如果后端接口无法访问，检测会失败并允许消息发送（安全策略）：
```javascript
catch (error) {
    console.error('❌ 敏感词检测失败:', error);
    return {
        isSensitive: false,
        error: error.message
    };
}
```

### 2. 接口返回异常
如果接口返回非 200 状态码，视为检测失败，允许发送。

### 3. 超时处理
建议在后端接口设置合理的超时时间（如 3 秒），避免影响用户体验。

## 性能优化

### 1. 本地预检测
在调用后端接口前，先使用正则表达式进行本地检测，只有检测到可疑内容才调用接口，减少不必要的网络请求。

### 2. 异步处理
敏感词检测使用 `async/await` 异步处理，不会阻塞 UI 线程。

### 3. 缓存机制（可选）
可以考虑添加本地缓存，对相同内容的检测结果进行缓存：
```javascript
const sensitiveCache = new Map();

async function checkSensitiveContent(text) {
    // 检查缓存
    if (sensitiveCache.has(text)) {
        return sensitiveCache.get(text);
    }
    
    // 执行检测...
    const result = await doCheck(text);
    
    // 缓存结果（设置过期时间）
    sensitiveCache.set(text, result);
    setTimeout(() => sensitiveCache.delete(text), 60000); // 1分钟后过期
    
    return result;
}
```

## 测试用例

### 测试 URL 检测
```javascript
// 应该被检测到
"访问 http://example.com 查看详情"
"请访问 www.google.com"
"网站：example.com"
"https://github.com/user/repo"

// 不应该被检测到
"这是普通消息"
"我的邮箱是 user@example.com"
```

### 测试 BTC 地址检测
```javascript
// 应该被检测到
"我的钱包地址：1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
"发送到：3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy"
"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"

// 不应该被检测到
"这是普通消息"
"我的账号是 123456789"
```

## 安全建议

1. **HTTPS 通信**：确保后端接口使用 HTTPS 加密通信
2. **速率限制**：后端接口应实现速率限制，防止滥用
3. **日志记录**：记录敏感内容检测日志，便于审计
4. **白名单机制**：可以为特定用户或域名设置白名单
5. **定期更新规则**：定期更新检测规则和敏感词库

## 扩展功能

### 1. 支持更多敏感内容类型
- 电话号码
- 邮箱地址
- 身份证号
- 银行卡号
- 其他加密货币地址（ETH、USDT 等）

### 2. 自定义敏感词库
允许用户或管理员自定义敏感词列表。

### 3. 分级处理
- **高风险**：直接阻止发送
- **中风险**：显示警告但允许发送
- **低风险**：仅记录日志

### 4. 用户反馈
允许用户对误判进行反馈，优化检测规则。

## 版本信息

- 创建日期：2026-02-05
- 版本：1.0.0
- 依赖库：无（使用原生正则表达式）
- 兼容性：所有现代浏览器

## 故障排除

### 问题 1：检测不生效
**原因：** 后端接口未启动或地址错误
**解决：** 检查接口地址和服务状态

### 问题 2：误报率高
**原因：** 正则表达式过于宽松
**解决：** 调整正则表达式，增加更精确的匹配规则

### 问题 3：影响发送速度
**原因：** 后端接口响应慢
**解决：** 优化后端接口性能，添加超时处理

## 相关文件

- `electron/scripts/WhatsApp.js` - 主要实现文件
- `/app/sensitive/check` - 后端检测接口
- `SENSITIVE_CONTENT_CHECK.md` - 本文档
