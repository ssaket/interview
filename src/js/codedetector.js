/**
 * CodeDetector - Extract code content from text using DeepSeekFormatter patterns
 *
 * This module provides robust code detection and extraction functionality
 * based on the patterns used in DeepSeekFormatter for superior code recognition.
 */

class CodeDetector {
  /**
   * Extract code content from text using DeepSeekFormatter patterns
   * @param {string} content - The content to extract code from
   * @returns {string} Extracted code content
   */
  static extractCodeFromContent(content) {
    if (!content) return '';

    // Normalize custom [LANG CODE] headers to standard markdown
    let normalizedContent = content.replace(
      /^\[ *([A-Za-z]+) CODE *\]\s*$/gim,
      (_, lang) => '```' + lang.toLowerCase()
    );

    const codeBlocks = [];

    // Extract fenced code blocks using DeepSeekFormatter regex pattern
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(normalizedContent)) !== null) {
      const codeContent = match[2].trim();
      if (codeContent) {
        codeBlocks.push(codeContent);
      }
    }

    // Extract inline code (`code`) - but be more selective
    const inlineCodeRegex = /`([^`\n]+)`/g;
    const inlineMatches = [];

    while ((match = inlineCodeRegex.exec(normalizedContent)) !== null) {
      const code = match[1].trim();
      // Only include inline code that looks substantial (not just single words)
      if (
        code.length > 3 &&
        (code.includes('(') || code.includes('.') || code.includes('=') || code.includes(';'))
      ) {
        inlineMatches.push(code);
      }
    }

    // Add inline code if we have substantial pieces
    if (inlineMatches.length > 0) {
      codeBlocks.push(...inlineMatches);
    }

    // Extract indented code blocks (4+ spaces) with better detection
    const lines = normalizedContent.split('\n');
    let currentBlock = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isIndented = line.match(/^ {4}\S/);
      const isEmpty = line.trim() === '';

      if (isIndented) {
        currentBlock.push(line.replace(/^ {4}/, ''));
        inCodeBlock = true;
      } else if (isEmpty && inCodeBlock) {
        // Allow empty lines within code blocks
        currentBlock.push('');
      } else {
        // End of code block
        if (currentBlock.length > 0) {
          const blockContent = currentBlock.join('\n').trim();
          // Only include if it looks like actual code (has special chars)
          if (
            blockContent &&
            (blockContent.includes('{') ||
              blockContent.includes('=') ||
              blockContent.includes(';') ||
              blockContent.includes('('))
          ) {
            codeBlocks.push(blockContent);
          }
          currentBlock = [];
          inCodeBlock = false;
        }
      }
    }

    // Handle final block
    if (currentBlock.length > 0) {
      const blockContent = currentBlock.join('\n').trim();
      if (
        blockContent &&
        (blockContent.includes('{') ||
          blockContent.includes('=') ||
          blockContent.includes(';') ||
          blockContent.includes('('))
      ) {
        codeBlocks.push(blockContent);
      }
    }

    return codeBlocks.filter((block) => block.trim()).join('\n\n');
  }

  /**
   * Check if content contains code blocks or inline code
   * @param {string} content - The content to check
   * @returns {boolean} True if content contains code
   */
  static hasCode(content) {
    if (!content) return false;

    // Check for fenced code blocks
    if (content.includes('```')) return true;

    // Check for inline code with substantial content
    const inlineCodeRegex = /`([^`\n]+)`/g;
    let match;
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      const code = match[1].trim();
      if (
        code.length > 3 &&
        (code.includes('(') || code.includes('.') || code.includes('=') || code.includes(';'))
      ) {
        return true;
      }
    }

    // Check for indented code blocks
    const lines = content.split('\n');
    for (const line of lines) {
      if (
        line.match(/^ {4}\S/) &&
        (line.includes('{') || line.includes('=') || line.includes(';') || line.includes('('))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract specific types of code blocks
   * @param {string} content - The content to extract from
   * @param {string} language - Language to filter (optional)
   * @returns {Array<Object>} Array of code blocks with metadata
   */
  static extractCodeBlocksByLanguage(content, language = null) {
    if (!content) return [];

    const normalizedContent = content.replace(
      /^\[ *([A-Za-z]+) CODE *\]\s*$/gim,
      (_, lang) => '```' + lang.toLowerCase()
    );
    const codeBlocks = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(normalizedContent)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();

      if (code && (!language || lang.toLowerCase() === language.toLowerCase())) {
        codeBlocks.push({
          language: lang,
          code: code,
          type: 'fenced',
        });
      }
    }

    return codeBlocks;
  }
}

module.exports = CodeDetector;
