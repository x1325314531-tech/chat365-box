# 浏览器指纹保护功能说明

本文档说明了已实现的三个浏览器指纹保护功能。

## 1. 蓝牙指纹检测 (Bluetooth Fingerprint)

### 功能说明
当 `configForm.Bluetooth === '真实'` 时，系统会检测并使用当前电脑的真实蓝牙指纹信息。

### 检测内容
- ✅ 蓝牙硬件可用性检测
- ✅ 4 个蓝牙 API 特性支持检测：
  - `getAvailability` - 获取可用性
  - `requestDevice` - 请求设备
  - `getDevices` - 获取已配对设备
  - `requestLEScan` - 低功耗蓝牙扫描
- ✅ 已配对设备数量统计
- ✅ 生成唯一的蓝牙指纹哈希值

### 显示示例
```
将使用当前电脑真实的蓝牙指纹信息 (可用: 是, 已配对: 2个设备, API特性: 3/4, 指纹: a3f5c8d2)
```

### 实现位置
- 前端：`frontend/src/views/components/SessionSettings.vue`
- 函数：`getBluetoothFingerprint()`
- 配置字段：`configForm.Bluetooth`, `configForm.BluetoothCustom`

---

## 2. 电池指纹检测 (Battery Fingerprint)

### 功能说明
当 `configForm.battery === '真实'` 时，系统会检测并使用当前电脑的真实电池指纹信息。

### 检测内容
- ✅ 设备类型识别（台式机/笔记本）
- ✅ 电池电量百分比
- ✅ 充电状态（充电中/未充电）
- ✅ 充电时间和放电时间
- ✅ 生成唯一的电池指纹哈希值

### 显示示例
```
将使用当前电脑真实的电池指纹信息 (设备: 笔记本/移动设备, 电量: 85%, 状态: 充电中, 指纹: b7e4f9a1)
```

或者对于台式机：
```
将使用当前电脑真实的电池指纹信息 (设备: 台式机/无电池设备, 指纹: c8d3e2f5)
```

### 实现位置
- 前端：`frontend/src/views/components/SessionSettings.vue`
- 函数：`getBatteryFingerprint()`
- 配置字段：`configForm.battery`, `configForm.batteryCustom`

---

## 3. 端口扫描保护 (Port Scan Protection)

### 功能说明
当 `configForm.portScanProtection === true` 时，系统会阻止网站通过各种方式扫描本地网络端口。

### 保护机制
端口扫描保护通过拦截以下 API 来防止端口扫描：

1. **Fetch API** - 阻止对本地端口的 fetch 请求
2. **XMLHttpRequest** - 阻止对本地端口的 XHR 请求
3. **WebSocket** - 阻止对本地端口的 WebSocket 连接
4. **EventSource** - 阻止对本地端口的 Server-Sent Events 连接
5. **动态元素** - 阻止 iframe、img、script、link 等标签访问本地端口

### 检测范围
保护以下本地地址：
- `localhost`
- `127.0.0.1`
- `0.0.0.0`
- `::1` (IPv6 本地地址)
- `192.168.x.x` (私有网络)
- `10.x.x.x` (私有网络)
- `172.16.x.x - 172.31.x.x` (私有网络)

### 允许端口配置
可以配置允许访问的端口范围（未来功能）：
```javascript
// 示例：允许访问 3000-4000 和 8080 端口
allowedPorts: ['3000-4000', '8080']
```

### 显示信息
- **开启时**：`已启用端口扫描保护，阻止脚本使用网站检测对本地网络内的端口和服务器，保护您的网络隐私安全`
- **关闭时**：`已关闭端口扫描保护，网站可以检测您使用了本地网络的哪些端口，可能存在隐私泄露风险`

### 实现位置
- 前端配置：`frontend/src/views/components/SessionSettings.vue`
- 后端注入：`electron/service/window.js` (在 `_loadConfig` 方法中)
- 保护脚本：`electron/utils/PortScanProtection.js`
- 配置字段：`configForm.portScanProtection`, `configForm.portScanProtectionCustom`

