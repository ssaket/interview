const natural = require('natural');

// === Configuration constants ===
const MIN_LINE_LENGTH = 2;
const MAX_LINES = 50;
const SCORE_THRESHOLD_HIGH = 0.25;
const SCORE_THRESHOLD_LOW = 0.15;

// Confidence-based filtering
const CONFIDENCE_THRESHOLD = 0.6; // default minimum line confidence

class LLMFriendlyOCRCleaner {
  constructor() {
    // Initialize NLP components
    this.tokenizer = new natural.WordTokenizer();

    // Common UI junk patterns to remove
    this.junkPatterns = [
      // Browser/OS UI
      /^\s*(file|edit|view|window|help|about|quit|exit)$/i,
      /^\s*(chrome|firefox|safari|edge|browser)$/i,
      /^\s*(back|forward|reload|refresh|home|bookmark)$/i,
      /^\s*(new tab|close tab|duplicate tab)$/i,
      /^\s*(copy|paste|cut|undo|redo|select all)$/i,
      /^\s*(finder|explorer|desktop|trash|recycle)$/i,
      /^\s*(settings|preferences|options|configure)$/i,

      // System indicators
      /^\s*\d{1,2}:\d{2}\s*(am|pm)$/i,
      /^\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
      /^\s*\d{1,3}%$/i,
      /^\s*(wifi|bluetooth|battery|charging)$/i,
      /^\s*(notification|alert|message|reminder)$/i,
      /^\s*(minimize|maximize|close|resize)$/i,

      // App names and development tools
      /^\s*(vs code|visual studio|atom|sublime|notepad)$/i,
      /^\s*(terminal|console|command prompt|powershell)$/i,
      /^\s*(debug|debugger|inspector|profiler)$/i,
      /^\s*(git|github|gitlab|bitbucket)$/i,

      // Single characters or short meaningless strings
      /^[a-z]$/i,
      /^[0-9]$/,
      /^[|\\\/\-=_+\[\]{}()<>,.;:'"!@#$%^&*`~]+$/,
      /^\s*[|\\\/\-=_]{3,}\s*$/,

      // URL patterns
      /^https?:\/\//i,
      /^\w+\.(com|org|net|edu|gov)$/i,

      // Mac menu-bar & system artifacts
      /^\s*/i,
      /^\s*\d+%$/i, // Battery percentage
      /^\s*Wi-?Fi$/i,
      /^\s*Bluetooth$/i,
      /^\s*(Siri|Spotlight)$/i,
      /^\s*\d+% \d+°[CF]$/i, // e.g. "75% 72°F"
    ];

    // Patterns that indicate valuable content
    this.valuePatterns = [
      // Questions (formal and informal)
      /^(what|how|why|when|where|which|who|can|should|would|could|is|are|do|does|did)\b/i,
      /\?$/,
      /\b(explain|describe|implement|write|create|design|solve|find|calculate|determine|optimize|analyze)\b/i,

      // Notepad-style questions and prompts
      /^\d+[\.\)]\s*/, // Numbered lists (1. or 1))
      /^[-*•]\s*/, // Bullet points
      /^(step|note|example|solution|answer|explanation):/i,
      /\b(let's|try|consider|suppose|assume|think about)\b/i,

      // Code patterns
      /^\s*(def|function|class|if|for|while|return|import|from|const|let|var)\b/i,
      /\w+\s*=\s*\w+/,
      /\w+\.\w+\(/,
      /\w+\[[^\]]*\]/,
      /[{}();]/,
      /^\s{2,}/, // Indented code
      /O\s*\(\s*[^)]+\s*\)/, // Big O notation
      /^(>>>|\$|>)\s+/, // Command line prompts
      /^(print|console\.log|System\.out)\s*\(/, // Output statements

      // Technical content
      /\b(algorithm|complexity|array|string|integer|boolean|object|function|method|class|variable)\b/i,
      /\b(time|space|memory|runtime|performance|efficiency)\b/i,
      /\b(sort|search|merge|quick|bubble|insertion|selection|binary|linear|logarithmic)\b/i,
      /\b(stack|queue|tree|graph|hash|map|set|list|heap|linked)\b/i,
      /\b(recursive|iterative|dynamic|greedy|divide|conquer)\b/i,

      // Programming languages and concepts
      /\b(python|javascript|java|cpp|c\+\+|html|css|sql|react|node)\b/i,
      /\b(leetcode|hackerrank|codility|interview|problem|solution|example)\b/i,
    ];

    // Problem description patterns (including notepad-style)
    this.problemPatterns = [
      /^given\b/i,
      /\breturn\s+(the|an?|indices|values?|result)\b/i,
      /\byou\s+(may|must|should|can|need)\b/i,
      /\binput:|output:|example\s*\d*:/i,
      /\bassume\s+that\b/i,
      /\bfind\s+(the|all|any)\b/i,
      /\bdetermine\s+(if|whether|the)\b/i,

      // Notepad-style patterns
      /^(problem|task|exercise|challenge):/i,
      /^(here's|here are|let me show you)\b/i,
      /\b(for instance|for example|such as|like this)\b/i,
      /^(step \d+|first|second|third|finally|lastly)\b/i,
      /\b(walkthrough|approach|method|technique)\b/i,
      /^(note|important|remember):/i,
    ];

    // Common OCR errors (conservative corrections only)
    this.simpleOCRFixes = new Map([
      // Only fix obvious, common OCR mistakes
      ['rn', 'm'],
      ['cl', 'd'],
      ['0o', 'oo'],
      ['1l', 'll'],
      ['5s', 'ss'],
    ]);

    // Notepad-style content indicators
    this.notepadPatterns = [
      /^\d+[\.\)]\s+/, // Numbered lists
      /^[-*•]\s+/, // Bullet points
      /^(step|note|example|solution|answer):/i,
      /\b(walkthrough|approach|let's try|here's how)\b/i,
      /^(first|second|third|next|then|finally),?\s/i,
      /\b(explanation|reasoning|because|since|therefore)\b/i,
      /^(input|output|result|expected):/i,
    ];

    // Patterns to catch informal or hand-written prompts without '?'
    this.casualPatterns = [
      /\b(given|find|return|implement|solve)\b/i,
      /\b(how do i|what is|where is|why does)\b/i,
    ];

    // Programming vocabulary for scoring
    this.programmingTerms = new Set([
      'algorithm',
      'array',
      'string',
      'integer',
      'boolean',
      'function',
      'method',
      'class',
      'variable',
      'loop',
      'condition',
      'complexity',
      'time',
      'space',
      'sort',
      'search',
      'tree',
      'graph',
      'stack',
      'queue',
      'hash',
      'binary',
      'linear',
      'logarithmic',
      'recursive',
      'iterative',
      'dynamic',
      'greedy',
    ]);
  }

  /**
   * Main cleaning function optimized for LLM consumption
   * Incorporates: short-circuit junk, configurable thresholds, merged code blocks,
   * context-aware numeric fixes, and new applyNumericOCRFixes logic.
   * @param {string} rawText - Raw OCR text
   * @param {Object} options - Cleaning options
   * @returns {string} - Cleaned, LLM-friendly text
   */
  cleanText(rawText, options = {}) {
    const {
      maxLines = MAX_LINES,
      minLineLength = MIN_LINE_LENGTH,
      preserveQuestions = true,
      preserveCode = true,
      removeJunk = true,
      applyOCRFixes = true,
      applyConfidenceFilter = true,
      confidenceThreshold = CONFIDENCE_THRESHOLD,
      confidenceScores = [],
      logResults = false,
      scoreThresholdHigh = SCORE_THRESHOLD_HIGH,
      scoreThresholdLow = SCORE_THRESHOLD_LOW,
    } = options;

    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    // Split into lines and basic cleanup
    let lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length >= minLineLength);

    // Drop lines below confidence threshold if enabled
    if (
      applyConfidenceFilter &&
      Array.isArray(confidenceScores) &&
      confidenceScores.length === lines.length
    ) {
      lines = lines.filter((_, idx) => confidenceScores[idx] >= confidenceThreshold);
    }

    const originalLineCount = lines.length;

    // Score and filter lines
    const scoredLines = lines.map((line, index) => ({
      line,
      index,
      ...this.scoreLine(line, index, lines),
    }));

    // Apply filtering logic
    let filteredLines = this.filterLines(scoredLines, {
      preserveQuestions,
      preserveCode,
      removeJunk,
      scoreThresholdHigh,
      scoreThresholdLow,
    });

    // Merge adjacent code lines into single blocks
    const mergedLines = [];
    filteredLines.forEach((item) => {
      if (item.isCode) {
        const last = mergedLines[mergedLines.length - 1];
        if (last && last.isCode) {
          last.line += '\n' + item.line;
          return;
        }
      }
      mergedLines.push({ ...item });
    });
    filteredLines = mergedLines;

    // Sort by importance and limit
    filteredLines.sort((a, b) => b.totalScore - a.totalScore);
    if (filteredLines.length > maxLines) {
      filteredLines = filteredLines.slice(0, maxLines);
    }

    // Restore original order
    filteredLines.sort((a, b) => a.index - b.index);

    // Apply OCR fixes: numeric fixes only on non-code lines, conservative only if requested
    let cleanedLines = filteredLines.map((item) => {
      let line = item.line;
      if (applyOCRFixes) {
        // Apply conservative OCR error fixes
        line = this.applyConservativeOCRFixes(line);
      }
      // Apply numeric OCR fixes only on non-code lines
      if (!item.isCode) {
        line = this.applyNumericOCRFixes(line);
      }
      return line;
    });

    const cleanedText = cleanedLines.join('\n');

    if (logResults) {
      this.logResults(rawText, cleanedText, scoredLines, filteredLines);
    }

    // Final pass to remove stray punctuation/whitespace
    return this.postProcess(cleanedText);
  }

