class OCRCleaner {
  constructor() {
    // Common macOS UI junk patterns to filter out
    this.junkPatterns = [
      // Menu bar items
      /^(File|Edit|View|Window|Help|About|Preferences|Settings)$/gi,
      /^(Copy|Paste|Cut|Undo|Redo|Select All)$/gi,

      // Browser UI
      /^(Back|Forward|Reload|Home|Bookmarks|History)$/gi,
      /^(New Tab|Close Tab|Developer Tools)$/gi,

      // Common app names and UI elements
      /^(Finder|Safari|Chrome|Firefox|VS Code|Terminal|Xcode)$/gi,
      /^(Minimize|Maximize|Close|Zoom)$/gi,

      // Time and date patterns
      /^\d{1,2}:\d{2}(\s?(AM|PM))?$/gi,
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/gi,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}\/\d{2,4})$/gi,

      // System notifications and status
      /^(WiFi|Battery|Bluetooth|AirDrop)$/gi,
      /^(Notification|Alert|Warning|Error)$/gi,
      /^\d+%$/g, // Battery percentages

      // URLs and domains (but keep if they seem relevant to coding)
      /^https?:\/\/[^\s]*$/gi,
      /^www\.[^\s]*$/gi,

      // Single characters and very short fragments
      /^[^\w\d]$/g, // Single non-alphanumeric characters
      /^[a-zA-Z]$/g, // Single letters
      /^\d$/g, // Single digits

      // Common OCR artifacts
      /^[|\\\/\-_=+\[\]{}().,;:'"]*$/g, // Lines of special characters
      /^[•·▪▫■□▲△▼▽◆◇○●]+$/g, // Bullet points and symbols
    ];

    // Patterns that indicate likely coding content (should be preserved)
    this.codingPatterns = [
      // Programming keywords
      /\b(function|class|def|var|let|const|if|else|for|while|return|import|export|from|async|await)\b/gi,

      // Code structures
      /[{}[\]();]/g, // Brackets, braces, parentheses
      /\w+\([^)]*\)/g, // Function calls
      /\w+\.\w+/g, // Object.method or similar
      /\w+\[\w*\]/g, // Array access

      // Programming languages
      /\b(python|javascript|java|cpp|c\+\+|html|css|sql|bash|shell|git)\b/gi,

      // Technical terms
      /\b(algorithm|complexity|array|string|integer|boolean|null|undefined|true|false)\b/gi,
      /\b(time|space|o\(|big\s*o|runtime|memory)\b/gi,

      // Mathematical expressions
      /\b\d+[\+\-\*/]\d+\b/g,
      /\b(log|sqrt|pow|max|min|sum)\b/gi,
    ];

