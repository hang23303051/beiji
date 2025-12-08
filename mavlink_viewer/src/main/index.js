const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SerialManager = require('./modules/SerialManager');
const MAVLinkConnection = require('./modules/MAVLinkConnection');
const TileServer = require('./modules/TileServer');
const DataLogger = require('./modules/DataLogger');

let mainWindow = null;
let serialManager = null;
let mavlinkConnection = null;
let tileServer = null;
let dataLoggers = { 1: null, 2: null };

// Electron开发环境检测
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'MAVLink Viewer',
    backgroundColor: '#ffffff',
  });

  // 开发模式加载Vite服务器，生产模式加载构建文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用启动
app.whenReady().then(() => {
  createWindow();
  initializeModules();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

app.on('before-quit', () => {
  cleanup();
});

// 初始化模块
function initializeModules() {
  serialManager = new SerialManager();
  
  // 监听串口事件
  serialManager.on('connected', () => {
    sendToRenderer('serial:status', { status: 'connected' });
  });

  serialManager.on('disconnected', () => {
    sendToRenderer('serial:status', { status: 'disconnected' });
    if (mavlinkConnection) {
      mavlinkConnection = null;
    }
  });

  serialManager.on('error', (error) => {
    sendToRenderer('serial:error', { message: error.message });
  });

  serialManager.on('data', (data) => {
    console.log(`[Serial] Received ${data.length} bytes:`, data.toString('hex').substring(0, 60));
    if (mavlinkConnection) {
      mavlinkConnection.parse(data);
    }
  });
}

// IPC通信处理器
function setupIpcHandlers() {
  // 串口相关
  ipcMain.handle('serial:list', async () => {
    try {
      return await serialManager.listPorts();
    } catch (error) {
      return { error: error.message };
    }
  });

  ipcMain.handle('serial:connect', async (event, { port, baudRate }) => {
    try {
      // 更新波特率
      if (baudRate) {
        serialManager.baudRate = baudRate;
      }
      console.log(`Attempting to connect to ${port} @ ${serialManager.baudRate}`);
      await serialManager.connect(port);
      
      // 创建MAVLink连接
      mavlinkConnection = new MAVLinkConnection(serialManager);
      
      // 设置MAVLink事件处理
      setupMAVLinkHandlers();
      
      console.log('[Main] ============================================');
      console.log('[Main] CONNECTION SUCCESSFUL! Sending REQUEST_DATA_STREAM...');
      console.log('[Main] ============================================');
      
      // 连接成功后，立即和延迟发送数据流请求（针对所有可能的系统ID）
      // 立即发送一次
      mavlinkConnection.requestDataStream(1, 6, 10); // System ID 1
      mavlinkConnection.requestDataStream(2, 6, 10); // System ID 2
      
      // 1秒后再发送一次确保飞控收到
      setTimeout(() => {
        console.log('[Main] Re-sending REQUEST_DATA_STREAM (retry)...');
        if (mavlinkConnection) {
          mavlinkConnection.requestDataStream(1, 6, 10);
          mavlinkConnection.requestDataStream(2, 6, 10);
        }
      }, 1000);
      
      // 3秒后再发送一次
      setTimeout(() => {
        console.log('[Main] Re-sending REQUEST_DATA_STREAM (retry 2)...');
        if (mavlinkConnection) {
          mavlinkConnection.requestDataStream(1, 6, 10);
          mavlinkConnection.requestDataStream(2, 6, 10);
        }
      }, 3000);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('serial:disconnect', async () => {
    try {
      await serialManager.disconnect();
      mavlinkConnection = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 离线瓦片服务器
  ipcMain.handle('tiles:start-offline', async (event, { tileDir }) => {
    try {
      if (tileServer) {
        await tileServer.stop();
      }
      tileServer = new TileServer(tileDir);
      const info = await tileServer.start();
      return { success: true, ...info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiles:stop-offline', async () => {
    try {
      if (tileServer) {
        await tileServer.stop();
        tileServer = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 数据记录
  ipcMain.handle('logger:start', async (event, { emitterId, outputDir }) => {
    try {
      const logger = new DataLogger(emitterId, outputDir);
      const filename = await logger.start();
      dataLoggers[emitterId] = logger;
      return { success: true, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logger:stop', async (event, { emitterId }) => {
    try {
      const logger = dataLoggers[emitterId];
      if (logger) {
        await logger.stop();
        dataLoggers[emitterId] = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logger:stop-all', async () => {
    try {
      for (const logger of Object.values(dataLoggers)) {
        if (logger) {
          await logger.stop();
        }
      }
      dataLoggers = { 1: null, 2: null };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// MAVLink事件处理
function setupMAVLinkHandlers() {
  if (!mavlinkConnection) return;

  mavlinkConnection.on('heartbeat', (data) => {
    sendToRenderer('mavlink:heartbeat', data);
  });

  mavlinkConnection.on('data', (data) => {
    // 调试：确认数据在主进程被接收
    if (data.messageType === 'GpsRawInt' || data.messageType === 'Heartbeat') {
      console.log('[Main] Received data event:', {
        messageType: data.messageType,
        emitterId: data.emitterId,
        lat: data.lat,
        lon: data.lon
      });
    }
    
    sendToRenderer('mavlink:data', data);
    
    // 调试：确认数据被发送到渲染进程
    if (data.messageType === 'GpsRawInt' || data.messageType === 'Heartbeat') {
      console.log('[Main] Data sent to renderer via mavlink:data');
    }
    
    // 记录数据
    const logger = dataLoggers[data.emitterId];
    if (logger) {
      logger.log(data);
    }
  });

  mavlinkConnection.on('parse-error', (error) => {
    console.error('MAVLink parse error:', error);
  });
}

// 发送消息到渲染进程
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// 清理资源
async function cleanup() {
  try {
    if (serialManager) {
      await serialManager.disconnect();
    }
    if (tileServer) {
      await tileServer.stop();
    }
    for (const logger of Object.values(dataLoggers)) {
      if (logger) {
        await logger.stop();
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}
