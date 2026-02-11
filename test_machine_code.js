const { machineIdSync } = require('node-machine-id');
const si = require('systeminformation');
const crypto = require('crypto');

async function test() {
    try {
        console.log('--- 机器码生成测试 ---');
        
        // 1. 获取基础机器 ID
        const baseMachineId = machineIdSync({ original: true });
        console.log('基础 MachineId (注册表):', baseMachineId);
        
        // 2. 获取硬件级 UUID
        const hardwareUuid = await si.uuid();
        const uuidString = hardwareUuid.os || hardwareUuid.hardware || '';
        console.log('硬件 UUID:', uuidString);

        // 3. 获取 CPU 序列号
        const cpuInfo = await si.cpu();
        const cpuId = cpuInfo.processorId || '';
        console.log('CPU ProcessorId:', cpuId);

        // 整合
        const combinedId = `${baseMachineId}-${uuidString}-${cpuId}`;
        console.log('合并原始串:', combinedId);

        // 4. 哈希处理
        const finalMachineCode = crypto.createHash('sha256').update(combinedId).digest('hex');
        console.log('最终生成的机器码 (SHA-256):', finalMachineCode);
        console.log('长度:', finalMachineCode.length);
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

test();