  /**
   * Score a line for importance and content type
   */
  scoreLine(line, index, allLines) {
    // Short-circuit: if clearly junk, skip all further checks for performance
    if (this.junkPatterns.some((pattern) => pattern.test(line))) {
      return {
        line,
        index,
        isQuestion: false,
        isProblemDescription: false,
        isCode: false,
        isProgramming: false,
        isJunk: true,
        contentScore: 0,
        contextScore: 0,
        totalScore: 0,
      };
    }
    let scores = {
      isQuestion: false,
      isCode: false,
      isProgramming: false,
      isJunk: false,
      contentScore: 0,
      contextScore: 0,
      totalScore: 0,
    };

    const lowerLine = line.toLowerCase();
    const tokens = this.tokenizer.tokenize(lowerLine) || [];

    // Check if it's a question or problem description
    scores.isQuestion =
      this.valuePatterns.some(
        (pattern) =>
          pattern.test(line) &&
          (line.includes('?') ||
            /^(what|how|why|when|where|which|who|can|should|would|could)\b/i.test(line))
      ) ||
      this.problemPatterns.some((pattern) => pattern.test(line)) ||
      this.notepadPatterns.some((pattern) => pattern.test(line));
    // Also treat casual prompts (no '?') as questions
    scores.isQuestion = scores.isQuestion || this.casualPatterns.some((p) => p.test(line));

    // Check if it's a problem description (valuable instructional content)
    scores.isProblemDescription =
      this.problemPatterns.some((pattern) => pattern.test(line)) ||
      this.notepadPatterns.some((pattern) => pattern.test(line)) ||
      (line.length > 30 &&
        /\b(given|return|find|determine|implement|solve)\b/i.test(line) &&
        /\b(array|string|integer|number|target|element|node|tree|graph)\b/i.test(line)) ||
      // Notepad-style explanatory content
      (line.length > 20 &&
        /\b(explanation|example|approach|method|solution|walkthrough)\b/i.test(line));

    // Check if it's code
    scores.isCode = configLinePattern.test(line) || this.valuePatterns.some(
      (pattern) =>
        pattern.test(line) &&
        (line.includes('def ') ||
          line.includes('function') ||
          line.includes('=') ||
          line.includes('()') ||
          /^\s{2,}/.test(line) ||
          line.includes('{') ||
          line.includes('}'))
    );

    // Check for programming content
    const programmingWords = tokens.filter((token) => this.programmingTerms.has(token)).length;
    scores.isProgramming = programmingWords > 0;

    // Check if it's junk
    scores.isJunk = this.junkPatterns.some((pattern) => pattern.test(line));

    // Calculate content score
    scores.contentScore = this.calculateContentScore(line, tokens);

    // Calculate context score
    scores.contextScore = this.calculateContextScore(line, index, allLines);

    // Calculate total score
    scores.totalScore = this.calculateTotalScore(scores, line);

    return scores;
  }

