/**
 * OCR Logger - Comprehensive logging system for OCR text processing analysis
 *
 * Features:
 * - Month-wise folder organization
 * - Timestamp-based file naming
 * - Before/after text comparison
 * - Processing metadata and statistics
 * - Analysis and reporting capabilities
 * - Automatic cleanup of old logs
 */

const fs = require('fs').promises;
const path = require('path');

class OCRLogger {
  constructor(options = {}) {
    this.baseLogDir = options.logDir || path.join(process.cwd(), 'logs', 'ocr');
    this.maxLogAge = options.maxLogAge || 90; // days
    this.enableLogging = options.enableLogging !== false;
    this.logLevel = options.logLevel || 'info'; // 'debug', 'info', 'warn', 'error'

    // Statistics tracking
    this.sessionStats = {
      totalProcessed: 0,
      totalOriginalChars: 0,
      totalCleanedChars: 0,
      averageReduction: 0,
      contentTypes: {},
      confidenceLevels: {},
      startTime: new Date(),
    };

    this.initializeLogger();
  }

  /**
   * Initialize logger and create directory structure
   */
  async initializeLogger() {
    if (!this.enableLogging) return;

    try {
      await this.ensureLogDirectory();
      await this.cleanupOldLogs();
      this.log('info', 'OCR Logger initialized successfully');
    } catch (error) {
      console.error('[OCRLogger] Failed to initialize:', error.message);
      this.enableLogging = false;
    }
  }

  /**
   * Log OCR processing session with before/after comparison
   */
  async logOCRSession(data) {
    if (!this.enableLogging) return null;

    try {
      const timestamp = new Date();
      const sessionId = this.generateSessionId(timestamp);

      // Prepare log entry
      const logEntry = {
        sessionId,
        timestamp: timestamp.toISOString(),
        processing: {
          originalText: data.originalText || '',
          cleanedText: data.cleanedText || '',
          confidence: data.confidence || 0,
          contentType: data.contentType || 'unknown',
          preset: data.preset || 'auto',
          processingTime: data.processingTime || 0,
        },
        analysis: this.analyzeTextProcessing(data.originalText, data.cleanedText),
        metadata: {
          imageSize: data.imageSize,
          preprocessed: data.preprocessed || false,
          filteringEnabled: data.filteringEnabled || false,
          ocrEngine: 'tesseract',
          version: '1.0.0',
        },
        settings: data.cleaningOptions || {},
      };

      // Update session statistics
      this.updateSessionStats(logEntry);

      // Write to file
      const filePath = await this.writeLogEntry(logEntry, timestamp);

      this.log('info', `OCR session logged: ${sessionId}`);
      return { sessionId, filePath, analysis: logEntry.analysis };
    } catch (error) {
      this.log('error', `Failed to log OCR session: ${error.message}`);
      return null;
    }
  }

  /**
   * Analyze text processing effectiveness
   */
  analyzeTextProcessing(originalText, cleanedText) {
    const original = originalText || '';
    const cleaned = cleanedText || '';

    const analysis = {
      // Basic metrics
      originalLength: original.length,
      cleanedLength: cleaned.length,
      reductionRatio:
        original.length > 0 ? (original.length - cleaned.length) / original.length : 0,
      reductionPercentage: 0,

      // Line analysis
      originalLines: original.split('\n').length,
      cleanedLines: cleaned.split('\n').length,
      linesRemoved: 0,
      linesKept: 0,

      // Content analysis
      questionsPreserved: this.countQuestions(cleaned),
      codeBlocksPreserved: this.countCodeBlocks(cleaned),
      meaningfulWordsPreserved: this.countMeaningfulWords(cleaned),

      // Quality assessment
      qualityScore: 0,
      preservationScore: 0,
      cleaningEffectiveness: 'unknown',

      // Detailed comparison
      removedContent: this.findRemovedContent(original, cleaned),
      preservedContent: this.findPreservedContent(original, cleaned),

      // Suggestions
      suggestions: [],
    };

    // Calculate derived metrics
    analysis.reductionPercentage = Math.round(analysis.reductionRatio * 100);
    analysis.linesRemoved = analysis.originalLines - analysis.cleanedLines;
    analysis.linesKept = analysis.cleanedLines;

    // Calculate quality scores
    analysis.qualityScore = this.calculateQualityScore(analysis);
    analysis.preservationScore = this.calculatePreservationScore(original, cleaned);
    analysis.cleaningEffectiveness = this.assessCleaningEffectiveness(analysis);

    // Generate suggestions
    analysis.suggestions = this.generateProcessingSuggestions(analysis);

    return analysis;
  }

