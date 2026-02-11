'use strict';
const { machineIdSync } = require('node-machine-id');
const si = require('systeminformation');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const Log = require('ee-core/log');
const Addon = require('ee-core/addon');
const { Service } = require('ee-core');
const { BrowserWindow } = require('electron');
const {app} = require("electron");
/**
 * 示例服务（service层为单例）
 * @class
 */
class LoginService extends Service {

    constructor(ctx) {
        super(ctx);
    }

    /**
     * 获取机器码
     */
    async getMachineCode() {
        try {
            // 1. 获取基础机器 ID (注册表相关)
           // const baseMachineId = machineIdSync({ original: true });
            
            // 2. 获取硬件级 UUID (通常是主板/BIOS UUID)
           // const hardwareUuid = await si.uuid();
           // const uuidString = hardwareUuid.os || hardwareUuid.hardware || '';

            // 3. 获取 CPU 序列号
           // const cpuInfo = await si.cpu();
           // const cpuId = cpuInfo.processorId || '';

            // 整合多维度参数
           // const combinedId = `${baseMachineId}-${uuidString}-${cpuId}`;

            // 4. 使用 SHA-256 生成固定长度的哈希值
          //  const finalMachineCode = crypto.createHash('sha256').update(combinedId).digest('hex');
           const   finalMachineCode=this.getMachineFingerprint()
           Log.info('机器码',finalMachineCode)
            return finalMachineCode;
        } catch (error) {
            // 降级方案：如果获取深度硬件信息失败，返回原始 ID
            console.error('获取硬件信息失败，启用降级方案:', error);
            return machineIdSync({ original: true });
        }
    }

    async saveAuthCode(args, event) {
        const { authCode, expiryDate } = args;
        app.authCode = authCode;
        app.expiryDate = expiryDate;

        // 将 `expiryDate` 转换为数字格式
        const date = this.formatTimestamp(Number(expiryDate));
        const mainId = Addon.get('window').getMWCid();
        const mainWin = BrowserWindow.fromId(mainId);
        mainWin.setTitle(`授权有效期:${date}`);
    }

    async saveAuthToken(token) {
        app.boxToken = token;
        Log.info('Token saved to app.boxToken');
    }
      
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始，所以需要加 1
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }
  async  getMachineFingerprint() {
  const components = [];
  
  // 1. 主板信息（对虚拟机友好）
  try {
    const { stdout } = await execAsync('wmic baseboard get serialnumber');
    const mbSerial = stdout.split('\n')[1]?.trim();
    if (mbSerial && mbSerial !== '') components.push(`MB:${mbSerial}`);
  } catch {}
  
  // 2. CPU信息
  const cpuInfo = os.cpus()[0];
  if (cpuInfo) {
    components.push(`CPU:${cpuInfo.model}:${cpuInfo.speed}`);
  }
  
  // 3. 硬盘序列号
  try {
    const { stdout } = await execAsync('wmic diskdrive get serialnumber');
    const diskSerials = stdout.split('\n')
      .slice(1)
      .filter(s => s.trim())
      .map(s => s.trim());
    diskSerials.forEach(serial => {
      components.push(`DISK:${serial}`);
    });
  } catch {}
  
  // 4. MAC地址
  const networkInterfaces = os.networkInterfaces();
  const macs = [];
  Object.values(networkInterfaces).forEach(iface => {
    iface.forEach(info => {
      if (info.mac && info.mac !== '00:00:00:00:00:00') {
        macs.push(info.mac);
      }
    });
  });
  if (macs.length > 0) {
    components.push(`MAC:${macs.sort()[0]}`);
  }
  
  // 5. 操作系统安装ID
  try {
    const { stdout } = await execAsync('wmic os get serialnumber');
    const osSerial = stdout.split('\n')[1]?.trim();
    if (osSerial) components.push(`OS:${osSerial}`);
  } catch {}
  
  // 组合并生成哈希
  const fingerprint = components.join('|');
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
    .update(fingerprint)
    .digest('hex');
    Log.info('fingerprint', fingerprint);
    Log.info('hash', hash);
   
  return hash;
}
 
}

LoginService.toString = () => '[class LoginService]';
module.exports = LoginService;
