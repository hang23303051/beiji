<template>
  <div class="bg-white border-b border-gray-300 px-4 py-3">
    <div class="flex items-center gap-4 flex-wrap">
      <!-- 串口设置 -->
      <div class="flex items-center gap-2 border-r border-gray-300 pr-4">
        <label class="text-sm font-medium">串口:</label>
        <select 
          v-model="appStore.selectedPort"
          :disabled="appStore.connected"
          class="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          @focus="appStore.loadSerialPorts"
        >
          <option :value="null">选择串口</option>
          <option 
            v-for="port in appStore.serialPorts" 
            :key="port.path" 
            :value="port.path"
            :class="{ 'font-bold': port.isRecommended }"
          >
            {{ port.description }} {{ port.isRecommended ? '(推荐)' : '' }}
          </option>
        </select>

        <label class="text-sm font-medium ml-2">波特率:</label>
        <select 
          v-model.number="appStore.baudRate"
          :disabled="appStore.connected"
          class="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option :value="9600">9600</option>
          <option :value="19200">19200</option>
          <option :value="38400">38400</option>
          <option :value="57600">57600</option>
          <option :value="115200">115200</option>
        </select>

        <button
          @click="refreshPorts"
          :disabled="appStore.connected"
          class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
          title="刷新串口列表"
        >
          刷新
        </button>
      </div>

      <!-- 连接按钮 -->
      <button
        @click="toggleConnection"
        :class="[
          'px-4 py-1.5 rounded text-sm font-medium',
          appStore.connected 
            ? 'bg-red-500 text-white hover:bg-red-600' 
            : 'bg-green-500 text-white hover:bg-green-600'
        ]"
      >
        {{ appStore.connected ? '断开' : '连接' }}
      </button>

      <!-- 离线瓦片 -->
      <div class="flex items-center gap-2 border-l border-gray-300 pl-4">
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            :checked="appStore.offlineTiles"
            @change="toggleOfflineTiles"
            class="w-4 h-4"
          />
          <span>离线瓦片</span>
        </label>
      </div>

      <!-- 投影模式 -->
      <div class="flex items-center gap-2 border-l border-gray-300 pl-4">
        <label class="text-sm font-medium">投影模式:</label>
        <select 
          v-model="appStore.projectionMode"
          class="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="normal">常规投影</option>
          <option value="north_polar">北极极地投影</option>
          <option value="south_polar">南极极地投影</option>
        </select>
      </div>

      <!-- 数据计数 -->
      <div class="border-l border-gray-300 pl-4">
        <span class="text-sm text-gray-600">
          数据: <span class="font-medium">{{ appStore.dataCount.total }}</span>
          (1:<span class="text-emitter1 font-medium">{{ appStore.dataCount.emitter1 }}</span>,
          2:<span class="text-emitter2 font-medium">{{ appStore.dataCount.emitter2 }}</span>)
        </span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <!-- 记录按钮 -->
        <button
          @click="toggleRecording"
          :disabled="!appStore.connected"
          :class="[
            'px-4 py-1.5 rounded text-sm font-medium',
            appStore.recording 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-blue-500 text-white hover:bg-blue-600',
            !appStore.connected && 'opacity-50 cursor-not-allowed'
          ]"
        >
          {{ appStore.recording ? '停止记录' : '开始记录' }}
        </button>

        <!-- 清除轨迹 -->
        <button
          @click="clearTrajectories"
          class="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          清除轨迹
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

async function refreshPorts() {
  await appStore.loadSerialPorts()
}

async function toggleConnection() {
  if (appStore.connected) {
    await appStore.disconnectSerial()
  } else {
    await appStore.connectSerial()
  }
}

async function toggleOfflineTiles(event) {
  await appStore.toggleOfflineTiles(event.target.checked)
}

async function toggleRecording() {
  if (appStore.recording) {
    await appStore.stopRecording()
  } else {
    await appStore.startRecording()
  }
}

function clearTrajectories() {
  if (confirm('确定要清除轨迹吗？')) {
    appStore.clearTrajectories()
  }
}
</script>
