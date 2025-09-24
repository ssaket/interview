const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;

/**
 * WebSocket server for real-time conversation history updates
 */
class ConversationWebSocketServer {
  constructor(aiManager, port = 0) {
    this.aiManager = aiManager;
    this.server = null;
    this.wss = null;
    this.httpServer = null;
    this.port = port;
    this.actualPort = null;
    this.isRunning = false;
    this.clients = new Set();

    console.log('[ConversationWebSocketServer] Initialized');
  }

  /**
   * Start the WebSocket server
   * @returns {Promise<string>} Server URL
   */
  async start() {
    if (this.isRunning) {
      return this.getUrl();
    }

    try {
      // Create HTTP server
      this.httpServer = http.createServer(this.handleHttpRequest.bind(this));

      // Create WebSocket server
      this.wss = new WebSocket.Server({ server: this.httpServer });

      // Set up WebSocket event handlers
      this.wss.on('connection', this.handleWebSocketConnection.bind(this));

      // Start listening on all interfaces (0.0.0.0) to allow network access
      await new Promise((resolve, reject) => {
        this.httpServer.listen(this.port, '0.0.0.0', (error) => {
          if (error) {
            reject(error);
          } else {
            this.actualPort = this.httpServer.address().port;
            this.isRunning = true;
            console.log(
              `[ConversationWebSocketServer] Started on port ${this.actualPort}, accessible on all network interfaces`
            );
            resolve();
          }
        });
      });

      return this.getUrl();
    } catch (error) {
      console.error('[ConversationWebSocketServer] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close all WebSocket connections
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      // Close HTTP server
      if (this.httpServer) {
        await new Promise((resolve) => {
          this.httpServer.close(resolve);
        });
        this.httpServer = null;
      }

      this.isRunning = false;
      this.actualPort = null;
      console.log('[ConversationWebSocketServer] Stopped');
    } catch (error) {
      console.error('[ConversationWebSocketServer] Error stopping server:', error);
    }
  }

  /**
   * Get the server URL
   * @returns {string} Server URL
   */
  getUrl() {
    if (!this.isRunning || !this.actualPort) {
      return null;
    }
    return `http://0.0.0.0:${this.actualPort}`;
  }

  /**
   * Get network-accessible URLs for the server
   * @returns {Array<string>} Array of accessible URLs
   */
  getNetworkUrls() {
    if (!this.isRunning || !this.actualPort) {
      return [];
    }

    const os = require('os');
    const interfaces = os.networkInterfaces();
    const urls = [];

    // Add localhost
    urls.push(`http://localhost:${this.actualPort}`);

    // Add all network interfaces
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.internal || iface.family !== 'IPv4') {
          continue;
        }
        urls.push(`http://${iface.address}:${this.actualPort}`);
      }
    }

    return urls;
  }

  /**
   * Broadcast conversation history to all connected clients
   */
  async broadcastHistoryUpdate() {
    if (!this.isRunning || this.clients.size === 0) {
      return;
    }

    try {
      const historyData = this.getCurrentHistory();
      const message = JSON.stringify({
        type: 'history_update',
        data: historyData,
        timestamp: new Date().toISOString(),
      });

      // Send to all connected clients
      const deadClients = new Set();
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          deadClients.add(client);
        }
      });

      // Remove dead clients
      deadClients.forEach((client) => this.clients.delete(client));

      console.log(
        `[ConversationWebSocketServer] Broadcasted update to ${this.clients.size} clients`
      );
    } catch (error) {
      console.error('[ConversationWebSocketServer] Failed to broadcast update:', error);
    }
  }

  /**
   * Handle HTTP requests (serve the HTML page)
   * @private
   */
  async handleHttpRequest(req, res) {
    try {
      if (req.url === '/' || req.url === '/index.html') {
        // Serve the conversation history HTML page
        const htmlPath = path.join(process.cwd(), 'conversation-history-websocket.html');
        const htmlContent = await fs.readFile(htmlPath, 'utf8');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
      } else if (req.url === '/favicon.ico') {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } catch (error) {
      console.error('[ConversationWebSocketServer] HTTP request error:', error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  /**
   * Handle new WebSocket connection
   * @private
   */
  handleWebSocketConnection(ws, req) {
    console.log('[ConversationWebSocketServer] New WebSocket connection');

    // Add client to the set
    this.clients.add(ws);

    // Send current history immediately
    this.sendCurrentHistory(ws);

    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleClientMessage(ws, data);
      } catch (error) {
        console.error('[ConversationWebSocketServer] Invalid message from client:', error);
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('[ConversationWebSocketServer] WebSocket connection closed');
      this.clients.delete(ws);
    });

    // Handle client error
    ws.on('error', (error) => {
      console.error('[ConversationWebSocketServer] WebSocket client error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Send current history to a specific client
   * @private
   */
  async sendCurrentHistory(ws) {
    try {
      const historyData = this.getCurrentHistory();
      const message = JSON.stringify({
        type: 'initial_history',
        data: historyData,
        timestamp: new Date().toISOString(),
      });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    } catch (error) {
      console.error('[ConversationWebSocketServer] Failed to send current history:', error);
    }
  }

  /**
   * Handle messages from clients
   * @private
   */
  async handleClientMessage(ws, data) {
    try {
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        case 'request_history':
          await this.sendCurrentHistory(ws);
          break;

        case 'clear_history':
          // This could trigger a history clear in the main app
          // For now, just acknowledge
          ws.send(
            JSON.stringify({
              type: 'clear_acknowledged',
              timestamp: new Date().toISOString(),
            })
          );
          break;

        default:
          console.warn('[ConversationWebSocketServer] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[ConversationWebSocketServer] Error handling client message:', error);
    }
  }

  /**
   * Get current conversation history data
   * @returns {Object} History data object
   */
  getCurrentHistory() {
    const providerInfo = this.aiManager.getProviderInfo();
    const sessionStats = this.aiManager.getSessionStats();
    const session = this.aiManager.getSession();

    return {
      provider: providerInfo.name,
      model: providerInfo.model,
      isOllama: providerInfo.isOllama,
      history: session.history || [],
      lastUpdated: new Date().toISOString(),
      sessionStats: {
        historyLength: sessionStats.historyLength,
        cacheSize: sessionStats.cacheSize,
        isActive: sessionStats.isActive,
        provider: sessionStats.provider,
        model: sessionStats.model,
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        source: 'DeepSeek Overlay Helper',
      },
    };
  }

  /**
   * Get server statistics
   * @returns {Object} Server statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      port: this.actualPort,
      url: this.getUrl(),
      connectedClients: this.clients.size,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
    };
  }
}

module.exports = ConversationWebSocketServer;
