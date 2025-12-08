const {
  MavLinkPacketSplitter,
  MavLinkPacketParser,
  MavLinkProtocolV1,
  common,
  ardupilotmega,
  minimal,
  send,
} = require('node-mavlink');
const EventEmitter = require('events');
const { Readable } = require('stream');

/**
 * MAVLink连接管理器
 * 负责MAVLink协议的解析和数据处理
 */
class MAVLinkConnection extends EventEmitter {
  constructor(serialManager) {
    super();
    this.serialManager = serialManager;
    
    // 创建msgId到消息类的映射（合并 minimal + common + ardupilotmega）
    this.messageRegistry = {};
    const registries = [minimal, common, ardupilotmega];
    registries.forEach((registry) => {
      for (const key in registry) {
        const msgClass = registry[key];
        if (msgClass && msgClass.MSG_ID !== undefined) {
          this.messageRegistry[msgClass.MSG_ID] = msgClass;
        }
      }
    });
    // 确保 Heartbeat 一定存在（避免解析失败导致不拉流）
    if (!this.messageRegistry[0]) {
      this.messageRegistry[0] =
        minimal.Heartbeat || common.Heartbeat || ardupilotmega.Heartbeat;
    }
    console.log('[MAVLink] Registry built with', Object.keys(this.messageRegistry).length, 'message types');
    console.log('[MAVLink] Sample IDs:', Object.keys(this.messageRegistry).slice(0, 20));
    console.log('[MAVLink] Has Attitude (ID:30)?', !!this.messageRegistry[30], this.messageRegistry[30]?.name);
    console.log('[MAVLink] Has ScaledImu (ID:26)?', !!this.messageRegistry[26], this.messageRegistry[26]?.name);
    
    // 创建stream管道
    this.splitter = new MavLinkPacketSplitter();
    this.parser = new MavLinkPacketParser();
    
    // 连接管道: splitter -> parser
    this.splitter.pipe(this.parser);
    
    // 发射端映射（优先使用静态映射，避免两个系统ID抢占同一UI位置）
    this.staticEmitterMap = { 1: 1, 2: 2 }; // 可根据需要调整/扩展
    this.emitterMap = new Map(); // sysid -> emitterId
    this.nextEmitterId = 1;
    
    // 每个发射端的数据缓存
    this.dataCache = {
      1: this.createEmptyData(),
      2: this.createEmptyData(),
    };
    
    this.setupParser();
  }

  /**
   * 创建空数据对象
   */
  createEmptyData() {
    return {
      time: 0,
      lat: 0.0,
      lon: 0.0,
      alt: 0.0,
      satellites: 0,
      hdop: 0.0,
      accel_x: 0.0,
      accel_y: 0.0,
      accel_z: 0.0,
      gyro_x: 0.0,
      gyro_y: 0.0,
      gyro_z: 0.0,
      mag_x: 0.0,
      mag_y: 0.0,
      mag_z: 0.0,
      pressure: 0.0,
      temperature: 0.0,
      roll: 0.0,
      pitch: 0.0,
      yaw: 0.0,
    };
  }

  /**
   * 设置解析器
   */
  setupParser() {
    // 监听串口数据
    this.serialManager.on('data', (buffer) => {
      this.parse(buffer);
    });

    // 监听解析后的MAVLink包
    this.parser.on('data', (packet) => {
      const msgId = packet.header?.msgid;
      const sysId = packet.header?.sysid;
      
      // 只在需要时输出详细packet信息
      const debugPacket = false;  // 设为true以查看详细packet信息
      if (debugPacket) {
        console.log(`[MAVLink] Packet received: ${msgId || 'unknown'}`);
        console.log(`[MAVLink] Packet keys:`, Object.keys(packet));
        console.log(`[MAVLink] Has payload:`, !!packet.payload);
        console.log(`[MAVLink] Registry has msgId:`, !!this.messageRegistry[msgId]);
      }
      
      // 手动解析message - 使用common消息注册表
      try {
        const msgClass = this.messageRegistry[msgId];
        if (msgClass) {
          if (debugPacket) {
            console.log('[MAVLink] Creating message from class:', msgClass.name);
          }
          // 使用协议自带的data反序列化，确保字段正确解析
          packet.message = packet.protocol.data(packet.payload, msgClass);
          if (debugPacket) {
            console.log('[MAVLink] Message created, keys:', Object.keys(packet.message));
          }
        } else {
          if (debugPacket) {
            console.log(`[MAVLink] No message class for ID: ${msgId}`);
          }
          console.log('[MAVLink] No message class for ID:', msgId);
          // msgId=0 是 Heartbeat，若未能映射，尝试兜底解析以便触发拉流
          if (msgId === 0 && this.messageRegistry[0]) {
            try {
              packet.message = packet.protocol.data(packet.payload, this.messageRegistry[0]);
              console.warn('[MAVLink] Fallback parsed Heartbeat for msgId=0');
            } catch (e) {
              console.warn(
                '[MAVLink] msgId=0 fallback failed, packet head:',
                packet.buffer ? packet.buffer.slice(0, 12).toString('hex') : 'no buffer'
              );
            }
          }
        }
      } catch (error) {
        console.error('[MAVLink] Message parsing error:', error);
      }
      
      this.handlePacket(packet);
    });

    this.parser.on('error', (error) => {
      console.error('[MAVLink] Parser error:', error);
      this.emit('parse-error', error);
    });
    
    this.splitter.on('error', (error) => {
      console.error('[MAVLink] Splitter error:', error);
      this.emit('parse-error', error);
    });
  }

