const request = require('../utils/request'); // 导入工具类
const { app} = require('electron');
const Log = require('ee-core/log');
const { validateContent } = require('../utils/ValidationUtils'); // 导入验证工具
const { validateUrls, validateWalletAddress} = require('../utils/ValidationUrlUtils')

//获取语言列表
async function getLanguages() {
    try {
        // 调用封装好的 get 请求，发送到指定的端点
        return await request.get('/app/languageList/languageList'); // 返回数据以供其他地方使用
    } catch (error) {
        throw error; // 抛出错误以便调用方处理
    }
}
// 实现 translateText 函数
async function translateText(text,localLanguage, targetLanguage) {

    const requestBody = {
        fromLang: localLanguage, // 假设源语言为本地语言
        targetLang: targetLanguage,
        text: text,
        // authCode:'18e6f894-2dca-4fbb-a66a-efedcc7a28e2',  // 假设 authCode 已定义在 window 中app.authCode
    };
    
     Log.info('requestBody',requestBody)
    try {
        // 使用封装好的 request 模块的 POST 方法发送数据
        const response = await request.post('/app/translate', requestBody);
        Log.info('响应结果：',response)
       
        // 判断响应状态码
        if (response.code === 200) {
            return { success: true, data: response.data }; // 返回翻译结果
        } else {
            // 业务错误，返回错误信息
            return { success: false, msg: response.msg || '翻译服务异常' };
        }
    } catch (error) {
        Log.error('translateText 接口请求失败:', error);
        return { success: false, msg: '网络请求失败，请检查网络连接' };
    }
}

// 实现敏感词检测函数
async function checkSensitiveContent(content) {
    const sensitiveRequestBody = {
        content: content
    };
    
    Log.info('敏感词检测请求:', sensitiveRequestBody);
    
    try {
        // 1. 调用敏感词检测接口
        const sensitiveResponse = await request.post('/app/sensitive/check', sensitiveRequestBody);
        Log.info('敏感词检测响应:', sensitiveResponse);
        
        // 检查敏感词接口返回
        if (sensitiveResponse.code === 200 && sensitiveResponse.data && sensitiveResponse.data.sensitiveWord) {
             // 触发验证请求 (Sensitive Word - Type 1)
             try {
                 const triggerRequestBody = {
                     content: content,
                     triggerType: 1,
                     sensitiveWord: sensitiveResponse.data.sensitiveWord
                 };
                 Log.info('触发验证请求 (Type 1):', triggerRequestBody);
                 await request.post('/app/trigger', triggerRequestBody);
             } catch (triggerError) {
                 Log.error('Type 1 触发验证接口失败:', triggerError);
             }

             return {
                success: true,
                data: {
                    isSensitive: true,
                    reason: `内容包含敏感词: ${sensitiveResponse.data.sensitiveWord}`,
                    details: sensitiveResponse.data
                }
            };
        }

        // 2. 本地检测 URL 和 加密货币地址
        const urlResults = validateUrls(content);
        const cryptoResults = validateWalletAddress(content); // 这里返回的是 CryptoScanner.scan 的结果数组

        const hasUrl = urlResults.length > 0;
        const hasCrypto = cryptoResults.length > 0;

        if (hasUrl || hasCrypto) {
            Log.info('本地检测到敏感内容 (URL/Crypto):', { urls: urlResults, crypto: cryptoResults });

            // 3. 如果包含 URL 或 Crypto 地址，调用 /app/trigger 接口验证
            // 优先级：加密货币 (3) > URL (2)
            const triggerType = hasCrypto ? 3 : 2;

            const triggerRequestBody = {
                content: content,
                // hasUrl: hasUrl,
                // hasCrypto: hasCrypto,
                // urls: urlResults,
                // crypto: cryptoResults,
                triggerType: triggerType
            };
            
            Log.info(`触发验证请求 (Type ${triggerType}):`, triggerRequestBody);

            let triggerResponse;
            try {
                 triggerResponse = await request.post('/app/trigger', triggerRequestBody);
                 Log.info('触发验证响应:', triggerResponse);
            } catch (triggerError) {
                 Log.error('触发验证接口调用失败:', triggerError);
                 return {
                    success: true,
                    data: {
                        isSensitive: true, 
                        reason: '安全验证服务连接失败，请稍后重试',
                        details: { error: triggerError.message }
                    }
                };
            }

            if (triggerResponse && (triggerResponse.code === 200 || triggerResponse.success)) {
                 // 假设后端逻辑：如果 trigger 认为需要阻止，会返回 code!=200 或 data.block=true
                 if (triggerResponse.data && (triggerResponse.data.block || triggerResponse.data.sensitiveWord)) {
                     return {
                        success: true,
                        data: {
                            isSensitive: true,
                            reason: triggerResponse.data.msg || '内容包含受限链接或地址',
                            details: triggerResponse.data
                        }
                    };
                 }
            } else {
                 // trigger 接口返回非 200，视为阻止
                 return {
                    success: true,
                    data: {
                        isSensitive: true,
                        reason: triggerResponse.msg || '内容安全验证未通过',
                        details: triggerResponse
                    }
                };
            }
        }
        
        // 所有检查通过
        return { 
            success: true, 
            data: {
                isSensitive: false,
                reason: '',
                details: {}
            }
        };
        
    } catch (error) {
        Log.error('敏感词检测流程异常:', error);
         return { 
            success: false, 
            msg: '安全检测服务异常',
            data: {
                isSensitive: false, // 暂时放行，或者改为 true 阻止
                reason: '检测服务连接超时',
                details: {}
            }
        };
    }
}

// 导出业务请求函数
module.exports = {
    translateText,
    getLanguages,
    checkSensitiveContent
};
