<template>
  <div class="bg-gray-100 border-t border-gray-300 px-4 py-2 flex items-center justify-between text-sm">
    <div class="flex items-center gap-4">
      <!-- 连接状态 -->
      <div class="flex items-center gap-2">
        <span 
          :class="[
            'inline-block w-2 h-2 rounded-full',
            appStore.connected ? 'bg-green-500 animate-pulse-slow' : 'bg-gray-400'
          ]"
        ></span>
        <span class="text-gray-700">
          {{ appStore.connected ? '已连接' : '未连接' }}
        </span>
      </div>

      <!-- 记录状态 -->
      <div v-if="appStore.recording" class="flex items-center gap-2 text-red-600">
        <span class="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        <span class="font-medium">正在记录</span>
      </div>
    </div>

    <!-- 状态消息 -->
    <div class="flex-1 mx-4">
      <p class="text-gray-600 truncate">{{ appStore.statusMessage }}</p>
    </div>

    <!-- 错误消息 -->
    <div v-if="appStore.errorMessage" class="text-red-600 font-medium">
      ⚠️ {{ appStore.errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
</script>