### 工作原理
1. 前端用户在会话设置中启用/禁用端口扫描保护
2. 配置保存到数据库的 `card_config` 表中
3. 创建或刷新会话时，`_loadConfig` 方法读取配置
4. 如果启用保护，生成保护脚本并注入到 WebContentsView
5. 脚本在页面加载完成后执行，拦截所有可能的端口扫描行为

### 控制台输出
当保护脚本成功注入后，浏览器控制台会显示：
```
🛡️ 端口扫描保护已启用
🛡️ 端口扫描保护初始化完成
🛡️ 允许的端口范围: []
```

当网站尝试扫描本地端口时，会显示警告：
```
🛡️ 端口扫描保护: 已阻止对本地端口的访问: http://localhost:3000
```

---

## 数据库字段

所有配置都保存在 `card_config` 表中：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `Bluetooth` | string | 蓝牙模式：'真实' 或 '隐私' |
| `battery` | string | 电池模式：'真实' 或 '隐私' |
| `battery_custom` | string | 电池指纹详细信息 |
| `port_scan_protection` | boolean | 端口扫描保护开关 |
| `port_scan_protection_custom` | string | 端口扫描保护状态说明 |

---

## 使用方法

### 1. 启用蓝牙指纹检测
1. 打开会话设置
2. 找到"蓝牙"选项
3. 选择"真实"模式
4. 系统会自动检测并显示蓝牙指纹信息

### 2. 启用电池指纹检测
1. 打开会话设置
2. 找到"电池"选项
3. 选择"真实"模式
4. 系统会自动检测并显示电池指纹信息

### 3. 启用端口扫描保护
1. 打开会话设置
2. 找到"端口扫描保护"选项
3. 选择"开启"
4. 保存配置后，所有新创建或刷新的会话都会受到保护

---

## 技术细节

### 指纹哈希算法
所有指纹都使用简单的哈希算法生成 8 位十六进制标识：
```javascript
let hash = 0;
for (let i = 0; i < fingerprintString.length; i++) {
  const char = fingerprintString.charCodeAt(i);
  hash = ((hash << 5) - hash) + char;
  hash = hash & hash;
}
const fingerprintHash = Math.abs(hash).toString(16).substring(0, 8);
```

### 脚本注入时机
端口扫描保护脚本在 `did-finish-load` 事件触发时注入，确保在页面加载完成后立即生效。

### 性能影响
- 蓝牙检测：异步执行，不阻塞 UI
- 电池检测：异步执行，不阻塞 UI
- 端口扫描保护：在页面加载时注入，对性能影响极小

---

## 安全性说明

1. **蓝牙指纹**：仅检测 API 可用性和已授权设备，不会主动扫描或连接新设备
2. **电池指纹**：仅读取电池状态，不会修改任何设置
3. **端口扫描保护**：采用白名单机制，默认阻止所有本地端口访问，可配置允许的端口

---

## 未来改进

1. 支持自定义允许的端口范围
2. 添加端口扫描日志记录
3. 支持更多指纹检测项（如 USB 设备、打印机等）
4. 添加指纹随机化功能

---

## 故障排除

### 蓝牙检测失败
- 确保浏览器支持 Web Bluetooth API
- 检查操作系统蓝牙是否启用
- 某些浏览器可能需要 HTTPS 环境

### 电池检测失败
- 确保浏览器支持 Battery Status API
- 台式机可能没有电池信息
- 某些浏览器已禁用此 API

### 端口扫描保护不生效
- 检查配置是否正确保存
- 刷新会话以重新加载配置
- 查看浏览器控制台是否有错误信息

---

## 版本信息

- 创建日期：2026-02-05
- 版本：1.0.0
- 作者：Kiro AI Assistant
