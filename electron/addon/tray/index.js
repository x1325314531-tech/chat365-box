const { Tray, Menu, app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const Ps = require('ee-core/ps');
const Log = require('ee-core/log');
const Electron = require('ee-core/electron');
const CoreWindow = require('ee-core/electron/window');
const Conf = require('ee-core/config');
const EE = require('ee-core/ee');

/**
 * 托盘插件
 * @class
 */
class TrayAddon {

  constructor() {
    this.tray = null;
  }

  /**
   * 创建托盘
   */
  create () {
    // 开发环境，代码热更新开启时，会导致托盘中有残影
    if (Ps.isDev() && Ps.isHotReload()) return;
    
    Log.info('[addon:tray] load');
    const { CoreApp } = EE;
    const cfg = Conf.getValue('addons.tray');
    const mainWindow = CoreWindow.getMainWindow();

    // 托盘图标
    let iconPath = path.join(Ps.getHomeDir(), cfg.icon);
  
    // 托盘菜单功能列表
    const appName = app.getName();
    const appVersion = app.getVersion();

    // 启动新实例的方法
    const launchInstance = (userId) => {
      const exePath = app.getPath('exe');
      const args = [`--user-id=${userId}`];
      
      // 开发环境下，需要指定应用路径（通常是项目根目录）
      if (!app.isPackaged) {
        args.unshift(app.getAppPath());
      }
      
      Log.info(`启动新实例: ${exePath} ${args.join(' ')}`);
      spawn(exePath, args, {
        detached: true,
        stdio: 'ignore'
      }).unref();
    };

    let trayMenuTemplate = [
      {
        label: `${appName} ${appVersion}`,
        enabled: false
      },
      { type: 'separator' }
    ];

    // 添加 10 个用户项
    // for (let i = 1; i <= 10; i++) {
    //     trayMenuTemplate.push({
    //       label: `用户 ${i}`,
    //       click: () => {
    //         launchInstance(i);
    //       }
    //     });
    // }

    trayMenuTemplate.push(
      { type: 'separator' },
      {
        label: '显示',
        click: function () {
          mainWindow.show();
        }
      },
      {
        label: '退出',
        click: function () {
          CoreApp.appQuit();
        }
      }
    );
  
    // 点击关闭，最小化到托盘
    mainWindow.on('close', (event) => {
      if (Electron.extra.closeWindow == true) {
        return;
      }
      mainWindow.hide();
      event.preventDefault();
    });
    
    // 实例化托盘
    this.tray = new Tray(iconPath);
    this.tray.setToolTip(cfg.title);
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    this.tray.setContextMenu(contextMenu);
    this.tray.on('double-click', () => {
      mainWindow.show()
    })
  }
}

TrayAddon.toString = () => '[class TrayAddon]';
module.exports = TrayAddon;
