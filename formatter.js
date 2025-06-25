const { encode } = require('html-entities');

class ResponseFormatter {
  constructor() {
    // Keywords that indicate verbose explanations to remove
    this.verbosePatterns = [
      /^(Let me|I'll|I will|I can|I'd be happy to|Sure!|Certainly!|Of course!)/i,
      /^(Here's how|Here is how|This is how|The way to)/i,
      /^(First, let me|To start with|Let's begin by)/i,
      /^(As you can see|As shown|As demonstrated)/i,
      /^(In this example|For example|For instance)/i,
      /^(It's worth noting|Note that|Keep in mind)/i,
      /^(I hope this helps|This should help|Hope this clarifies)/i
    ];

    // Code language patterns
    this.codeLanguages = ['python', 'java', 'javascript', 'cpp', 'c', 'go', 'rust', 'sql', 'html', 'css'];

    // Complexity patterns
    this.complexityPattern = /(Time|Space)\s*[Cc]omplexity:\s*O\([^)]+\)/g;
  }

  /**
   * Main formatting function
   * @param {string} response - Raw ChatGPT response
   * @returns {object} - Formatted response with HTML and plain text
   */
  formatResponse(response) {
    if (!response || typeof response !== 'string') {
      return { html: '', text: '', hasCode: false };
    }

    // Clean up the response
    let cleaned = this.removeVerboseIntros(response);
    cleaned = this.cleanupWhitespace(cleaned);

    // Extract and format different sections
    const sections = this.extractSections(cleaned);
    const formattedSections = this.formatSections(sections);

    // Generate HTML and plain text versions
    const html = this.generateHTML(formattedSections);
    const text = this.generatePlainText(formattedSections);
    const hasCode = formattedSections.some(section => section.type === 'code');

    return { html, text, hasCode };
  }

  /**
   * Remove verbose introductory phrases
   */
  removeVerboseIntros(text) {
    const lines = text.split('\n');
    const cleanedLines = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        cleanedLines.push('');
        continue;
      }

      // Check if line starts with verbose pattern
      let isVerbose = false;
      for (let pattern of this.verbosePatterns) {
        if (pattern.test(trimmed)) {
          isVerbose = true;
          break;
        }
      }

      if (!isVerbose) {
        cleanedLines.push(line);
      }
    }

    return cleanedLines.join('\n');
  }

  /**
   * Clean up excessive whitespace
   */
  cleanupWhitespace(text) {
    return text
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ')     // Multiple spaces to single space
      .trim();
  }

