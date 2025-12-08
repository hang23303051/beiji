const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 串口API
  serial: {
    list: () => ipcRenderer.invoke('serial:list'),
    connect: (port, baudRate) => ipcRenderer.invoke('serial:connect', { port, baudRate }),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
    onStatus: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('serial:status', subscription);
      return () => ipcRenderer.removeListener('serial:status', subscription);
    },
    onError: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('serial:error', subscription);
      return () => ipcRenderer.removeListener('serial:error', subscription);
    },
  },

  // MAVLink API
  mavlink: {
    onHeartbeat: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('mavlink:heartbeat', subscription);
      return () => ipcRenderer.removeListener('mavlink:heartbeat', subscription);
    },
    onData: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('mavlink:data', subscription);
      return () => ipcRenderer.removeListener('mavlink:data', subscription);
    },
  },

  // 瓦片服务器API
  tiles: {
    startOffline: (tileDir) => ipcRenderer.invoke('tiles:start-offline', { tileDir }),
    stopOffline: () => ipcRenderer.invoke('tiles:stop-offline'),
  },

  // 数据记录API
  logger: {
    start: (emitterId, outputDir) => ipcRenderer.invoke('logger:start', { emitterId, outputDir }),
    stop: (emitterId) => ipcRenderer.invoke('logger:stop', { emitterId }),
    stopAll: () => ipcRenderer.invoke('logger:stop-all'),
  },
});
