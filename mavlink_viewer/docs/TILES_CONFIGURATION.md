# 地图瓦片配置说明

## 在线瓦片（默认）

### 当前配置
应用默认使用 **OpenStreetMap** 的在线瓦片服务：

```
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

### 瓦片加载机制
1. **自动加载**: 应用启动时自动从OpenStreetMap服务器下载瓦片
2. **实时渲染**: 地图移动和缩放时实时请求新瓦片
3. **浏览器缓存**: 已加载的瓦片会被浏览器缓存，减少重复请求

### 调试瓦片加载
打开Electron开发者工具（F12），查看Console标签页：
- ✅ "瓦片加载成功" - 瓦片正常加载
- ❌ "瓦片加载错误" - 瓦片加载失败，检查网络连接

### 常见问题

#### Q1: 地图显示灰色背景，没有瓦片？
**原因**：
- 网络连接问题
- OpenStreetMap服务器暂时不可用
- 防火墙/代理阻止了请求

**解决方案**：
1. 检查网络连接：`ping tile.openstreetmap.org`
2. 查看开发者工具Console的错误信息
3. 尝试使用其他瓦片源（见下文）
4. 使用离线瓦片

#### Q2: 瓦片加载很慢？
**原因**：
- 网络带宽限制
- OpenStreetMap服务器负载高
- 地理位置远离服务器

**解决方案**：
1. 使用国内瓦片镜像（见下文）
2. 准备离线瓦片
3. 降低地图缩放级别

## 替代瓦片源

### 1. OpenStreetMap标准服务器（当前）
```javascript
// src/renderer/stores/app.js
const tileUrl = ref('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
```
- ✅ 官方服务器，数据最新
- ❌ 国内访问可能较慢

### 2. OpenStreetMap中国镜像
```javascript
const tileUrl = ref('https://tile-a.openstreetmap.fr/hot/{z}/{x}/{y}.png')
```
- ✅ 人道主义OSM风格
- ✅ 访问速度更快

### 3. CartoDB瓦片（清爽风格）
```javascript
const tileUrl = ref('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png')
```
- ✅ 简洁清爽的地图风格
- ✅ 适合数据可视化

### 4. Esri卫星影像
```javascript
const tileUrl = ref('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
```
- ✅ 高清卫星影像
- ❌ 可能需要API密钥

### 如何更改瓦片源

#### 方法1: 修改代码（永久）
编辑 `src/renderer/stores/app.js`:
```javascript
const tileUrl = ref('你的瓦片URL')
```

#### 方法2: 通过UI切换（未实现）
未来版本可以添加瓦片源选择下拉框。

## 离线瓦片

### 瓦片目录结构
```
tiles/
├── 0/0/0.png
├── 1/0/0.png
├── 1/0/1.png
├── 1/1/0.png
├── 1/1/1.png
├── 2/...
└── 18/...
```

### 准备离线瓦片

#### 选项1: 使用MOBAC下载
[Mobile Atlas Creator (MOBAC)](https://mobac.sourceforge.io/)
1. 下载MOBAC
2. 选择地图源（OpenStreetMap）
3. 选择区域和缩放级别
4. 导出为PNG瓦片

#### 选项2: 使用Python脚本
```python
import requests
import os

def download_tile(z, x, y, output_dir):
    url = f'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    filepath = f'{output_dir}/{z}/{x}/{y}.png'
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    response = requests.get(url, headers={'User-Agent': 'MAVLinkViewer/1.0'})
    with open(filepath, 'wb') as f:
        f.write(response.content)
    print(f'Downloaded: {z}/{x}/{y}')

# 下载特定区域的瓦片
# 注意：大量下载需要遵守使用条款
```

#### 选项3: 使用在线工具
- [OpenMapTiles](https://openmaptiles.org/)
- [MapTiler](https://www.maptiler.com/)

### 使用离线瓦片
1. 将瓦片放到 `tiles/` 目录
2. 在应用中勾选"离线瓦片"
3. 应用会启动本地瓦片服务器（端口8008-8999）

## 瓦片服务器配置

### Express服务器（当前）
- **文件**: `src/main/modules/TileServer.js`
- **端口**: 随机（8008-8999）
- **URL格式**: `http://127.0.0.1:{port}/{z}/{x}/{y}.png`

### 性能优化
1. **缓存**: 浏览器自动缓存瓦片
2. **压缩**: 瓦片使用PNG格式，已压缩
3. **并发**: Leaflet自动管理并发请求

## 最佳实践

### 1. 开发环境
✅ 使用在线瓦片，方便调试
✅ 打开开发者工具监控瓦片加载

### 2. 生产环境
✅ 准备离线瓦片（关键区域）
✅ 配置备用瓦片源
✅ 实现瓦片源切换UI

### 3. 网络受限环境
✅ 必须使用离线瓦片
✅ 提前下载所需区域
✅ 准备多个缩放级别

### 4. 遵守使用条款
⚠️ OpenStreetMap有使用限制
⚠️ 大量下载前阅读[瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/)
⚠️ 考虑自建瓦片服务器

## 技术细节

### Leaflet瓦片请求
```javascript
L.tileLayer(url, {
  attribution: '© OpenStreetMap',
  maxZoom: 19,           // 最大缩放级别
  crossOrigin: true,     // CORS支持
})
```

### 瓦片URL模板
- `{z}` - 缩放级别 (0-19)
- `{x}` - 横向瓦片索引
- `{y}` - 纵向瓦片索引
- `{s}` - 子域名 (a/b/c)

### 瓦片坐标系统
使用Web Mercator投影（EPSG:3857）:
- 纬度范围: -85.0511° 到 85.0511°
- 经度范围: -180° 到 180°

## 相关资源

- [OpenStreetMap瓦片服务器](https://wiki.openstreetmap.org/wiki/Tile_servers)
- [Leaflet文档](https://leafletjs.com/reference.html#tilelayer)
- [瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/)
- [地图瓦片标准](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
