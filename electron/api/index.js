const request = require('../utils/request'); // 导入工具类
const path = require('path');
const { app} = require('electron');
const Log = require('ee-core/log');
const { validateContent } = require('../utils/ValidationUtils'); // 导入验证工具
const { validateUrls, validateWalletAddress} = require('../utils/ValidationUrlUtils')
const fs = require('fs');
const FormData = require('form-data');

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
        const sensitiveResponse = await request.post(`/app/sensitive/check`,  sensitiveRequestBody);
        Log.info('敏感词检测响应结果:', sensitiveResponse);
        
        // 检查敏感词接口返回
        if (sensitiveResponse.code === 200 && sensitiveResponse.data && sensitiveResponse.data.sensitiveWord) {
             // 触发验证请求 (Sensitive Word - Type 0)
             try {
                 const triggerRequestBody = {
                      triggerContent: content,
                     triggerType: 0,
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
            const triggerType = hasCrypto ? 2 : 1;

            const triggerRequestBody = {
                triggerContent: content,
                // hasUrl: hasUrl,
                // hasCrypto: hasCrypto,
                // urls: urlResults,
                // crypto: cryptoResults,
                triggerType: triggerType.toString()
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


// 实现图片翻译函数
async function translateImage(filePath, fromLang, targetLang) {
    try {
        if (!fs.existsSync(filePath)) {
             throw new Error('文件不存在');
        }
        
        const formData = new FormData();
        const fileName = path.basename(filePath);
        
        // 显式指定文件名和 Content-Type，确保后端正确识别
        formData.append('file', fs.createReadStream(filePath), {
            filename: fileName,
            contentType: 'image/png'
        });

        Log.info('开始图片翻译:', { filePath, from: fromLang, target: targetLang });

        // query params in URL
        const url = `/app/mediaTranslate/image?from=${fromLang}&target=${targetLang}`;
        
        // 传递 headers, formData.getHeaders() 会包含 Content-Type 和 boundry
        const config = {
            headers: {
                ...formData.getHeaders()
            }
        };
        Log.info('图片请求参数', { url, fileName, headers: config.headers });
        
        const response = await request.post(url, formData, config);
        Log.info('图片翻译响应:', response);

        if (response.code === 200) {
            let finalData = response.data;
            
            // 如果 data 是对象且包含 error_code，直接解包
            if (finalData && typeof finalData === 'object' && finalData.error_code === "0") {
                finalData = finalData.data || finalData;
            } else if (finalData && typeof finalData === 'object' && (finalData.error_code || (finalData.code && finalData.code !== 200))) {
                Log.error('图片翻译服务内部错误:', finalData);
                return { 
                    success: false, 
                    msg: finalData.error_msg || finalData.msg || `翻译接口内部错误(${finalData.error_code || finalData.code})` 
                };
            }

            try {
                // 如果 data 是 JSON 字符串，尝试解析以检查内部错误
                if (typeof finalData === 'string' && (finalData.startsWith('{') || finalData.startsWith('['))) {
                    const parsedData = JSON.parse(finalData);
                    
                    // 检查服务内部错误码
                    // 如果 error_code 是 "0"，说明成功，提取内部 data
                    if (parsedData.error_code === "0") {
                        finalData = parsedData.data || parsedData;
                    } else if (parsedData.error_code || (parsedData.code && parsedData.code !== 200)) {
                        // 处理非 0 的错误码
                        Log.error('图片翻译服务内部错误:', parsedData);
                        return { 
                            success: false, 
                            msg: parsedData.error_msg || parsedData.msg || `翻译接口内部错误(${parsedData.error_code || parsedData.code})` 
                        };
                    } else {
                        finalData = parsedData;
                    }
                }
            } catch (e) {
                Log.warn('尝试解析响应数据失败，按原样返回:', e.message);
            }
             Log.info('图片翻译结果响应:', finalData);
            return { success: true, data: finalData };
        } else {
            return { success: false, msg: response.msg || '图片翻译请求失败' };
        }
    } catch (error) {
        Log.error('图片翻译异常:', error);
        return { success: false, msg: error.message || '图片翻译通信异常' };
    }
}

// 实现语音翻译函数
async function translateVoice(filePath, fromLang, targetLang, format) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error('语音文件不存在');
        }

        const formData = new FormData();
        const fileName = path.basename(filePath);
        
        // 显式指定文件名和 Content-Type
        formData.append('file', fs.createReadStream(filePath), {
            filename: fileName,
            contentType: `audio/${format}`
        });

        Log.info('开始语音翻译:', { filePath, from: fromLang, target: targetLang, format });

        // query params in URL
        const url = `/app/mediaTranslate/voice?from=${fromLang}&target=${targetLang}&format=${format}`;
        
        const config = {
            headers: {
                ...formData.getHeaders()
            }
        };
        Log.info('语音请求参数', { url, fileName, headers: config.headers });
        
        const response = await request.post(url, formData, config);
        Log.info('语音翻译原始响应:', JSON.stringify(response));

        if (response && response.code === 200) {
            let finalData = response.data;
            
            // 尝试解析可能的内部错误结构 (与图片翻译类似)
            if (finalData && typeof finalData === 'object' && finalData.error_code === "0") {
                finalData = finalData.data || finalData;
            } else if (finalData && typeof finalData === 'object' && (finalData.error_code || (finalData.code && finalData.code !== 200))) {
                Log.error('语音翻译服务内部错误:', finalData);
                return { 
                    success: false, 
                    msg: finalData.error_msg || finalData.msg || `翻译接口内部错误(${finalData.error_code || finalData.code})` 
                };
            }

            try {
                if (typeof finalData === 'string' && (finalData.startsWith('{') || finalData.startsWith('['))) {
                    const parsedData = JSON.parse(finalData);
                    if (parsedData.error_code === "0") {
                        finalData = parsedData.data || parsedData;
                    } else if (parsedData.error_code || (parsedData.code && parsedData.code !== 200)) {
                        Log.error('语音翻译服务内部错误 (parsed):', parsedData);
                        return { 
                            success: false, 
                            msg: parsedData.error_msg || parsedData.msg || `翻译接口内部错误(${parsedData.error_code || parsedData.code})` 
                        };
                    } else {
                        finalData = parsedData;
                    }
                }
            } catch (e) {
                Log.warn('语音响应解析失败:', e.message);
            }

            return { success: true, data: finalData };
        } else {
            return { success: false, msg: response.msg || '语音翻译请求失败' };
        }
    } catch (error) {
        Log.error('语音翻译异常:', error);
        return { success: false, msg: error.message || '语音翻译通信异常' };
    }
}

// 导出业务请求函数
module.exports = {
    translateText,
    getLanguages,
    checkSensitiveContent,
    translateImage,
    translateVoice
};
