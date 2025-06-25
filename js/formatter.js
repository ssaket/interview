class DeepSeekFormatter {
  constructor() {
    // Patterns for detecting different content types
    this.thinkingPattern = /<think>([\s\S]*?)<\/think>/gi;
    this.codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
    this.complexityPattern = /(?:time|space)\s*complexity[:\s]*o\([^)]+\)/gi;
    this.markdownSectionPattern = /^###\s*(.+)$/gm;

    // Verbose patterns to remove
    this.verbosePatterns = [
      /^(let me|i'll|i will|i can|sure!|certainly!|of course!)/i,
      /^(here's how|here is how|this is how|the way to)/i,
      /^(as you can see|as shown|as demonstrated)/i,
      /^(i hope this helps|this should help)/i,
    ];
  }

  /**
   * Main formatting function for DeepSeek responses
   * @param {string} response - Raw DeepSeek response
   * @returns {object} - {text: string, html: string, hasCode: boolean}
   */
  formatResponse(response) {
    if (!response || typeof response !== "string") {
      return { text: "", html: "", hasCode: false };
    }

    // Extract all sections
    const sections = this.extractSections(response);

    // Reorder sections: Code → Complexity → Explanations → Thinking
    const reorderedSections = this.reorderSections(sections);

    // Generate outputs
    const text = this.generatePlainText(reorderedSections);
    const html = this.generateHTML(reorderedSections);
    const hasCode = sections.code.length > 0;

    return { text, html, hasCode };
  }

  /**
   * Extract different types of content from the response
   */
  extractSections(response) {
    const sections = {
      thinking: [],
      code: [],
      complexity: [],
      markdownSections: [],
      explanations: [],
    };

    // Extract thinking sections first
    let cleanResponse = response;
    let thinkingMatch;

    while ((thinkingMatch = this.thinkingPattern.exec(response)) !== null) {
      sections.thinking.push({
        type: "thinking",
        content: thinkingMatch[1].trim(),
      });
    }

    // Remove thinking sections from main response
    cleanResponse = cleanResponse.replace(this.thinkingPattern, "").trim();

    // Extract code blocks
    let codeMatch;
    while ((codeMatch = this.codeBlockPattern.exec(cleanResponse)) !== null) {
      sections.code.push({
        type: "code",
        language: codeMatch[1] || "text",
        content: codeMatch[2].trim(),
      });
    }

    // Remove code blocks from text for further processing
    let textWithoutCode = cleanResponse.replace(this.codeBlockPattern, "");

    // Extract markdown sections (### headers)
    const markdownSections = [];
    let match;
    while (
      (match = this.markdownSectionPattern.exec(textWithoutCode)) !== null
    ) {
      const header = match[1].trim();
      const startIndex = match.index;
      markdownSections.push({
        header: header,
        startIndex: startIndex,
        fullMatch: match[0],
      });
    }

    // Process markdown sections and extract their content
    for (let i = 0; i < markdownSections.length; i++) {
      const currentSection = markdownSections[i];
      const nextSection = markdownSections[i + 1];

      // Determine the end of current section
      const endIndex = nextSection
        ? nextSection.startIndex
        : textWithoutCode.length;

      // Extract content between current and next section
      const sectionContent = textWithoutCode
        .substring(currentSection.startIndex, endIndex)
        .replace(currentSection.fullMatch, "") // Remove the header
        .trim();

      if (sectionContent) {
        sections.markdownSections.push({
          type: "markdownSection",
          header: currentSection.header,
          content: sectionContent,
        });
      }
    }

    // Remove markdown sections from text for further processing
    textWithoutCode = textWithoutCode.replace(this.markdownSectionPattern, "");

    // Split remaining text into lines for analysis
    const lines = textWithoutCode
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    for (const line of lines) {
      if (this.complexityPattern.test(line)) {
        sections.complexity.push({
          type: "complexity",
          content: line,
        });
      } else if (this.isUsefulExplanation(line)) {
        sections.explanations.push({
          type: "explanation",
          content: line,
        });
      }
    }

    return sections;
  }

  /**
   * Check if a line contains useful explanation content
   */
  isUsefulExplanation(line) {
    if (line.length < 10) return false;

    // Skip verbose introductions
    for (const pattern of this.verbosePatterns) {
      if (pattern.test(line)) return false;
    }

    // Keep lines with substantive content
    const keywords = [
      "algorithm",
      "approach",
      "solution",
      "method",
      "strategy",
      "implementation",
      "steps",
      "process",
      "technique",
      "because",
      "however",
      "therefore",
      "first",
      "second",
      "next",
      "finally",
    ];

    return keywords.some((keyword) => line.toLowerCase().includes(keyword));
  }

  /**
   * Reorder sections to prioritize code first, thinking last
   */
  reorderSections(sections) {
    const reordered = [];

    // 1. Code blocks first (most important)
    reordered.push(...sections.code);

    // 2. Markdown sections second (Solution Code, Approach and Time Complexity, etc.)
    reordered.push(...sections.markdownSections);

    // 3. Complexity analysis third
    reordered.push(...sections.complexity);

    // 4. Main explanations fourth
    reordered.push(...sections.explanations);

    // 5. Thinking sections last
    reordered.push(...sections.thinking);

    return reordered;
  }

  /**
   * Generate plain text output
   */
  generatePlainText(sections) {
    const parts = [];

    for (const section of sections) {
      switch (section.type) {
        case "code":
          parts.push(
            `\n[${section.language.toUpperCase()} CODE]\n${section.content}\n[/CODE]\n`,
          );
          break;

        case "markdownSection":
          parts.push(`\n## ${section.header}\n${section.content}\n`);
          break;

        case "complexity":
          parts.push(`\n📊 ${section.content}\n`);
          break;

        case "explanation":
          parts.push(`${section.content}\n`);
          break;

        case "thinking":
          parts.push(`\n💭 REASONING:\n${section.content}\n`);
          break;
      }
    }

    return parts
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Generate HTML output with styling
   */
  generateHTML(sections) {
    const parts = [];

    for (const section of sections) {
      switch (section.type) {
        case "code":
          const highlightedCode = this.highlightCode(
            section.content,
            section.language,
          );
          parts.push(`
            <div class="code-section">
              <div class="code-language">${section.language}</div>
              <pre class="code-block"><code>${highlightedCode}</code></pre>
            </div>
          `);
          break;

        case "markdownSection":
          const formattedMarkdownContent = this.formatInlineElements(
            section.content,
          );
          parts.push(`
            <div class="markdown-section">
              <div class="markdown-header">${section.header}</div>
              <div class="markdown-content">${formattedMarkdownContent}</div>
            </div>
          `);
          break;

        case "complexity":
          parts.push(`
            <div class="complexity-section">
              <span class="complexity-icon">📊</span>
              <span class="complexity-text">${section.content}</span>
            </div>
          `);
          break;

        case "explanation":
          const formattedText = this.formatInlineElements(section.content);
          parts.push(`<div class="explanation-section">${formattedText}</div>`);
          break;

        case "thinking":
          const formattedThinking = this.formatInlineElements(section.content);
          parts.push(`
            <div class="thinking-section">
              <div class="thinking-header">💭 Reasoning Process</div>
              <div class="thinking-content">${formattedThinking}</div>
            </div>
          `);
          break;
      }
    }

    return `<div class="deepseek-response">${parts.join("")}</div>`;
  }

  /**
   * Basic syntax highlighting for code
   */
  highlightCode(code, language) {
    let highlighted = this.escapeHtml(code);

    if (language === "python" || language === "py") {
      highlighted = highlighted
        .replace(
          /\b(def|class|if|else|elif|for|while|try|except|finally|with|import|from|return|yield|lambda|and|or|not|in|is|True|False|None)\b/g,
          '<span class="keyword">$1</span>',
        )
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/(["'].*?["'])/g, '<span class="string">$1</span>')
        .replace(/(#.*$)/gm, '<span class="comment">$1</span>');
    } else if (language === "javascript" || language === "js") {
      highlighted = highlighted
        .replace(
          /\b(function|const|let|var|if|else|for|while|try|catch|finally|return|class|extends|import|export|async|await|true|false|null|undefined)\b/g,
          '<span class="keyword">$1</span>',
        )
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/(["'`].*?["'`])/g, '<span class="string">$1</span>')
        .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>');
    }

    return highlighted;
  }

  /**
   * Format inline elements like bold, italic, inline code
   */
  formatInlineElements(text) {
    return this.escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Get CSS styles for the formatted response
   */
  getCSS() {
    return `
      .deepseek-response {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #e0e0e0;
      }

      .code-section {
        margin: 16px 0;
        border-radius: 8px;
        overflow: hidden;
        background: rgba(40, 44, 52, 0.9);
        border: 1px solid #444;
      }

      .code-language {
        background: rgba(70, 130, 180, 0.3);
        color: #87ceeb;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .code-block {
        margin: 0;
        padding: 16px;
        background: transparent;
        overflow-x: auto;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
        font-size: 14px;
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
        background: rgba(76, 175, 80, 0.15);
        border-left: 4px solid #4caf50;
        padding: 12px 16px;
        margin: 12px 0;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .complexity-icon {
        font-size: 16px;
      }

      .complexity-text {
        color: #4caf50;
        font-weight: 600;
        font-size: 14px;
      }

      .explanation-section {
        margin: 10px 0;
        line-height: 1.7;
        color: #e0e0e0;
      }

      .thinking-section {
        margin: 20px 0;
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 8px;
        overflow: hidden;
      }

      .thinking-header {
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        border-bottom: 1px solid rgba(255, 193, 7, 0.3);
      }

      .thinking-content {
        padding: 16px;
        font-size: 13px;
        line-height: 1.6;
        color: #ddd;
      }

      .inline-code {
        background: rgba(255, 255, 255, 0.1);
        color: #ff79c6;
        padding: 2px 5px;
        border-radius: 3px;
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
        font-size: 0.9em;
      }

      .explanation-section strong {
        color: #fff;
        font-weight: 600;
      }

      .explanation-section em {
        color: #ccc;
        font-style: italic;
      }

      .thinking-content strong {
        color: #ffc107;
      }

      .markdown-section {
        margin: 16px 0;
        background: rgba(33, 150, 243, 0.1);
        border: 1px solid rgba(33, 150, 243, 0.3);
        border-radius: 8px;
        overflow: hidden;
      }

      .markdown-header {
        background: rgba(33, 150, 243, 0.2);
        color: #2196f3;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 600;
        border-bottom: 1px solid rgba(33, 150, 243, 0.3);
      }

      .markdown-content {
        padding: 16px;
        line-height: 1.6;
        color: #e0e0e0;
      }

      .markdown-content strong {
        color: #2196f3;
        font-weight: 600;
      }
    `;
  }
}

module.exports = DeepSeekFormatter;
