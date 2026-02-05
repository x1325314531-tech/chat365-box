# 会话编辑接口集成说明

## 功能概述

在编辑模式下（`props.isEdit === true`），SessionSettings 组件会调用 `/app/session/{sessionId}` 接口获取会话详情，并将所有配置数据回显到表单中。

## API 接口

### 获取会话详情
```
GET /app/session/{sessionId}
```

**响应格式：**
```json
{
  "code": 200,
  "data": {
    "sessionId": "xxx",
    "sessionName": "会话名称",
    "cardId": "xxx",
    "platform": "WhatsApp",
    "moreOptions": "{...}" // JSON 字符串或对象
  }
}
```

## 数据流程

### 1. 编辑模式触发
```javascript
if (props.isEdit && props.card) {
  // 调用会话详情接口
  const sessionRes = await get(`/app/session/${props.card.sessionId}`);
}
```

### 2. 解析 moreOptions
```javascript
let moreOptions = {};
if (sessionData.moreOptions) {
  moreOptions = typeof sessionData.moreOptions === 'string' 
    ? JSON.parse(sessionData.moreOptions) 
    : sessionData.moreOptions;
}
```

### 3. 数据回显
所有配置项都会从 `moreOptions` 中读取并回显到 `configForm`：

#### 基本信息
- `sessionId` - 会话 ID
- `cardId` - 卡片 ID
- `name` - 会话名称

#### 代理配置
- `proxyStatus` - 代理状态
- `proxy` - 代理类型
- `host` - 主机地址
- `port` - 端口
- `username` - 用户名
- `password` - 密码

#### 指纹配置
- `fingerprintSwitch` - 指纹开关
- `browser` - 浏览器版本
- `os` - 操作系统
- `userAgent` - User Agent

#### WebGL 配置
- `webglMetadata` - WebGL 元数据模式
- `webglVendor` - WebGL 厂商
- `webglRenderer` - WebGL 渲染器
- `webgpu` - WebGPU 模式
- `webglImage` - WebGL 图像模式

#### 其他指纹配置
- `webrtc` - WebRTC 模式
- `timezone` - 时区设置
- `geolocation` - 地理位置设置
- `language` - 语言设置
- `languages` - 语言列表
- `resolution` - 分辨率设置
- `font` - 字体设置
- `canvas` - Canvas 模式
- `audioContext` - AudioContext 模式
- `mediaDevices` - 媒体设备模式
- `clientRects` - ClientRects 模式
- `speechVoices` - SpeechVoices 模式
- `cpuCores` - CPU 内核数设置
- `memory` - 内存设置
- `doNotTrack` - Do Not Track 设置
- `screen` - 屏幕模式
- `Bluetooth` - 蓝牙模式
- `battery` - 电池模式
- `portScanProtection` - 端口扫描保护
- `cookie` - Cookie 数据

## 错误处理

### 1. 接口调用失败
```javascript
if (sessionRes.code !== 200) {
  ElMessage.error('获取会话详情失败');
}
```

### 2. JSON 解析失败
```javascript
try {
  moreOptions = JSON.parse(sessionData.moreOptions);
} catch (e) {
  console.error('解析 moreOptions 失败:', e);
}
```

### 3. 网络错误
```javascript
catch (error) {
  console.error('获取会话详情出错:', error);
  ElMessage.error('获取会话详情出错，请稍后重试');
}
```

## 使用示例

### 1. 新建会话
```javascript
// props.isEdit = false
// 表单使用默认值初始化
```

### 2. 编辑会话
```javascript
// props.isEdit = true
// props.card = { sessionId: 'xxx', card_id: 'xxx' }
// 自动调用 GET /app/session/xxx 获取详情并回显
```

## 注意事项

1. **异步加载**：`fetchConfig` 现在是异步函数，使用 `async/await`
2. **数据类型**：确保 `moreOptions` 中的布尔值正确处理（如 `fingerprintSwitch`、`doNotTrack` 等）
3. **默认值**：如果某个字段不存在，会使用默认值
4. **分辨率特殊处理**：分辨率会自动组合成 `width*height` 格式显示
5. **语言数组**：`languages` 字段是数组类型，需要正确处理

## 调试信息

在开发模式下，控制台会输出：
```javascript
console.log('编辑模式，加载会话详情:', props.card);
console.log('会话详情加载成功:', configForm);
```

## 版本信息

- 更新日期：2026-02-05
- 版本：2.0.0
- 变更：从 IPC 调用改为 HTTP API 调用
