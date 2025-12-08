<template>
  <div class="relative w-full h-full bg-gray-100 flex items-center justify-center">
    <canvas
      ref="canvas"
      :width="canvasSize"
      :height="canvasSize"
      class="border border-gray-300 shadow-lg"
    ></canvas>

    <!-- 投影信息标签 -->
    <div class="absolute top-4 left-4 bg-white px-4 py-2 rounded shadow-lg">
      <p class="text-sm font-bold text-gray-800">{{ projectionTitle }}</p>
      <p class="text-xs text-gray-600">EPSG:{{ epsgCode }}</p>
    </div>

    <!-- 控制按钮 -->
    <div class="absolute top-4 right-4 flex flex-col gap-2">
      <button
        @click="zoomIn"
        class="bg-white p-2 rounded shadow hover:bg-gray-100"
        title="放大"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <button
        @click="zoomOut"
        class="bg-white p-2 rounded shadow hover:bg-gray-100"
        title="缩小"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
      <button
        @click="resetView"
        class="bg-white p-2 rounded shadow hover:bg-gray-100"
        title="重置视图"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore } from '../stores/app'
import proj4 from 'proj4'
import { arcticLandmasses, antarcticaCoastline, antarcticFeatures } from '../utils/polarGeometry'

const props = defineProps({
  hemisphere: {
    type: String,
    default: 'north',
    validator: (value) => ['north', 'south'].includes(value),
  },
})

const appStore = useAppStore()
const canvas = ref(null)
const canvasSize = 700
const centerX = canvasSize / 2
const centerY = canvasSize / 2
const scale = ref(0.00005) // 缩放因子（米 -> 像素）
const backgroundImage = ref(null)
const imageLoaded = ref(false)

const projectionTitle = computed(() =>
  props.hemisphere === 'north' ? '北极极地投影' : '南极极地投影'
)

const epsgCode = computed(() =>
  props.hemisphere === 'north' ? '3413' : '3031'
)

let ctx = null

// 定义投影
proj4.defs([
  ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
  ['EPSG:3413', '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs'],
  ['EPSG:3031', '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs'],
])

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  loadBackgroundImage()
  
  // 监听轨迹变化
  watch(() => appStore.trajectories, draw, { deep: true })
  watch(() => props.hemisphere, () => {
    loadBackgroundImage()
  })
  watch(scale, draw)
})

function loadBackgroundImage() {
  const imageName = props.hemisphere === 'north' ? 'polar_north.png' : 'polar_south.png'
  const img = new Image()
  
  img.onload = () => {
    backgroundImage.value = img
    imageLoaded.value = true
    console.log(`✅ ${props.hemisphere === 'north' ? '北极' : '南极'}背景图加载成功`)
    draw()
  }
  
  img.onerror = (error) => {
    console.error(`❌ 背景图加载失败:`, error)
    imageLoaded.value = false
    // 如果图片加载失败，仍然绘制基本的背景
    draw()
  }
  
  // 使用Vite的资源导入路径
  img.src = `/src/renderer/assets/${imageName}`
}

function wgs84ToPolar(lat, lon) {
  const targetEpsg = props.hemisphere === 'north' ? 'EPSG:3413' : 'EPSG:3031'
  return proj4('EPSG:4326', targetEpsg, [lon, lat])
}

function draw() {
  if (!ctx) return
  
  clearCanvas()
  drawBackground()
  drawTrajectories()
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvasSize, canvasSize)
}

function drawBackground() {
  // 如果背景图片已加载，直接绘制图片
  if (imageLoaded.value && backgroundImage.value) {
    ctx.drawImage(backgroundImage.value, 0, 0, canvasSize, canvasSize)
    return
  }
  
  // 否则使用备用的手绘背景
  // 1. 绘制海洋背景
  ctx.fillStyle = '#a5bfdd' // 海洋蓝色
  ctx.fillRect(0, 0, canvasSize, canvasSize)
  
  // 2. 绘制陆地区域（使用简化的海岸线）
  drawLandmasses()
  
  // 3. 绘制纬线（同心圆）
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1

  const latitudes = props.hemisphere === 'north'
    ? [50, 60, 70, 80, 90]
    : [-50, -60, -70, -80, -90]

  latitudes.forEach((lat) => {
    try {
      const [x, y] = wgs84ToPolar(lat, 0)
      const radius = Math.sqrt(x * x + y * y) * scale.value

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.stroke()

      // 标注纬度
      ctx.fillStyle = '#333'
      ctx.font = '10px Arial'
      ctx.fillText(`${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`, centerX + radius + 5, centerY)
    } catch (error) {
      console.error('Error drawing latitude circle:', error)
    }
  })

  // 4. 绘制经线
  ctx.strokeStyle = '#888'
  for (let lon = 0; lon < 360; lon += 30) {
    try {
      const [x, y] = wgs84ToPolar(
        props.hemisphere === 'north' ? 50 : -50,
        lon
      )
      const screenX = centerX + x * scale.value
      const screenY = centerY - y * scale.value

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(screenX, screenY)
      ctx.stroke()

      // 标注经度
      ctx.fillStyle = '#333'
      ctx.font = '10px Arial'
      ctx.fillText(`${lon}°`, screenX + 5, screenY)
    } catch (error) {
      console.error('Error drawing longitude line:', error)
    }
  }

  // 5. 绘制极点标记
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI)
  ctx.fill()
  
  // 6. 标注极点
  ctx.fillStyle = '#000'
  ctx.font = 'bold 14px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(props.hemisphere === 'north' ? '北极' : '南极', centerX, centerY - 12)
  ctx.textAlign = 'left'
}

