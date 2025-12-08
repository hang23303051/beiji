const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

/**
 * 数据记录器
 * 将MAVLink数据记录到CSV文件
 */
class DataLogger {
  constructor(emitterId, outputDir = '.') {
    this.emitterId = emitterId;
    this.outputDir = outputDir;
    this.csvWriter = null;
    this.filename = null;
    this.isLogging = false;
  }

  /**
   * 开始记录
   * @returns {Promise<string>} CSV文件路径
   */
  async start() {
    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.filename = path.join(
      this.outputDir,
      `mavlink_data_emitter${this.emitterId}_${timestamp}.csv`
    );

    // 创建CSV写入器
    this.csvWriter = createObjectCsvWriter({
      path: this.filename,
      header: [
        { id: 'timestamp', title: 'timestamp' },
        { id: 'lat', title: 'lat' },
        { id: 'lon', title: 'lon' },
        { id: 'alt', title: 'alt' },
        { id: 'satellites', title: 'satellites' },
        { id: 'hdop', title: 'hdop' },
        { id: 'roll', title: 'roll' },
        { id: 'pitch', title: 'pitch' },
        { id: 'yaw', title: 'yaw' },
        { id: 'accel_x', title: 'accel_x' },
        { id: 'accel_y', title: 'accel_y' },
        { id: 'accel_z', title: 'accel_z' },
        { id: 'gyro_x', title: 'gyro_x' },
        { id: 'gyro_y', title: 'gyro_y' },
        { id: 'gyro_z', title: 'gyro_z' },
        { id: 'mag_x', title: 'mag_x' },
        { id: 'mag_y', title: 'mag_y' },
        { id: 'mag_z', title: 'mag_z' },
        { id: 'pressure', title: 'pressure' },
        { id: 'temperature', title: 'temperature' },
      ],
    });

    this.isLogging = true;
    console.log(`Data logger started: ${this.filename}`);
    return this.filename;
  }

  /**
   * 记录数据
   * @param {Object} data - MAVLink数据对象
   */
  async log(data) {
    if (!this.isLogging || !this.csvWriter) {
      return;
    }

    try {
      const record = {
        timestamp: new Date(data.time).toISOString(),
        lat: data.lat || 0,
        lon: data.lon || 0,
        alt: data.alt || 0,
        satellites: data.satellites || 0,
        hdop: data.hdop || 0,
        roll: data.roll || 0,
        pitch: data.pitch || 0,
        yaw: data.yaw || 0,
        accel_x: data.accel_x || 0,
        accel_y: data.accel_y || 0,
        accel_z: data.accel_z || 0,
        gyro_x: data.gyro_x || 0,
        gyro_y: data.gyro_y || 0,
        gyro_z: data.gyro_z || 0,
        mag_x: data.mag_x || 0,
        mag_y: data.mag_y || 0,
        mag_z: data.mag_z || 0,
        pressure: data.pressure || 0,
        temperature: data.temperature || 0,
      };

      await this.csvWriter.writeRecords([record]);
    } catch (error) {
      console.error('Failed to log data:', error);
    }
  }

  /**
   * 停止记录
   * @returns {Promise<void>}
   */
  async stop() {
    this.isLogging = false;
    this.csvWriter = null;
    console.log(`Data logger stopped: ${this.filename}`);
  }
}

module.exports = DataLogger;
