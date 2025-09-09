const fs = require('fs').promises;
const path = require('path');

/**
 * Service to manage conversation history export for web viewing
 */
class ConversationHistoryService {
  constructor(aiManager, appController) {
    this.aiManager = aiManager;
    this.appController = appController;
    this.historyFilePath = path.join(process.cwd(), 'conversation-data.json');
    this.isEnabled = true;
    this.webSocketServer = null;
    
    console.log(`[ConversationHistoryService] Initialized with output file: ${this.historyFilePath}`);
  }

  /**
   * Enable or disable the service
   * @param {boolean} enabled - Whether to enable history export
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`[ConversationHistoryService] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Set the WebSocket server instance
   * @param {ConversationWebSocketServer} webSocketServer - WebSocket server instance
   */
  setWebSocketServer(webSocketServer) {
    this.webSocketServer = webSocketServer;
    console.log('[ConversationHistoryService] WebSocket server attached');
  }

  /**
   * Export current conversation history to JSON file and broadcast via WebSocket
   * This should be called after each AI query
   */
  async exportHistory() {
    if (!this.isEnabled) {
      return;
    }

    try {
      const historyData = this.buildHistoryData();
      await this.writeHistoryFile(historyData);
      
      // Broadcast update via WebSocket if available
      if (this.webSocketServer && this.webSocketServer.isRunning) {
        await this.webSocketServer.broadcastHistoryUpdate();
      }
      
      console.log(`[ConversationHistoryService] History exported with ${historyData.history.length} messages`);
    } catch (error) {
      console.error('[ConversationHistoryService] Failed to export history:', error);
    }
  }

  /**
   * Build conversation history data structure
   * @returns {Object} History data object
   */
  buildHistoryData() {
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
        model: sessionStats.model
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        source: 'DeepSeek Overlay Helper'
      }
    };
  }

  /**
   * Write history data to JSON file
   * @param {Object} historyData - History data to write
   */
  async writeHistoryFile(historyData) {
    const jsonData = JSON.stringify(historyData, null, 2);
    await fs.writeFile(this.historyFilePath, jsonData, 'utf8');
  }

  /**
   * Get the current history data without writing to file
   * @returns {Object} Current history data
   */
  getCurrentHistory() {
    return this.buildHistoryData();
  }

  /**
   * Clear the history file
   */
  async clearHistoryFile() {
    try {
      const emptyHistory = {
        provider: 'Unknown',
        model: 'Unknown',
        isOllama: false,
        history: [],
        lastUpdated: new Date().toISOString(),
        sessionStats: {
          historyLength: 0,
          cacheSize: 0,
          isActive: false,
          provider: 'Unknown',
          model: 'Unknown'
        },
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          source: 'DeepSeek Overlay Helper'
        }
      };

      await this.writeHistoryFile(emptyHistory);
      console.log('[ConversationHistoryService] History file cleared');
    } catch (error) {
      console.error('[ConversationHistoryService] Failed to clear history file:', error);
    }
  }

  /**
   * Get the path to the conversation history HTML file
   * @returns {string} HTML file path
   */
  getHistoryHtmlPath() {
    return path.join(process.cwd(), 'conversation-history.html');
  }

  /**
   * Check if the history HTML file exists
   * @returns {Promise<boolean>} True if HTML file exists
   */
  async isHistoryHtmlAvailable() {
    try {
      await fs.access(this.getHistoryHtmlPath());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open the conversation history in the default browser
   * This is a helper method for the main app to use
   */
  async openInBrowser() {
    const { shell } = require('electron');
    
    try {
      // If WebSocket server is running, open the live URL
      if (this.webSocketServer && this.webSocketServer.isRunning) {
        const url = this.webSocketServer.getUrl();
        await shell.openExternal(url);
        console.log(`[ConversationHistoryService] Opened live conversation history at ${url}`);
        return;
      }
      
      // Fallback to static HTML file
      const htmlPath = this.getHistoryHtmlPath();
      await fs.access(htmlPath);
      await shell.openExternal(`file://${htmlPath}`);
      console.log('[ConversationHistoryService] Opened conversation history in browser');
    } catch (error) {
      console.error('[ConversationHistoryService] Failed to open in browser:', error);
      throw new Error('Conversation history not available');
    }
  }

  /**
   * Get statistics about the current history
   * @returns {Object} History statistics
   */
  getHistoryStats() {
    const historyData = this.buildHistoryData();
    
    const userMessages = historyData.history.filter(msg => msg.role === 'user').length;
    const assistantMessages = historyData.history.filter(msg => msg.role === 'assistant').length;
    
    let totalCharacters = 0;
    let totalWords = 0;
    
    historyData.history.forEach(msg => {
      if (msg.content) {
        totalCharacters += msg.content.length;
        totalWords += msg.content.split(/\s+/).length;
      }
    });

    return {
      totalMessages: historyData.history.length,
      userMessages,
      assistantMessages,
      totalCharacters,
      totalWords,
      lastUpdated: historyData.lastUpdated,
      isActive: historyData.sessionStats.isActive,
      provider: historyData.provider,
      model: historyData.model
    };
  }
}

module.exports = ConversationHistoryService;