  /**
   * Extract different sections from the response
   */
  extractSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = { type: 'text', content: [] };
    let inCodeBlock = false;
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect code block start
      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting code block
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          codeLanguage = trimmed.slice(3).toLowerCase();
          currentSection = { type: 'code', language: codeLanguage, content: [] };
          inCodeBlock = true;
        } else {
          // Ending code block
          sections.push(currentSection);
          currentSection = { type: 'text', content: [] };
          inCodeBlock = false;
        }
        continue;
      }

      // Detect complexity analysis
      if (this.complexityPattern.test(trimmed)) {
        if (currentSection.content.length > 0 && currentSection.type !== 'complexity') {
          sections.push(currentSection);
        }
        if (currentSection.type !== 'complexity') {
          currentSection = { type: 'complexity', content: [] };
        }
        currentSection.content.push(line);
        continue;
      }

      // Detect headers (lines starting with #)
      if (trimmed.startsWith('#')) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        const level = (trimmed.match(/^#+/) || [''])[0].length;
        const headerText = trimmed.replace(/^#+\s*/, '');
        currentSection = { type: 'header', level, content: [headerText] };
        sections.push(currentSection);
        currentSection = { type: 'text', content: [] };
        continue;
      }

      // Regular content
      currentSection.content.push(line);
    }

    // Add final section
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Format sections for display
   */
  formatSections(sections) {
    return sections.map(section => {
      switch (section.type) {
        case 'code':
          return {
            type: 'code',
            language: section.language,
            content: section.content.join('\n'),
            formatted: this.formatCode(section.content.join('\n'), section.language)
          };

        case 'complexity':
          return {
            type: 'complexity',
            content: section.content.join('\n'),
            formatted: this.formatComplexity(section.content.join('\n'))
          };

        case 'header':
          return {
            type: 'header',
            level: section.level,
            content: section.content[0],
            formatted: section.content[0]
          };

        case 'text':
          return {
            type: 'text',
            content: section.content.join('\n').trim(),
            formatted: this.formatText(section.content.join('\n').trim())
          };

        default:
          return section;
      }
    }).filter(section => section.content && section.content.length > 0);
  }

  /**
   * Format code with basic syntax highlighting
   */
  formatCode(code, language) {
    if (!code) return '';

    // Basic syntax highlighting using CSS classes
    let highlighted = encode(code);

    // Python-specific highlighting
    if (language === 'python' || language === 'py') {
      highlighted = highlighted
        .replace(/\b(def|class|if|else|elif|for|while|try|except|finally|with|import|from|return|yield|lambda|and|or|not|in|is|True|False|None)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/(["'].*?["'])/g, '<span class="string">$1</span>')
        .replace(/(#.*$)/gm, '<span class="comment">$1</span>');
    }

    // JavaScript-specific highlighting
    if (language === 'javascript' || language === 'js') {
      highlighted = highlighted
        .replace(/\b(function|const|let|var|if|else|for|while|try|catch|finally|return|class|extends|import|export|async|await|true|false|null|undefined)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/(["'`].*?["'`])/g, '<span class="string">$1</span>')
        .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>');
    }

    return highlighted;
  }

  /**
   * Format complexity analysis
   */
  formatComplexity(text) {
    return text.replace(this.complexityPattern, '<strong class="complexity">$&</strong>');
  }

  /**
   * Format regular text
   */
  formatText(text) {
    if (!text) return '';

    // Make key points bold
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  }

  /**
   * Generate HTML output
   */
  generateHTML(sections) {
    const htmlParts = sections.map(section => {
      switch (section.type) {
        case 'header':
          const tag = `h${Math.min(section.level, 6)}`;
          return `<${tag} class="response-header">${section.formatted}</${tag}>`;

        case 'code':
          return `<div class="code-section">
            ${section.language ? `<div class="code-language">${section.language}</div>` : ''}
            <pre class="code-block"><code class="language-${section.language}">${section.formatted}</code></pre>
          </div>`;

        case 'complexity':
          return `<div class="complexity-section">${section.formatted}</div>`;

        case 'text':
          return `<div class="text-section">${section.formatted.replace(/\n/g, '<br>')}</div>`;

        default:
          return `<div class="unknown-section">${encode(section.content)}</div>`;
      }
    });

    return `<div class="formatted-response">${htmlParts.join('')}</div>`;
  }

  /**
   * Generate plain text output
   */
  generatePlainText(sections) {
    const textParts = sections.map(section => {
      switch (section.type) {
        case 'header':
          return `\n${'='.repeat(section.level)} ${section.content} ${'='.repeat(section.level)}\n`;

        case 'code':
          return `\n[${section.language.toUpperCase()} CODE]\n${section.content}\n[/CODE]\n`;

        case 'complexity':
          return `\n📊 ${section.content}\n`;

        case 'text':
          return section.content;

        default:
          return section.content;
      }
    });

    return textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Get CSS styles for the formatted response
   */
  getCSS() {
    return `
      .formatted-response {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #e0e0e0;
      }

      .response-header {
        color: #4da6ff;
        margin: 16px 0 8px 0;
        font-weight: 600;
      }

      .code-section {
        margin: 12px 0;
        border-radius: 6px;
        overflow: hidden;
        background: rgba(40, 44, 52, 0.8);
        border: 1px solid #444;
      }

      .code-language {
        background: rgba(70, 130, 180, 0.2);
        color: #87ceeb;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .code-block {
        margin: 0;
        padding: 12px;
        background: transparent;
        overflow-x: auto;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
        font-size: 13px;
        line-height: 1.4;
      }

      .code-block code {
        background: transparent;
        padding: 0;
        border: none;
        color: #e0e0e0;
      }

      .keyword { color: #ff79c6; font-weight: 500; }
      .string { color: #f1fa8c; }
      .number { color: #bd93f9; }
      .comment { color: #6272a4; font-style: italic; }

      .complexity-section {
        background: rgba(76, 175, 80, 0.1);
        border-left: 3px solid #4caf50;
        padding: 8px 12px;
        margin: 8px 0;
        border-radius: 4px;
      }

      .complexity {
        color: #4caf50;
        font-weight: 600;
      }

      .text-section {
        margin: 8px 0;
        line-height: 1.6;
      }

      .inline-code {
        background: rgba(255, 255, 255, 0.1);
        color: #ff79c6;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
        font-size: 0.9em;
      }

      .text-section strong {
        color: #fff;
        font-weight: 600;
      }

      .text-section em {
        color: #ccc;
        font-style: italic;
      }
    `;
  }
}

module.exports = ResponseFormatter;
