# 敏感词检测 API 接口示例

## 接口规范

### 请求
```
POST /app/sensitive/check
Content-Type: application/json
```

**请求体：**
```json
{
  "content": "要检测的消息内容"
}
```

### 响应
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
        "sensitiveWord": "薄熙来",
        "status": null
    }
}
```

## Node.js + Express 实现示例

```javascript
const express = require('express');
const router = express.Router();

// 敏感词检测接口
router.post('/app/sensitive/check', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.json({
        code: 400,
        message: '内容不能为空',
        data: null
      });
    }
    
    // 执行检测
    const result = await checkSensitiveContent(content);
    
    return res.json({
      code: 200,
      message: 'success',
      data: result
    });
    
  } catch (error) {
    console.error('敏感词检测失败:', error);
    return res.json({
      code: 500,
      message: '服务器错误',
      data: null
    });
  }
});

// 敏感词检测逻辑
async function checkSensitiveContent(content) {
  const result = {
    isSensitive: false,
    reason: '',
    details: {}
  };
  
  // 1. URL 检测
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|co|cn|xyz|info|biz|me|app|dev|tech)[^\s]*)/gi;
  const urlMatches = content.match(urlRegex);
  
  if (urlMatches && urlMatches.length > 0) {
    // 检查是否在白名单中
    const isWhitelisted = await checkUrlWhitelist(urlMatches);
    
    if (!isWhitelisted) {
      result.isSensitive = true;
      result.reason = '内容包含未授权的 URL 地址';
      result.details = {
        type: 'url',
        matches: urlMatches
      };
      return result;
    }
  }
  
  // 2. BTC 地址检测
  const btcRegex = /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/g;
  const btcMatches = content.match(btcRegex);
  
  if (btcMatches && btcMatches.length > 0) {
    result.isSensitive = true;
    result.reason = '内容包含比特币地址';
    result.details = {
      type: 'btc',
      matches: btcMatches
    };
    return result;
  }
  
  // 3. 自定义敏感词检测
  const sensitiveWords = await getSensitiveWords();
  for (const word of sensitiveWords) {
    if (content.toLowerCase().includes(word.toLowerCase())) {
      result.isSensitive = true;
      result.reason = `内容包含敏感词：${word}`;
      result.details = {
        type: 'keyword',
        matches: [word]
      };
      return result;
    }
  }
  
  return result;
}

// 检查 URL 白名单
async function checkUrlWhitelist(urls) {
  // 白名单域名列表
  const whitelist = [
    'google.com',
    'youtube.com',
    'github.com',
    'stackoverflow.com'
  ];
  
  for (const url of urls) {
    const isWhitelisted = whitelist.some(domain => url.includes(domain));
    if (!isWhitelisted) {
      return false;
    }
  }
  
  return true;
}

// 获取敏感词列表（从数据库或配置文件）
async function getSensitiveWords() {
  // 示例敏感词列表
  return [
    '赌博',
    '色情',
    '毒品',
    '枪支',
    '诈骗'
  ];
}

module.exports = router;
```

## 使用 validator 库增强 URL 验证

```javascript
const validator = require('validator');

// 更精确的 URL 检测
function isValidUrl(text) {
  try {
    // 使用 validator 库验证
    return validator.isURL(text, {
      protocols: ['http', 'https'],
      require_protocol: false,
      require_valid_protocol: true,
      allow_underscores: true
    });
  } catch (e) {
    return false;
  }
}

// 在检测函数中使用
async function checkSensitiveContent(content) {
  // 提取可能的 URL
  const words = content.split(/\s+/);
  const urls = words.filter(word => isValidUrl(word));
  
  if (urls.length > 0) {
    // 检查白名单...
  }
}
```

## 使用原生算法验证 BTC 地址

```javascript
// BTC 地址验证（使用 Base58 和 Bech32 校验和）
function isValidBtcAddress(address) {
  // Bech32 地址验证 (bc1...)
  if (address.startsWith('bc1')) {
    return validateBech32(address);
  }
  
  // Legacy 和 P2SH 地址验证 (1... 或 3...)
  if (address.startsWith('1') || address.startsWith('3')) {
    return validateBase58(address);
  }
  
  return false;
}

// Base58 解码和双 SHA256 校验和验证
function validateBase58(address) {
  const crypto = require('crypto');
  // Base58 解码...
  // 提取校验和（最后 4 字节）
  const payload = bytes.slice(0, -4);
  const checksum = bytes.slice(-4);
  
  // 计算校验和（双 SHA256 的前 4 字节）
  const hash1 = crypto.createHash('sha256').update(payload).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  
  // 验证校验和
  return checksum.equals(hash2.slice(0, 4));
}

// Bech32 校验和验证
function validateBech32(address) {
  // Bech32 解码和多项式校验和验证...
  return verifyBech32Checksum(hrp, values);
}

