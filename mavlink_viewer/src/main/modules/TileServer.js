const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

/**
 * 离线瓦片服务器
 * 使用Express提供本地瓦片文件服务
 */
class TileServer {
  constructor(tileDir) {
    this.tileDir = tileDir;
    this.app = express();
    this.server = null;
    this.port = null;
  }

  /**
   * 启动服务器
   * @returns {Promise<Object>} 包含端口和URL的对象
   */
  async start() {
    return new Promise((resolve, reject) => {
      // 检查瓦片目录是否存在
      if (!fs.existsSync(this.tileDir)) {
        reject(new Error(`Tile directory not found: ${this.tileDir}`));
        return;
      }

      // 启用CORS
      this.app.use(cors());

      // 静态文件服务
      this.app.use(express.static(this.tileDir));

      // 404处理 - 返回透明瓦片
      this.app.use((req, res) => {
        // 创建1x1透明PNG
        const transparentTile = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
          'base64'
        );
        res.type('png').send(transparentTile);
      });

      // 随机端口（8008-8999）
      this.port = Math.floor(Math.random() * (8999 - 8008 + 1)) + 8008;

      this.server = this.app.listen(this.port, '127.0.0.1', (err) => {
        if (err) {
          reject(err);
        } else {
          const url = `http://127.0.0.1:${this.port}/{z}/{x}/{y}.png`;
          console.log(`Tile server started: ${url}`);
          resolve({
            port: this.port,
            url: url,
          });
        }
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用，重试
          this.port = Math.floor(Math.random() * (8999 - 8008 + 1)) + 8008;
          this.server = this.app.listen(this.port, '127.0.0.1', (retryErr) => {
            if (retryErr) {
              reject(retryErr);
            } else {
              const url = `http://127.0.0.1:${this.port}/{z}/{x}/{y}.png`;
              console.log(`Tile server started: ${url}`);
              resolve({
                port: this.port,
                url: url,
              });
            }
          });
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * 停止服务器
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Tile server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = TileServer;