  /**
   * Calculate content quality score
   */
  calculateContentScore(line, tokens) {
    let score = 0;

    // Length bonus (sweet spot for meaningful content)
    if (line.length >= 10 && line.length <= 300) {
      score += 0.3;
    }

    // Word count bonus
    if (tokens.length >= 3 && tokens.length <= 50) {
      score += 0.2;
    }

    // Technical vocabulary bonus
    const technicalWords = tokens.filter((token) => this.programmingTerms.has(token)).length;
    score += Math.min(technicalWords * 0.15, 0.4);

    // Grammar indicators
    if (/^[A-Z]/.test(line)) score += 0.1; // Starts with capital
    if (/[.!?:]$/.test(line)) score += 0.1; // Proper ending

    // Bonus for sentences with technical content
    if (
      line.length > 20 &&
      /\b(array|string|integer|algorithm|complexity|function|method)\b/i.test(line)
    ) {
      score += 0.2;
    }

    // Bonus for instructional content
    if (/\b(given|return|find|implement|assume|example|input|output)\b/i.test(line)) {
      score += 0.15;
    }

    // Bonus for notepad-style content
    if (this.notepadPatterns.some((pattern) => pattern.test(line))) {
      score += 0.2;
    }

    // Bonus for explanatory text
    if (/\b(because|since|therefore|thus|hence|so|explanation|reason)\b/i.test(line)) {
      score += 0.1;
    }

    // Penalize single words or very short lines
    if (tokens.length <= 1) score -= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  applyNumericOCRFixes(line) {
    // Count letters vs digits
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    const digits = (line.match(/[0-9]/g) || []).length;

    // Only correct if mostly letters (i.e. text lines)
    if (letters > digits) {
      const map = {
        0: 'O',
        1: 'l',
        3: 'E',
        4: 'A',
        5: 'S',
        6: 'G',
        7: 'T',
        8: 'B',
        9: 'g',
      };
      return line.replace(/[013456789]/g, (ch) => map[ch] || ch);
    }
    // Otherwise leave code/numeric lines alone
    return line;
  }

  /**
   * Calculate contextual importance score
   */
  calculateContextScore(line, index, allLines) {
    let score = 0;

    // Position bonus for content near questions or code
    for (let i = Math.max(0, index - 2); i <= Math.min(allLines.length - 1, index + 2); i++) {
      if (i === index) continue;

      const nearbyLine = allLines[i];
      if (
        nearbyLine.includes('?') ||
        nearbyLine.includes('def ') ||
        nearbyLine.includes('function') ||
        /^(what|how|why|explain|implement)/i.test(nearbyLine)
      ) {
        score += 0.1;
      }
    }

    return Math.min(0.3, score);
  }

  /**
   * Calculate final total score
   */
  calculateTotalScore(scores, line) {
    let total = 0;

    // Base content score
    total += scores.contentScore * 0.4;

    // Content type bonuses
    if (scores.isQuestion) total += 0.4;
    if (scores.isProblemDescription) total += 0.35;
    if (scores.isCode) total += 0.3;
    if (scores.isProgramming) total += 0.2;

    // Context bonus
    total += scores.contextScore * 0.1;

    // Junk penalty
    if (scores.isJunk) total -= 0.5;

    // Special patterns
    if (line.includes('O(') || line.includes('complexity')) total += 0.25;
    if (line.includes('Example') || line.includes('Input:') || line.includes('Output:'))
      total += 0.2;

    // Bonus for longer meaningful sentences
    if (line.length > 50 && scores.contentScore > 0.4) total += 0.1;

    return Math.max(0, Math.min(1, total));
  }

  /**
   * Filter lines based on scores and preferences
   */
  filterLines(scoredLines, options) {
    const { preserveQuestions, preserveCode, removeJunk } = options;

    return scoredLines.filter((item) => {
      // Always remove clear junk
      if (removeJunk && item.isJunk && item.totalScore < 0.15) {
        return false;
      }

      // Always keep questions and problem descriptions
      if (
        preserveQuestions &&
        (item.isQuestion || item.isProblemDescription) &&
        item.totalScore > 0.25
      ) {
        return true;
      }

      // Always keep code with lower threshold
      if (preserveCode && (item.isCode || item.isProgramming) && item.totalScore > 0.15) {
        return true;
      }

      // Keep content with good overall score
      if (item.totalScore >= 0.25) {
        return true;
      }

      // Keep short but meaningful technical lines
      if (item.line.length < 50 && item.contentScore > 0.4) {
        return true;
      }

      return false;
    });
  }

  /**
   * Apply conservative OCR error fixes
   */
  applyConservativeOCRFixes(line) {
    let fixed = line;

    // Only apply very safe, common fixes
    for (const [error, correction] of this.simpleOCRFixes) {
      // Be very conservative - only fix if it creates a known word
      const pattern = new RegExp(`\\b${error}\\b`, 'gi');
      if (pattern.test(fixed)) {
        const testFix = fixed.replace(pattern, correction);
        // Only apply if the result looks better (basic heuristic)
        if (
          testFix.length >= fixed.length - 1 &&
          testFix.split(' ').length >= fixed.split(' ').length
        ) {
          fixed = testFix;
        }
      }
    }

    return fixed;
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
      questionsPreserved: (cleanedText.match(/\?/g) || []).length,
      codeBlocksPreserved: (cleanedText.match(/def |function |class |=/g) || []).length,
      technicalTermsPreserved: Array.from(this.programmingTerms).filter((term) =>
        cleanedText.toLowerCase().includes(term)
      ).length,
    };
  }

