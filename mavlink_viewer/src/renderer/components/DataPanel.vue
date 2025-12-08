<template>
  <div class="p-4 space-y-4">
    <h2 class="text-xl font-bold text-gray-800">数据面板</h2>

    <!-- 发射端1数据 -->
    <div class="border border-emitter1 rounded-lg overflow-hidden">
      <div class="bg-emitter1 text-white px-4 py-2 font-bold">
        发射端 1
      </div>
      <EmitterDataView :data="appStore.emitterData[1]" :color="appStore.emitterColors[1]" />
    </div>

    <!-- 发射端2数据 -->
    <div class="border border-emitter2 rounded-lg overflow-hidden">
      <div class="bg-emitter2 text-white px-4 py-2 font-bold">
        发射端 2
      </div>
      <EmitterDataView :data="appStore.emitterData[2]" :color="appStore.emitterColors[2]" />
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/app'
import EmitterDataView from './EmitterDataView.vue'

const appStore = useAppStore()
</script>
