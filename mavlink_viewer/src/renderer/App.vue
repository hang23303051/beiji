<template>
  <div class="h-full w-full flex flex-col bg-gray-50">
    <!-- 顶部工具栏 -->
    <Toolbar />
    
    <!-- 主内容区 -->
    <div class="flex-1 flex min-h-0">
      <!-- 地图区域 (2/3) -->
      <div class="flex-[2] relative">
        <MapView v-if="projectionMode === 'normal'" />
        <PolarMapView v-else :hemisphere="projectionMode === 'north_polar' ? 'north' : 'south'" />
      </div>
      
      <!-- 数据面板 (1/3) -->
      <div class="flex-[1] border-l border-gray-300 bg-white overflow-y-auto">
        <DataPanel />
      </div>
    </div>
    
    <!-- 底部状态栏 -->
    <StatusBar />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from './stores/app'
import Toolbar from './components/Toolbar.vue'
import MapView from './components/MapView.vue'
import PolarMapView from './components/PolarMapView.vue'
import DataPanel from './components/DataPanel.vue'
import StatusBar from './components/StatusBar.vue'

const appStore = useAppStore()
const projectionMode = computed(() => appStore.projectionMode)

// 初始化IPC监听
onMounted(() => {
  appStore.initializeListeners()
})

onUnmounted(() => {
  appStore.cleanupListeners()
})
</script>
