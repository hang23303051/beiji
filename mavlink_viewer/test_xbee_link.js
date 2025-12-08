#!/usr/bin/env node
/**
 * XBee链路测试工具
 * 用于测试XBee通信和MAVLink数据接收
 */

const { SerialPort } = require('serialport');
const { MAVLink } = require('node-mavlink');

// 创建MAVLink实例
const mavlink = new MAVLink(null, 255, 0); // srcSystem=255, srcComponent=0

// 配置
const COM_PORT = 'COM7';
const BAUD_RATE = 57600;

console.log('='.repeat(60));
console.log('XBee链路测试工具');
console.log('='.repeat(60));
console.log(`串口: ${COM_PORT}`);
console.log(`波特率: ${BAUD_RATE}`);
console.log('='.repeat(60));
console.log('');

// 创建串口
const port = new SerialPort({
  path: COM_PORT,
  baudRate: BAUD_RATE,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
});

// MAVLink解析器已在上面创建

// 统计
let bytesReceived = 0;
let messagesReceived = 0;
let lastDataTime = Date.now();
const messageTypes = new Map();

// 串口事件
port.on('open', () => {
  console.log('✓ 串口已打开');
  console.log('');
  console.log('等待数据...');
  console.log('提示:');
  console.log('  - 如果看到"原始数据"，说明XBee链路正常');
  console.log('  - 如果看到"MAVLink消息"，说明协议解析正常');
  console.log('  - 如果什么都没有，说明发射端没有发送数据');
  console.log('');
  console.log('按 Ctrl+C 停止测试');
  console.log('-'.repeat(60));
  console.log('');
});

port.on('data', (data) => {
  bytesReceived += data.length;
  lastDataTime = Date.now();
  
  // 显示原始数据（十六进制）
  const hex = data.toString('hex').match(/.{1,2}/g).join(' ');
  console.log(`[原始数据] ${data.length}字节: ${hex.substring(0, 60)}${hex.length > 60 ? '...' : ''}`);
  
  // 尝试解析MAVLink
  try {
    mavlink.parse(data);
  } catch (error) {
    console.log(`[解析错误] ${error.message}`);
  }
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

// MAVLink事件
mavlink.on('message', (message) => {
  messagesReceived++;
  
  const msgType = message.constructor.name || message._name || 'UNKNOWN';
  messageTypes.set(msgType, (messageTypes.get(msgType) || 0) + 1);
  
  // 获取System ID
  let sysId = 'Unknown';
  if (message.header && message.header.srcSystem) {
    sysId = message.header.srcSystem;
  } else if (message._header && message._header.srcSystem) {
    sysId = message._header.srcSystem;
  }
  
  console.log(`[MAVLink消息] ${msgType} (SysID: ${sysId})`);
  
  // 显示关键消息的详细信息
  if (msgType === 'HEARTBEAT') {
    console.log(`  → Type: ${message.type}, Autopilot: ${message.autopilot}`);
  } else if (msgType === 'GPS_RAW_INT') {
    const lat = message.lat / 1e7;
    const lon = message.lon / 1e7;
    const alt = message.alt / 1000;
    const sats = message.satellites_visible || 0;
    console.log(`  → GPS: ${lat.toFixed(6)}°, ${lon.toFixed(6)}°, Alt: ${alt.toFixed(1)}m, Sats: ${sats}`);
  } else if (msgType === 'ATTITUDE') {
    const roll = (message.roll * 180 / Math.PI).toFixed(1);
    const pitch = (message.pitch * 180 / Math.PI).toFixed(1);
    const yaw = (message.yaw * 180 / Math.PI).toFixed(1);
    console.log(`  → Roll: ${roll}°, Pitch: ${pitch}°, Yaw: ${yaw}°`);
  }
});

mavlink.on('error', (error) => {
  console.log(`[MAVLink错误] ${error.message}`);
});

// 定期显示统计
setInterval(() => {
  const elapsed = (Date.now() - lastDataTime) / 1000;
  if (bytesReceived > 0 && elapsed < 5) {
    console.log(`\n[统计] 接收: ${bytesReceived}字节, MAVLink消息: ${messagesReceived}条`);
    if (messageTypes.size > 0) {
      console.log('[消息类型]');
      for (const [type, count] of messageTypes.entries()) {
        console.log(`  - ${type}: ${count}`);
      }
    }
    console.log('');
  }
}, 10000); // 每10秒显示一次

// 检测无数据超时
setInterval(() => {
  const elapsed = (Date.now() - lastDataTime) / 1000;
  if (elapsed > 5 && bytesReceived === 0) {
    console.log(`\n⚠️  警告: ${elapsed.toFixed(0)}秒未收到任何数据`);
    console.log('可能原因:');
    console.log('  1. XBee发射端未开机或未配对');
    console.log('  2. 飞控未连接到XBee发射端');
    console.log('  3. 飞控未发送MAVLink数据');
    console.log('  4. XBee配置不匹配（波特率、信道等）');
    console.log('');
  }
}, 5000);

// 显示统计信息
function showStatistics() {
  console.log('\n' + '='.repeat(60));
  console.log('测试统计');
  console.log('='.repeat(60));
  console.log(`总接收字节: ${bytesReceived}`);
  console.log(`MAVLink消息: ${messagesReceived}`);
  if (messageTypes.size > 0) {
    console.log('\n消息类型统计:');
    for (const [type, count] of messageTypes.entries()) {
      console.log(`  - ${type}: ${count}`);
    }
  } else {
    console.log('\n未收到MAVLink消息');
  }
  console.log('='.repeat(60));
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n正在关闭...');
  port.close();
});
