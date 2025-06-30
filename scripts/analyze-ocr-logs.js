#!/usr/bin/env node

/**
 * OCR Log Analysis Script
 *
 * Simple utility to analyze OCR processing logs and evaluate
 * the effectiveness of the LLMFriendlyOCRCleaner.
 *
 * Usage:
 *   node scripts/analyze-ocr-logs.js [days]
 *
 * Examples:
 *   node scripts/analyze-ocr-logs.js     # Analyze last 7 days
 *   node scripts/analyze-ocr-logs.js 30  # Analyze last 30 days
 */

const fs = require('fs').promises;
const path = require('path');

class OCRLogAnalyzer {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'ocr');
    this.stats = {
      totalSessions: 0,
      totalOriginalChars: 0,
      totalCleanedChars: 0,
      averageConfidence: 0,
      contentTypes: {},
      qualityScores: [],
      reductionRatios: [],
      effectivenessDistribution: {},
      problemSessions: []
    };
  }

  /**
   * Main analysis function
   */
  async analyze(days = 7) {
    console.log(`🔍 Analyzing OCR logs for the last ${days} days...\n`);

    try {
      const logFiles = await this.findLogFiles(days);

      if (logFiles.length === 0) {
        console.log('❌ No OCR log files found in the specified time range.');
        console.log(`📁 Looking in: ${this.logDir}`);
        return;
      }

      console.log(`📄 Found ${logFiles.length} log files`);
      console.log('⏳ Processing logs...\n');

      await this.processLogFiles(logFiles);
      this.displayResults();

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
    }
  }

  /**
   * Find log files within the specified date range
   */
  async findLogFiles(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const logFiles = [];

    try {
      const months = await fs.readdir(this.logDir);

      for (const monthDir of months) {
        if (!monthDir.match(/^\d{4}-\d{2}$/)) continue;

        const monthPath = path.join(this.logDir, monthDir);
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
      if (error.code === 'ENOENT') {
        throw new Error(`Log directory not found: ${this.logDir}`);
      }
      throw error;
    }

    return logFiles.sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * Process all log files and collect statistics
   */
  async processLogFiles(logFiles) {
    let totalConfidence = 0;

    for (const { path: filePath } of logFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const logEntry = JSON.parse(content);

        this.processLogEntry(logEntry);
        totalConfidence += logEntry.processing.confidence || 0;

      } catch (error) {
        console.warn(`⚠️ Failed to process ${path.basename(filePath)}: ${error.message}`);
      }
    }

    if (this.stats.totalSessions > 0) {
      this.stats.averageConfidence = totalConfidence / this.stats.totalSessions;
    }
  }

  /**
   * Process individual log entry
   */
  processLogEntry(logEntry) {
    const { processing, analysis } = logEntry;

    this.stats.totalSessions++;
    this.stats.totalOriginalChars += analysis.originalLength || 0;
    this.stats.totalCleanedChars += analysis.cleanedLength || 0;

    // Track content types
    const contentType = processing.contentType || 'unknown';
    this.stats.contentTypes[contentType] = (this.stats.contentTypes[contentType] || 0) + 1;

    // Track quality scores
    if (analysis.qualityScore !== undefined) {
      this.stats.qualityScores.push(analysis.qualityScore);
    }

    // Track reduction ratios
    if (analysis.reductionPercentage !== undefined) {
      this.stats.reductionRatios.push(analysis.reductionPercentage);
    }

    // Track effectiveness
    const effectiveness = analysis.cleaningEffectiveness || 'unknown';
    this.stats.effectivenessDistribution[effectiveness] =
      (this.stats.effectivenessDistribution[effectiveness] || 0) + 1;

    // Identify problem sessions
    if (analysis.qualityScore < 0.4 || analysis.reductionPercentage > 80) {
      this.stats.problemSessions.push({
        sessionId: logEntry.sessionId,
        timestamp: new Date(logEntry.timestamp).toLocaleString(),
        qualityScore: analysis.qualityScore,
        reductionPercentage: analysis.reductionPercentage,
        contentType: contentType,
        suggestions: analysis.suggestions || []
      });
    }
  }

  /**
   * Display analysis results
   */
  displayResults() {
    console.log('═'.repeat(60));
    console.log('📊 OCR TEXT CLEANING ANALYSIS RESULTS');
    console.log('═'.repeat(60));

    this.displayOverviewStats();
    this.displayContentTypeBreakdown();
    this.displayCleaningEffectiveness();
    this.displayQualityMetrics();
    this.displayProblemSessions();
    this.displayRecommendations();
  }

  /**
   * Display overview statistics
   */
  displayOverviewStats() {
    const totalReduction = this.stats.totalOriginalChars > 0
      ? ((this.stats.totalOriginalChars - this.stats.totalCleanedChars) / this.stats.totalOriginalChars * 100)
      : 0;

    console.log('\n📈 OVERVIEW STATISTICS');
    console.log('─'.repeat(30));
    console.log(`Total Sessions Processed: ${this.stats.totalSessions}`);
    console.log(`Average OCR Confidence: ${this.stats.averageConfidence.toFixed(1)}%`);
    console.log(`Total Characters Before: ${this.stats.totalOriginalChars.toLocaleString()}`);
    console.log(`Total Characters After: ${this.stats.totalCleanedChars.toLocaleString()}`);
    console.log(`Overall Text Reduction: ${totalReduction.toFixed(1)}%`);
  }

  /**
   * Display content type breakdown
   */
  displayContentTypeBreakdown() {
    console.log('\n📄 CONTENT TYPE BREAKDOWN');
    console.log('─'.repeat(30));

    const sortedTypes = Object.entries(this.stats.contentTypes)
      .sort(([,a], [,b]) => b - a);

    for (const [type, count] of sortedTypes) {
      const percentage = (count / this.stats.totalSessions * 100).toFixed(1);
      console.log(`${type.padEnd(15)} ${count.toString().padStart(3)} (${percentage}%)`);
    }
  }

  /**
   * Display cleaning effectiveness
   */
  displayCleaningEffectiveness() {
    console.log('\n🧹 CLEANING EFFECTIVENESS');
    console.log('─'.repeat(30));

    const effectivenessOrder = ['excellent', 'good', 'fair', 'poor', 'very_poor', 'unknown'];
    const effectivenessEmojis = {
      excellent: '🟢',
      good: '🟡',
      fair: '🟠',
      poor: '🔴',
      very_poor: '🔴',
      unknown: '⚪'
    };

    for (const effectiveness of effectivenessOrder) {
      const count = this.stats.effectivenessDistribution[effectiveness] || 0;
      if (count > 0) {
        const percentage = (count / this.stats.totalSessions * 100).toFixed(1);
        const emoji = effectivenessEmojis[effectiveness] || '⚪';
        console.log(`${emoji} ${effectiveness.padEnd(12)} ${count.toString().padStart(3)} (${percentage}%)`);
      }
    }
  }

  /**
   * Display quality metrics
   */
  displayQualityMetrics() {
    if (this.stats.qualityScores.length === 0) return;

    const avgQuality = this.stats.qualityScores.reduce((a, b) => a + b, 0) / this.stats.qualityScores.length;
    const avgReduction = this.stats.reductionRatios.reduce((a, b) => a + b, 0) / this.stats.reductionRatios.length;

    console.log('\n📊 QUALITY METRICS');
    console.log('─'.repeat(30));
    console.log(`Average Quality Score: ${avgQuality.toFixed(2)} / 1.0`);
    console.log(`Average Text Reduction: ${avgReduction.toFixed(1)}%`);

    // Quality score distribution
    const qualityRanges = {
      'Excellent (0.8-1.0)': this.stats.qualityScores.filter(s => s >= 0.8).length,
      'Good (0.6-0.8)': this.stats.qualityScores.filter(s => s >= 0.6 && s < 0.8).length,
      'Fair (0.4-0.6)': this.stats.qualityScores.filter(s => s >= 0.4 && s < 0.6).length,
      'Poor (0.0-0.4)': this.stats.qualityScores.filter(s => s < 0.4).length
    };

    console.log('\nQuality Score Distribution:');
    for (const [range, count] of Object.entries(qualityRanges)) {
      if (count > 0) {
        const percentage = (count / this.stats.qualityScores.length * 100).toFixed(1);
        console.log(`  ${range}: ${count} (${percentage}%)`);
      }
    }
  }

  /**
   * Display problem sessions
   */
  displayProblemSessions() {
    if (this.stats.problemSessions.length === 0) {
      console.log('\n✅ PROBLEM SESSIONS');
      console.log('─'.repeat(30));
      console.log('No problem sessions detected! 🎉');
      return;
    }

    console.log('\n⚠️ PROBLEM SESSIONS');
    console.log('─'.repeat(30));
    console.log(`Found ${this.stats.problemSessions.length} sessions with issues:\n`);

    // Show top 5 most problematic sessions
    const topProblems = this.stats.problemSessions
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 5);

    for (const [index, session] of topProblems.entries()) {
      console.log(`${index + 1}. Session: ${session.sessionId.slice(-8)}`);
      console.log(`   Time: ${session.timestamp}`);
      console.log(`   Quality: ${session.qualityScore.toFixed(2)}, Reduction: ${session.reductionPercentage.toFixed(1)}%`);
      console.log(`   Type: ${session.contentType}`);
      if (session.suggestions.length > 0) {
        console.log(`   Issue: ${session.suggestions[0]}`);
      }
      console.log('');
    }

    if (this.stats.problemSessions.length > 5) {
      console.log(`... and ${this.stats.problemSessions.length - 5} more problem sessions`);
    }
  }

  /**
   * Display recommendations
   */
  displayRecommendations() {
    console.log('\n💡 RECOMMENDATIONS');
    console.log('─'.repeat(30));

    const recommendations = [];
    const avgQuality = this.stats.qualityScores.length > 0
      ? this.stats.qualityScores.reduce((a, b) => a + b, 0) / this.stats.qualityScores.length
      : 0;
    const avgReduction = this.stats.reductionRatios.length > 0
      ? this.stats.reductionRatios.reduce((a, b) => a + b, 0) / this.stats.reductionRatios.length
      : 0;

    if (avgQuality < 0.5) {
      recommendations.push('🔧 Overall quality is low - consider adjusting OCR cleaning parameters');
    }

    if (avgReduction > 70) {
      recommendations.push('✂️ High text reduction rate - verify important content is preserved');
    }

    const poorCount = this.stats.effectivenessDistribution.poor || 0;
    const veryPoorCount = this.stats.effectivenessDistribution.very_poor || 0;
    const problemRatio = (poorCount + veryPoorCount) / this.stats.totalSessions;

    if (problemRatio > 0.2) {
      recommendations.push('📊 High rate of poor cleaning - review content type detection');
    }

    if (this.stats.averageConfidence < 70) {
      recommendations.push('📷 Low OCR confidence - consider image preprocessing improvements');
    }

    // Content-specific recommendations
    const unknownContentRatio = (this.stats.contentTypes.unknown || 0) / this.stats.totalSessions;
    if (unknownContentRatio > 0.3) {
      recommendations.push('🔍 Many sessions with unknown content type - improve auto-detection');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ OCR text cleaning is working well! Keep up the good work!');
    }

    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📁 Detailed logs available in: ' + this.logDir);
    console.log('═'.repeat(60));
  }
}

// Main execution
async function main() {
  const days = parseInt(process.argv[2]) || 7;
  const analyzer = new OCRLogAnalyzer();
  await analyzer.analyze(days);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = OCRLogAnalyzer;
