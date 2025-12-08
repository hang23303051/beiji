<template>
  <div ref="mapContainer" class="w-full h-full relative">
    <!-- 投影信息 -->
    <div class="absolute top-4 left-4 bg-white px-4 py-2 rounded shadow-lg z-[1000]">
      <p class="text-sm font-bold text-gray-800">{{ projectionTitle }}</p>
      <p class="text-xs text-gray-600">EPSG:{{ epsgCode }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import proj4 from 'proj4'
import 'proj4leaflet'

const props = defineProps({
  hemisphere: {
    type: String,
    default: 'north',
    validator: (value) => ['north', 'south'].includes(value),
  },
})

const appStore = useAppStore()
const mapContainer = ref(null)
let map = null
const polylines = {}
const markers = {}

const projectionTitle = computed(() =>
  props.hemisphere === 'north' ? '北极极地投影' : '南极极地投影'
)

const epsgCode = computed(() =>
  props.hemisphere === 'north' ? '3413' : '3031'
)

onMounted(() => {
  initPolarMap()
  
  // 监听轨迹变化
  watch(() => appStore.trajectories, updateTrajectories, { deep: true })
  watch(() => props.hemisphere, () => {
    if (map) {
      map.remove()
      map = null
    }
    initPolarMap()
  })
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

function initPolarMap() {
  if (!mapContainer.value) return

  // 定义极地投影
  if (props.hemisphere === 'north') {
    // EPSG:3413 - NSIDC Sea Ice Polar Stereographic North
    proj4.defs('EPSG:3413', '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs')
  } else {
    // EPSG:3031 - Antarctic Polar Stereographic
    proj4.defs('EPSG:3031', '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs')
  }

  const crs = new L.Proj.CRS(
    props.hemisphere === 'north' ? 'EPSG:3413' : 'EPSG:3031',
    proj4.defs(props.hemisphere === 'north' ? 'EPSG:3413' : 'EPSG:3031'),
    {
      origin: [0, 0],
      resolutions: generateResolutions(),
      bounds: L.bounds(
        props.hemisphere === 'north' 
          ? [[-4194304, -4194304], [4194304, 4194304]]
          : [[-4194304, -4194304], [4194304, 4194304]]
      ),
    }
  )

  map = L.map(mapContainer.value, {
    crs: crs,
    center: [props.hemisphere === 'north' ? 90 : -90, 0],
    zoom: 2,
    minZoom: 0,
    maxZoom: 8,
    zoomControl: false,
  })

  // 添加缩放控件
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  // 添加极地投影瓦片图层
  addPolarTileLayer()

  console.log('极地地图初始化完成')
}

function generateResolutions() {
  const resolutions = []
  for (let i = 0; i <= 8; i++) {
    resolutions.push(8192 / Math.pow(2, i))
  }
  return resolutions
}

function addPolarTileLayer() {
  console.log(`加载${props.hemisphere === 'north' ? '北极' : '南极'}瓦片图层`)
  
  if (props.hemisphere === 'north') {
    // 北极 - 尝试多个瓦片源
    // 方案1: 使用WGS84转换到极地投影的方式
    const osmLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 8,
        tileSize: 256,
      }
    )
    
    osmLayer.on('tileerror', (error) => {
      console.error('瓦片加载失败:', error)
    })
    
    osmLayer.on('tileload', () => {
      console.log('瓦片加载成功')
    })
    
    osmLayer.addTo(map)
    
    // 添加陆地图层以提供更好的视觉效果
    addCoastlineOverlay()
    
  } else {
    // 南极 - 使用相同策略
    const osmLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 8,
        tileSize: 256,
      }
    )
    
    osmLayer.on('tileerror', (error) => {
      console.error('瓦片加载失败:', error)
    })
    
    osmLayer.on('tileload', () => {
      console.log('瓦片加载成功')
    })
    
    osmLayer.addTo(map)
    
    // 添加陆地图层
    addCoastlineOverlay()
  }
}

// 添加海岸线叠加层以提供更好的地理参考
function addCoastlineOverlay() {
  // 这里可以添加GeoJSON海岸线数据
  // 暂时使用简单的标记来指示主要陆地区域
  console.log('添加海岸线叠加层')
}

function addFallbackLayer() {
  // 备用方案：添加简单的栅格底图
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  
  // 绘制简单的海洋底图
  ctx.fillStyle = '#a5bfdd'
  ctx.fillRect(0, 0, 256, 256)
  
  // 绘制网格
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1
  for (let i = 0; i < 256; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.stroke()
    
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  
  const dataUrl = canvas.toDataURL()
  
  L.tileLayer(dataUrl, {
    attribution: '简化底图',
    maxZoom: 8,
  }).addTo(map)
}

function updateTrajectories(newTrajectories) {
  if (!map) return

  Object.entries(newTrajectories).forEach(([emitterId, points]) => {
    if (!points || points.length === 0) {
      // 清除该发射端的轨迹
      if (polylines[emitterId]) {
        map.removeLayer(polylines[emitterId])
        delete polylines[emitterId]
      }
      if (markers[emitterId]) {
        map.removeLayer(markers[emitterId])
        delete markers[emitterId]
      }
      return
    }

    const color = appStore.emitterColors[emitterId]
    const emitterIdNum = Number.parseInt(emitterId)

    // 更新或创建轨迹线
    if (!polylines[emitterId]) {
      polylines[emitterId] = L.polyline(points, {
        color: color,
        weight: 3,
        opacity: 0.8,
      }).addTo(map)
    } else {
      polylines[emitterId].setLatLngs(points)
    }

    // 更新当前位置标记
    const lastPoint = points[points.length - 1]
    if (markers[emitterId]) {
      markers[emitterId].setLatLng(lastPoint)
    } else {
      markers[emitterId] = L.marker(lastPoint, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              color: ${color};
              font-size: 18px;
              font-weight: bold;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.7), 
                           -1px -1px 2px rgba(255,255,255,0.9);
              transform: translate(-50%, -50%);
            ">
              ${emitterIdNum}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .bindTooltip(`发射端 ${emitterIdNum}<br>当前位置`, { permanent: false })
        .addTo(map)
    }

    // 自动居中到最新位置
    try {
      map.panTo(lastPoint)
    } catch (error) {
      console.warn('无法平移到位置:', error)
    }
  })
}
</script>

<style scoped>
.custom-marker {
  background: transparent;
  border: none;
}
</style>