// 在检测函数中使用
async function checkSensitiveContent(content) {
  // 提取可能的 BTC 地址
  const btcRegex = /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/g;
  const matches = content.match(btcRegex) || [];
  
  const validBtcAddresses = matches.filter(addr => isValidBtcAddress(addr));
  
  if (validBtcAddresses.length > 0) {
    return {
      isSensitive: true,
      reason: '内容包含比特币地址',
      details: {
        type: 'btc',
        matches: validBtcAddresses
      }
    };
  }
}
```

## 完整示例（带库验证）

```javascript
const express = require('express');
const validator = require('validator');
const router = express.Router();

router.post('/app/sensitive/check', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.json({
        code: 400,
        message: '内容不能为空',
        data: null
      });
    }
    
    const result = {
      isSensitive: false,
      reason: '',
      details: {}
    };
    
    // 1. URL 检测（使用 validator 库）
    const words = content.split(/\s+/);
    const urls = words.filter(word => {
      try {
        return validator.isURL(word, {
          protocols: ['http', 'https'],
          require_protocol: false
        });
      } catch (e) {
        return false;
      }
    });
    
    if (urls.length > 0) {
      // 检查白名单
      const whitelist = ['google.com', 'youtube.com', 'github.com'];
      const hasUnauthorizedUrl = urls.some(url => {
        return !whitelist.some(domain => url.includes(domain));
      });
      
      if (hasUnauthorizedUrl) {
        result.isSensitive = true;
        result.reason = '内容包含未授权的 URL 地址';
        result.details = {
          type: 'url',
          matches: urls
        };
        
        return res.json({
          code: 200,
          message: 'success',
          data: result
        });
      }
    }
    
    // 2. BTC 地址检测（使用原生校验和验证）
    const btcRegex = /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/g;
    const btcMatches = content.match(btcRegex) || [];
    const validBtcAddresses = btcMatches.filter(addr => {
      try {
        return isValidBtcAddress(addr); // 使用自定义验证函数
      } catch (e) {
        return false;
      }
    });
    
    if (validBtcAddresses.length > 0) {
      result.isSensitive = true;
      result.reason = '内容包含比特币地址';
      result.details = {
        type: 'btc',
        matches: validBtcAddresses
      };
      
      return res.json({
        code: 200,
        message: 'success',
        data: result
      });
    }
    
    // 3. 自定义敏感词检测
    const sensitiveWords = ['赌博', '色情', '毒品', '枪支', '诈骗'];
    for (const word of sensitiveWords) {
      if (content.toLowerCase().includes(word.toLowerCase())) {
        result.isSensitive = true;
        result.reason = `内容包含敏感词：${word}`;
        result.details = {
          type: 'keyword',
          matches: [word]
        };
        
        return res.json({
          code: 200,
          message: 'success',
          data: result
        });
      }
    }
    
    // 没有检测到敏感内容
    return res.json({
      code: 200,
      message: 'success',
      data: result
    });
    
  } catch (error) {
    console.error('敏感词检测失败:', error);
    return res.json({
      code: 500,
      message: '服务器错误',
      data: null
    });
  }
});

// BTC 地址验证函数（Base58 + Bech32）
function isValidBtcAddress(address) {
  if (address.startsWith('bc1')) {
    return validateBech32(address);
  }
  if (address.startsWith('1') || address.startsWith('3')) {
    return validateBase58(address);
  }
  return false;
}

// Base58 验证（使用 crypto 模块）
function validateBase58(address) {
  const crypto = require('crypto');
  // ... Base58 解码和校验和验证实现
}

// Bech32 验证
function validateBech32(address) {
  // ... Bech32 解码和校验和验证实现
}

module.exports = router;
```

## 安装依赖

```bash
npm install validator
```

注意：BTC 地址验证使用原生 Node.js crypto 模块，无需额外依赖。

## 测试接口

### 使用 curl 测试

```bash
# 测试普通消息
curl -X POST http://localhost:3000/app/sensitive/check \
  -H "Content-Type: application/json" \
  -d '{"content":"这是一条普通消息"}'

# 测试包含 URL 的消息
curl -X POST http://localhost:3000/app/sensitive/check \
  -H "Content-Type: application/json" \
  -d '{"content":"访问 http://example.com 查看详情"}'

# 测试包含 BTC 地址的消息
curl -X POST http://localhost:3000/app/sensitive/check \
  -H "Content-Type: application/json" \
  -d '{"content":"我的钱包地址：1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}'
```

### 使用 Postman 测试

1. 创建新请求
2. 方法：POST
3. URL：`http://localhost:3000/app/sensitive/check`
4. Headers：`Content-Type: application/json`
5. Body (raw JSON)：
```json
{
  "content": "访问 http://example.com 查看详情"
}
```

## 性能优化建议

1. **缓存机制**：对相同内容的检测结果进行缓存
2. **异步处理**：使用消息队列处理大量检测请求
3. **数据库索引**：为敏感词表建立索引
4. **限流**：使用 Redis 实现接口限流
5. **日志记录**：记录检测日志便于分析和优化

## 扩展功能

1. **机器学习**：使用 AI 模型进行更智能的内容检测
2. **多语言支持**：支持多种语言的敏感词检测
3. **实时更新**：支持动态更新敏感词库
4. **统计分析**：提供敏感内容统计和分析功能
5. **用户反馈**：允许用户对误判进行反馈