  /**
   * Log detailed results for analysis
   */
  logResults(originalText, cleanedText, scoredLines, filteredLines) {
    console.log('\n🚀 LLM-FRIENDLY OCR CLEANING RESULTS');
    console.log('====================================');

    const metrics = this.getQualityMetrics(originalText, cleanedText);

    console.log(`📊 Processing Summary:`);
    console.log(
      `   Lines: ${metrics.originalLineCount} → ${metrics.cleanedLineCount} (${metrics.reductionPercentage}% reduction)`
    );
    console.log(
      `   Length: ${metrics.originalLength} → ${metrics.cleanedLength} (${metrics.lengthReduction}% reduction)`
    );
    console.log(`   Questions preserved: ${metrics.questionsPreserved}`);
    console.log(`   Code blocks preserved: ${metrics.codeBlocksPreserved}`);
    console.log(`   Technical terms preserved: ${metrics.technicalTermsPreserved}`);

    console.log(`\n🎯 TOP SCORING LINES:`);
    filteredLines
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10)
      .forEach((item, i) => {
        const flags = [];
        if (item.isQuestion) flags.push('QUESTION');
        if (item.isCode) flags.push('CODE');
        if (item.isProgramming) flags.push('PROGRAMMING');
        if (item.isJunk) flags.push('JUNK');

        console.log(
          `  ${i + 1}. [Score: ${item.totalScore.toFixed(3)}] [${flags.join(', ') || 'CONTENT'}]`
        );
        console.log(`     "${item.line}"`);
      });

