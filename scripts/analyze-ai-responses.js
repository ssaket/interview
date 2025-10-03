#!/usr/bin/env node

/**
 * AI Response Analysis Script
 *
 * Analyzes logged AI responses to identify patterns and help improve the formatter.
 *
 * Usage:
 *   node scripts/analyze-ai-responses.js [days]
 *   node scripts/analyze-ai-responses.js 7    # Analyze last 7 days (default)
 *   node scripts/analyze-ai-responses.js 30   # Analyze last 30 days
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs', 'ai-responses');

/**
 * Get date N days ago
 * @param {number} daysAgo
 * @returns {string} Date in YYYY-MM-DD format
 */
function getDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

/**
 * Get all log files within date range
 * @param {number} days
 * @returns {Array<string>} Array of log file paths
 */
function getLogFilesInRange(days) {
  if (!fs.existsSync(LOGS_DIR)) {
    console.error(`❌ Logs directory not found: ${LOGS_DIR}`);
    process.exit(1);
  }

  const cutoffDate = getDateDaysAgo(days);
  const files = fs
    .readdirSync(LOGS_DIR)
    .filter((file) => file.endsWith('.jsonl'))
    .filter((file) => {
      const fileDate = file.replace('.jsonl', '');
      return fileDate >= cutoffDate;
    })
    .map((file) => path.join(LOGS_DIR, file));

  return files;
}

/**
 * Parse all entries from log files
 * @param {Array<string>} files
 * @returns {Array<Object>} Array of log entries
 */
function parseLogFiles(files) {
  const entries = [];

  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    lines.forEach((line) => {
      try {
        entries.push(JSON.parse(line));
      } catch (error) {
        console.error(`⚠️  Failed to parse line in ${file}:`, error.message);
      }
    });
  });

  return entries;
}

/**
 * Analyze entries and generate statistics
 * @param {Array<Object>} entries
 * @returns {Object} Analysis results
 */
