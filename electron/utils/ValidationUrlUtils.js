/**
 * 网站网址提取与识别工具
 */
const WAValidator = require('multicoin-address-validator');

// 核心正则说明：
// 1. (https?:\/\/)? : 可选的 http 或 https 协议
// 2. (www\.)? : 可选的 www
// 3. 域名/IP部分 : 匹配合法域名字符或 IP 数字
// 4. \.[a-zA-Z]{2,11} : 匹配域名后缀（如 .com, .cn, .online 等）
// 5. (:\d+)? : 可选的端口号
// 6. (\/[\w#!:.?+=&%@!\-\/]*)? : 可选的路径和参数
const urlRegex = /\b(?:https?:\/\/|www\.)[\w\-_]+(?:\.[\w\-_]+)+(?::\d+)?(?:\/[\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?|\b[\w\-_]+(?:\.[\w\-_]+)*(?:\.(?:com|cn|net|org|io|gov|edu|me|app|info|xyz|top|site|online|vip|work|fun|icu))\b(?::\d+)?(?:\/[\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/gi;

// 专门匹配纯 IP 地址形式的网址
const ipRegex = /\b(?:https?:\/\/)?(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])(?::\d+)?(?:\/\S*)?\b/g;

// 扫描文本中的 URL
function validateUrls(text) {
    if (!text) return [];

    const results = new Set(); // 使用 Set 去重

    // 1. 扫描常规域名网址
    const urlMatches = text.match(urlRegex);
    if (urlMatches) {
        urlMatches.forEach(url => results.add(url.trim()));
    }

    // 2. 扫描纯 IP 网址
    const ipMatches = text.match(ipRegex);
    if (ipMatches) {
        ipMatches.forEach(ip => results.add(ip.trim()));
    }

    return Array.from(results).map(url => {
        return {
            url: url,
            type: identifyType(url),
            hasProtocol: url.startsWith('http')
        };
    });
}

function identifyType(url) {
    if (/^(https?:\/\/)?(?:\d{1,3}\.){3}\d{1,3}/.test(url)) return 'IP地址';
    if (/^https?:\/\//i.test(url)) return '完整URL';
    return '纯域名/缺省协议网址';
}

/**
 * 智能文本扫描器：结合正则提取与库校验
 */
const CryptoScanner = {
    // 定义需要扫描的币种及其基本正则特征（用于初步筛选）
    // 这样可以避免对整段文本进行盲目校验，提高性能
    searchConfigs: [
        { coin: 'btc', regex: /\b(1|3)[a-km-zA-NP-Z1-9]{25,34}\b|\b(bc1)[a-z0-9]{25,39}\b/g },
        { coin: 'eth', regex: /\b0x[a-fA-F0-9]{40}\b/g }, // ETH 校验也适用于 BNB/MATIC
        { coin: 'tron', regex: /\bT[a-zA-Z0-9]{33}\b/g }, // TRON 用于 USDT-TRC20
        {coin:'trx', regex:/^T[a-zA-Z0-9]{33}$/},
        {coin:'ltc', regex:/^(L|M|3)[a-zA-Z1-9]{26,33}$/},
        {coin:'doge', regex:/^(D|9|A)[a-zA-Z1-9]{33}$/},
        {coin:'sol', regex:/^[1-9A-HJ-NP-Za-km-z]{32,44}$/},
        {coin:'xrp', regex:/^r[a-zA-Z0-9]{24,34}$/},
        {coin:'bnb',regex:/^(bnb1|0x)[a-zA-Z0-9]{39,59}$/},
        {coin:'Bitcoin-like',regex:/^[1-9A-HJ-NP-Za-km-z]{32,44}$/}
    ],


    scan(text) {
        const results = [];
        
        this.searchConfigs.forEach(config => {
            // 1. 初步提取
            const matches = text.match(config.regex);
            if (matches) {
                matches.forEach(potentialAddr => {
                    // 2. 使用库进行二次算法校验 (Checksum 验证)
                    // multicoin-address-validator 使用 validate(address, currency)
                    const isValid = WAValidator.validate(potentialAddr, config.coin);
                    
                    if (isValid) {
                        results.push({
                            address: potentialAddr,
                            coin: config.coin.toUpperCase(), // 转大写展示
                            confidence: 1.0, // 算法校验通过，确定是该币种地址
                            message: `确认为有效的 ${config.coin.toUpperCase()} 地址`
                        });
                    } else {
                        // 如果正则过了但校验没过，可能是打错了或者只是长得像的乱码
                        // 这里我们可以选择不返回，或者标记为低置信度
                        // 为了严格验证，我们只返回校验通过的
                         // console.log(`校验失败: ${potentialAddr} for ${config.coin}`);
                    }
                });
            }
        });

        return results;
    }
};

function validateWalletAddress(text) { 
    return CryptoScanner.scan(text);
}

module.exports = { 
      validateUrls,
      validateWalletAddress
}