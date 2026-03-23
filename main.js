const { ElectronEgg } = require('ee-core');
//托盘菜单功能列表
// const { app } = require('electron');
// const path = require('path');

// // 匹配启动参数中的 --user-id=X
// const userIdArg = process.argv.find(arg => arg.startsWith('--user-id='));
// if (userIdArg) {
//   const userId = userIdArg.split('=')[1];
//   app.userId = userId;
//   // 将数据目录重定向到 Chat365/User-X
//   const userDataPath = path.join(app.getPath('appData'), 'Chat365', `User-${userId}`);
//   app.setPath('userData', userDataPath);
// }

new ElectronEgg();