    // Question indicators (should be preserved)
    this.questionPatterns = [
      /^(what|how|why|when|where|which|who|can|should|would|could|is|are|do|does|did)/gi,
      /\?$/g, // Ends with question mark
      /\b(solve|find|implement|write|create|design|optimize|explain|calculate)\b/gi,
    ];
  }

  /**
   * Clean OCR text by removing junk and irrelevant content
   * @param {string} rawText - Raw OCR output
   * @param {Object} options - Cleaning options
   * @returns {string} - Cleaned text
   */
  cleanText(rawText, options = {}) {
    const {
      minLineLength = 3,
      maxLines = 50,
      preserveCoding = true,
      preserveQuestions = true,
      removeCommonUI = true,
      confidenceThreshold = 0.6 // Not used yet, for future Tesseract confidence integration
    } = options;

    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    // Split into lines and process each line
    let lines = rawText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Remove obviously junk lines
    if (removeCommonUI) {
      lines = this.filterJunkLines(lines);
    }

    // Filter by line characteristics
    lines = lines.filter(line => {
      // Keep if it looks like coding content
      if (preserveCoding && this.looksLikeCoding(line)) {
        return true;
      }

      // Keep if it looks like a question
      if (preserveQuestions && this.looksLikeQuestion(line)) {
        return true;
      }

      // Filter by length
      if (line.length < minLineLength) {
        return false;
      }

      // Filter very long lines that are likely junk
      if (line.length > 200) {
        return false;
      }

      // Keep lines with reasonable word count
      const words = line.split(/\s+/).filter(w => w.length > 0);
      return words.length >= 2 && words.length <= 30;
    });

    // Limit total lines to prevent overwhelming the LLM
    if (lines.length > maxLines) {
      // Try to keep the most relevant lines
      lines = this.selectMostRelevantLines(lines, maxLines);
    }

    // Join and clean up
    let cleanedText = lines.join('\n');

    // Final cleanup
    cleanedText = this.finalCleanup(cleanedText);

    return cleanedText.trim();
  }

  /**
   * Filter out lines that match junk patterns
   */
  filterJunkLines(lines) {
    return lines.filter(line => {
      // Check against all junk patterns
      for (const pattern of this.junkPatterns) {
        if (pattern.test(line)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Check if a line looks like coding content
   */
  looksLikeCoding(line) {
    let score = 0;

    for (const pattern of this.codingPatterns) {
      const matches = line.match(pattern);
      if (matches) {
        score += matches.length;
      }
    }

    // Also check for common code characteristics
    if (/^\s*(#|\/\/|\/\*|\*)/.test(line)) score += 2; // Comments
    if (/^\s*(def|function|class|public|private|protected|static)/.test(line)) score += 3; // Declarations
    if (/[{}[\]();]/.test(line)) score += 1; // Code punctuation
    if (/^\s+/.test(line) && line.length > 10) score += 1; // Indented lines (likely code)

    return score >= 2;
  }

  /**
   * Check if a line looks like a question or problem statement
   */
  looksLikeQuestion(line) {
    for (const pattern of this.questionPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }

    // Additional question indicators
    if (line.includes('?')) return true;
    if (/\b(problem|exercise|challenge|task|question)\b/gi.test(line)) return true;
    if (/\b(given|input|output|return|expected)\b/gi.test(line)) return true;

    return false;
  }

  /**
   * Select the most relevant lines when we have too many
   */
  selectMostRelevantLines(lines, maxLines) {
    // Score each line by relevance
    const scoredLines = lines.map(line => ({
      line,
      score: this.calculateRelevanceScore(line)
    }));

    // Sort by score (highest first) and take top lines
    scoredLines.sort((a, b) => b.score - a.score);

    return scoredLines
      .slice(0, maxLines)
      .map(item => item.line);
  }

  /**
   * Calculate relevance score for a line
   */
  calculateRelevanceScore(line) {
    let score = 0;

    // Coding content gets high score
    if (this.looksLikeCoding(line)) score += 10;

    // Questions get high score
    if (this.looksLikeQuestion(line)) score += 8;

    // Length bonus (moderate length is good)
    if (line.length >= 20 && line.length <= 100) score += 3;
    else if (line.length >= 10 && line.length <= 200) score += 1;

    // Word count bonus
    const words = line.split(/\s+/).length;
    if (words >= 3 && words <= 20) score += 2;

    // Technical terms bonus
    if (/\b(algorithm|function|array|string|integer|complexity|time|space|runtime)\b/gi.test(line)) {
      score += 5;
    }

    // Numbers and formulas
    if (/\d+/.test(line)) score += 1;
    if (/[+\-*/=<>]/.test(line)) score += 1;

    return score;
  }

  /**
   * Final cleanup of the text
   */
  finalCleanup(text) {
    return text
      // Remove excessive whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove trailing spaces
      .replace(/[ \t]+$/gm, '')
      // Fix common OCR character mistakes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/—/g, '-')
      .replace(/…/g, '...')
      // Remove standalone punctuation lines
      .replace(/^\s*[.,:;!?]+\s*$/gm, '')
      // Clean up spacing around common programming characters
      .replace(/\s*([{}[\]();,])\s*/g, '$1 ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Get a summary of what was filtered out (for debugging)
   */
  getFilteringSummary(originalText, cleanedText) {
    const originalLines = originalText.split('\n').filter(l => l.trim());
    const cleanedLines = cleanedText.split('\n').filter(l => l.trim());

    return {
      originalLineCount: originalLines.length,
      cleanedLineCount: cleanedLines.length,
      reductionPercentage: Math.round((1 - cleanedLines.length / originalLines.length) * 100),
      originalLength: originalText.length,
      cleanedLength: cleanedText.length,
      lengthReduction: Math.round((1 - cleanedText.length / originalText.length) * 100)
    };
  }
}

module.exports = OCRCleaner;
