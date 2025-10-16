class InterviewCodeFormatter {
  constructor() {
    // Python code block patterns (strict)
    this.pythonCodeRegex = /```(?:python|py)\n([\s\S]*?)```/g;

    // Interview section patterns
    this.optimizedSectionRegex = /###?\s*(?:Optimized?|Optimal)\s*(?:solution|approach|algorithm)[\s\S]*?(?=###|$)/i;
    this.bruteForceRegex = /###?\s*(?:Brute.?force|Brute.force)\s*(?:reasoning|approach|solution)[\s\S]*?(?=###|$)/i;
    this.exampleSectionRegex = /###?\s*(?:Guided?\s*)?(?:examples?|walkthrough)[\s\S]*?(?=###|$)/i;

    // LaTeX formulas (preserve for browser rendering)
    this.blockMathRegex = /\$\$([^$]+)\$\$/g;
    this.inlineMathRegex = /(?<!\$)\$([^$\n]+)\$(?!\$)/g;

    // Thinking blocks to remove
    this.thinkingRegex = /<think>[\s\S]*?<\/think>/gi;

    // Markdown table detection (header + separator + at least one row)
    this.markdownTableRegex = /(\|.+\|\n\|[\s:|-]+\|\n(?:\|.+\|\n?)+)/g;

    // Minimum code length to consider (filters out tiny snippets)
    this.minCodeLength = 50;
    this.minSignificantLength = 100; // For "main" algorithms
  }

  /**
   * Parse a markdown table into structured data
   * @param {string} tableText - Raw markdown table text
   * @returns {Object} Parsed table with headers, alignments, and rows
   */
  parseTable(tableText) {
    const lines = tableText.trim().split('\n').filter(line => line.trim());

    if (lines.length < 3) {
      return null; // Need at least header, separator, and one data row
    }

    // Parse header row
    const headerLine = lines[0].trim();
    const headers = headerLine.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    // Parse separator row to determine alignments
    const separatorLine = lines[1].trim();
    const separators = separatorLine.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    const alignments = separators.map(sep => {
      const startsWithColon = sep.startsWith(':');
      const endsWithColon = sep.endsWith(':');

      if (startsWithColon && endsWithColon) return 'center';
      if (endsWithColon) return 'right';
      return 'left';
    });

    // Parse data rows
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
      const rowLine = lines[i].trim();
      const cells = rowLine.split('|')
        .map(cell => cell.trim())
        .filter((cell, idx, arr) => {
          // Filter out empty first/last cells from leading/trailing pipes
          return idx > 0 && idx < arr.length - 1 ? true : cell.length > 0;
        });

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    return {
      headers,
      alignments,
      rows,
      columnCount: headers.length
    };
  }

  /**
   * Format a table as ASCII with proper column alignment
   * @param {string} tableText - Raw markdown table text
   * @returns {string} Formatted ASCII table with aligned columns
   */
  formatTableASCII(tableText) {
    const parsed = this.parseTable(tableText);
    if (!parsed) return tableText;

    const { headers, alignments, rows, columnCount } = parsed;

    // Calculate max width for each column
    const columnWidths = headers.map((header, colIdx) => {
      let maxWidth = header.length;

      rows.forEach(row => {
        if (row[colIdx]) {
          // Strip markdown formatting for width calculation
          const plainText = row[colIdx]
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
            .replace(/\*([^*]+)\*/g, '$1')     // Italic
            .replace(/`([^`]+)`/g, '$1');      // Inline code
          maxWidth = Math.max(maxWidth, plainText.length);
        }
      });

      return maxWidth;
    });

    // Helper function to pad cell content based on alignment
    const padCell = (content, width, alignment) => {
      // Strip markdown for length calculation but keep in output
      const plainText = content
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');

      const paddingNeeded = width - plainText.length;

      if (alignment === 'center') {
        const leftPad = Math.floor(paddingNeeded / 2);
        const rightPad = paddingNeeded - leftPad;
        return ' '.repeat(leftPad) + content + ' '.repeat(rightPad);
      } else if (alignment === 'right') {
        return ' '.repeat(paddingNeeded) + content;
      } else { // left
        return content + ' '.repeat(paddingNeeded);
      }
    };

    // Build formatted table
    const lines = [];

    // Header row
    const headerCells = headers.map((header, idx) =>
      padCell(header, columnWidths[idx], alignments[idx])
    );
    lines.push('| ' + headerCells.join(' | ') + ' |');

    // Separator row
    const separatorCells = columnWidths.map((width, idx) => {
      if (alignments[idx] === 'center') {
        return ':' + '-'.repeat(width - 2) + ':';
      } else if (alignments[idx] === 'right') {
        return '-'.repeat(width - 1) + ':';
      } else {
        return '-'.repeat(width);
      }
    });
    lines.push('| ' + separatorCells.join(' | ') + ' |');

    // Data rows
    rows.forEach(row => {
      const cells = row.map((cell, idx) =>
        padCell(cell || '', columnWidths[idx], alignments[idx])
      );
      lines.push('| ' + cells.join(' | ') + ' |');
    });

    return lines.join('\n');
  }

  /**
   * Format a table as HTML with proper styling
   * @param {string} tableText - Raw markdown table text
   * @returns {string} HTML table element
   */
  formatTableHTML(tableText) {
    const parsed = this.parseTable(tableText);
    if (!parsed) return this.escapeHtml(tableText);

    const { headers, alignments, rows } = parsed;

    // Helper to convert markdown formatting in cells
    const formatCellContent = (content) => {
      let formatted = this.escapeHtml(content);
      // Apply markdown formatting
      formatted = formatted
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')             // Italic
        .replace(/`([^`]+)`/g, '<code>$1</code>');          // Inline code
      return formatted;
    };

    let html = '<table class="markdown-table">\n';

    // Header
    html += '  <thead>\n    <tr>\n';
    headers.forEach((header, idx) => {
      const align = alignments[idx];
      html += `      <th style="text-align: ${align}">${formatCellContent(header)}</th>\n`;
    });
    html += '    </tr>\n  </thead>\n';

    // Body
    html += '  <tbody>\n';
    rows.forEach(row => {
      html += '    <tr>\n';
      row.forEach((cell, idx) => {
        const align = alignments[idx];
        html += `      <td style="text-align: ${align}">${formatCellContent(cell || '')}</td>\n`;
      });
      html += '    </tr>\n';
    });
    html += '  </tbody>\n';

    html += '</table>';

    return html;
  }

  /**
   * Extract Python code with interview-aware prioritization
   * @param {string} raw - Raw AI response
   * @param {boolean} formatterEnabled - Enable/disable formatting
   * @param {boolean} codeOnly - Show only code blocks
   * @returns {Object} Formatted result with prioritized Python code
   */
  formatResponse(raw, formatterEnabled = true, codeOnly = true) {
    if (!raw || typeof raw !== 'string') {
      return { text: '', html: '', hasCode: false };
    }

    if (!formatterEnabled) {
      return { text: raw, html: this.escapeHtml(raw), hasCode: false };
    }

    // Remove thinking blocks first
    raw = raw.replace(this.thinkingRegex, '').trim();

    // Wrap markdown tables in code blocks for better display
    raw = this.wrapTablesInCodeBlocks(raw);

    // Extract interview sections
    const sections = this.extractInterviewSections(raw);

    // Extract and prioritize Python code blocks
    const codeBlocks = this.extractPythonCode(raw, sections);

    if (!codeOnly) {
      // Return full formatted content with LaTeX support
      return this.formatFullResponse(raw, codeBlocks);
    }

    // Code-only mode: return prioritized Python algorithms and markdown tables
    const markdownTables = this.extractMarkdownTables(raw);
    return this.formatCodeOnly(codeBlocks, markdownTables);
  }

  /**
   * Extract interview sections based on your 3-phase structure
   */
  extractInterviewSections(text) {
    const sections = {};

    const optimizedMatch = text.match(this.optimizedSectionRegex);
    if (optimizedMatch) {
      sections.optimized = optimizedMatch[0];
    }

    const bruteForceMatch = text.match(this.bruteForceRegex);
    if (bruteForceMatch) {
      sections.bruteForce = bruteForceMatch[0];
    }

    const exampleMatch = text.match(this.exampleSectionRegex);
    if (exampleMatch) {
      sections.examples = exampleMatch[0];
    }

    return sections;
  }

  /**
   * Extract Python code blocks with smart prioritization
   */
  extractPythonCode(text, sections) {
    const codeBlocks = [];
    let match;

    // Reset regex
    this.pythonCodeRegex.lastIndex = 0;

    while ((match = this.pythonCodeRegex.exec(text)) !== null) {
      const code = match[1].trim();

      // Filter out tiny snippets (likely not main algorithms)
      if (code.length < this.minCodeLength) {
        continue;
      }

      // Determine section and priority
      const position = match.index;
      let section = 'unknown';
      let priority = 3;

      // Check which section this code belongs to
      if (sections.optimized) {
        const optStart = text.indexOf(sections.optimized);
        const optEnd = optStart + sections.optimized.length;
        if (position >= optStart && position <= optEnd) {
          section = 'optimized';
          priority = 1; // Highest priority
        }
      }

      if (sections.bruteForce && section === 'unknown') {
        const bruteStart = text.indexOf(sections.bruteForce);
        const bruteEnd = bruteStart + sections.bruteForce.length;
        if (position >= bruteStart && position <= bruteEnd) {
          section = 'bruteForce';
          priority = 2;
        }
      }

      if (sections.examples && section === 'unknown') {
        const exStart = text.indexOf(sections.examples);
        const exEnd = exStart + sections.examples.length;
        if (position >= exStart && position <= exEnd) {
          section = 'examples';
          priority = 4; // Lower priority (examples, not main code)
        }
      }

      // Boost priority for longer, more complete algorithms
      if (code.length >= this.minSignificantLength) {
        priority = Math.max(1, priority - 1);
      }

      // Check for algorithm indicators (functions, classes, complexity)
      if (this.isAlgorithmCode(code)) {
        priority = Math.max(1, priority - 1);
      }

      codeBlocks.push({
        code,
        section,
        priority,
        length: code.length,
        position
      });
    }

    // Sort by priority (lower number = higher priority)
    return codeBlocks.sort((a, b) => a.priority - b.priority || b.length - a.length);
  }

  /**
   * Check if code looks like a main algorithm (not just examples)
   */
  isAlgorithmCode(code) {
    // Look for function definitions
    if (/def\s+\w+\s*\(/m.test(code)) return true;

    // Look for class definitions
    if (/class\s+\w+/m.test(code)) return true;

    // Look for common algorithm patterns
    if (/(?:for|while).*:[\s\S]*(?:return|yield)/m.test(code)) return true;

    // Look for data structures
    if (/(?:list|dict|set|heap|queue|stack|tree|graph)/i.test(code)) return true;

    // Look for algorithm keywords
    if (/(?:sort|search|traverse|visit|dp|memo|cache|optimize)/i.test(code)) return true;

    return false;
  }

  /**
   * Format for code-only mode - show prioritized Python algorithms and markdown tables
   */
  formatCodeOnly(codeBlocks, markdownTables = []) {
    if (codeBlocks.length === 0 && markdownTables.length === 0) {
      return {
        text: '## No Code or Tables Found\n\nThe response does not contain any substantial Python code blocks or markdown tables.',
        html: '<div class="no-code">No Python algorithms or markdown tables found in the response.</div>',
        hasCode: false
      };
    }

    const plain = [];
    const html = [];

    // Show top priority code blocks (usually 1-2 main algorithms)
    const topBlocks = codeBlocks.slice(0, 2); // Show at most 2 blocks

    topBlocks.forEach((block, index) => {
      const sectionLabel = this.getSectionLabel(block.section);
      const title = `## ${sectionLabel}${topBlocks.length > 1 ? ` (${index + 1})` : ''}`;

      plain.push(`${title}\n\`\`\`python\n${block.code}\n\`\`\`\n`);

      html.push(`
        <div class="code-section">
          <div class="code-language">${sectionLabel}</div>
          <pre class="code-block"><code class="python">${this.highlightPython(this.escapeHtml(block.code))}</code></pre>
        </div>
      `);
    });

    // Show markdown tables
    markdownTables.forEach((table, index) => {
      const title = `## Table${markdownTables.length > 1 ? ` ${index + 1}` : ''}`;

      plain.push(`${title}\n${table.content}\n`);

      html.push(`
        <div class="code-section">
          <div class="code-language">Markdown Table</div>
          <pre class="code-block"><code class="markdown">${this.escapeHtml(table.content)}</code></pre>
        </div>
      `);
    });

    return {
      text: plain.join('\n').trim(),
      html: `<div class="formatted-response">\n${html.join('\n')}\n</div>`,
      hasCode: true
    };
  }

  /**
   * Get human-readable section labels
   */
  getSectionLabel(section) {
    const labels = {
      optimized: 'Optimized Solution',
      bruteForce: 'Brute-force Solution',
      examples: 'Example Code',
      unknown: 'Python Algorithm'
    };
    return labels[section] || 'Python Code';
  }

  /**
   * Format full response (when codeOnly = false)
   */
  formatFullResponse(raw, codeBlocks) {
    // Process LaTeX formulas
    let processed = this.processMathFormulas(raw);

    // Convert markdown tables to HTML first (before other replacements)
    this.markdownTableRegex.lastIndex = 0;
    processed = processed.replace(this.markdownTableRegex, (tableMatch) => {
      return this.formatTableHTML(tableMatch.trim());
    });

    // Basic markdown formatting (focused on structure, not inline code)
    processed = processed
      .replace(/```python\n[\s\S]*?```/g, '[PYTHON_CODE_BLOCK]') // Placeholder for code blocks
      .replace(/```\w*\n[\s\S]*?```/g, '<pre><code>$&</code></pre>') // Other code blocks
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Replace Python code block placeholders
    let codeIndex = 0;
    processed = processed.replace(/\[PYTHON_CODE_BLOCK\]/g, () => {
      if (codeIndex < codeBlocks.length) {
        const block = codeBlocks[codeIndex++];
        return `<div class="code-section">
          <div class="code-language">${this.getSectionLabel(block.section)}</div>
          <pre class="code-block"><code class="python">${this.highlightPython(this.escapeHtml(block.code))}</code></pre>
        </div>`;
      }
      return '';
    });

    return {
      text: raw,
      html: `<div class="formatted-response">${processed}</div>`,
      hasCode: codeBlocks.length > 0
    };
  }

  /**
   * Process LaTeX math formulas (preserve for browser rendering)
   */
  processMathFormulas(text) {
    // LaTeX formulas are preserved as-is for browser-side KaTeX rendering
    return text;
  }

  /**
   * Simple Python syntax highlighting
   */
  highlightPython(code) {
    return code
      // Comments
      .replace(/(#.*?$)/gm, '<span class="comment">$1</span>')
      // Strings (after comments to avoid conflicts)
      // Matches: triple-quoted strings, double-quoted strings with escapes, single-quoted strings with escapes
      // Won't match apostrophes in contractions (don't, it's, won't)
      .replace(/(?<!<span class="comment">.*?)("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="string">$1</span>')
      // Keywords
      .replace(/\b(def|class|if|else|elif|for|while|try|except|finally|with|return|import|from|as|lambda|True|False|None|and|or|not|in|is)\b/g, '<span class="keyword">$1</span>')
      // Numbers
      .replace(/\b(\d+\.?\d*|\.\d+)\b/g, '<span class="number">$1</span>');
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Detect markdown tables and wrap them in code blocks with proper formatting
   * @param {string} text - Text containing potential markdown tables
   * @returns {string} Text with tables formatted and wrapped in code blocks
   */
  wrapTablesInCodeBlocks(text) {
    let tableCounter = 0;

    return text.replace(this.markdownTableRegex, (tableMatch) => {
      tableCounter++;
      // Format the table with proper column alignment
      const formattedTable = this.formatTableASCII(tableMatch.trim());
      // Wrap the formatted table in a code block
      return `\n\`\`\`markdown\n${formattedTable}\n\`\`\`\n`;
    });
  }

  /**
   * Check if text contains markdown tables
   * @param {string} text - Text to check
   * @returns {boolean} True if tables are found
   */
  hasMarkdownTables(text) {
    this.markdownTableRegex.lastIndex = 0;
    return this.markdownTableRegex.test(text);
  }

  /**
   * Extract all markdown tables from text
   * @param {string} text - Text containing tables
   * @returns {Array} Array of table objects with position and content
   */
  extractMarkdownTables(text) {
    const tables = [];
    let match;

    this.markdownTableRegex.lastIndex = 0;

    while ((match = this.markdownTableRegex.exec(text)) !== null) {
      tables.push({
        content: match[0].trim(),
        position: match.index,
        length: match[0].length
      });
    }

    return tables;
  }
}

// Export with original name for backward compatibility
module.exports = InterviewCodeFormatter;