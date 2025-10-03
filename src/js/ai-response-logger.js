const fs = require('fs');
const path = require('path');

/**
 * AI Response Logger
 *
 * Logs all AI responses to JSONL files for later analysis.
 * Useful for improving the formatter and understanding AI output patterns.
 */
class AIResponseLogger {
  constructor(logDir = 'logs/ai-responses') {
    this.logDir = logDir;
    this.enabled = true;

    // Ensure log directory exists
    this._ensureLogDirectory();
  }

  /**
   * Ensure the log directory exists
   * @private
   */
  _ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`[AIResponseLogger] Created log directory: ${this.logDir}`);
      }
    } catch (error) {
      console.error(`[AIResponseLogger] Failed to create log directory:`, error.message);
      this.enabled = false;
    }
  }

  /**
   * Get the log file path for today
   * @returns {string} Path to today's log file
   * @private
   */
  _getTodayLogFile() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `${today}.jsonl`);
  }

  /**
   * Log an AI response
   * @param {Object} data - Response data
   * @param {string} data.question - The question asked
   * @param {string} data.response - The AI response
   * @param {string} data.provider - AI provider name (ollama, deepseek, etc.)
   * @param {string} data.model - Model name
   * @param {string} data.interviewType - Interview type (dsa, systemDesign, lld)
   * @param {string} [data.flowType] - Flow type (local, cloud, hybrid)
   * @param {number} [data.messageCount] - Number of messages in session
   * @param {boolean} [data.isError] - Whether this was an error response
   */
  logResponse(data) {
    if (!this.enabled) {
      return;
    }

    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        provider: data.provider || 'unknown',
        model: data.model || 'unknown',
        interviewType: data.interviewType || 'unknown',
        flowType: data.flowType || null,
        question: data.question || '',
        response: data.response || '',
        responseLength: data.response ? data.response.length : 0,
        messageCount: data.messageCount || 0,
        isError: data.isError || false,
        metadata: data.metadata || {},
      };

      const logFilePath = this._getTodayLogFile();
      const logLine = JSON.stringify(logEntry) + '\n';

      // Append to log file
      fs.appendFileSync(logFilePath, logLine, 'utf8');

      console.log(
        `[AIResponseLogger] Logged response: ${data.provider}/${data.model} (${data.interviewType})`
      );
    } catch (error) {
      console.error(`[AIResponseLogger] Failed to log response:`, error.message);
    }
  }

  /**
   * Enable logging
   */
  enable() {
    this.enabled = true;
    this._ensureLogDirectory();
    console.log('[AIResponseLogger] Logging enabled');
  }

  /**
   * Disable logging
   */
  disable() {
    this.enabled = false;
    console.log('[AIResponseLogger] Logging disabled');
  }

  /**
   * Get statistics for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Object} Statistics
   */
  getStatsForDate(date) {
    try {
      const logFilePath = path.join(this.logDir, `${date}.jsonl`);

      if (!fs.existsSync(logFilePath)) {
        return { error: `No log file found for ${date}` };
      }

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries = lines.map((line) => JSON.parse(line));

      const stats = {
        date,
        totalResponses: entries.length,
        byProvider: {},
        byModel: {},
        byInterviewType: {},
        byFlowType: {},
        errors: entries.filter((e) => e.isError).length,
        averageResponseLength: 0,
        totalResponseLength: 0,
      };

      entries.forEach((entry) => {
        // By provider
        stats.byProvider[entry.provider] = (stats.byProvider[entry.provider] || 0) + 1;

        // By model
        stats.byModel[entry.model] = (stats.byModel[entry.model] || 0) + 1;

        // By interview type
        stats.byInterviewType[entry.interviewType] =
          (stats.byInterviewType[entry.interviewType] || 0) + 1;

        // By flow type
        if (entry.flowType) {
          stats.byFlowType[entry.flowType] = (stats.byFlowType[entry.flowType] || 0) + 1;
        }

        // Response lengths
        stats.totalResponseLength += entry.responseLength;
      });

      stats.averageResponseLength =
        entries.length > 0 ? Math.round(stats.totalResponseLength / entries.length) : 0;

      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get all log files
   * @returns {Array<string>} Array of log file names (YYYY-MM-DD.jsonl)
   */
  getLogFiles() {
    try {
      if (!fs.existsSync(this.logDir)) {
        return [];
      }

      return fs
        .readdirSync(this.logDir)
        .filter((file) => file.endsWith('.jsonl'))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      console.error(`[AIResponseLogger] Failed to get log files:`, error.message);
      return [];
    }
  }

  /**
   * Read all entries from a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array<Object>} Array of log entries
   */
  getEntriesForDate(date) {
    try {
      const logFilePath = path.join(this.logDir, `${date}.jsonl`);

      if (!fs.existsSync(logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line));
    } catch (error) {
      console.error(`[AIResponseLogger] Failed to read entries for ${date}:`, error.message);
      return [];
    }
  }
}

module.exports = AIResponseLogger;