function analyzeEntries(entries) {
  const analysis = {
    totalResponses: entries.length,
    byProvider: {},
    byModel: {},
    byInterviewType: {},
    byFlowType: {},
    errors: 0,
    responseLengths: {
      min: Number.MAX_SAFE_INTEGER,
      max: 0,
      avg: 0,
      total: 0,
    },
    markdownPatterns: {
      codeBlocks: 0,
      headers: 0,
      lists: 0,
      tables: 0,
      mathFormulas: 0,
    },
    commonStructures: {},
  };

  entries.forEach((entry) => {
    // By provider
    analysis.byProvider[entry.provider] = (analysis.byProvider[entry.provider] || 0) + 1;

    // By model
    analysis.byModel[entry.model] = (analysis.byModel[entry.model] || 0) + 1;

    // By interview type
    analysis.byInterviewType[entry.interviewType] =
      (analysis.byInterviewType[entry.interviewType] || 0) + 1;

    // By flow type
    if (entry.flowType) {
      analysis.byFlowType[entry.flowType] = (analysis.byFlowType[entry.flowType] || 0) + 1;
    }

    // Errors
    if (entry.isError) {
      analysis.errors++;
    }

    // Response lengths
    const length = entry.responseLength || entry.response.length;
    analysis.responseLengths.min = Math.min(analysis.responseLengths.min, length);
    analysis.responseLengths.max = Math.max(analysis.responseLengths.max, length);
    analysis.responseLengths.total += length;

    // Markdown patterns
    if (entry.response && !entry.isError) {
      if (entry.response.match(/```/g)) {
        analysis.markdownPatterns.codeBlocks++;
      }
      if (entry.response.match(/^#{1,6}\s/gm)) {
        analysis.markdownPatterns.headers++;
      }
      if (entry.response.match(/^\s*[-*+]\s/gm)) {
        analysis.markdownPatterns.lists++;
      }
      if (entry.response.match(/\|.*\|/gm)) {
        analysis.markdownPatterns.tables++;
      }
      if (entry.response.match(/\$\$/g) || entry.response.match(/\$[^$]+\$/g)) {
        analysis.markdownPatterns.mathFormulas++;
      }

      // Extract numbered sections (e.g., "1. Section Name")
      const numberedSections = entry.response.match(/^\d+\.\s+([^\n]+)/gm);
      if (numberedSections) {
        numberedSections.forEach((section) => {
          analysis.commonStructures[section] = (analysis.commonStructures[section] || 0) + 1;
        });
      }
    }
  });

  // Calculate average
  analysis.responseLengths.avg =
    entries.length > 0 ? Math.round(analysis.responseLengths.total / entries.length) : 0;

  return analysis;
}

/**
 * Display analysis results
 * @param {Object} analysis
 * @param {number} days
 */
function displayResults(analysis, days) {
  console.log('');
  console.log('🤖 AI RESPONSE ANALYSIS');
  console.log('='.repeat(60));
  console.log(`📅 Analyzing last ${days} days`);
  console.log(`📊 Total Responses: ${analysis.totalResponses}`);
  console.log(`❌ Errors: ${analysis.errors} (${((analysis.errors / analysis.totalResponses) * 100).toFixed(1)}%)`);
  console.log('');

  console.log('📋 By Provider:');
  Object.entries(analysis.byProvider)
    .sort((a, b) => b[1] - a[1])
    .forEach(([provider, count]) => {
      console.log(`  • ${provider}: ${count} (${((count / analysis.totalResponses) * 100).toFixed(1)}%)`);
    });
  console.log('');

  console.log('🤖 By Model:');
  Object.entries(analysis.byModel)
    .sort((a, b) => b[1] - a[1])
    .forEach(([model, count]) => {
      console.log(`  • ${model}: ${count} (${((count / analysis.totalResponses) * 100).toFixed(1)}%)`);
    });
  console.log('');

  console.log('🎯 By Interview Type:');
  Object.entries(analysis.byInterviewType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  • ${type}: ${count} (${((count / analysis.totalResponses) * 100).toFixed(1)}%)`);
    });
  console.log('');

  if (Object.keys(analysis.byFlowType).length > 0) {
    console.log('⚡ By Flow Type:');
    Object.entries(analysis.byFlowType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  • ${type}: ${count} (${((count / analysis.totalResponses) * 100).toFixed(1)}%)`);
      });
    console.log('');
  }

  console.log('📏 Response Lengths:');
  console.log(`  • Min: ${analysis.responseLengths.min} chars`);
  console.log(`  • Max: ${analysis.responseLengths.max} chars`);
  console.log(`  • Avg: ${analysis.responseLengths.avg} chars`);
  console.log('');

  console.log('✍️  Markdown Patterns:');
  console.log(`  • Code blocks: ${analysis.markdownPatterns.codeBlocks} responses`);
  console.log(`  • Headers: ${analysis.markdownPatterns.headers} responses`);
  console.log(`  • Lists: ${analysis.markdownPatterns.lists} responses`);
  console.log(`  • Tables: ${analysis.markdownPatterns.tables} responses`);
  console.log(`  • Math formulas: ${analysis.markdownPatterns.mathFormulas} responses`);
  console.log('');

  console.log('🔍 Most Common Structures (Top 10):');
  const topStructures = Object.entries(analysis.commonStructures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topStructures.length > 0) {
    topStructures.forEach(([structure, count]) => {
      console.log(`  • ${structure.trim()}: ${count}x`);
    });
  } else {
    console.log('  (No numbered sections found)');
  }
  console.log('');

  console.log('💡 Recommendations for Formatter:');
  console.log('  • Focus on code block extraction (used in most responses)');
  if (analysis.markdownPatterns.headers > analysis.totalResponses * 0.5) {
    console.log('  • Consider header-based section detection');
  }
  if (analysis.markdownPatterns.mathFormulas > 0) {
    console.log('  • Ensure LaTeX formula rendering works properly');
  }
  if (analysis.markdownPatterns.tables > 0) {
    console.log('  • Add table formatting support');
  }
  console.log('');
}

/**
 * Main function
 */
function main() {
  const days = parseInt(process.argv[2]) || 7;

  console.log(`🔍 Searching for AI response logs from last ${days} days...`);

  const files = getLogFilesInRange(days);

  if (files.length === 0) {
    console.log('');
    console.log('⚠️  No log files found in the specified range.');
    console.log(`   Expected location: ${LOGS_DIR}`);
    console.log('');
    console.log('💡 Tip: AI responses will be logged automatically when you use the application.');
    process.exit(0);
  }

  console.log(`📁 Found ${files.length} log file(s)`);

  const entries = parseLogFiles(files);

  if (entries.length === 0) {
    console.log('');
    console.log('⚠️  No log entries found.');
    process.exit(0);
  }

  const analysis = analyzeEntries(entries);
  displayResults(analysis, days);
}

// Run the script
main();
