/**
 * 验证工具模块
 * 使用 validator 库进行验证，BTC 地址使用正则表达式验证
 */

const validator = require('validator');

/**
 * 验证 URL 地址
 * @param {string} text - 要检测的文本
 * @returns {Object} { hasUrl: boolean, urls: Array }
 */
function validateUrls(text) {
    const result = {
        hasUrl: false,
        urls: []
    };

    // 分割文本为单词
    const words = text.split(/\s+/);
    
    // 检查每个单词是否为有效的 URL
    for (const word of words) {
        try {
            // 使用 validator 库验证 URL
            if (validator.isURL(word, {
                protocols: ['http', 'https', 'ftp'],
                require_protocol: false,
                require_valid_protocol: true,
                allow_underscores: true,
                allow_trailing_dot: false,
                allow_protocol_relative_urls: false
            })) {
                result.hasUrl = true;
                result.urls.push(word);
            }
        } catch (e) {
            // 忽略验证错误
        }
    }

    // 额外检查：使用正则表达式捕获可能遗漏的 URL
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|co|cn|xyz|info|biz|me|app|dev|tech|top|vip|club|shop|site|online|store|cc|tv|pro|mobi|name|asia|tel|travel|museum|coop|aero|jobs|cat)[^\s]*)/gi;
    const regexMatches = text.match(urlRegex) || [];
    
    for (const match of regexMatches) {
        if (!result.urls.includes(match)) {
            result.urls.push(match);
            result.hasUrl = true;
        }
    }

    return result;
}

/**
 * 验证 BTC 地址
 * 使用增强的正则表达式和校验和验证
 * @param {string} text - 要检测的文本
 * @returns {Object} { hasBtc: boolean, addresses: Array }
 */
function validateBtcAddresses(text) {
    const result = {
        hasBtc: false,
        addresses: []
    };

    // BTC 地址正则表达式
    // Legacy (P2PKH): 以 1 开头，26-35 个字符
    // P2SH: 以 3 开头，26-35 个字符
    // Bech32 (SegWit): 以 bc1 开头，39-59 个字符
    const btcRegex = /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/g;
    const matches = text.match(btcRegex) || [];

    // 验证每个匹配的地址
    for (const match of matches) {
        try {
            if (isValidBtcAddress(match)) {
                result.hasBtc = true;
                result.addresses.push(match);
            }
        } catch (e) {
            // 验证失败，忽略该地址
            console.log('BTC 地址验证失败:', match, e.message);
        }
    }

    return result;
}

/**
 * 验证单个 BTC 地址的有效性
 * 使用 Base58 校验和验证（Legacy 和 P2SH）
 * 使用 Bech32 校验和验证（SegWit）
 * @param {string} address - BTC 地址
 * @returns {boolean} 是否有效
 */
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

/**
 * Base58 解码和校验和验证
 * 用于 Legacy (1...) 和 P2SH (3...) 地址
 */
function validateBase58(address) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const crypto = require('crypto');
    
    try {
        // 检查字符有效性
        for (let i = 0; i < address.length; i++) {
            if (ALPHABET.indexOf(address[i]) === -1) return false;
        }
        
        // Base58 解码
        let decoded = BigInt(0);
        for (let i = 0; i < address.length; i++) {
            const value = ALPHABET.indexOf(address[i]);
            decoded = decoded * BigInt(58) + BigInt(value);
        }
        
        // 转换为十六进制字符串
        let hex = decoded.toString(16);
        
        // 处理前导零
        for (let i = 0; i < address.length && address[i] === '1'; i++) {
            hex = '00' + hex;
        }
        
        // 确保偶数长度
        if (hex.length % 2) hex = '0' + hex;
        
        // 转换为字节数组
        const bytes = Buffer.from(hex, 'hex');
        
        // 检查最小长度（至少 25 字节）
        if (bytes.length < 25) return false;
        
        // 提取校验和（最后 4 字节）
        const payload = bytes.slice(0, -4);
        const checksum = bytes.slice(-4);
        
        // 计算校验和（双 SHA256 的前 4 字节）
        const hash1 = crypto.createHash('sha256').update(payload).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        
        // 验证校验和
        return checksum.equals(hash2.slice(0, 4));
    } catch (e) {
        console.log('Base58 验证错误:', e.message);
        return false;
    }
}

/**
 * Bech32 地址验证
 * 用于 SegWit 地址 (bc1...)
 */
function validateBech32(address) {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    
    try {
        // 转换为小写
        address = address.toLowerCase();
        
        // 检查格式
        if (!address.startsWith('bc1')) return false;
        
        // 分离 HRP (bc) 和数据部分
        const pos = address.lastIndexOf('1');
        if (pos < 1 || pos + 7 > address.length || address.length > 90) {
            return false;
        }
        
        const hrp = address.substring(0, pos);
        const data = address.substring(pos + 1);
        
        // 验证字符集
        for (let i = 0; i < data.length; i++) {
            if (CHARSET.indexOf(data[i]) === -1) return false;
        }
        
        // 验证校验和
        const values = [];
        for (let i = 0; i < data.length; i++) {
            values.push(CHARSET.indexOf(data[i]));
        }
        
        return verifyBech32Checksum(hrp, values);
    } catch (e) {
        return false;
    }
}

/**
 * 验证 Bech32 校验和
 */
function verifyBech32Checksum(hrp, data) {
    const expanded = [];
    for (let i = 0; i < hrp.length; i++) {
        expanded.push(hrp.charCodeAt(i) >> 5);
    }
    expanded.push(0);
    for (let i = 0; i < hrp.length; i++) {
        expanded.push(hrp.charCodeAt(i) & 31);
    }
    
    let chk = 1;
    for (let i = 0; i < expanded.length; i++) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ expanded[i];
        for (let j = 0; j < 5; j++) {
            if ((top >> j) & 1) {
                chk ^= [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3][j];
            }
        }
    }
    
    for (let i = 0; i < data.length; i++) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ data[i];
        for (let j = 0; j < 5; j++) {
            if ((top >> j) & 1) {
                chk ^= [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3][j];
            }
        }
    }
    
    return chk === 1;
}

/**
 * 验证以太坊地址（可选扩展）
 * @param {string} text - 要检测的文本
 * @returns {Object} { hasEth: boolean, addresses: Array }
 */
function validateEthAddresses(text) {
    const result = {
        hasEth: false,
        addresses: []
    };

    // 以太坊地址正则表达式：0x 开头，后跟 40 个十六进制字符
    const ethRegex = /\b0x[a-fA-F0-9]{40}\b/g;
    const matches = text.match(ethRegex) || [];

    if (matches.length > 0) {
        result.hasEth = true;
        result.addresses = matches;
    }

    return result;
}

/**
 * 综合验证函数
 * @param {string} text - 要检测的文本
 * @returns {Object} 验证结果
 */
function validateContent(text) {
    const urlResult = validateUrls(text);
    const btcResult = validateBtcAddresses(text);
    const ethResult = validateEthAddresses(text);

    return {
        hasUrl: urlResult.hasUrl,
        urls: urlResult.urls,
        hasBtc: btcResult.hasBtc,
        btcAddresses: btcResult.addresses,
        hasEth: ethResult.hasEth,
        ethAddresses: ethResult.addresses,
        hasSensitiveContent: urlResult.hasUrl || btcResult.hasBtc || ethResult.hasEth
    };
}

module.exports = {
    validateUrls,
    validateBtcAddresses,
    validateEthAddresses,
    validateContent
};
