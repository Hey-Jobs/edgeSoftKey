/**
 * EdgeKey 软件激活 SDK for Node.js
 *
 * 功能：
 * 1. 硬件信息采集（CPU、内存、显卡、主板）
 * 2. 硬件信息加密（生成唯一硬件序列号）
 * 3. 卡密验证接口调用
 * 4. 软件启动时自动验证机制
 * 5. 硬件变更检测（任意硬件变更时触发卡密错误）
 *
 * 安装：
 *   npm install edgekey-auth
 *
 * 使用示例：
 *   const { EdgeKeyClient } = require('edgekey-auth');
 *
 *   const client = new EdgeKeyClient({
 *     apiUrl: 'https://your-domain.com',
 *     cacheDir: '~/.edgekey_cache'
 *   });
 *
 *   // 手动验证
 *   const result = await client.verify('YOUR_CARD_KEY');
 *   if (result.success) {
 *     console.log(`验证成功，到期时间: ${result.expireAt}`);
 *   } else {
 *     console.log(`验证失败: ${result.message}`);
 *   }
 *
 *   // 自动验证（推荐在软件启动时调用）
 *   const result = await client.autoVerify('YOUR_CARD_KEY');
 *   if (!result.success) {
 *     console.error('软件无法启动');
 *     process.exit(1);
 *   }
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// ==================== 硬件信息采集 ====================

function getCpuInfo() {
  try {
    return os.cpus()[0]?.model || 'unknown_cpu';
  } catch {
    return 'cpu_error';
  }
}

function getMemoryInfo() {
  try {
    return `${os.totalmem()} bytes`;
  } catch {
    return 'memory_error';
  }
}

function getGpuInfo() {
  try {
    if (process.platform === 'win32') {
      try {
        return execSync('wmic path win32_VideoController get name', { encoding: 'utf8' })
          .split('\n')
          .filter(l => l.trim() && l.trim().toLowerCase() !== 'name')
          .join('|') || 'gpu_unknown';
      } catch {
        return 'gpu_windows_error';
      }
    } else if (process.platform === 'darwin') {
      try {
        return execSync('system_profiler SPDisplaysDataType', { encoding: 'utf8', maxBuffer: 1024 * 1024 })
          .substring(0, 300);
      } catch {
        return 'gpu_macos_error';
      }
    } else {
      try {
        const output = execSync('lspci 2>/dev/null || echo ""', { encoding: 'utf8' });
        const gpuLines = output
          .split('\n')
          .filter(l => /vga|3d|display|nvidia|amd/i.test(l));
        return gpuLines.join('|') || 'no_gpu_detected';
      } catch {
        return 'gpu_linux_error';
      }
    }
  } catch {
    return 'gpu_error';
  }
}

function getMotherboardInfo() {
  try {
    if (process.platform === 'win32') {
      try {
        return execSync('wmic baseboard get manufacturer,product,version', { encoding: 'utf8' })
          .split('\n')
          .filter(l => l.trim() && l.trim().toLowerCase() !== 'manufacturer' && l.trim().toLowerCase() !== 'product' && l.trim().toLowerCase() !== 'version')
          .join('|') || 'mb_unknown';
      } catch {
        return 'mb_windows_error';
      }
    } else if (process.platform === 'darwin') {
      try {
        return execSync('system_profiler SPHardwareDataType', { encoding: 'utf8', maxBuffer: 1024 * 1024 })
          .substring(0, 300);
      } catch {
        return 'mb_macos_error';
      }
    } else {
      try {
        const vendor = fs.readFileSync('/sys/class/dmi/id/board_vendor', 'utf8').trim();
        const name = fs.readFileSync('/sys/class/dmi/id/board_name', 'utf8').trim();
        return `${vendor}:${name}`;
      } catch {
        return 'mb_linux_error';
      }
    }
  } catch {
    return 'motherboard_error';
  }
}

function getMacAddress() {
  try {
    const interfaces = os.networkInterfaces();
    const macs = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === 'IPv4') {
          macs.push(iface.mac);
        }
      }
    }
    return macs.join('|') || 'mac_unknown';
  } catch {
    return 'mac_error';
  }
}

// ==================== 硬件哈希计算 ====================

function computeHardwareHash(options = {}) {
  /**
   * 计算硬件信息的SHA256哈希值
   *
   * @param {Object} options
   * @param {string} [options.cpuInfo] - CPU信息
   * @param {string} [options.memoryInfo] - 内存信息
   * @param {string} [options.gpuInfo] - 显卡信息
   * @param {string} [options.motherboardInfo] - 主板信息
   * @param {string} [options.macAddress] - MAC地址
   * @returns {string} SHA256哈希字符串（64位十六进制）
   */
  const cpuInfo = options.cpuInfo || getCpuInfo();
  const memoryInfo = options.memoryInfo || getMemoryInfo();
  const gpuInfo = options.gpuInfo || getGpuInfo();
  const motherboardInfo = options.motherboardInfo || getMotherboardInfo();
  const macAddress = options.macAddress || getMacAddress();

  const hardwareStr = `${cpuInfo}|${memoryInfo}|${gpuInfo}|${motherboardInfo}|${macAddress}`;
  return crypto.createHash('sha256').update(hardwareStr, 'utf8').digest('hex');
}

