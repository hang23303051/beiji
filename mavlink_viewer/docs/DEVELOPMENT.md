# 开发者文档

## 开发环境设置

### 必需软件
- Node.js 18+ 
- npm 9+
- Git
- VS Code（推荐）

### 推荐VS Code插件
- ESLint
- Volar（Vue语言支持）
- Tailwind CSS IntelliSense

### 安装依赖
```bash
npm install
```

## 项目架构

### 技术栈
```
Electron 28 (桌面框架)
  ├── 主进程 (Node.js)
  │   ├── serialport (串口通信)
  │   ├── node-mavlink (协议解析)
  │   ├── express (瓦片服务器)
  │   └── csv-writer (数据记录)
  │
  └── 渲染进程 (Chromium)
      ├── Vue 3 (UI框架)
      ├── Pinia (状态管理)
      ├── Leaflet.js (地图)
      ├── Proj4js (投影转换)
      └── TailwindCSS (样式)
```

### 目录结构
```
src/
├── main/              # Electron主进程
│   ├── index.js       # 主进程入口，窗口管理
│   ├── preload.js     # IPC预加载脚本
│   └── modules/       # 功能模块
│       ├── SerialManager.js      # 串口管理
│       ├── MAVLinkConnection.js  # MAVLink解析
│       ├── TileServer.js         # 瓦片服务器
│       └── DataLogger.js         # CSV记录
│
└── renderer/          # Vue渲染进程
    ├── main.js        # Vue入口
    ├── App.vue        # 根组件
    ├── style.css      # 全局样式
    ├── components/    # Vue组件
    │   ├── Toolbar.vue          # 工具栏
    │   ├── StatusBar.vue        # 状态栏
    │   ├── MapView.vue          # 常规地图
    │   ├── PolarMapView.vue     # 极地地图
    │   ├── DataPanel.vue        # 数据面板容器
    │   └── EmitterDataView.vue  # 单发射端数据
    │
    └── stores/        # Pinia状态
        └── app.js     # 应用全局状态
```

## IPC通信架构

### 通信流程
```
渲染进程 (Vue)  <-->  IPC  <-->  主进程 (Node.js)
     ↓                              ↓
  window.electronAPI          Serial/MAVLink
```

### IPC接口定义

#### 串口API
```javascript
// 列出串口
const ports = await window.electronAPI.serial.list()

// 连接串口
const result = await window.electronAPI.serial.connect(port, baudRate)

// 断开串口
await window.electronAPI.serial.disconnect()

// 监听状态
window.electronAPI.serial.onStatus((data) => {
  console.log(data.status) // 'connected' | 'disconnected'
})

// 监听错误
window.electronAPI.serial.onError((data) => {
  console.error(data.message)
})
```

#### MAVLink API
```javascript
// 监听心跳
window.electronAPI.mavlink.onHeartbeat((data) => {
  console.log(data.systemId, data.emitterId)
})

// 监听数据
window.electronAPI.mavlink.onData((data) => {
  console.log(data.emitterId, data.lat, data.lon)
})
```

#### 瓦片服务器API
```javascript
// 启动离线瓦片服务器
const result = await window.electronAPI.tiles.startOffline(tileDir)
// result: { success: true, port: 8123, url: 'http://...' }

// 停止服务器
await window.electronAPI.tiles.stopOffline()
```

#### 数据记录API
```javascript
// 开始记录
const result = await window.electronAPI.logger.start(emitterId, outputDir)
// result: { success: true, filename: '...' }

// 停止记录
await window.electronAPI.logger.stop(emitterId)

// 停止所有记录
await window.electronAPI.logger.stopAll()
```

## 状态管理（Pinia）

### Store结构
```javascript
// stores/app.js
{
  // 连接状态
  connected: boolean,
  recording: boolean,
  
  // 配置
  projectionMode: 'normal' | 'north_polar' | 'south_polar',
  offlineTiles: boolean,
  tileUrl: string,
  
  // 串口
  serialPorts: Array,
  selectedPort: string,
  baudRate: number,
  
  // 数据
  emitterData: {
    1: { lat, lon, alt, ... },
    2: { lat, lon, alt, ... }
  },
  
  // 轨迹
  trajectories: {
    1: [[lat, lon], ...],
    2: [[lat, lon], ...]
  },
  
  // 统计
  dataCount: { total, emitter1, emitter2 },
  
  // 消息
  statusMessage: string,
  errorMessage: string
}
```

