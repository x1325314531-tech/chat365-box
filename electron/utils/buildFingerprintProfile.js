/**
 * 指纹伪装工具类
 * 用于生成注入到 WebContents 的 JavaScript 脚本和 Electron 配置项
 */
class FingerprintProfile {
    /**
     * 根据数据库配置生成指纹伪装脚本
     * @param {Object} config 
     * @returns {string} 注入脚本
     */
    static generateInjectionScript(config) {
        const {
            fingerprintSwitch,
            os,
            webglMetadata,
            webglVendor,
            webglRenderer,
            webgpu,
            webglImage,
            webrtc,
            timezone,
            geolocation,
            geolocationCustom,
            geolocationLatitude,
            geolocationLongitude,
            geolocationAccuracy,
            language,
            languages,
            resolution,
            resolutionWidth,
            resolutionHeight,
            font,
            fontCustom,
            canvas,
            audioContext,
            mediaDevices,
            clientRects,
            speechVoices,
            cpuCores,
            cpuCoresCustom,
            memory,
            memoryCustom,
            doNotTrack,
            screen,
            bluetooth,
            battery,
            portScanProtection,
            webrtcCustom,
            languageCustom
        } = config;

        // 如果指纹开关关闭，返回空脚本
        if (fingerprintSwitch === false || fingerprintSwitch === 'false') {
            return '';
        }

        const scripts = [];

        // 1. 硬件核心数 (CPU Cores)
        if (cpuCores === '自定义' && cpuCoresCustom) {
            scripts.push(`
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                    get: () => ${parseInt(cpuCoresCustom) || 8}
                });
            `);
        }

        // 2. 内存大小 (Memory)
        if (memory === '自定义' && memoryCustom) {
            scripts.push(`
                Object.defineProperty(navigator, 'deviceMemory', {
                    get: () => ${parseInt(memoryCustom) || 8}
                });
            `);
        }

        // 3. 语言 (Languages)
        if (language === '自定义' && languages) {
            let langList = [];
            try {
                langList = typeof languages === 'string' ? JSON.parse(languages) : languages;
            } catch (e) {
                langList = [languages];
            }
            if (Array.isArray(langList) && langList.length > 0) {
                scripts.push(`
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ${JSON.stringify(langList)}
                    });
                    Object.defineProperty(navigator, 'language', {
                        get: () => ${JSON.stringify(langList[0])}
                    });
                `);
            }
        }

        // 4. WebGL 伪装 (Vendor & Renderer)
        if (webglMetadata === '自定义' && webglVendor && webglRenderer) {
            scripts.push(`
                const getParameterProxy = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    // UNMASKED_VENDOR_WEBGL
                    if (parameter === 37445) {
                        return ${JSON.stringify(webglVendor)};
                    }
                    // UNMASKED_RENDERER_WEBGL
                    if (parameter === 37446) {
                        return ${JSON.stringify(webglRenderer)};
                    }
                    return getParameterProxy.apply(this, arguments);
                };
                
                const getParameterProxy2 = WebGL2RenderingContext.prototype.getParameter;
                if (getParameterProxy2) {
                    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
                        if (parameter === 37445) return ${JSON.stringify(webglVendor)};
                        if (parameter === 37446) return ${JSON.stringify(webglRenderer)};
                        return getParameterProxy2.apply(this, arguments);
                    };
                }
            `);
        }

        // 5. Canvas 噪音 (Canvas Noise)
        if (canvas === '噪音') {
            scripts.push(`
                const toDataURLProxy = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function() {
                    const ctx = this.getContext('2d');
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, 1, 1);
                        imageData.data[0] = (imageData.data[0] + 1) % 255;
                        ctx.putImageData(imageData, 0, 0);
                    }
                    return toDataURLProxy.apply(this, arguments);
                };
            `);
        }

        // 6. AudioContext 噪音
        if (audioContext === '噪音') {
            scripts.push(`
                const originalGetChannelData = AudioBuffer.prototype.getChannelData;
                AudioBuffer.prototype.getChannelData = function() {
                    const data = originalGetChannelData.apply(this, arguments);
                    for (let i = 0; i < 5; i++) {
                        data[i] = data[i] + (Math.random() * 0.0000001);
                    }
                    return data;
                };
            `);
        }

        // 7. 分辨率和屏幕信息 (Resolution & Screen)
        if (resolution === '自定义' && resolutionWidth && resolutionHeight) {
            const w = parseInt(resolutionWidth);
            const h = parseInt(resolutionHeight);
            scripts.push(`
                Object.defineProperty(window.screen, 'width', { get: () => ${w} });
                Object.defineProperty(window.screen, 'height', { get: () => ${h} });
                Object.defineProperty(window.screen, 'availWidth', { get: () => ${w} });
                Object.defineProperty(window.screen, 'availHeight', { get: () => ${h} });
                Object.defineProperty(window, 'innerWidth', { get: () => ${w} });
                Object.defineProperty(window, 'innerHeight', { get: () => ${h} });
                Object.defineProperty(window, 'outerWidth', { get: () => ${w} });
                Object.defineProperty(window, 'outerHeight', { get: () => ${h} });
            `);
        }

        // 8. Do Not Track
        if (doNotTrack === true || doNotTrack === 'true') {
            scripts.push(`
                Object.defineProperty(navigator, 'doNotTrack', { get: () => "1" });
            `);
        }

        // 9. 时区 (通过修改 Intl 对象)
        if (timezone === '自定义' && config.timezoneCustom) {
            scripts.push(`
                const originalDateTimeFormat = Intl.DateTimeFormat;
                Intl.DateTimeFormat = function(locale, options) {
                    if (options && !options.timeZone) {
                        options.timeZone = ${JSON.stringify(config.timezoneCustom)};
                    } else if (!options) {
                        options = { timeZone: ${JSON.stringify(config.timezoneCustom)} };
                    }
                    return new originalDateTimeFormat(locale, options);
                };
                Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
                Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;
            `);
        }

        // 10. WebRTC 禁用 (Privacy mode) 或 替换 (Custom IP)
        if (webrtc === '禁用') {
            scripts.push(`
                window.RTCPeerConnection = undefined;
                window.webkitRTCPeerConnection = undefined;
            `);
        } else if (webrtc === '替换' && webrtcCustom) {
            scripts.push(`
                (function() {
                    const customIP = ${JSON.stringify(webrtcCustom)};
                    const originalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
                    if (!originalRTCPeerConnection) return;

                    const HookRTCPeerConnection = function(arg) {
                        const pc = new originalRTCPeerConnection(arg);
                        const originalCreateOffer = pc.createOffer;
                        pc.createOffer = function() {
                            return originalCreateOffer.apply(this, arguments).then(offer => {
                                if (offer && offer.sdp) {
                                    offer.sdp = offer.sdp.replace(
                                        /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g,
                                        customIP
                                    );
                                }
                                return offer;
                            });
                        };
                        return pc;
                    };

                    window.RTCPeerConnection = HookRTCPeerConnection;
                    window.webkitRTCPeerConnection = HookRTCPeerConnection;
                    if (originalRTCPeerConnection.prototype) {
                        HookRTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
                    }
                })();
            `);
        }

        // 11. 地理位置
        if (geolocation === '禁止') {
            scripts.push(`
                navigator.geolocation.getCurrentPosition = (success, error) => {
                    if (error) error({ code: 1, message: "User denied Geolocation" });
                };
            `);
        }

        // 11.5 Media Devices 伪装
        if (mediaDevices === '噪音') {
            scripts.push(`
                if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                    const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
                    navigator.mediaDevices.enumerateDevices = async function() {
                        return [
                            { deviceId: "default", kind: "audioinput", label: "Microphone (High Definition Audio Device)", groupId: "default" },
                            { deviceId: "default", kind: "videoinput", label: "USB Video Device", groupId: "default" },
                            { deviceId: "default", kind: "audiooutput", label: "Speakers (High Definition Audio Device)", groupId: "default" }
                        ];
                    };
                }
            `);
        }

        // 12. WebGPU 伪装
        if (webgpu === '禁用') {
            scripts.push(`
                if (navigator.gpu) {
                    navigator.gpu.requestAdapter = () => Promise.resolve(null);
                }
            `);
        } else if (webgpu === '自定义' && config.webgpuCustom) {
            scripts.push(`
                if (navigator.gpu) {
                    const originalRequestAdapter = navigator.gpu.requestAdapter;
                    navigator.gpu.requestAdapter = async function() {
                        const adapter = await originalRequestAdapter.apply(navigator.gpu, arguments);
                        if (adapter) {
                            const spoofedInfo = {
                                vendor: ${JSON.stringify(config.webgpuCustom.split(' ')[0] || '')},
                                architecture: '',
                                device: '',
                                description: ${JSON.stringify(config.webgpuCustom)}
                            };
                            try {
                                Object.defineProperty(adapter, 'info', {
                                    get: () => spoofedInfo
                                });
                            } catch (e) {}
                            if (typeof adapter.requestAdapterInfo === 'function') {
                                adapter.requestAdapterInfo = () => Promise.resolve(spoofedInfo);
                            }
                        }
                        return adapter;
                    };
                }
            `);
        }

        // 13. WebGL Drawing (Image) 噪音
        if (webglImage === '噪音') {
            scripts.push(`
                const hookReadPixels = (proto) => {
                    const originalReadPixels = proto.readPixels;
                    proto.readPixels = function(x, y, width, height, format, type, pixels) {
                        originalReadPixels.apply(this, arguments);
                        if (pixels && pixels.length > 0) {
                            pixels[0] = (pixels[0] + 1) % 255;
                        }
                    };
                };
                if (window.WebGLRenderingContext) hookReadPixels(WebGLRenderingContext.prototype);
                if (window.WebGL2RenderingContext) hookReadPixels(WebGL2RenderingContext.prototype);
            `);
        }

        // 14. 字体 (Fonts) 伪装
        if (font === '自定义' && fontCustom) {
            scripts.push(`
                if (window.FontFaceSet) {
                    const originalCheck = FontFaceSet.prototype.check;
                    FontFaceSet.prototype.check = function(font) {
                        const allowed = ${JSON.stringify(fontCustom.split(',').map(f => f.trim().toLowerCase()))};
                        const isAllowed = allowed.some(a => font.toLowerCase().includes(a));
                        return isAllowed;
                    };
                }
            `);
        }

        // 15. 电池 (Battery) 伪装
        if (battery === '隐私') {
            scripts.push(`
                if (navigator.getBattery) {
                    navigator.getBattery = () => Promise.resolve({
                        charging: true,
                        chargingTime: 0,
                        dischargingTime: Infinity,
                        level: 1,
                        onchargingchange: null,
                        onchargingtimechange: null,
                        ondischargingtimechange: null,
                        onlevelchange: null,
                        addEventListener: () => {},
                        removeEventListener: () => {},
                        dispatchEvent: () => false,
                    });
                }
            `);
        }

        // 16. 蓝牙 (Bluetooth) 伪装
        if (bluetooth === '真实' && config.bluetoothCustom) {
            try {
                const parts = config.bluetoothCustom.split('-');
                const available = parts[0] === 'true';
                const count = parseInt(parts[1]) || 0;
                scripts.push(`
                    if (navigator.bluetooth) {
                        navigator.bluetooth.getAvailability = () => Promise.resolve(${available});
                        navigator.bluetooth.getDevices = () => Promise.resolve(new Array(${count}).fill({
                            name: 'Bluetooth Device',
                            id: 'dummy-id',
                            gatt: { connected: false }
                        }));
                    }
                `);
            } catch (e) {
                console.error('解析 bluetoothCustom 失败:', e);
            }
        } else if (bluetooth === '隐私') {
            scripts.push(`
                if (navigator.bluetooth) {
                    navigator.bluetooth.getAvailability = () => Promise.resolve(false);
                    navigator.bluetooth.getDevices = () => Promise.resolve([]);
                }
            `);
        }

        // 17. ClientRects 噪音
        if (clientRects === '噪音') {
            scripts.push(`
                const originalGetClientRects = Element.prototype.getClientRects;
                Element.prototype.getClientRects = function() {
                    const rects = originalGetClientRects.apply(this, arguments);
                    for (let i = 0; i < rects.length; i++) {
                        const rect = rects[i];
                        Object.defineProperty(rect, 'width', { get: () => rect.width + 0.0001 });
                        Object.defineProperty(rect, 'height', { get: () => rect.height + 0.0001 });
                        Object.defineProperty(rect, 'top', { get: () => rect.top + 0.0001 });
                        Object.defineProperty(rect, 'left', { get: () => rect.left + 0.0001 });
                        Object.defineProperty(rect, 'right', { get: () => rect.right + 0.0001 });
                        Object.defineProperty(rect, 'bottom', { get: () => rect.bottom + 0.0001 });
                        Object.defineProperty(rect, 'x', { get: () => rect.x + 0.0001 });
                        Object.defineProperty(rect, 'y', { get: () => rect.y + 0.0001 });
                    }
                    return rects;
                };
                const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
                Element.prototype.getBoundingClientRect = function() {
                    const rect = originalGetBoundingClientRect.apply(this, arguments);
                    Object.defineProperty(rect, 'width', { get: () => rect.width + 0.0001 });
                    Object.defineProperty(rect, 'height', { get: () => rect.height + 0.0001 });
                    Object.defineProperty(rect, 'top', { get: () => rect.top + 0.0001 });
                    Object.defineProperty(rect, 'left', { get: () => rect.left + 0.0001 });
                    Object.defineProperty(rect, 'right', { get: () => rect.right + 0.0001 });
                    Object.defineProperty(rect, 'bottom', { get: () => rect.bottom + 0.0001 });
                    Object.defineProperty(rect, 'x', { get: () => rect.x + 0.0001 });
                    Object.defineProperty(rect, 'y', { get: () => rect.y + 0.0001 });
                    return rect;
                };
            `);
        }

        // 18. Speech Voices 伪装
        if (speechVoices === '隐私') {
            scripts.push(`
                if (window.speechSynthesis) {
                    const originalGetVoices = speechSynthesis.getVoices;
                    speechSynthesis.getVoices = function() {
                        return [
                            { name: "Google US English", lang: "en-US", default: true, localService: false, voiceURI: "Google US English" },
                            { name: "Microsoft David - English (United States)", lang: "en-US", default: false, localService: true, voiceURI: "Microsoft David - English (United States)" }
                        ];
                    };
                }
            `);
        }

        // 封装在自执行函数中以避免变量冲突
        console.log('SCROIPT', scripts);
        return `(function() {
            try {
                ${scripts.join('\n')}
                console.log('🧬 [Fingerprint] Profile applied successfully.');
            } catch (e) {
                console.error('🧬 [Fingerprint] Failed to apply profile:', e);
            }
        })();`;
    }
      
