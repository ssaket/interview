class LLMFriendlyOCRCleaner {
  constructor() {
    // Only remove the most obvious UI junk
    this.junkPatterns = [
      // Single characters or meaningless punctuation lines
      /^[a-z]$/i,
      /^[0-9]$/,
      /^[|\\\/\-=_+\[\]{}()<>,.;:'"!@#$%^&*`~]+$/,

      // Time stamps and system indicators
      /^\s*\d{1,2}:\d{2}\s*(am|pm)$/i,
      /^\s*\d{1,3}%$/i,

      // Very obvious system UI elements
      /^\s*Wi-?Fi$/i,
      /^\s*Bluetooth$/i,

      // Only the most common menu items that never contain useful content
      /^\s*(file|edit|view|window|help)$/i,
      /^\s*(copy|paste|cut|undo|redo)$/i,
    ];
  }

  /**
   * Simple cleaning function - only removes obvious junk, preserves everything else
   * @param {string} rawText - Raw OCR text
   * @param {Object} options - Cleaning options (simplified)
   * @returns {string} - Cleaned text
   */
  cleanText(rawText, options = {}) {
    const {
      minLineLength = 1, // Very permissive - only remove empty lines
      removeEmptyLines = true,
      logResults = false,
    } = options;

    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    // Split into lines and basic cleanup
    let lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        // Only remove if completely empty or below minimum length
        if (removeEmptyLines && line.length === 0) return false;
        if (line.length < minLineLength) return false;
        return true;
      });

    // Remove only the most obvious junk patterns
    const cleanedLines = lines.filter((line) => {
      // Check if line matches any obvious junk pattern
      const isJunk = this.junkPatterns.some((pattern) => pattern.test(line));
      return !isJunk;
    });

    const cleanedText = cleanedLines.join('\n');

    if (logResults) {
      this.logResults(rawText, cleanedText);
    }

    return cleanedText;
  }

  /**
   * Get quality metrics for the cleaned text
   */
  getQualityMetrics(originalText, cleanedText) {
    const originalLines = originalText.split('\n').filter((l) => l.trim().length > 0);
    const cleanedLines = cleanedText.split('\n').filter((l) => l.trim().length > 0);

    return {
      originalLineCount: originalLines.length,
      cleanedLineCount: cleanedLines.length,
      reductionPercentage: Math.round((1 - cleanedLines.length / originalLines.length) * 100),
      originalLength: originalText.length,
      cleanedLength: cleanedText.length,
      lengthReduction: Math.round((1 - cleanedText.length / originalText.length) * 100),
    };
  }

  /**
   * Log simple results for analysis
   */
  logResults(originalText, cleanedText) {
    console.log('\n🚀 SIMPLE OCR CLEANING RESULTS');
    console.log('==============================');

    const metrics = this.getQualityMetrics(originalText, cleanedText);

    console.log(`📊 Processing Summary:`);
    console.log(
      `   Lines: ${metrics.originalLineCount} → ${metrics.cleanedLineCount} (${metrics.reductionPercentage}% reduction)`
    );
    console.log(
      `   Length: ${metrics.originalLength} → ${metrics.cleanedLength} (${metrics.lengthReduction}% reduction)`
    );

    console.log(`\n✨ CLEANED TEXT:`);
    const lines = cleanedText.split('\n');
    lines.forEach((line, i) => {
      console.log(`   ${i + 1}. "${line}"`);
    });

    console.log('==============================\n');
  }

  /**
   * Quick check if text has any content worth processing
   */
  isLLMWorthy(text) {
    if (!text || text.length < 3) return false;

    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return lines.length > 0;
  }

  /**
   * Extract key information for LLM context (simple version)
   */
  extractLLMContext(text) {
    const context = {
      questions: [],
      codeBlocks: [],
      technicalConcepts: [],
      examples: [],
    };

    const lines = text.split('\n');

    lines.forEach((line) => {
      // Simple question detection
      if (line.includes('?') || /^(what|how|why|explain|describe|implement)/i.test(line)) {
        context.questions.push(line.trim());
      }

      // Simple code detection
      if (/def |function |class |=|{|}|\(/i.test(line) || /^\s+/.test(line)) {
        context.codeBlocks.push(line.trim());
      }

      // Simple example detection
      if (/example|input:|output:|step/i.test(line) || /^\d+[\.\)]\s+/.test(line)) {
        context.examples.push(line.trim());
      }

      // Basic technical terms
      const technicalWords = [
        'algorithm',
        'array',
        'string',
        'function',
        'complexity',
        'sort',
        'search',
      ];
      technicalWords.forEach((term) => {
        if (line.toLowerCase().includes(term) && !context.technicalConcepts.includes(term)) {
          context.technicalConcepts.push(term);
        }
      });
    });

    return context;
  }
}

module.exports = LLMFriendlyOCRCleaner;