## 组件开发指南

### Vue组件规范
1. 使用Composition API
2. 使用`<script setup>`语法
3. Props使用TypeScript风格定义
4. 保持组件单一职责

### 示例组件
```vue
<template>
  <div class="component">
    <h3>{{ title }}</h3>
    <p>{{ data.value }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const props = defineProps({
  title: {
    type: String,
    required: true
  }
})

const appStore = useAppStore()
const data = computed(() => appStore.someData)
</script>
```

### TailwindCSS使用
```html
<!-- 布局 -->
<div class="flex items-center gap-4 p-4">

<!-- 按钮 -->
<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">

<!-- 输入框 -->
<input class="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">

<!-- 颜色变量 -->
<div class="text-emitter1">  <!-- 红色 #ef4444 -->
<div class="text-emitter2">  <!-- 蓝色 #3b82f6 -->
```

## MAVLink消息处理

### 添加新消息类型

#### 1. 主进程解析
```javascript
// src/main/modules/MAVLinkConnection.js
handleMessage(message) {
  // ...
  switch (msgType) {
    case 'NEW_MESSAGE_TYPE':
      data.newField = message.someValue
      break
  }
}
```

#### 2. 更新数据结构
```javascript
// src/renderer/stores/app.js
createEmptyData() {
  return {
    // ... 现有字段
    newField: 0,  // 新字段
  }
}
```

#### 3. 更新UI
```vue
<!-- src/renderer/components/EmitterDataView.vue -->
<DataField label="新字段" :value="data.newField" />
```

## 调试技巧

### 主进程调试
```javascript
// src/main/index.js
console.log('Main process:', data)
```
输出到终端控制台

### 渲染进程调试
```javascript
// src/renderer/...
console.log('Renderer:', data)
```
输出到Electron DevTools

### 开启DevTools
```javascript
// src/main/index.js
if (isDev) {
  mainWindow.webContents.openDevTools()
}
```

### 网络请求调试
F12 → Network标签查看瓦片请求

## 测试

### 单元测试（TODO）
```bash
npm test
```

### E2E测试（TODO）
```bash
npm run test:e2e
```

### 手动测试清单
- [ ] 串口枚举
- [ ] 串口连接/断开
- [ ] MAVLink数据接收
- [ ] 地图轨迹显示
- [ ] 投影模式切换
- [ ] 离线瓦片
- [ ] 数据记录
- [ ] 清除轨迹

## 性能优化

### 1. 轨迹点限制
```javascript
// stores/app.js
const maxTrajectoryPoints = 500
```

### 2. 数据节流
使用`lodash.throttle`限制更新频率

### 3. 组件懒加载
```javascript
const PolarMapView = defineAsyncComponent(() => 
  import('./components/PolarMapView.vue')
)
```

### 4. 虚拟滚动
对于大量数据使用虚拟列表

## 打包优化

### 减小体积
```javascript
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'leaflet': ['leaflet'],
        'proj4': ['proj4']
      }
    }
  }
}
```

### 排除开发依赖
```json
// package.json
"devDependencies": {
  // 这些不会打包到生产版本
}
```

## 常见问题

### Q: 修改代码后不生效？
A: 重启开发服务器（Ctrl+C，然后`npm run dev`）

### Q: 串口权限问题？
A: 
- Windows：以管理员运行
- macOS：检查权限设置
- Linux：加入dialout组

### Q: node-mavlink编译失败？
A: 
```bash
npm install --build-from-source
```

## 贡献代码

### 分支策略
- `main` - 稳定版本
- `develop` - 开发版本
- `feature/*` - 新功能
- `bugfix/*` - 修复bug

### 提交规范
```
feat: 添加新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

### Pull Request流程
1. Fork仓库
2. 创建特性分支
3. 提交代码
4. 推送到Fork
5. 创建PR

## 资源链接

- [Electron文档](https://www.electronjs.org/docs)
- [Vue 3文档](https://vuejs.org/)
- [Pinia文档](https://pinia.vuejs.org/)
- [Leaflet文档](https://leafletjs.com/)
- [MAVLink协议](https://mavlink.io/)
- [TailwindCSS文档](https://tailwindcss.com/)
