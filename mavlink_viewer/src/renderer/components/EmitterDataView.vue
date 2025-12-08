<template>
  <div class="p-4 space-y-4 bg-white">
    <!-- GPS数据 -->
    <div>
      <h3 class="text-sm font-bold text-gray-700 mb-2">GPS数据</h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <DataField label="纬度" :value="data.lat.toFixed(6)" />
        <DataField label="经度" :value="data.lon.toFixed(6)" />
        <DataField label="高度" :value="`${data.alt.toFixed(1)} m`" />
        <DataField label="卫星数" :value="data.satellites" />
        <DataField label="HDOP" :value="data.hdop.toFixed(1)" />
      </div>
    </div>

    <!-- 姿态数据 -->
    <div>
      <h3 class="text-sm font-bold text-gray-700 mb-2">姿态数据</h3>
      <div class="grid grid-cols-3 gap-2 text-sm">
        <DataField label="横滚" :value="`${data.roll.toFixed(1)}°`" />
        <DataField label="俯仰" :value="`${data.pitch.toFixed(1)}°`" />
        <DataField label="偏航" :value="`${data.yaw.toFixed(1)}°`" />
      </div>
    </div>

    <!-- IMU数据 -->
    <div>
      <h3 class="text-sm font-bold text-gray-700 mb-2">IMU数据</h3>
      <div class="space-y-1 text-sm">
        <DataField 
          label="加速度" 
          :value="`X:${data.accel_x.toFixed(2)} Y:${data.accel_y.toFixed(2)} Z:${data.accel_z.toFixed(2)} m/s²`" 
        />
        <DataField 
          label="陀螺仪" 
          :value="`X:${data.gyro_x.toFixed(3)} Y:${data.gyro_y.toFixed(3)} Z:${data.gyro_z.toFixed(3)} rad/s`" 
        />
        <DataField 
          label="磁力计" 
          :value="`X:${data.mag_x.toFixed(0)} Y:${data.mag_y.toFixed(0)} Z:${data.mag_z.toFixed(0)}`" 
        />
      </div>
    </div>

    <!-- 环境数据 -->
    <div>
      <h3 class="text-sm font-bold text-gray-700 mb-2">环境数据</h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <DataField label="气压" :value="`${data.pressure.toFixed(1)} hPa`" />
        <DataField label="温度" :value="`${data.temperature.toFixed(1)} °C`" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  data: {
    type: Object,
    required: true,
  },
  color: {
    type: String,
    default: '#000',
  },
})
</script>

<script>
// 数据字段组件
import { defineComponent, h } from 'vue'

const DataField = defineComponent({
  props: {
    label: String,
    value: [String, Number],
  },
  render() {
    return h('div', { class: 'flex justify-between items-center' }, [
      h('span', { class: 'text-gray-600' }, this.label + ':'),
      h('span', { class: 'font-medium text-gray-900' }, this.value),
    ])
  },
})

export default {
  components: {
    DataField,
  },
}
</script>
