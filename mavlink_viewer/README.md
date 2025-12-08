# MAVLink Viewer

基于 Electron + Vue3 + TailwindCSS 的MAVLink数据可视化客户端。支持双发射端数据接收、地图轨迹显示（常规/极地投影）、数据记录等功能。

![MAVLink Viewer](docs/screenshot.png)

## 功能特性

### 核心功能
- ✅ **双发射端支持**: 同时接收和区分两个独立发射端的MAVLink数据
- ✅ **串口通信**: 自动识别和连接串口设备
- ✅ **实时数据显示**: GPS、姿态、IMU、环境数据实时更新
- ✅ **地图可视化**: Leaflet.js地图实时显示轨迹
- ✅ **极地投影**: 支持北极/南极极地投影（EPSG:3413/3031）
- ✅ **离线瓦片**: 支持本地瓦片服务器
- ✅ **数据记录**: CSV格式记录MAVLink数据

### 技术架构
- **前端**: Vue 3 (Composition API) + TailwindCSS
- **桌面框架**: Electron 28
- **状态管理**: Pinia
- **地图库**: Leaflet.js + Proj4js
- **串口通信**: serialport
- **MAVLink解析**: node-mavlink
- **数据记录**: csv-writer

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
cd mavlink_viewer
npm install
```

### 开发模式
```bash
npm run dev
```

这将同时启动Vite开发服务器和Electron应用。

### 构建生产版本
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 使用说明

### 1. 连接串口
1. 点击"刷新"按钮刷新串口列表
2. 选择目标串口（推荐串口会高亮显示）
3. 选择波特率（默认57600）
4. 点击"连接"按钮

### 2. 查看数据
连接成功后，数据面板会实时显示两个发射端的：
- GPS数据（纬度、经度、高度、卫星数、HDOP）
- 姿态数据（横滚、俯仰、偏航）
- IMU数据（加速度、陀螺仪、磁力计）
- 环境数据（气压、温度）

### 3. 地图显示
- **常规投影**: 使用Web Mercator投影显示全球地图
- **北极投影**: 适用于北纬50°以上区域
- **南极投影**: 适用于南纬50°以下区域

### 4. 记录数据
1. 点击"开始记录"按钮
2. 数据将自动保存到CSV文件
3. 每个发射端独立保存
4. 文件命名格式: `mavlink_data_emitter{1/2}_YYYYMMDD_HHMMSS.csv`

### 5. 地图瓦片

#### 在线瓦片（默认）
应用默认使用OpenStreetMap在线瓦片：
- ✅ 自动下载和加载
- ✅ 无需配置
- ✅ 数据最新
- ⚠️ 需要网络连接

**调试瓦片加载**：
- 打开开发者工具（F12）查看Console
- 查看"瓦片加载成功"或"瓦片加载错误"消息
- 检查Network标签的瓦片请求

#### 离线瓦片（可选）
如果网络受限或需要离线使用：
1. 准备瓦片文件，放置在`tiles/`目录
2. 瓦片目录结构: `tiles/{z}/{x}/{y}.png`
3. 勾选"离线瓦片"复选框
4. 应用会自动启动本地瓦片服务器

**瓦片准备工具**：
- [MOBAC](https://mobac.sourceforge.io/) - 离线地图下载器
- [详细配置指南](docs/TILES_CONFIGURATION.md)

## 项目结构

```
mavlink_viewer/
├── src/
│   ├── main/                  # Electron主进程
│   │   ├── index.js          # 主进程入口
│   │   ├── preload.js        # 预加载脚本
│   │   └── modules/          # 功能模块
│   │       ├── SerialManager.js       # 串口管理
│   │       ├── MAVLinkConnection.js   # MAVLink解析
│   │       ├── TileServer.js          # 瓦片服务器
│   │       └── DataLogger.js          # 数据记录
│   │
│   └── renderer/             # Vue渲染进程
│       ├── main.js           # 渲染进程入口
│       ├── App.vue           # 根组件
│       ├── style.css         # 全局样式
│       ├── components/       # Vue组件
│       │   ├── Toolbar.vue           # 顶部工具栏
│       │   ├── StatusBar.vue         # 底部状态栏
│       │   ├── MapView.vue           # 常规地图
│       │   ├── PolarMapView.vue      # 极地地图
│       │   ├── DataPanel.vue         # 数据面板
│       │   └── EmitterDataView.vue   # 发射端数据视图
│       │
│       └── stores/           # Pinia状态管理
│           └── app.js        # 应用状态
│
├── package.json              # 项目配置
├── vite.config.js           # Vite配置
├── tailwind.config.js       # TailwindCSS配置
├── index.html               # HTML入口
└── README.md                # 本文件
```

## MAVLink消息支持

当前支持的MAVLink消息类型：
- `HEARTBEAT` - 心跳包
- `GPS_RAW_INT` - GPS原始数据
- `ATTITUDE` - 姿态数据
- `RAW_IMU` - IMU原始数据
- `SCALED_PRESSURE` - 气压数据

## 已知问题

1. **node-mavlink兼容性**: 某些飞控可能需要使用`SET_MESSAGE_INTERVAL`代替`REQUEST_DATA_STREAM`
2. **极地投影性能**: 大量轨迹点时可能出现卡顿，建议限制显示点数
3. **Windows权限**: 某些COM口需要管理员权限

## 开发计划

- [ ] 支持更多MAVLink消息类型
- [ ] 添加历史数据回放功能
- [ ] 支持SQLite数据库存储
- [ ] 添加数据导出功能
- [ ] 优化极地投影性能
- [ ] 添加自动更新功能

## 贡献指南

欢迎提交Issue和Pull Request！

### 开发环境设置
1. Fork本仓库
2. 创建特性分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送分支: `git push origin feature/your-feature`
5. 提交Pull Request

## 许可证

MIT License

## 致谢

- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [Leaflet](https://leafletjs.com/)
- [MAVLink](https://mavlink.io/)
- [TailwindCSS](https://tailwindcss.com/)

## 联系方式

如有问题或建议，请提交Issue或联系开发团队。

---

**从Python迁移**: 本项目是从Python (PyQt5) 版本重构而来，保留了所有核心功能并进行了架构优化。详见 [迁移文档](../MIGRATION_REQUIREMENTS.md)。
