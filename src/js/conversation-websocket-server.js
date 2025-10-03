const WebSocket = require('ws');
const https = require('https');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');
const selfsigned = require('selfsigned');
const { AssemblyAI } = require('assemblyai');

/**
 * WebSocket server for real-time conversation history updates
 */
class ConversationWebSocketServer {
  constructor(aiManager, windowManager, port = 8443) {
    this.aiManager = aiManager;
    this.windowManager = windowManager;
    this.server = null;
    this.wss = null;
    this.httpServer = null;
    this.port = port;
    this.actualPort = null;
    this.isRunning = false;
    this.clients = new Set();
    this.assemblyAIConnections = new Map(); // sessionId -> AssemblyAI streaming transcriber
    this.assemblyAIClient = null;

    console.log('[ConversationWebSocketServer] Initialized with WindowManager integration');
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
      // Generate proper self-signed certificate for HTTPS
      const cert = await this.generateSelfSignedCert();

      // Create HTTPS server
      this.httpServer = https.createServer({
        key: cert.key,
        cert: cert.cert
      }, this.handleHttpRequest.bind(this));

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
    return `https://0.0.0.0:${this.actualPort}`;
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
    urls.push(`https://localhost:${this.actualPort}`);

    // Add all network interfaces
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.internal || iface.family !== 'IPv4') {
          continue;
        }
        urls.push(`https://${iface.address}:${this.actualPort}`);
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
   * Notify the window manager of WebSocket connection status changes
   */
  notifyConnectionStatusChange() {
    if (!this.windowManager) {
      return;
    }

    const clientCount = this.clients.size;
    console.log(
      `[ConversationWebSocketServer] Connection status changed: ${clientCount} client(s) connected`
    );

    this.windowManager.send('websocket-connection-status', {
      clientCount: clientCount,
      isConnected: clientCount > 0,
    });
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

    // Notify about connection status change
    this.notifyConnectionStatusChange();

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
      // Notify about connection status change
      this.notifyConnectionStatusChange();
    });

    // Handle client error
    ws.on('error', (error) => {
      console.error('[ConversationWebSocketServer] WebSocket client error:', error);
      this.clients.delete(ws);
      // Notify about connection status change
      this.notifyConnectionStatusChange();
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

        case 'start_speech':
          console.log('🎤 [Speech Recording] Started recording session:', data.sessionId);
          await this.startAssemblyAIStream(data.sessionId, ws);
          break;

        case 'audio_data':
          console.log(`🎵 [Audio] Received ${data.audio.length} bytes for session: ${data.sessionId}`);
          await this.forwardAudioToAssemblyAI(data.sessionId, data.audio);
          break;

        case 'stop_speech':
          console.log('🛑 [Speech Recording] Stopped recording session:', data.sessionId);
          await this.stopAssemblyAIStream(data.sessionId);
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
  /**
   * Start AssemblyAI streaming connection using official SDK
   */
  async startAssemblyAIStream(sessionId, clientWS) {
    try {
      const apiKey = process.env.ASSEMBLYAI_API_KEY;
      console.log('[AssemblyAI] API Key check:', apiKey ? `Key exists (${apiKey.substring(0, 8)}...)` : 'No API key found');

      if (!apiKey || apiKey === 'your_assemblyai_api_key_here') {
        throw new Error('AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY in your .env file');
      }

      // Initialize AssemblyAI client if needed
      if (!this.assemblyAIClient) {
        this.assemblyAIClient = new AssemblyAI({
          apiKey: apiKey
        });
      }

      // Create streaming transcriber with explicit configuration
      const rt = this.assemblyAIClient.streaming.transcriber({
        apiKey: apiKey,  // Explicitly pass API key
        sampleRate: 16000
      });

      // Set up event handlers
      rt.on('open', ({ id }) => {
        console.log(`🔗 [AssemblyAI] Session opened: ${id} for session: ${sessionId}`);

        clientWS.send(JSON.stringify({
          type: 'speech_started',
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        }));
      });

      // Removed debug event interception to prevent interference

      // Removed "turn" event handler to prevent duplicates

      rt.on("transcript", (message) => {
        const text = message.text || message.transcript || '';
        const isFinal = message.message_type === 'FinalTranscript';

        console.log(`📝 [AssemblyAI] ${isFinal ? 'FINAL' : 'PARTIAL'} transcript: "${text}"`);

        if (text && clientWS.readyState === WebSocket.OPEN) {
          // Send all transcripts (partial and final) to WebSocket clients for real-time feedback
          clientWS.send(JSON.stringify({
            type: 'speech_transcript',
            text: text,
            isFinal: isFinal,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          }));

          // Only send FINAL transcripts to CodeMirror editor
          if (isFinal && this.windowManager) {
            this.windowManager.send('transcription-to-editor', {
              text: text,
              sessionId: sessionId,
              timestamp: new Date().toISOString(),
              isFinal: true
            });
          }
        }
      });

      rt.on('error', (error) => {
        console.error(`❌ [AssemblyAI] Error for session ${sessionId}:`, error);

        if (clientWS.readyState === WebSocket.OPEN) {
          clientWS.send(JSON.stringify({
            type: 'speech_error',
            error: error.message || error,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          }));
        }
      });

      rt.on('close', () => {
        console.log(`🔗 [AssemblyAI] Session closed for session: ${sessionId}`);
        this.assemblyAIConnections.delete(sessionId);
      });

      // Connect to AssemblyAI
      await rt.connect();

      // Store the connection
      this.assemblyAIConnections.set(sessionId, {
        transcriber: rt,
        connected: true
      });

      console.log(`✅ [AssemblyAI] Successfully connected for session: ${sessionId}`);


    } catch (error) {
      console.error('[AssemblyAI] Error starting stream:', error);
      clientWS.send(JSON.stringify({
        type: 'speech_error',
        error: error.message,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Forward audio data to AssemblyAI using SDK
   */
  async forwardAudioToAssemblyAI(sessionId, base64Audio) {
    const connection = this.assemblyAIConnections.get(sessionId);
    if (!connection) {
      console.warn(`⚠️  [AssemblyAI] No connection found for session: ${sessionId}`);
      return;
    }

    try {
      const audioBuffer = Buffer.from(base64Audio, 'base64');

      // Log more details about the audio data
      console.log(`🎵 [AssemblyAI] Audio chunk details: ${audioBuffer.length} bytes, first few bytes:`, audioBuffer.subarray(0, 8));

      if (connection.connected && connection.transcriber) {
        // Send directly to AssemblyAI - no buffering
        connection.transcriber.sendAudio(audioBuffer);
        console.log(`✅ [AssemblyAI] Sent audio chunk directly: ${audioBuffer.length} bytes`);
      } else {
        // Drop audio if connection not ready - real-time audio should be processed real-time
        console.log(`⚠️ [AssemblyAI] Dropping audio chunk - connection not ready for session: ${sessionId}`);
      }
    } catch (error) {
      console.error(`❌ [AssemblyAI] Error forwarding audio for session ${sessionId}:`, error);
      console.error(`❌ [AssemblyAI] Error details:`, {
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Handle transcript events from AssemblyAI
   */
  handleTranscriptEvent(data, isFinal, sessionId, clientWS) {
    const text = data.text || data.transcript || data.message || '';

    if (text && clientWS.readyState === WebSocket.OPEN) {
      console.log(`📝 [AssemblyAI Response] ${isFinal ? 'FINAL' : 'PARTIAL'}: "${text}"`);

      clientWS.send(JSON.stringify({
        type: 'speech_transcript',
        text: text,
        isFinal: isFinal,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Stop AssemblyAI streaming connection using SDK
   */
  async stopAssemblyAIStream(sessionId) {
    const connection = this.assemblyAIConnections.get(sessionId);
    if (connection && connection.transcriber) {
      try {
        await connection.transcriber.close();
        console.log(`🛑 [AssemblyAI] Stopped stream for session: ${sessionId}`);
      } catch (error) {
        console.error(`❌ [AssemblyAI] Error stopping stream for session ${sessionId}:`, error);
      }
      this.assemblyAIConnections.delete(sessionId);
    }
  }

  /**
   * Generate a proper self-signed certificate for HTTPS using selfsigned package
   * @returns {Promise<{cert: string, key: string}>} Certificate and private key
   */
  async generateSelfSignedCert() {
    const attrs = [
      { name: 'commonName', value: 'localhost' },
      { name: 'countryName', value: 'US' },
      { shortName: 'ST', value: 'CA' },
      { name: 'localityName', value: 'San Francisco' },
      { name: 'organizationName', value: 'DeepSeek Overlay Helper' },
      { shortName: 'OU', value: 'Development' }
    ];

    const opts = {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'basicConstraints',
          cA: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: 2, // DNS
              value: 'localhost'
            },
            {
              type: 2, // DNS
              value: '*.localhost'
            },
            {
              type: 7, // IP
              ip: '127.0.0.1'
            },
            {
              type: 7, // IP
              ip: '0.0.0.0'
            }
          ]
        }
      ]
    };

    const pems = selfsigned.generate(attrs, opts);

    console.log('[ConversationWebSocketServer] Generated self-signed certificate for HTTPS');

    return {
      key: pems.private,
      cert: pems.cert
    };
  }

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
