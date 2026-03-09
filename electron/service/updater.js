'use strict';
const { app: electronApp, shell } = require('electron');
const { Service } = require('ee-core');
const Log = require('ee-core/log');
const CoreWindow = require('ee-core/electron/window');
const Electron = require('ee-core/electron');
const Ps = require('ee-core/ps');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class UpdaterService extends Service {

    constructor(ctx) {
        super(ctx);
        this.downloading = false;
    }

    /**
     * 加载 (保留 ee-core 默认逻辑结构，但我们可以按需扩展)
     */
    load() {
        // ... 原有的 IncrUpdaterPlugin 逻辑可以保留或按需移除
    }

    /**
     * 检查更新
     */
    async checkUpdate() {
        Log.info('触发检查更新');
    }

    /**
     * 自定义下载逻辑 (支持普通 URL 下载并上报进度)
     */
    async download(args) {
        if (this.downloading) {
            Log.warn('已经有一个下载任务在进行中');
            return;
        }

        const { url } = args;
        if (!url) {
            Log.error('下载地址不能为空');
            return;
        }

        this.downloading = true;
        Log.info('开始下载更新包:', url);

        try {
            const tempDir = path.join(electronApp.getPath('temp'), 'chat365_updates');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const fileName = path.basename(url) || 'Chat365-update.exe';
            const filePath = path.join(tempDir, fileName);
            const writer = fs.createWriteStream(filePath);

            Log.info('准备发起 axios 请求...');
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 60000, // 增加超时到 60s
                maxRedirects: 5,
            });

            const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
            Log.info('响应成功, totalBytes:', totalBytes);

            let downloadedBytes = 0;
            let lastDownloadedBytes = 0;
            let startTime = Date.now();

            // 每 1000ms 计算一次进度和速度
            const progressInterval = setInterval(() => {
                if (!this.downloading) {
                    clearInterval(progressInterval);
                    return;
                }

                const now = Date.now();
                const duration = (now - startTime) / 1000;
                const chunkBytes = downloadedBytes - lastDownloadedBytes;
                const speedBytes = chunkBytes / (duration || 1);
                
                // 格式化速度
                let speedText = '0.0MB/秒';
                if (speedBytes > 1024 * 1024) {
                    speedText = (speedBytes / (1024 * 1024)).toFixed(1) + 'MB/秒';
                } else if (speedBytes > 1024) {
                    speedText = (speedBytes / 1024).toFixed(1) + 'KB/秒';
                } else {
                    speedText = speedBytes.toFixed(0) + 'B/秒';
                }

                const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
                
                const content = {
                    status: 3, // downloading
                    percent: String(percent),
                    speed: speedText,
                    transferredSize: this.formatBytes(downloadedBytes),
                    totalSize: this.formatBytes(totalBytes),
                };

                this._sendToWindow(content);

                // 更新上一次的数据
                lastDownloadedBytes = downloadedBytes;
                startTime = now;
            }, 1000);

            response.data.on('data', (chunk) => {
                downloadedBytes += chunk.length;
            });

            response.data.pipe(writer);

            writer.on('finish', () => {
                this.downloading = false;
                clearInterval(progressInterval);
                Log.info('下载流任务结束, 已下载:', downloadedBytes);
                
                this._sendToWindow({ 
                    status: 4, 
                    desc: '下载完成',
                    percent: '100',
                    transferredSize: this.formatBytes(downloadedBytes),
                    totalSize: this.formatBytes(totalBytes)
                });

                // 准备安装
                setTimeout(() => {
                  this.installApp(filePath);
                }, 1000);
            });

            writer.on('error', (err) => {
                this.downloading = false;
                clearInterval(progressInterval);
                Log.error('文件写入错误:', err);
                this._sendToWindow({ status: -1, error: '文件保存失败: ' + err.message });
            });

            response.data.on('error', (err) => {
                this.downloading = false;
                clearInterval(progressInterval);
                Log.error('下载响应流错误:', err);
                this._sendToWindow({ status: -1, error: '下载中断: ' + err.message });
            });

        } catch (error) {
            this.downloading = false;
            Log.error('下载初始化失败:', error);
            const msg = error.code === 'ECONNABORTED' ? '网络请求超时' : '网络连接失败';
            this._sendToWindow({ status: -1, error: msg });
        }
    }

    /**
     * 安装并重启
     */
    async relaunchApp() {
        Log.info('正在重启应用...');
        electronApp.relaunch();
        electronApp.quit();
    }

    /**
     * 执行安装程序并退出
     */
    async installApp(filePath) {
        Log.info('准备拉起安装程序:', filePath);
        try {
            if (!fs.existsSync(filePath)) {
                Log.error('安装包文件不存在:', filePath);
                return;
            }
            await shell.openPath(filePath);
            Log.info('安装程序已启动，即将退出当前应用');
            setTimeout(() => {
                electronApp.quit();
            }, 1500);
        } catch (err) {
            Log.error('调起安装程序失败:', err);
        }
    }

    /**
     * 字节转换 (鲁棒性改进)
     */
    formatBytes(bytes) {
        if (!bytes || bytes <= 0 || isNaN(bytes)) return '0B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const res = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
        return res + sizes[i];
    }

    /**
     * 本地/当前版本
     */
    currentVersion() {
        return electronApp.getVersion();
    }

    /**
     * 向窗口发消息
     */
    _sendToWindow(content = {}) {
        const textJson = JSON.stringify(content);
        const channel = 'custom.app.updater';
        const win = CoreWindow.getMainWindow();
        if (win && win.webContents) {
            win.webContents.send(channel, textJson);
        }
    }
}

UpdaterService.toString = () => '[class UpdaterService]';
module.exports = UpdaterService;