  /**
   * Count questions in text
   */
  countQuestions(text) {
    return (text.match(/\?/g) || []).length;
  }

  /**
   * Count code blocks in text
   */
  countCodeBlocks(text) {
    const codePatterns = [
      /[{}();]/g,
      /\b(function|class|def|if|else|for|while|return)\b/gi,
      /[=+\-*\/]{2,}/g,
    ];

    let codeCount = 0;
    codePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) codeCount += matches.length;
    });

    return codeCount;
  }

  /**
   * Count meaningful words (excluding common junk)
   */
  countMeaningfulWords(text) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const junkWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
    ]);

    return words.filter((word) => word.length > 2 && !junkWords.has(word)).length;
  }

  /**
   * Find content that was removed during cleaning
   */
  findRemovedContent(original, cleaned) {
    const originalLines = original.split('\n');
    const cleanedLines = cleaned.split('\n');
    const cleanedSet = new Set(cleanedLines);

    return originalLines.filter((line) => !cleanedSet.has(line) && line.trim().length > 0);
  }

  /**
   * Find content that was preserved during cleaning
   */
  findPreservedContent(original, cleaned) {
    const originalLines = original.split('\n');
    const cleanedLines = cleaned.split('\n');
    const originalSet = new Set(originalLines);

    return cleanedLines.filter((line) => originalSet.has(line) && line.trim().length > 0);
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(analysis) {
    let score = 0.5; // Base score

    // Penalize excessive reduction
    if (analysis.reductionPercentage > 80) {
      score -= 0.3;
    } else if (analysis.reductionPercentage > 60) {
      score -= 0.1;
    }

    // Reward question preservation
    if (analysis.questionsPreserved > 0) {
      score += 0.2;
    }

    // Reward code preservation
    if (analysis.codeBlocksPreserved > 0) {
      score += 0.1;
    }

    // Reward meaningful word preservation
    if (analysis.meaningfulWordsPreserved > 10) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate preservation score
   */
  calculatePreservationScore(original, cleaned) {
    if (original.length === 0) return 0;

    const commonChars = this.countCommonCharacters(original, cleaned);
    return commonChars / original.length;
  }

  /**
   * Count common characters between two strings
   */
  countCommonCharacters(str1, str2) {
    const chars1 = str1.toLowerCase().split('');
    const chars2 = str2.toLowerCase().split('');
    const charMap = {};

    // Count characters in first string
    chars1.forEach((char) => {
      charMap[char] = (charMap[char] || 0) + 1;
    });

    // Count common characters
    let common = 0;
    chars2.forEach((char) => {
      if (charMap[char] && charMap[char] > 0) {
        common++;
        charMap[char]--;
      }
    });

    return common;
  }

  /**
   * Assess cleaning effectiveness
   */
  assessCleaningEffectiveness(analysis) {
    if (analysis.qualityScore > 0.8) return 'excellent';
    if (analysis.qualityScore > 0.6) return 'good';
    if (analysis.qualityScore > 0.4) return 'fair';
    if (analysis.qualityScore > 0.2) return 'poor';
    return 'very_poor';
  }

  /**
   * Generate processing suggestions
   */
  generateProcessingSuggestions(analysis) {
    const suggestions = [];

    if (analysis.reductionPercentage > 80) {
      suggestions.push(
        'Excessive text removal detected - consider reducing cleaning aggressiveness'
      );
    }

    if (analysis.questionsPreserved === 0 && analysis.originalLength > 100) {
      suggestions.push(
        'No questions detected in cleaned text - verify question preservation settings'
      );
    }

    if (analysis.qualityScore < 0.4) {
      suggestions.push('Low quality score - review cleaning parameters and content type detection');
    }

    if (analysis.cleanedLength < 20 && analysis.originalLength > 100) {
      suggestions.push('Very short output from long input - possible over-filtering');
    }

    if (suggestions.length === 0) {
      suggestions.push('Text cleaning appears to be working well');
    }

    return suggestions;
  }

  /**
   * Update session statistics
   */
  updateSessionStats(logEntry) {
    const analysis = logEntry.analysis;
    const processing = logEntry.processing;

    this.sessionStats.totalProcessed++;
    this.sessionStats.totalOriginalChars += analysis.originalLength;
    this.sessionStats.totalCleanedChars += analysis.cleanedLength;

    // Update averages
    this.sessionStats.averageReduction =
      (this.sessionStats.totalOriginalChars - this.sessionStats.totalCleanedChars) /
      this.sessionStats.totalOriginalChars;

    // Track content types
    const contentType = processing.contentType;
    this.sessionStats.contentTypes[contentType] =
      (this.sessionStats.contentTypes[contentType] || 0) + 1;

    // Track confidence levels
    const confidenceRange = Math.floor(processing.confidence / 10) * 10;
    this.sessionStats.confidenceLevels[confidenceRange] =
      (this.sessionStats.confidenceLevels[confidenceRange] || 0) + 1;
  }

  /**
   * Generate session ID
   */
  generateSessionId(timestamp) {
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const random = Math.random().toString(36).substr(2, 4);
    return `ocr-${dateStr}-${random}`;
  }

  /**
   * Write log entry to file
   */
  async writeLogEntry(logEntry, timestamp) {
    const monthDir = this.getMonthDirectory(timestamp);
    await this.ensureDirectory(monthDir);

    const fileName = this.generateFileName(timestamp);
    const filePath = path.join(monthDir, fileName);

    await fs.writeFile(filePath, JSON.stringify(logEntry, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Get month directory path
   */
  getMonthDirectory(timestamp) {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    return path.join(this.baseLogDir, `${year}-${month}`);
  }

  /**
   * Generate log file name
   */
  generateFileName(timestamp) {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hour = String(timestamp.getHours()).padStart(2, '0');
    const minute = String(timestamp.getMinutes()).padStart(2, '0');
    const second = String(timestamp.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hour}-${minute}-${second}_ocr.json`;
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    await this.ensureDirectory(this.baseLogDir);
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxLogAge);

      const months = await fs.readdir(this.baseLogDir);

      for (const monthDir of months) {
        const monthPath = path.join(this.baseLogDir, monthDir);
        const stat = await fs.stat(monthPath);

        if (stat.isDirectory() && stat.mtime < cutoffDate) {
          await fs.rm(monthPath, { recursive: true, force: true });
          this.log('info', `Cleaned up old log directory: ${monthDir}`);
        }
      }
    } catch (error) {
      this.log('warn', `Failed to cleanup old logs: ${error.message}`);
    }
  }

  /**
   * Get processing statistics
   */
  getSessionStats() {
    const runtime = (new Date() - this.sessionStats.startTime) / 1000 / 60; // minutes

    return {
      ...this.sessionStats,
      runtimeMinutes: Math.round(runtime * 100) / 100,
      averageReductionPercentage: Math.round(this.sessionStats.averageReduction * 100),
      processingRate:
        runtime > 0 ? Math.round((this.sessionStats.totalProcessed / runtime) * 100) / 100 : 0,
    };
  }

  /**
   * Generate processing report
   */
  async generateReport(options = {}) {
    const days = options.days || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const logFiles = await this.findLogFiles(cutoffDate);
      const reportData = await this.analyzeLogFiles(logFiles);

      const report = {
        period: `${days} days`,
        generated: new Date().toISOString(),
        summary: reportData.summary,
        trends: reportData.trends,
        recommendations: reportData.recommendations,
        topIssues: reportData.issues,
        sessionStats: this.getSessionStats(),
      };

      // Save report
      if (options.saveReport !== false) {
        const reportPath = await this.saveReport(report);
        report.reportPath = reportPath;
      }

      return report;
    } catch (error) {
      this.log('error', `Failed to generate report: ${error.message}`);
      return null;
    }
  }

  /**
   * Find log files within date range
   */
  async findLogFiles(cutoffDate) {
    const logFiles = [];

    try {
      const months = await fs.readdir(this.baseLogDir);

      for (const monthDir of months) {
        const monthPath = path.join(this.baseLogDir, monthDir);
        const files = await fs.readdir(monthPath);

        for (const file of files) {
          if (file.endsWith('_ocr.json')) {
            const filePath = path.join(monthPath, file);
            const stat = await fs.stat(filePath);

            if (stat.mtime >= cutoffDate) {
              logFiles.push({ path: filePath, mtime: stat.mtime });
            }
          }
        }
      }
    } catch (error) {
      this.log('warn', `Error finding log files: ${error.message}`);
    }

    return logFiles.sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * Analyze log files for reporting
   */
  async analyzeLogFiles(logFiles) {
    const analysis = {
      summary: {
        totalSessions: 0,
        averageQualityScore: 0,
        averageReduction: 0,
        contentTypes: {},
        effectivenessDistribution: {},
      },
      trends: [],
      recommendations: [],
      issues: [],
    };

    let totalQuality = 0;
    let totalReduction = 0;

    for (const { path: filePath } of logFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const logEntry = JSON.parse(content);
        const logAnalysis = logEntry.analysis;

        analysis.summary.totalSessions++;
        totalQuality += logAnalysis.qualityScore;
        totalReduction += logAnalysis.reductionPercentage;

        // Track content types
        const contentType = logEntry.processing.contentType;
        analysis.summary.contentTypes[contentType] =
          (analysis.summary.contentTypes[contentType] || 0) + 1;

        // Track effectiveness
        const effectiveness = logAnalysis.cleaningEffectiveness;
        analysis.summary.effectivenessDistribution[effectiveness] =
          (analysis.summary.effectivenessDistribution[effectiveness] || 0) + 1;

        // Collect issues
        if (logAnalysis.qualityScore < 0.4) {
          analysis.issues.push({
            sessionId: logEntry.sessionId,
            issue: 'Low quality score',
            score: logAnalysis.qualityScore,
            suggestions: logAnalysis.suggestions,
          });
        }
      } catch (error) {
        this.log('warn', `Failed to analyze log file ${filePath}: ${error.message}`);
      }
    }

    // Calculate averages
    if (analysis.summary.totalSessions > 0) {
      analysis.summary.averageQualityScore = totalQuality / analysis.summary.totalSessions;
      analysis.summary.averageReduction = totalReduction / analysis.summary.totalSessions;
    }

    // Generate recommendations
    analysis.recommendations = this.generateReportRecommendations(analysis.summary);

    return analysis;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateReportRecommendations(summary) {
    const recommendations = [];

    if (summary.averageQualityScore < 0.5) {
      recommendations.push('Overall quality score is low - consider adjusting cleaning parameters');
    }

    if (summary.averageReduction > 70) {
      recommendations.push(
        'High text reduction rate - verify important content is being preserved'
      );
    }

    const poorSessions = summary.effectivenessDistribution.poor || 0;
    const totalSessions = summary.totalSessions;

    if (poorSessions / totalSessions > 0.2) {
      recommendations.push(
        'High rate of poor cleaning effectiveness - review content type detection'
      );
    }

    return recommendations;
  }

  /**
   * Save report to file
   */
  async saveReport(report) {
    const timestamp = new Date();
    const monthDir = this.getMonthDirectory(timestamp);
    await this.ensureDirectory(monthDir);

    const fileName = `report_${this.generateFileName(timestamp).replace('_ocr.json', '_report.json')}`;
    const filePath = path.join(monthDir, fileName);

    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Internal logging method
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = logLevels[this.logLevel] || 1;

    if (logLevels[level] >= currentLevel) {
      console.log(`[OCRLogger] ${timestamp} [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Enable/disable logging
   */
  setLoggingEnabled(enabled) {
    this.enableLogging = enabled;
    this.log('info', `Logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current logging status
   */
  getStatus() {
    return {
      enabled: this.enableLogging,
      logDirectory: this.baseLogDir,
      sessionStats: this.getSessionStats(),
      maxLogAge: this.maxLogAge,
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    this.log('info', 'OCR Logger shutting down');
    // Any cleanup needed
  }
}

module.exports = OCRLogger;