  /**
   * 解析数据
   */
  parse(data) {
    try {
      // 确保数据是Buffer类型
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      // 将数据写入splitter (stream管道的起点)
      this.splitter.write(buffer);
    } catch (error) {
      console.error('[MAVLink] Parse error:', error);
      this.emit('parse-error', error);
    }
  }

  /**
   * 处理MAVLink数据包
   */
  handlePacket(packet) {
    try {
      this.handleMessage(packet);
    } catch (error) {
      console.error('[MAVLink] Packet handling error:', error);
    }
  }

  /**
   * 处理MAVLink消息
   */
  handleMessage(packet) {
    // packet本身就包含解析后的message
    const message = packet.message || packet;
    const msgId = packet.header?.msgid;
    const sysId = packet.header?.sysid || 1;
    
    // 调试：查看message内容
    if (msgId === 0 || msgId === 24) { // HEARTBEAT或GPS
      console.log('[MAVLink] Packet structure:', {
        hasMessage: !!packet.message,
        messageKeys: packet.message ? Object.keys(packet.message) : [],
        msgId,
        sysId
      });
    }
    
    // 获取消息类型名称 - 使用类名
    let msgType = 'UNKNOWN';
    if (message && message.constructor && message.constructor.name !== 'Object') {
      msgType = message.constructor.name; // 例如：GpsRawInt, Heartbeat, RawImu
    } else if (message && message._name) {
      msgType = message._name;
    } else if (msgId !== undefined) {
      msgType = `MSG_${msgId}`;
    }
    
    // 记录消息类型，特别关注msgId=0 (Heartbeat)
    if (msgId === 0 || msgId === 30) {
      console.log(`[MAVLink] *** msgId=${msgId}, msgType=${msgType}, SysID=${sysId} ***`);
      console.log(`[MAVLink] Message class name:`, message?.constructor?.name);
      console.log(`[MAVLink] Message keys:`, message ? Object.keys(message).slice(0, 5) : 'no message');
    }
    
    // 调试：统计所有消息类型
    if (!this.messageStats) {
      this.messageStats = {};
    }
    this.messageStats[msgType] = (this.messageStats[msgType] || 0) + 1;
    
    // 每100条消息打印一次统计
    const totalMessages = Object.values(this.messageStats).reduce((a, b) => a + b, 0);
    if (totalMessages % 100 === 0) {
      console.log('[MAVLink] Message Statistics:', this.messageStats);
    }
    
    // 获取或分配发射端ID
    const emitterId = this.resolveEmitter(sysId);
    if (!emitterId) {
      console.log(`[MAVLink] Ignoring message from SysID ${sysId} - max emitters reached`);
      return; // 超过2个发射端，忽略
    }

    const data = this.dataCache[emitterId];
    data.time = Date.now();

    // 根据消息类型更新数据  
    // 注意：message可能是packet.message，需要安全访问
    const msg = message || {};
    
    switch (msgType) {
      case 'Heartbeat':
        console.log('[MAVLink] HEARTBEAT detected!');
        
        // 首次收到HEARTBEAT时，请求数据流
        if (!this.dataStreamRequested) {
          this.dataStreamRequested = new Set();
        }
        if (!this.dataStreamRequested.has(sysId)) {
          console.log(`[MAVLink] First HEARTBEAT from SysID ${sysId}, requesting data stream...`);
          this.requestDataStream(sysId, 6, 10); // MAV_DATA_STREAM_ALL, 10Hz
          this.dataStreamRequested.add(sysId);
        }
        
        this.emit('heartbeat', {
          systemId: sysId,
          emitterId: emitterId,
          type: msg.type,
          autopilot: msg.autopilot,
        });
        break;

      case 'GpsRawInt':
        console.log('[MAVLink] GpsRawInt RAW VALUES:', {
          lat: msg.lat,
          lon: msg.lon,
          alt: msg.alt,
          satellitesVisible: msg.satellitesVisible,
          eph: msg.eph
        });
        if (msg.lat !== undefined && msg.lon !== undefined) {
          data.lat = msg.lat / 1e7;
          data.lon = msg.lon / 1e7;
          data.alt = (msg.alt || 0) / 1000.0;
          data.satellites = msg.satellitesVisible || 0;
          data.hdop = (msg.eph || 0) / 100.0;
          console.log(`[MAVLink] GPS: ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}, Alt: ${data.alt.toFixed(1)}m, Sats: ${data.satellites}`);
        }
        break;

      case 'Attitude':
        console.log('[MAVLink] Attitude RAW VALUES:', {
          roll: msg.roll,
          pitch: msg.pitch,
          yaw: msg.yaw,
          rollspeed: msg.rollspeed,
          pitchspeed: msg.pitchspeed,
          yawspeed: msg.yawspeed
        });
        // 打印原始payload字节
        if (packet.payload) {
          console.log('[MAVLink] Attitude payload (hex):', packet.payload.toString('hex'));
        }
        if (msg.roll !== undefined) {
          data.roll = this.radToDeg(msg.roll);
          data.pitch = this.radToDeg(msg.pitch);
          data.yaw = this.radToDeg(msg.yaw);
          console.log(`[MAVLink] Attitude: Roll=${data.roll.toFixed(1)}°, Pitch=${data.pitch.toFixed(1)}°, Yaw=${data.yaw.toFixed(1)}°`);
        }
        break;

      case 'RawImu':
        console.log('[MAVLink] RawImu RAW VALUES:', {
          xacc: msg.xacc,
          yacc: msg.yacc,
          zacc: msg.zacc,
          xgyro: msg.xgyro,
          ygyro: msg.ygyro,
          zgyro: msg.zgyro,
          xmag: msg.xmag,
          ymag: msg.ymag,
          zmag: msg.zmag
        });
        if (msg.xacc !== undefined) {
          data.accel_x = msg.xacc / 1000.0;
          data.accel_y = msg.yacc / 1000.0;
          data.accel_z = msg.zacc / 1000.0;
          data.gyro_x = msg.xgyro / 1000.0;
          data.gyro_y = msg.ygyro / 1000.0;
          data.gyro_z = msg.zgyro / 1000.0;
          data.mag_x = msg.xmag || 0;
          data.mag_y = msg.ymag || 0;
          data.mag_z = msg.zmag || 0;
          console.log(`[MAVLink] IMU: Accel=(${data.accel_x.toFixed(2)}, ${data.accel_y.toFixed(2)}, ${data.accel_z.toFixed(2)}) m/s²`);
        }
        break;

      case 'ScaledImu':
      case 'ScaledImu2':
      case 'ScaledImu3':
        console.log(`[MAVLink] ${msgType} RAW VALUES:`, {
          xacc: msg.xacc,
          yacc: msg.yacc,
          zacc: msg.zacc,
          xgyro: msg.xgyro,
          ygyro: msg.ygyro,
          zgyro: msg.zgyro
        });
        if (msg.xacc !== undefined) {
          // ScaledImu已经是标准单位（m/s² 和 rad/s），不需要除以1000
          data.accel_x = msg.xacc / 1000.0;  // milli-g to m/s²
          data.accel_y = msg.yacc / 1000.0;
          data.accel_z = msg.zacc / 1000.0;
          data.gyro_x = msg.xgyro / 1000.0;  // milli-rad/s to rad/s
          data.gyro_y = msg.ygyro / 1000.0;
          data.gyro_z = msg.zgyro / 1000.0;
          data.mag_x = msg.xmag || 0;
          data.mag_y = msg.ymag || 0;
          data.mag_z = msg.zmag || 0;
          console.log(`[MAVLink] ${msgType}: Accel=(${data.accel_x.toFixed(2)}, ${data.accel_y.toFixed(2)}, ${data.accel_z.toFixed(2)}) m/s²`);
        }
        break;

      case 'ScaledPressure':
        console.log('[MAVLink] ScaledPressure RAW VALUES:', {
          pressAbs: msg.pressAbs,
          temperature: msg.temperature
        });
        if (msg.pressAbs !== undefined) {
          data.pressure = msg.pressAbs || 0;
          data.temperature = (msg.temperature || 0) / 100.0;
          console.log(`[MAVLink] Pressure: ${data.pressure.toFixed(1)} hPa, Temp: ${data.temperature.toFixed(1)}°C`);
        }
        break;
    }

    // 发送数据到渲染进程
    const dataToSend = {
      emitterId: emitterId,
      systemId: sysId,
      messageType: msgType,
      ...data,
    };
    
    // 调试：定期打印发送的数据
    if (msgType === 'GpsRawInt' || msgType === 'Heartbeat') {
      console.log('[MAVLink] Sending to UI:', {
        msgType,
        emitterId,
        lat: dataToSend.lat,
        lon: dataToSend.lon,
        satellites: dataToSend.satellites
      });
    }
    
    this.emit('data', dataToSend);
  }