function collectHardwareInfo() {
  /**
   * 采集所有硬件信息
   *
   * @returns {Object} 包含所有硬件信息的字典
   */
  return {
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    gpu: getGpuInfo(),
    motherboard: getMotherboardInfo(),
    mac: getMacAddress(),
  };
}

// ==================== HTTP 请求 ====================

function makeRequest(url, data, timeout = 10000) {
  /**
   * 发送HTTP POST请求
   *
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 响应数据
   */
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify(data);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout,
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: json });
        } catch {
          reject(new Error(`响应格式错误: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

// ==================== 数据模型 ====================

/**
 * 验证结果
 * @typedef {Object} VerifyResult
 * @property {boolean} success - 是否成功
 * @property {string} message - 消息
 * @property {string} [expireAt] - 到期时间（ISO 8601）
 * @property {string} [code] - 错误码
 */

/**
 * 解绑结果
 * @typedef {Object} UnbindResult
 * @property {boolean} success - 是否成功
 * @property {string} message - 消息
 * @property {number} [remainingDays] - 剩余天数
 * @property {string} [code] - 错误码
 */

// ==================== SDK 客户端 ====================

class EdgeKeyClient {
  /**
   * EdgeKey 卡密验证客户端
   *
   * @param {Object} options
   * @param {string} options.apiUrl - API基础URL，例如 "https://your-domain.com"
   * @param {string} [options.cacheDir] - 本地缓存目录
   * @param {number} [options.timeout] - 请求超时时间（毫秒），默认10000
   */
  constructor(options) {
    if (!options?.apiUrl) {
      throw new Error('apiUrl is required');
    }

    this.apiUrl = options.apiUrl.replace(/\/+$/, '');
    this.timeout = options.timeout || 10000;

    // 设置缓存目录
    const defaultCacheDir = path.join(os.homedir(), '.edgekey_cache');
    this.cacheDir = (options.cacheDir || defaultCacheDir)
      .replace(/^~/, os.homedir());
    this.cachePath = path.join(this.cacheDir, '.edgekey_cache.json');

    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 });
    }

    this._cachedHardwareHash = null;
    this._cachedHardwareInfo = null;
  }

  /**
   * 加载本地缓存
   * @returns {Object}
   */
  _loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const content = fs.readFileSync(this.cachePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (err) {
      // ignore
    }
    return {};
  }

  /**
   * 保存本地缓存
   * @param {Object} data
   */
  _saveCache(data) {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      // silent
    }
  }

  /**
   * 获取硬件哈希值
   * @returns {string}
   */
  _getHardwareHash() {
    const cache = this._loadCache();
    const cachedHash = cache.hardware_hash;

    if (cachedHash) {
      const currentHash = computeHardwareHash();
      if (cachedHash === currentHash) {
        this._cachedHardwareHash = cachedHash;
        this._cachedHardwareInfo = cache.hardware_info || null;
        return cachedHash;
      }
    }

    // 硬件信息变化或无缓存，重新采集
    const hardwareInfo = collectHardwareInfo();
    const hardwareHash = computeHardwareHash(hardwareInfo);

    const updateCache = {
      ...cache,
      hardware_hash: hardwareHash,
      hardware_info: hardwareInfo,
      updated_at: new Date().toISOString(),
    };
    this._saveCache(updateCache);

    this._cachedHardwareHash = hardwareHash;
    this._cachedHardwareInfo = hardwareInfo;

    return hardwareHash;
  }

  /**
   * 检查硬件是否发生变化
   * @returns {boolean}
   */
  _checkHardwareChange() {
    const currentHash = computeHardwareHash();
    const cache = this._loadCache();
    return currentHash !== cache.hardware_hash;
  }

  /**
   * 验证卡密
   *
   * 首次验证会激活卡密并绑定当前硬件；非首次验证会检查硬件匹配性。
   *
   * @param {string} cardKey - 卡密字符串
   * @param {string} [hardwareHash] - 硬件哈希值（可选，不提供则自动采集）
   * @returns {Promise<VerifyResult>}
   */
  async verify(cardKey, hardwareHash) {
    if (!cardKey || !cardKey.trim()) {
      return {
        success: false,
        message: '卡密不能为空',
        code: 'MISSING_PARAMS',
      };
    }

    const hwHash = hardwareHash || this._getHardwareHash();

    try {
      const url = `${this.apiUrl}/api/card/verify`;
      const response = await makeRequest(url, {
        card: cardKey.trim(),
        hardwareHash: hwHash,
        cpuInfo: this._cachedHardwareInfo?.cpu || null,
        memoryInfo: this._cachedHardwareInfo?.memory || null,
        gpuInfo: this._cachedHardwareInfo?.gpu || null,
        motherboardInfo: this._cachedHardwareInfo?.motherboard || null,
      }, this.timeout);

      return {
        success: response.data.success || false,
        message: response.data.message || '未知错误',
        expireAt: response.data.expireAt || null,
        code: response.data.code || null,
      };
    } catch (err) {
      return {
        success: false,
        message: `网络连接失败: ${err.message}`,
        code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * 解绑卡密（解除硬件绑定）
   *
   * 解绑后会延长卡密有效期一天。
   *
   * @param {string} cardKey - 卡密字符串
   * @returns {Promise<UnbindResult>}
   */
  async unbind(cardKey) {
    if (!cardKey || !cardKey.trim()) {
      return {
        success: false,
        message: '卡密不能为空',
        code: 'MISSING_PARAMS',
      };
    }

    try {
      const url = `${this.apiUrl}/api/card/unbind`;
      const response = await makeRequest(url, {
        card: cardKey.trim(),
      }, this.timeout);

      return {
        success: response.data.success || false,
        message: response.data.message || '未知错误',
        remainingDays: response.data.remainingDays || null,
        code: response.data.code || null,
      };
    } catch (err) {
      return {
        success: false,
        message: `网络连接失败: ${err.message}`,
        code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * 自动验证（推荐在软件启动时调用）
   *
   * 该方法会检测硬件变更并自动重新采集硬件信息。
   *
   * @param {string} cardKey - 卡密字符串
   * @returns {Promise<VerifyResult>}
   */
  async autoVerify(cardKey) {
    // 检查硬件是否变化
    if (this._checkHardwareChange()) {
      // 清除旧缓存
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
      }
      // 重新采集硬件信息
      this._getHardwareHash();
    }

    const result = await this.verify(cardKey);

    // 如果是硬件不匹配，给出更友好的提示
    if (result.code === 'HARDWARE_MISMATCH') {
      result.message = '硬件信息不匹配，该卡密已绑定其他设备。请联系客服解绑后重试。';
    }

    return result;
  }

  /**
   * 获取卡密到期信息（仅查询）
   *
   * @param {string} cardKey - 卡密字符串
   * @returns {Promise<VerifyResult>}
   */
  async getExpireInfo(cardKey) {
    return this.verify(cardKey);
  }

  /**
   * 清除本地缓存
   */
  clearCache() {
    if (fs.existsSync(this.cachePath)) {
      fs.unlinkSync(this.cachePath);
    }
    this._cachedHardwareHash = null;
    this._cachedHardwareInfo = null;
  }
}

module.exports = { EdgeKeyClient, computeHardwareHash, collectHardwareInfo };