    console.log(`\n✨ FINAL CLEANED TEXT:`);
    const lines = cleanedText.split('\n');
    lines.forEach((line, i) => {
      console.log(`   ${i + 1}. "${line}"`);
    });

    console.log('====================================\n');
  }

  /**
   * Quick check if text is likely to be meaningful for LLM processing
   */
  isLLMWorthy(text) {
    if (!text || text.length < 10) return false;

    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return false;

    // Check for questions, code, or technical content
    const hasQuestions = text.includes('?') || /^(what|how|why|explain)/i.test(text);
    const hasCode =
      /def |function |class |=/i.test(text) || text.includes('(') || text.includes('{');
    const hasTechnical = Array.from(this.programmingTerms).some((term) =>
      text.toLowerCase().includes(term)
    );

    return hasQuestions || hasCode || hasTechnical;
  }

  /**
   * Extract key information for LLM context
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
      if (
        line.includes('?') ||
        /^(what|how|why|explain|describe|implement)/i.test(line) ||
        this.notepadPatterns.some((pattern) => pattern.test(line))
      ) {
        context.questions.push(line.trim());
      }

      if (
        /def |function |class |=/i.test(line) ||
        /^\s{2,}/.test(line) ||
        /^(>>>|\$|>)\s+/.test(line) ||
        /^(print|console\.log|System\.out)\s*\(/.test(line)
      ) {
        context.codeBlocks.push(line.trim());
      }

      if (
        line.toLowerCase().includes('example') ||
        line.includes('Input:') ||
        line.includes('Output:') ||
        /^(step|note|solution|answer):/i.test(line) ||
        /^\d+[\.\)]\s+/.test(line)
      ) {
        context.examples.push(line.trim());
      }

      // Extract technical terms
      const tokens = this.tokenizer.tokenize(line.toLowerCase()) || [];
      tokens.forEach((token) => {
        if (this.programmingTerms.has(token) && !context.technicalConcepts.includes(token)) {
          context.technicalConcepts.push(token);
        }
      });
    });

    return context;
  }

  /**
   * Final cleanup: trim stray punctuation and normalize whitespace
   * @param {string} text
   * @returns {string}
   */
  postProcess(text) {
    return (
      text
        // Remove leading/trailing punctuation or dashes on each line
        .split('\n')
        .map((line) => line.replace(/^[\s\.\-–—]+|[\s\.\-–—]+$/g, '').trim())
        .filter((line) => line.length > 0)
        .join('\n')
        // Normalize multiple spaces to single
        .replace(/ {2,}/g, ' ')
    );
  }
}

module.exports = LLMFriendlyOCRCleaner;