  /**
   * 获取消息的系统ID
   */
  getSystemId(packet) {
    try {
      if (packet && packet.header) {
        const sysId = packet.header.sysid || packet.header.srcSystem;
        if (sysId !== undefined) {
          return sysId;
        }
      }
      const message = packet.message || packet;
      if (message.header && message.header.sysid) {
        return message.header.sysid;
      }
      if (message.sysid !== undefined) {
        return message.sysid;
      }
      return 1; // 默认系统ID
    } catch (error) {
      console.error('[MAVLink] getSystemId error:', error);
      return 1;
    }
  }

  /**
   * 解析发射端ID（自动绑定，最多2个）
   */
  resolveEmitter(sysId) {
    // 静态绑定优先
    if (this.staticEmitterMap[sysId]) {
      return this.staticEmitterMap[sysId];
    }

    if (this.emitterMap.has(sysId)) {
      return this.emitterMap.get(sysId);
    }
    if (this.nextEmitterId <= 2) {
      const emitterId = this.nextEmitterId++;
      this.emitterMap.set(sysId, emitterId);
      console.log(`[MAVLink] System ID ${sysId} mapped to Emitter ${emitterId}`);
      console.log('[MAVLink] Current mapping:', Array.from(this.emitterMap.entries()));
      return emitterId;
    }
    console.warn(`[MAVLink] Too many emitters! SysID ${sysId} rejected`);
    return null;
  }

