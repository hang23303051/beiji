#!/usr/bin/env node
/**
 * 串口原始数据监控工具
 * 不依赖MAVLink解析，只显示原始数据
 * 用于快速诊断XBee链路是否正常
 */

const { SerialPort } = require('serialport');

// 配置
const COM_PORT = 'COM7';
const BAUD_RATE = 57600;

console.log('='.repeat(60));
console.log('XBee链路原始数据监控');
console.log('='.repeat(60));
console.log(`串口: ${COM_PORT}`);
console.log(`波特率: ${BAUD_RATE}`);
console.log('='.repeat(60));
console.log('');

// 统计
let bytesReceived = 0;
let packetsReceived = 0;
let lastDataTime = Date.now();
let startTime = Date.now();

// 创建串口
const port = new SerialPort({
  path: COM_PORT,
  baudRate: BAUD_RATE,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
});

// 串口事件
port.on('open', () => {
  console.log('✓ 串口已打开');
  console.log('');
  console.log('正在监听数据...');
  console.log('');
  console.log('提示:');
  console.log('  - 如果看到数据，说明XBee链路正常');
  console.log('  - MAVLink数据通常以 FE 或 FD 开头');
  console.log('  - 如果什么都没有，说明发射端未工作');
  console.log('');
  console.log('按 Ctrl+C 停止监控');
  console.log('-'.repeat(60));
  console.log('');
  startTime = Date.now();
});

port.on('data', (data) => {
  bytesReceived += data.length;
  packetsReceived++;
  lastDataTime = Date.now();
  
  // 显示原始数据（十六进制和ASCII）
  const hex = data.toString('hex').match(/.{1,2}/g).join(' ').toUpperCase();
  const ascii = data.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
  
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`[${timestamp}] ${data.length}字节:`);
  console.log(`  HEX:   ${hex}`);
  console.log(`  ASCII: ${ascii}`);
  
  // 检查是否可能是MAVLink数据
  if (data[0] === 0xFE || data[0] === 0xFD) {
    console.log('  ✓ 可能是MAVLink数据！');
  }
  console.log('');
});

port.on('error', (err) => {
  console.error('✗ 串口错误:', err.message);
  process.exit(1);
});

port.on('close', () => {
  console.log('\n✗ 串口已关闭');
  showStatistics();
  process.exit(0);
});

// 定期显示统计和超时警告
setInterval(() => {
  const elapsed = (Date.now() - lastDataTime) / 1000;
  const totalElapsed = (Date.now() - startTime) / 1000;
  
  if (bytesReceived === 0 && totalElapsed > 5) {
    console.log(`⚠️  警告: ${totalElapsed.toFixed(0)}秒未收到任何数据`);
    console.log('');
    console.log('可能原因:');
    console.log('  1. ❌ XBee发射端未开机');
    console.log('  2. ❌ XBee未配对（ID或Channel不匹配）');
    console.log('  3. ❌ 飞控未连接到XBee发射端');
    console.log('  4. ❌ 飞控未上电或初始化失败');
    console.log('');
    console.log('建议操作:');
    console.log('  1. 检查发射端XBee的LED状态');
    console.log('  2. 使用XCTU检查XBee配置');
    console.log('  3. 确认飞控TELEM口连接正确');
    console.log('  4. 尝试近距离测试（<1米）');
    console.log('');
  } else if (bytesReceived > 0) {
    // 显示活动统计
    console.log('-'.repeat(60));
    console.log(`[活动统计] 运行: ${totalElapsed.toFixed(0)}秒`);
    console.log(`  总接收: ${bytesReceived} 字节`);
    console.log(`  数据包: ${packetsReceived} 个`);
    console.log(`  速率: ${(bytesReceived / totalElapsed).toFixed(1)} 字节/秒`);
    console.log(`  最后数据: ${elapsed.toFixed(1)} 秒前`);
    console.log('-'.repeat(60));
    console.log('');
  }
}, 10000); // 每10秒检查一次

// 显示最终统计
function showStatistics() {
  const totalElapsed = (Date.now() - startTime) / 1000;
  
  console.log('='.repeat(60));
  console.log('测试统计');
  console.log('='.repeat(60));
  console.log(`运行时间: ${totalElapsed.toFixed(1)} 秒`);
  console.log(`总接收字节: ${bytesReceived}`);
  console.log(`数据包数: ${packetsReceived}`);
  
  if (bytesReceived > 0) {
    console.log(`平均速率: ${(bytesReceived / totalElapsed).toFixed(1)} 字节/秒`);
    console.log('');
    console.log('✓ XBee链路正常！');
  } else {
    console.log('');
    console.log('✗ 未收到任何数据 - XBee链路可能有问题');
  }
  console.log('='.repeat(60));
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n正在关闭...');
  port.close();
});

// 初始超时检查
setTimeout(() => {
  if (bytesReceived === 0) {
    console.log('━'.repeat(60));
    console.log('⚠️  5秒超时检查');
    console.log('━'.repeat(60));
    console.log('仍未收到数据。建议:');
    console.log('');
    console.log('1. 确认发射端已上电');
    console.log('   - 检查XBee模块LED灯');
    console.log('   - 检查飞控是否已启动');
    console.log('');
    console.log('2. 确认XBee配对');
    console.log('   - 下载XCTU软件');
    console.log('   - 连接COM7检查配置');
    console.log('   - 确认ID和CH匹配');
    console.log('');
    console.log('3. 缩短测试距离');
    console.log('   - 尝试将两个模块放在一起(<1米)');
    console.log('   - 排除距离和干扰问题');
    console.log('');
    console.log('继续等待数据...');
    console.log('━'.repeat(60));
    console.log('');
  }
}, 5000);
