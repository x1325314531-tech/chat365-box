'use strict';

const { Controller } = require('ee-core');
const Log = require('ee-core/log');
const Addon = require('ee-core/addon');
const { app, BrowserWindow, WebContentsView, dialog, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const Services = require('ee-core/services');
const { getDictData } = require('../api');
class WindowController extends Controller {
    constructor(ctx) {
        super(ctx);
    }

    async addSession(args, event) {
        Log.info('添加回话',args)
        
        const { cardId, platform } = args;

        if (cardId === undefined || cardId === '' || platform === '' || platform === undefined) {
            return { status: false, message: '参数不能为空' };
        }

        try {
            return await Services.get('window').addCard(args);
        } catch (error) {
            Log.error('添加会话时出错:', error);
            return { status: false, message: '添加会话时出现异常，请稍后重试' };
        }
    }

    async refreshSession(args, event) {
        const { platform, cardId } = args;

        if (cardId === undefined || cardId === '' || platform === '' || platform === undefined) {
            return { status: false, message: '参数不能为空' };
        }

        try {
            return await Services.get('window').refreshCard(args);
        } catch (error) {
            Log.error('刷新会话时出错:', error);
            return { status: false, message: '刷新会话时出现异常，请稍后重试' };
        }
    }

    async deleteSession(args, event) {
        const { platform, cardId } = args;

        if (cardId === undefined || cardId === '' || platform === '' || platform === undefined) {
            return { status: false, message: '参数不能为空' };
        }
        try {
            return await Services.get('window').deleteCard(args);
        } catch (error) {
            Log.error('删除会话时出错:', error);
            return { status: false, message: '删除会话时出现异常，请稍后重试' };
        }
    }

    async selectSession(args, event) {
        const { cardId, platform } = args;

        if (cardId === undefined || cardId === '' || platform === '' || platform === undefined) {
            return { status: false, message: '参数不能为空' };
        }

        try {
            return await Services.get('window').selectCard(args);
        } catch (error) {
            Log.error('选择会话时出错:', error);
            return { status: false, message: '选择会话时出现异常，请稍后重试' };
        }
    }

    async initSession(args, event) {
        const { cardId, platform } = args;
        if (cardId === undefined || cardId === '' || platform === '' || platform === undefined) {
            return { status: false, message: '参数不能为空' };
        }
        try {
            return await Services.get('window').initCard(args);
        } catch (error) {
            Log.error('选择会话时出错:', error);
            return { status: false, message: `启动会话出错${error.message}` };
        }
    }

    async getSessions(args, event) {
        const { platform } = args;

        if (platform === undefined || platform === '') {
            return { status: false, message: '参数不能为空', data: [] };
        }

        try {
            const result = await Services.get('window').getCards(args);
            return { status: true, message: '查询成功', data: result };
        } catch (error) {
            Log.error('获取会话信息时出错:', error);
            return { status: false, message: '获取会话信息时出现异常，请稍后重试', data: [] };
        }
    }

    async addConfigInfo(args, event) {
        const { card_id } = args;

        if (card_id === undefined || card_id === '') {
            return { status: false, message: '参数不能为空' };
        }

        try {
            return await Services.get('window').saveCardConfig(args);
        } catch (error) {
            Log.error('添加配置信息时出错:', error);
            return { status: false, message: '保存配置时出现异常，请稍后重试' };
        }
    }

    async getConfigInfo(args, event) {
        const { cardId } = args;
        if (cardId === undefined || cardId === '') {
            return {status:false,message:'参数不能为空'}
        }
        try{
            const result = await Services.get('window').getCardConfig(args)
            return {status:true,message:'查询成功', data:result}
        }catch(err){
            return {status:false,message:`查询发生错误:${err.message}`};
        }
    }

    async getDictData(args, event) {
        const dictType = typeof args === 'string' ? args : args?.dictType;
        if (!dictType) {
            return { code: 400, msg: 'dictType is required', data: [] };
        }
        try {
            return await getDictData(dictType);
        } catch (error) {
            Log.error('getDictData error:', error);
            return { code: 500, msg: 'get dict data failed', data: [] };
        }
    }

    async getSessionConfig(args, event) {
        try {
            return await Services.get('window').getSessionConfig(args);
        } catch (error) {
            Log.error('getSessionConfig error:', error);
            return null;
        }
    }

    async saveSessionConfig(args, event) {
        try {
            return await Services.get('window').saveSessionConfig(args);
        } catch (error) {
            Log.error('saveSessionConfig error:', error);
            return { status: false, message: 'save session config failed' };
        }
    }

    async getChatHistory(args, event) {
        try {
            const data = await Services.get('window').getChatHistory(args);
            return { status: true, data };
        } catch (error) {
            Log.error('getChatHistory error:', error);
            return { status: false, data: [] };
        }
    }

    async sendToWv(args, event) {
        try {
            return await Services.get('window').sendToWv(args);
        } catch (error) {
            Log.error('sendToWv error:', error);
            return { status: false, message: 'send to webview failed' };
        }
    }

    async getIPInfo(args, event) {
        try {
            return await Services.get('window').getIPInfo(args);
        } catch (error) {
            Log.error('获取IP信息出错:', error);
            return { status: false, message: '获取IP信息失败' };
        }
    }

    async hideWindow(args, event) {
        try {
            await Services.get('window').hideAllWindow();
            return {status:true,message:'隐藏所有窗口成功'}
        } catch (error) {
            return {status:false,message:'隐藏所有窗口发生错误'}
        }
    }

    async showConfirmDialog(args, event) {
        const { title, message, type = 'question' } = args;
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showMessageBox(win, {
            type: type,
            title: title || '提示',
            message: message || '',
            buttons: ['确定', '取消'],
            defaultId: 0,
            cancelId: 1
        });
        return { status: true, data: result.response === 0 };
    }
    async logout(args, event) {
        try{
            await Services.get('window').logOut();
            return {status:true,message:'退出成功'}
        }catch (error) {
            return {status:false,message:'发生错误'}
        }
    }

    async changeSidebarWidth(args, event) {
        const { isShrunk } = args;
        try {
            return await Services.get('window').changeSidebarWidth(isShrunk);
        } catch (error) {
            Log.error('更改侧边栏宽度时出错:', error);
            return { status: false, message: '同步侧边栏状态失败' };
        }
    }

    async changeSidebarLayout(args, event) {
        const { isPlacedTop } = args;
        try {
            return await Services.get('window').changeSidebarLayout(isPlacedTop);
        } catch (error) {
            Log.error('更改侧边栏布局时出错:', error);
            return { status: false, message: '同步侧边栏布局失败' };
        }
    }

    async getSidebarState(args, event) {
        try {
            return await Services.get('window').getSidebarState();
        } catch (error) {
            Log.error('获取侧边栏状态失败:', error);
            return { isShrunk: false, isPlacedTop: false };
        }
    }

    async setRightOverlayWidth(args, event) {
        const { width } = args || {};
        try {
            return await Services.get('window').setRightOverlayWidth(width);
        } catch (error) {
            Log.error('设置右侧覆盖层宽度失败:', error);
            return { status: false, message: 'set right overlay width failed' };
        }
    }

    async getRunningSessionsCount(args, event) {
        try {
            return await Services.get('window').getRunningSessionsCount();
        } catch (error) {
            return 0;
        }
    }

    async restoreActiveViews(args, event) {
        try {
            return await Services.get('window').restoreActiveViews();
        } catch (error) {
            return { status: false };
        }
    }

    async filterNumber(args, event) {
        // 解构参数
        const { platform, cardId, phoneNumber } = args;
        // 检查参数是否为空或不符合要求
        if (!this._isValidString(platform) || !this._isValidString(cardId) ||!this._isValidString(phoneNumber)) {
            return {status:false,message:'传入参数有误'}
        }
        try {
            // 参数验证通过，继续执行过滤逻辑
            return await Services.get('window').filterNumber(args);
        } catch (error) {
            Log.error("过滤过程中出错:", error);
            return {status:false,message:error.message};
        }
    }

    async getPhoneNumberList(args, event) {
        // 解构参数
        const { platform, cardId } = args;
        // 检查参数是否为空或不符合要求
        if (!this._isValidString(platform) || !this._isValidString(cardId)) {
            return {status:false,message:'传入参数有误'}
        }
        return await Services.get('window').getPhoneNumberList(args);
    }
    async deletePhoneNumber(args, event) {
        // 解构参数
        const {platform, phoneNumber } = args;
        // 检查参数是否为空或不符合要求
        if (!this._isValidString(phoneNumber) || !this._isValidString(platform)) {
            return {status:false,message:'传入参数有误'}
        }
        return await Services.get('window').deletePhoneNumber(args);
    }

    async sendMessage(args, event) {
        // 解构参数
        const { platform, cardId, phoneNumber } = args;
        // 检查参数是否为空或不符合要求
        if (!this._isValidString(platform) || !this._isValidString(cardId) ||!this._isValidString(phoneNumber)) {
            return {status:false,message:'传入参数有误'}
        }
        try {
            // 参数验证通过，继续执行过滤逻辑
            return await Services.get('window').sendMessage(args);
        } catch (error) {
            Log.error("发送消息出错:", error);
            return {status:false,message:error.message};
        }
    }

    async handleMinimize(args, event) {
        return await Services.get('window').handleMinimize();
    }

    async handleMaximize(args, event) {
        return await Services.get('window').handleMaximize();
    }

    async handleClose(args, event) {
        return await Services.get('window').handleClose();
    }

    async getWindowStatus(args, event) {
        return await Services.get('window').getWindowStatus();
    }

    async showContextMenu(args, event) {
        const { items } = args; // items: [{ label, action, icon, type? }]
        try {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return { status: false, action: null };
            
            return await new Promise((resolve) => {
                const template = items.map(item => {
                    if (item.type === 'separator') return { type: 'separator' };
                    
                    const menuItem = {
                        label: item.label,
                        click: () => resolve({ status: true, action: item.action })
                    };

                    if (item.icon) {
                        try {
                            if (item.icon.startsWith('data:image')) {
                                menuItem.icon = nativeImage.createFromDataURL(item.icon).resize({ width: 16, height: 16 });
                            } else {
                                // 处理 Vite 开发环境路径
                                let processedPath = item.icon;
                                
                                // 处理 @fs 前缀（Electron 常用）
                                if (processedPath.startsWith('/@fs/')) {
                                    processedPath = processedPath.slice(5);
                                }
                                
                                // 移除 URL 参数（如 ?t=123...）
                                if (processedPath.includes('?')) {
                                    processedPath = processedPath.split('?')[0];
                                }

                                // 统一盘符格式 (Vite 可能会将 d: 变成 /d:)
                                if (process.platform === 'win32' && processedPath.startsWith('/') && processedPath[2] === ':') {
                                    processedPath = processedPath.slice(1);
                                }

                                // 尝试从路径加载
                                let iconPath = path.isAbsolute(processedPath) 
                                    ? processedPath 
                                    : path.join(app.getAppPath(), processedPath);
                                
                                // 如果相对路径找不到，且是 /src/ 开头，尝试在 app 目录下寻找
                                if (!fs.existsSync(iconPath) && processedPath.startsWith('/src/')) {
                                    iconPath = path.join(app.getAppPath(), 'frontend', processedPath);
                                }

                                if (fs.existsSync(iconPath)) {
                                    menuItem.icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
                                } else {
                                    // 最后尝试 DataURL
                                    menuItem.icon = nativeImage.createFromDataURL(item.icon).resize({ width: 16, height: 16 });
                                }
                            }
                        } catch (e) {
                            Log.error('加载菜单图标失败:', e);
                        }
                    }

                    return menuItem;
                });
                const menu = Menu.buildFromTemplate(template);
                menu.popup({
                    window: win,
                    callback: () => resolve({ status: false, action: null })
                });
            });
        } catch (error) {
            Log.error('showContextMenu error:', error);
            return { status: false, action: null };
        }
    }

    _isValidString(input) {
        return typeof input === 'string' && input.trim() !== '';
    }
}

WindowController.toString = () => '[class WindowController]';
module.exports = WindowController;