  /**
   * 弧度转角度
   */
  radToDeg(rad) {
    return rad * (180 / Math.PI);
  }

  /**
   * Request data stream
   */
  requestDataStream(targetSystem = 1, streamId = 6, rate = 10) {
    // MAV_DATA_STREAM_ALL = 6
    try {
      if (!this.serialManager || !this.serialManager.port || !this.serialManager.port.isOpen) {
        console.warn('[MAVLink] Serial port not open, cannot send REQUEST_DATA_STREAM');
        return;
      }

      console.log(`[MAVLink] Requesting data stream ${streamId} at ${rate}Hz for system ${targetSystem}`);

      const message = new common.RequestDataStream();
      message.targetSystem = targetSystem;
      message.targetComponent = 0; // 0 = all components
      message.reqStreamId = streamId; // 6 = MAV_DATA_STREAM_ALL
      message.reqMessageRate = rate; // Hz
      message.startStop = 1; // 1 = start, 0 = stop

      // use node-mavlink serializer to ensure CRC is correct
      const protocol = this.sendProtocol || new MavLinkProtocolV1(255, 0);
      this.sendProtocol = protocol;

      send(this.serialManager.port, message, protocol)
        .then(() => {
          console.log(`[MAVLink] REQUEST_DATA_STREAM sent (sys:${targetSystem}, stream:${streamId}, rate:${rate}Hz)`);
        })
        .catch((err) => {
          console.error('[MAVLink] Failed to send REQUEST_DATA_STREAM:', err);
        });
    } catch (error) {
      console.error('[MAVLink] Failed to request data stream:', error);
    }
  }
}


module.exports = MAVLinkConnection;
