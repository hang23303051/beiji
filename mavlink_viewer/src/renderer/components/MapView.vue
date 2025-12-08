<template>
  <div ref="mapContainer" class="w-full h-full"></div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const appStore = useAppStore()
const mapContainer = ref(null)
let map = null
const polylines = {}
const markers = {}
const startMarkers = {}

onMounted(() => {
  initMap()
  
  // 监听轨迹变化
  watch(() => appStore.trajectories, updateTrajectories, { deep: true })
  watch(() => appStore.tileUrl, updateTileLayer)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

function initMap() {
  // 修复Leaflet图标路径问题
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  map = L.map(mapContainer.value, {
    center: [0, 0],
    zoom: 2,
    zoomControl: false,
    preferCanvas: false,
  })

  // 添加缩放控件到右下角
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  // 添加比例尺
  L.control.scale({ position: 'bottomleft' }).addTo(map)

  // 加载瓦片图层
  const tileLayer = L.tileLayer(appStore.tileUrl, {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    crossOrigin: true,
  })
  
  tileLayer.on('tileerror', (error) => {
    console.error('瓦片加载错误:', error)
  })
  
  tileLayer.on('tileload', () => {
    console.log('瓦片加载成功')
  })
  
  tileLayer.addTo(map)
  
  console.log('地图初始化完成，中心点:', map.getCenter(), '缩放级别:', map.getZoom())
  console.log('瓦片URL:', appStore.tileUrl)
}

function updateTrajectories(newTrajectories) {
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
      if (startMarkers[emitterId]) {
        map.removeLayer(startMarkers[emitterId])
        delete startMarkers[emitterId]
      }
      return
    }

    const color = appStore.emitterColors[emitterId]
    const emitterIdNum = parseInt(emitterId)

    // 更新或创建轨迹线
    if (!polylines[emitterId]) {
      polylines[emitterId] = L.polyline(points, {
        color: color,
        weight: 3,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(map)

      // 添加起点标记
      startMarkers[emitterId] = L.circleMarker(points[0], {
        radius: 5,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindTooltip(`发射端 ${emitterIdNum} 起点`, { permanent: false })
        .addTo(map)
    } else {
      polylines[emitterId].setLatLngs(points)
      
      // 更新起点位置
      if (startMarkers[emitterId]) {
        startMarkers[emitterId].setLatLng(points[0])
      }
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
    map.panTo(lastPoint)
  })
}

function updateTileLayer(newUrl) {
  if (!map) return
  
  console.log('切换瓦片图层:', newUrl)
  
  // 移除旧图层
  map.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) {
      console.log('移除旧瓦片图层')
      map.removeLayer(layer)
    }
  })

  // 添加新图层
  const newTileLayer = L.tileLayer(newUrl, {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    crossOrigin: true,
  })
  
  newTileLayer.on('tileerror', (error) => {
    console.error('新瓦片层加载错误:', error)
  })
  
  newTileLayer.on('loading', () => {
    console.log('瓦片层开始加载...')
  })
  
  newTileLayer.on('load', () => {
    console.log('瓦片层加载完成')
  })
  
  newTileLayer.addTo(map)
}
</script>

<style scoped>
.custom-marker {
  background: transparent;
  border: none;
}
</style>
