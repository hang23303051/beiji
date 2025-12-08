const { SerialPort } = require('serialport');
const EventEmitter = require('events');

/**
 * 串口管理器
 * 负责串口的枚举、连接、断开和数据接收
 */
class SerialManager extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this.isOpen = false;
  }

  /**
   * 列出所有可用串口
   * @returns {Promise<Array>} 串口列表
   */
  async listPorts() {
    try {
      const ports = await SerialPort.list();
      const keywords = ['SiK', 'Telemetry', 'USB Serial', '3DR', 'Radio', 'CP210x', 'FTDI', 'CH340'];
      
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        serialNumber: port.serialNumber || '',
        description: `${port.path} - ${port.manufacturer || 'Unknown'}`,
        // 判断是否为推荐串口
        isRecommended: keywords.some(kw => 
          (port.manufacturer || '').toLowerCase().includes(kw.toLowerCase()) ||
          (port.serialNumber || '').toLowerCase().includes(kw.toLowerCase()) ||
          (port.path || '').toLowerCase().includes('usb')
        )
      }));
    } catch (error) {
      console.error('Failed to list ports:', error);
      throw error;
    }
  }

  /**
   * 连接串口
   * @param {string} portPath - 串口路径
   * @param {number} baudRate - 波特率
   * @returns {Promise<void>}
   */
  async connect(portPath, baudRate = 57600) {
    if (this.isOpen) {
      throw new Error('Port already open');
    }

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false,
      });

      this.port.open((err) => {
        if (err) {
          this.emit('error', err);
          reject(err);
          return;
        }

        this.isOpen = true;
        this.emit('connected', { port: portPath, baudRate });
        console.log(`Serial port opened: ${portPath} @ ${baudRate}`);
        resolve();
      });

      this.port.on('error', (err) => {
        console.error('Serial port error:', err);
        this.emit('error', err);
      });

      this.port.on('data', (data) => {
        this.emit('data', data);
      });

      this.port.on('close', () => {
        this.isOpen = false;
        this.emit('disconnected');
        console.log('Serial port closed');
      });
    });
  }

  /**
   * 断开串口连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.port || !this.isOpen) {
      return;
    }

    return new Promise((resolve) => {
      this.port.close((err) => {
        if (err) {
          console.error('Error closing port:', err);
        }
        this.port = null;
        this.isOpen = false;
        resolve();
      });
    });
  }

  /**
   * 写入数据到串口
   * @param {Buffer} data - 要写入的数据
   * @returns {Promise<void>}
   */
  async write(data) {
    if (!this.port || !this.isOpen) {
      throw new Error('Port not open');
    }

    return new Promise((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = SerialManager;
