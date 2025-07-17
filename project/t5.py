import time
import csv
import serial.tools.list_ports
from pymavlink import mavutil

# 自动识别数传模块串口
def find_telemetry_port():
    keywords = ["SiK", "Telemetry", "USB Serial", "3DR", "Radio", "CP210x", "FTDI"]
    ports = list(serial.tools.list_ports.comports())
    matched_ports = []

    for port in ports:
        for keyword in keywords:
            if keyword.lower() in port.description.lower():
                matched_ports.append((port.device, port.description))
                break

    if not matched_ports:
        print("⚠️ 未检测到数传模块串口，请手动确认是否已插入")
        for port in ports:
            print(f" - {port.device} : {port.description}")
        return None

    if len(matched_ports) == 1:
        dev, desc = matched_ports[0]
        print(f"✅ 已识别数传串口：{dev} - {desc}")
        return dev

    print("⚠️ 检测到多个可能的数传串口，请选择：")
    for i, (dev, desc) in enumerate(matched_ports):
        print(f" [{i}] {dev} : {desc}")
    try:
        idx = int(input("请输入要使用的串口编号："))
        return matched_ports[idx][0]
    except:
        print("❌ 输入无效")
        return None

# 主程序
def main():
    port = find_telemetry_port()
    baud = 57600  # 默认 SiK / XBee Telemetry 波特率
    if not port:
        print("🚫 未找到有效数传串口，程序退出")
        return

    try:
        print(f"🔌 尝试连接 {port}，波特率 {baud}")
        master = mavutil.mavlink_connection(port, baud=baud)
        print("等待 HEARTBEAT...")
        master.wait_heartbeat(timeout=10)
        print(f"✅ 已连接飞控，系统 ID: {master.target_system}")
    except Exception as e:
        print(f"❌ 无法通过数传连接飞控：{e}")
        return

    fieldnames = [
        'Time', 'Latitude', 'Longitude', 'Altitude',
        'Satellites', 'HDOP',
        'AccelX', 'AccelY', 'AccelZ',
        'GyroX', 'GyroY', 'GyroZ',
        'MagX', 'MagY', 'MagZ',
        'Pressure', 'Temperature',
        'Roll', 'Pitch', 'Yaw'
    ]
    data = {key: '' for key in fieldnames}

    with open("telemetry_log.csv", "w", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        print("📡 正在通过数传记录数据（按 Ctrl+C 停止）")

        try:
            while True:
                msg = master.recv_match(blocking=True)
                if not msg:
                    continue

                msg_type = msg.get_type()
                data['Time'] = time.time()

                if msg_type == 'GPS_RAW_INT':
                    data['Latitude'] = msg.lat / 1e7
                    data['Longitude'] = msg.lon / 1e7
                    data['Altitude'] = msg.alt / 1000.0
                    data['Satellites'] = msg.satellites_visible
                    data['HDOP'] = msg.eph / 100.0

                elif msg_type == 'ATTITUDE':
                    data['Roll'] = msg.roll
                    data['Pitch'] = msg.pitch
                    data['Yaw'] = msg.yaw

                elif msg_type == 'RAW_IMU':
                    data['AccelX'] = msg.xacc
                    data['AccelY'] = msg.yacc
                    data['AccelZ'] = msg.zacc
                    data['GyroX'] = msg.xgyro
                    data['GyroY'] = msg.ygyro
                    data['GyroZ'] = msg.zgyro
                    data['MagX'] = msg.xmag
                    data['MagY'] = msg.ymag
                    data['MagZ'] = msg.zmag

                elif msg_type == 'SCALED_PRESSURE':
                    data['Pressure'] = msg.press_abs
                    data['Temperature'] = msg.temperature / 100.0

                writer.writerow(data)
                print(f"📝 Lat={data['Latitude']}, Alt={data['Altitude']}, Roll={data['Roll']}")

        except KeyboardInterrupt:
            print("\n✅ 手动停止")
        except Exception as e:
            print(f"⚠️ 错误：{e}")

if __name__ == "__main__":
    main()