// 绘制陆地轮廓
function drawLandmasses() {
  ctx.fillStyle = '#f0e6d2' // 陆地颜色
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 0.5
  
  // 根据半球绘制不同的陆地
  if (props.hemisphere === 'north') {
    drawNorthernLandmasses()
  } else {
    drawSouthernLandmasses()
  }
}

// 绘制北半球陆地（使用详细的Natural Earth数据）
function drawNorthernLandmasses() {
  ctx.fillStyle = '#f0e6d2' // 陆地颜色
  ctx.strokeStyle = '#8b7355' // 深棕色边界
  ctx.lineWidth = 0.8
  
  // 绘制所有北极陆地区域
  arcticLandmasses.forEach(landmass => {
    ctx.beginPath()
    let first = true
    
    landmass.coordinates.forEach(([lon, lat]) => {
      try {
        const [x, y] = wgs84ToPolar(lat, lon)
        const screenX = centerX + x * scale.value
        const screenY = centerY - y * scale.value
        
        if (first) {
          ctx.moveTo(screenX, screenY)
          first = false
        } else {
          ctx.lineTo(screenX, screenY)
        }
      } catch (error) {
        // 忽略投影错误的点
      }
    })
    
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  })
}

// 绘制南半球陆地（南极洲）
function drawSouthernLandmasses() {
  ctx.fillStyle = '#f0e6d2' // 陆地颜色
  ctx.strokeStyle = '#8b7355' // 深棕色边界
  ctx.lineWidth = 0.8
  
  // 绘制主要南极洲轮廓
  ctx.beginPath()
  let first = true
  
  antarcticaCoastline.forEach(([lon, lat]) => {
    try {
      const [x, y] = wgs84ToPolar(lat, lon)
      const screenX = centerX + x * scale.value
      const screenY = centerY - y * scale.value
      
      if (first) {
        ctx.moveTo(screenX, screenY)
        first = false
      } else {
        ctx.lineTo(screenX, screenY)
      }
    } catch (error) {
      // 忽略投影错误的点
    }
  })
  
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  
  // 绘制南极半岛和其他特征
  antarcticFeatures.forEach(feature => {
    ctx.beginPath()
    let first = true
    
    feature.coordinates.forEach(([lon, lat]) => {
      try {
        const [x, y] = wgs84ToPolar(lat, lon)
        const screenX = centerX + x * scale.value
        const screenY = centerY - y * scale.value
        
        if (first) {
          ctx.moveTo(screenX, screenY)
          first = false
        } else {
          ctx.lineTo(screenX, screenY)
        }
      } catch (error) {
        // 忽略投影错误的点
      }
    })
    
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  })
}


function drawTrajectories() {
  Object.entries(appStore.trajectories).forEach(([emitterId, points]) => {
    if (!points || points.length === 0) return

    const color = appStore.emitterColors[emitterId]

    // 绘制轨迹线
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()

    let isFirst = true
    points.forEach((point) => {
      try {
        const [lat, lon] = point
        const [x, y] = wgs84ToPolar(lat, lon)
        const screenX = centerX + x * scale.value
        const screenY = centerY - y * scale.value

        if (isFirst) {
          ctx.moveTo(screenX, screenY)
          isFirst = false
        } else {
          ctx.lineTo(screenX, screenY)
        }
      } catch (error) {
        console.error('Error projecting point:', error)
      }
    })

    ctx.stroke()

    // 绘制当前位置
    if (points.length > 0) {
      try {
        const lastPoint = points[points.length - 1]
        const [lastLat, lastLon] = lastPoint
        const [lastX, lastY] = wgs84ToPolar(lastLat, lastLon)
        const lastScreenX = centerX + lastX * scale.value
        const lastScreenY = centerY - lastY * scale.value

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(lastScreenX, lastScreenY, 5, 0, 2 * Math.PI)
        ctx.fill()

        // 绘制编号
        ctx.fillStyle = color
        ctx.font = 'bold 16px Arial'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 3
        ctx.strokeText(emitterId, lastScreenX + 10, lastScreenY - 10)
        ctx.fillText(emitterId, lastScreenX + 10, lastScreenY - 10)
      } catch (error) {
        console.error('Error drawing emitter marker:', error)
      }
    }
  })
}

function zoomIn() {
  scale.value *= 1.2
}

function zoomOut() {
  scale.value /= 1.2
}

function resetView() {
  scale.value = 0.00005
}
</script>