    /**
     * 生成映射后的配置对象，供后端逻辑使用
     * @param {Object} dbConfig 数据库原始字段
     * @returns {Object} 逻辑配置对象
     */
    static mapConfig(dbConfig) {
        if (!dbConfig) return null;
        return {
            cardId: dbConfig.card_id,
            userAgent: dbConfig.user_agent,
            cookie: dbConfig.cookie,
            proxyType: dbConfig.proxy_type,
            proxyStatus: dbConfig.proxy_status,
            host: dbConfig.proxy_host,
            port: dbConfig.proxy_port,
            username: dbConfig.proxy_username,
            password: dbConfig.proxy_password,
            fingerprintSwitch: dbConfig.fingerprint_switch === 'true',
            browser: dbConfig.browser,
            os: dbConfig.os,
            webglMetadata: dbConfig.webgl_metadata,
            webglVendor: dbConfig.webgl_vendor,
            webglRenderer: dbConfig.webgl_renderer,
            webgpu: dbConfig.webgpu,
            webglImage: dbConfig.webgl_image,
            webrtc: dbConfig.webrtc,
            timezone: dbConfig.timezone,
            timezoneCustom: dbConfig.timezone_custom,
            geolocation: dbConfig.geolocation,
            geolocationCustom: dbConfig.geolocation_custom === 'true',
            language: dbConfig.language,
            languages: dbConfig.language, 
            resolution: dbConfig.resolution,
            resolutionWidth: dbConfig.resolution_width,
            resolutionHeight: dbConfig.resolution_height,
            font: dbConfig.font,
            fontCustom: dbConfig.font_custom,
            canvas: dbConfig.canvas,
            audioContext: dbConfig.audio_context,
            mediaDevices: dbConfig.media_devices,
            clientRects: dbConfig.client_rects,
            speechVoices: dbConfig.speech_voices,
            cpuCores: dbConfig.cpu_cores,
            cpuCoresCustom: dbConfig.cpu_cores_custom,
            memory: dbConfig.memory,
            memoryCustom: dbConfig.memory_custom,
            doNotTrack: dbConfig.do_not_track === 'true',
            screen: dbConfig.screen,
            bluetooth: dbConfig.bluetooth,
            battery: dbConfig.battery,
            portScanProtection: dbConfig.port_scan_protection === 'true',
            canvasCustom: dbConfig.canvas_custom,
            audioContextCustom: dbConfig.audio_context_custom,
            mediaDevicesCustom: dbConfig.media_devices_custom,
            clientRectsCustom: dbConfig.client_rects_custom,
            speechVoicesCustom: dbConfig.speech_voices_custom,
            webglImageCustom: dbConfig.webgl_image_custom,
            webgpuCustom: dbConfig.webgpu_custom,
            bluetoothCustom: dbConfig.bluetooth_custom,
            webrtcCustom: dbConfig.webrtc_custom,
            doNotTrackCustom: dbConfig.do_not_track_custom,
            screenCustom: dbConfig.screen_custom,
            portScanProtectionCustom: dbConfig.port_scan_protection_custom,
            geolocationLatitude: dbConfig.geolocation_latitude,
            geolocationLongitude: dbConfig.geolocation_longitude,
            geolocationAccuracy: dbConfig.geolocation_accuracy,
            batteryCustom: dbConfig.battery_custom,
            languageCustom: dbConfig.language_custom
        };
    }
}

module.exports = FingerprintProfile;
