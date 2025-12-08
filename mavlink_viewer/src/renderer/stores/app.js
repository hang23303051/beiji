import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 状态
  const connected = ref(false)
  const recording = ref(false)
  const projectionMode = ref('normal') // 'normal' | 'north_polar' | 'south_polar'
  const offlineTiles = ref(false)
  // 瓦片URL：离线或在线
  const tileUrl = ref('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
  const offlineTileUrl = ref('http://127.0.0.1:8888/{z}/{x}/{y}.png') // 离线瓦片URL
  
  // 串口状态
  const serialPorts = ref([])
  const selectedPort = ref(null)
  const baudRate = ref(57600)
  
  // MAVLink数据
  const emitterData = ref({
    1: createEmptyData(),
    2: createEmptyData(),
  })
  
  // 轨迹数据
  const trajectories = ref({
    1: [],
    2: [],
  })
  
  const maxTrajectoryPoints = 500
  
  // 数据计数
  const dataCount = ref({
    total: 0,
    emitter1: 0,
    emitter2: 0,
  })
  
  // 状态消息
  const statusMessage = ref('准备就绪')
  const errorMessage = ref('')
  
  // 发射端颜色
  const emitterColors = {
    1: '#ef4444', // red-500
    2: '#3b82f6', // blue-500
  }
  
  // IPC监听器清理函数
  let cleanupFunctions = []
  
  // 辅助函数
  function createEmptyData() {
    return {
      time: 0,
      lat: 0,
      lon: 0,
      alt: 0,
      satellites: 0,
      hdop: 0,
      accel_x: 0,
      accel_y: 0,
      accel_z: 0,
      gyro_x: 0,
      gyro_y: 0,
      gyro_z: 0,
      mag_x: 0,
      mag_y: 0,
      mag_z: 0,
      pressure: 0,
      temperature: 0,
      roll: 0,
      pitch: 0,
      yaw: 0,
    }
  }
  
  // Actions
  async function loadSerialPorts() {
    try {
      const ports = await window.electronAPI.serial.list()
      if (ports.error) {
        throw new Error(ports.error)
      }
      serialPorts.value = ports
      
      // 自动选择推荐串口
      const recommended = ports.find(p => p.isRecommended)
      if (recommended && !selectedPort.value) {
        selectedPort.value = recommended.path
      }
    } catch (error) {
      console.error('Failed to load serial ports:', error)
      errorMessage.value = error.message
    }
  }
  
  async function connectSerial() {
    if (!selectedPort.value) {
      errorMessage.value = '请选择串口'
      return
    }
    
    try {
      statusMessage.value = '正在连接...'
      const result = await window.electronAPI.serial.connect(selectedPort.value, baudRate.value)
      
      if (result.success) {
        connected.value = true
        statusMessage.value = `已连接到 ${selectedPort.value}`
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to connect:', error)
      errorMessage.value = error.message
      statusMessage.value = '连接失败'
    }
  }
  
  async function disconnectSerial() {
    try {
      await window.electronAPI.serial.disconnect()
      connected.value = false
      statusMessage.value = '已断开连接'
      
      // 停止记录
      if (recording.value) {
        await stopRecording()
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }
  
  async function toggleOfflineTiles(enabled) {
    try {
      if (enabled) {
        const result = await window.electronAPI.tiles.startOffline('./tiles')
        if (result.success) {
          offlineTiles.value = true
          offlineTileUrl.value = result.url
          tileUrl.value = result.url
          statusMessage.value = `离线瓦片服务器已启动: ${result.url}`
          console.log('离线瓦片已启用:', result.url)
        } else {
          throw new Error(result.error)
        }
      } else {
        await window.electronAPI.tiles.stopOffline()
        offlineTiles.value = false
        tileUrl.value = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        statusMessage.value = '已切换到在线地图'
      }
      
      // 不清空轨迹，只刷新地图
    } catch (error) {
      console.error('Failed to toggle offline tiles:', error)
      errorMessage.value = error.message
      statusMessage.value = `离线瓦片错误: ${error.message}`
    }
  }
  
  async function startRecording() {
    try {
      const outputDir = '.'
      
      // 启动两个发射端的记录器
      const result1 = await window.electronAPI.logger.start(1, outputDir)
      const result2 = await window.electronAPI.logger.start(2, outputDir)
      
      if (result1.success && result2.success) {
        recording.value = true
        statusMessage.value = `记录已开始: ${result1.filename}, ${result2.filename}`
      } else {
        throw new Error(result1.error || result2.error)
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
      errorMessage.value = error.message
    }
  }
  
  async function stopRecording() {
    try {
      await window.electronAPI.logger.stopAll()
      recording.value = false
      statusMessage.value = '记录已停止'
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }
  
  function setProjectionMode(mode) {
    projectionMode.value = mode
    statusMessage.value = `投影模式: ${mode === 'normal' ? '常规' : mode === 'north_polar' ? '北极极地' : '南极极地'}`
  }
  
  function clearTrajectories() {
    trajectories.value[1] = []
    trajectories.value[2] = []
    dataCount.value = {
      total: 0,
      emitter1: 0,
      emitter2: 0,
    }
  }
  
  function handleMAVLinkData(data) {
    // 调试：定期打印完整数据（每10条打印一次详细信息）
    if (dataCount.value.total % 10 === 0) {
      console.log('[Renderer] Full MAVLink data:', data)
    }
    
    const emitterId = data.emitterId
    
    if (emitterId !== 1 && emitterId !== 2) {
      console.warn('[Renderer] Invalid emitterId:', emitterId)
      return
    }
    
    // 更新数据
    emitterData.value[emitterId] = { ...data }
    console.log('[Renderer] emitterData updated for emitter', emitterId)
    
    // 更新计数
    dataCount.value.total++
    if (emitterId === 1) {
      dataCount.value.emitter1++
    } else {
      dataCount.value.emitter2++
    }
    console.log('[Renderer] Data count:', dataCount.value)
    
    // 更新轨迹
    if (data.lat !== 0 && data.lon !== 0) {
      const trajectory = trajectories.value[emitterId]
      trajectory.push([data.lat, data.lon])
      
      // 限制轨迹点数
      if (trajectory.length > maxTrajectoryPoints) {
        trajectory.shift()
      }
      console.log('[Renderer] Trajectory updated, points:', trajectory.length)
    }
  }
  
  function initializeListeners() {
    console.log('[Renderer] Initializing IPC listeners...')
    
    // 串口状态监听
    const serialStatusCleanup = window.electronAPI.serial.onStatus((data) => {
      if (data.status === 'connected') {
        connected.value = true
      } else if (data.status === 'disconnected') {
        connected.value = false
        statusMessage.value = '连接已断开'
      }
    })
    
    const serialErrorCleanup = window.electronAPI.serial.onError((data) => {
      errorMessage.value = data.message
      statusMessage.value = `串口错误: ${data.message}`
    })
    
    // MAVLink数据监听
    const mavlinkDataCleanup = window.electronAPI.mavlink.onData((data) => {
      console.log('[Renderer] mavlink:data event received')
      handleMAVLinkData(data)
    })
    
    const mavlinkHeartbeatCleanup = window.electronAPI.mavlink.onHeartbeat((data) => {
      console.log('[Renderer] Heartbeat received:', data)
      statusMessage.value = `系统ID ${data.systemId} 已连接 (发射端 ${data.emitterId})`
    })
    
    console.log('[Renderer] IPC listeners initialized successfully')
    
    cleanupFunctions = [
      serialStatusCleanup,
      serialErrorCleanup,
      mavlinkDataCleanup,
      mavlinkHeartbeatCleanup,
    ]
  }
  
  function cleanupListeners() {
    cleanupFunctions.forEach(cleanup => cleanup())
    cleanupFunctions = []
  }
  
  const storeInstance = {
    // 状态
    connected,
    recording,
    projectionMode,
    offlineTiles,
    tileUrl,
    offlineTileUrl,
    serialPorts,
    selectedPort,
    baudRate,
    emitterData,
    trajectories,
    dataCount,
    statusMessage,
    errorMessage,
    emitterColors,
    
    // Actions
    loadSerialPorts,
    connectSerial,
    disconnectSerial,
    toggleOfflineTiles,
    startRecording,
    stopRecording,
    setProjectionMode,
    clearTrajectories,
    initializeListeners,
    cleanupListeners,
  }
  
  // 调试：暴露到全局window对象
  if (typeof window !== 'undefined') {
    window.appStore = storeInstance
    console.log('[Store] appStore exposed to window for debugging')
  }
  
  return storeInstance
})
