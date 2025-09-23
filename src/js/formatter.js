class DeepSeekFormatter {
  constructor() {
    this.codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    this.thinkingRegex = /<think>[\s\S]*?<\/think>/gi;
    this.blockMathRegex = /\$\$([^$]+)\$\$/g;
    this.inlineMathRegex = /(?<!\$)\$([^$\n]+)\$(?!\$)/g;
  }

  /**
   * @param {string} raw – raw model response
   * @param {boolean} formatterEnabled – bypass if false
   * @param {boolean} codeOnly – if true, only show code blocks in output
   */
  formatResponse(raw, formatterEnabled = true, codeOnly = true) {
    if (!raw || typeof raw !== 'string') {
      return { text: '', html: '', hasCode: false };
    }

    if (!formatterEnabled) {
      return { text: raw, html: this.escapeHtml(raw), hasCode: false };
    }

    // Normalize custom "[LANG CODE]" headings into fenced blocks
    raw = raw.replace(/^\[ *([A-Za-z]+) CODE *\]\s*$/gim, (_, lang) => '```' + lang.toLowerCase());

    // --- Split into code and non-code segments, preserving order ---
    const segments = [];
    let lastIndex = 0;
    let m;
    while ((m = this.codeBlockRegex.exec(raw)) !== null) {
      if (m.index > lastIndex) {
        segments.push({ type: 'text', content: raw.slice(lastIndex, m.index) });
      }
      segments.push({ type: 'code', language: m[1] || 'text', content: m[2] });
      lastIndex = this.codeBlockRegex.lastIndex;
    }
    if (lastIndex < raw.length) {
      segments.push({ type: 'text', content: raw.slice(lastIndex) });
    }

    // --- Build outputs ---
    const plain = [],
      html = [];
    let hasCode = false;

    for (const seg of segments) {
      if (seg.type === 'code') {
        hasCode = true;
        plain.push(`\n[${seg.language.toUpperCase()} CODE]\n${seg.content}\n`);
        html.push(
          `<div class="code-section">
            <div class="code-language">${seg.language.toUpperCase()}</div>
            <pre class="code-block"><code>${this.highlightCode(
              this.escapeHtml(seg.content),
              seg.language
            )}</code></pre>
          </div>`
        );
      } else if (!codeOnly) {
        // Remove <think>...</think> and trim
        let cleaned = seg.content.replace(this.thinkingRegex, '').trim();
        if (!cleaned) continue;

        // Markdown headers
        cleaned = cleaned.replace(/^#### (.*)$/gm, '<div class="response-header h4">$1</div>');
        cleaned = cleaned.replace(/^### (.*)$/gm, '<div class="response-header h3">$1</div>');
        cleaned = cleaned.replace(/^## (.*)$/gm, '<div class="response-header h2">$1</div>');
        cleaned = cleaned.replace(/^# (.*)$/gm, '<div class="response-header h1">$1</div>');

        // Lists
        cleaned = cleaned.replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>');
        // Wrap consecutive <li> in <ul>
        cleaned = cleaned.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');

        // Process math formulas before other formatting
        cleaned = this.processMathFormulas(cleaned);

        // Bold, italic, inline code
        cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        cleaned = cleaned.replace(/\*(.*?)\*/g, '<em>$1</em>');
        cleaned = cleaned.replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');

        // Complexity and reasoning highlights
        cleaned = cleaned.replace(
          /📊 (.*?(?:Time|Space).*?Complexity.*?O\([^)]+\).*?)$/gm,
          '<div class="complexity-section"><span class="complexity-icon">📊</span><span class="complexity-text">$1</span></div>'
        );
        cleaned = cleaned.replace(
          /💭 REASONING:\n([\s\S]*?)(?=\n\n|\n$|$)/g,
          '<div class="thinking-section"><div class="thinking-header">💭 Reasoning Process</div><div class="thinking-content">$1</div></div>'
        );

        // Paragraphs for remaining text (split by double newlines)
        cleaned.split(/\n{2,}/).forEach((paragraph) => {
          if (paragraph.trim()) {
            html.push(`<p class="text-section">${paragraph.trim()}</p>`);
            plain.push(paragraph.trim());
          }
        });
      }
    }

    return {
      text: plain
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      html: `<div class="formatted-response">\n${html.join('\n')}\n</div>`,
      hasCode,
    };
  }

  // --- helpers ---
  escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Process LaTeX math formulas and convert them to rendered HTML
   * @param {string} text - Text containing math formulas
   * @returns {string} Text with math formulas converted to HTML
   */
  processMathFormulas(text) {
    // Store original formulas to preserve them
    const mathReplacements = [];
    let replacementIndex = 0;

    // Handle block math ($$...$$ - display mode)
    text = text.replace(this.blockMathRegex, (match, formula) => {
      const placeholder = `__MATH_BLOCK_${replacementIndex}__`;
      mathReplacements[replacementIndex] = {
        type: 'block',
        formula: formula.trim(),
        placeholder,
      };
      replacementIndex++;
      return placeholder;
    });

    // Handle inline math ($...$ - inline mode)
    text = text.replace(this.inlineMathRegex, (match, formula) => {
      const placeholder = `__MATH_INLINE_${replacementIndex}__`;
      mathReplacements[replacementIndex] = {
        type: 'inline',
        formula: formula.trim(),
        placeholder,
      };
      replacementIndex++;
      return placeholder;
    });

    // Replace placeholders with rendered math HTML
    mathReplacements.forEach((math) => {
      const renderedMath = this.renderMathFormula(math.formula, math.type === 'block');
      text = text.replace(math.placeholder, renderedMath);
    });

    return text;
  }

  /**
   * Render a LaTeX math formula to HTML
   * @param {string} formula - LaTeX formula
   * @param {boolean} displayMode - True for block display, false for inline
   * @returns {string} Rendered HTML
   */
  renderMathFormula(formula, displayMode = false) {
    // Escape the formula for safety
    const escapedFormula = this.escapeHtml(formula);

    // For now, return a styled span that can be rendered by KaTeX on the frontend
    // The actual rendering will happen in the browser using KaTeX
    const className = displayMode ? 'math-block' : 'math-inline';
    const displayAttr = displayMode ? ' data-display="true"' : '';

    return `<span class="${className}" data-formula="${escapedFormula}"${displayAttr}>${escapedFormula}</span>`;
  }

  highlightCode(code, lang) {
    if (['python', 'py'].includes(lang)) {
      // Highlight comments first
      code = code.replace(/(#.*?$)/gm, '<span class="comment">$1</span>');
      // Now, only highlight outside of comments
      code = code.replace(
        /(<span class="comment">.*?<\/span>)|(".*?"|'.*?')|(\b\d+\.?\d*|\.\d+\b)|\b(def|class|if|else|elif|for|while|try|except|finally|with|return|import|from|as|lambda|True|False|None)\b/gs,
        (match, comment, string, number, keyword) => {
          if (comment) return comment; // Don't touch inside comments
          if (string) return `<span class="string">${string}</span>`;
          if (number) return `<span class="number">${number}</span>`;
          if (keyword) return `<span class="keyword">${keyword}</span>`;
          return match;
        }
      );
      return code;
    }
    if (['javascript', 'js'].includes(lang)) {
      code = code.replace(/(\/\/.*?$)/gm, '<span class="comment">$1</span>');
      code = code.replace(
        /(<span class="comment">.*?<\/span>)|(".*?"|'.*?'|`.*?`)|(\b\d+\.?\d*|\.\d+\b)|\b(const|let|var|function|if|else|for|while|return|class|extends|import|export|async|await|true|false|null|undefined)\b/gs,
        (match, comment, string, number, keyword) => {
          if (comment) return comment;
          if (string) return `<span class="string">${string}</span>`;
          if (number) return `<span class="number">${number}</span>`;
          if (keyword) return `<span class="keyword">${keyword}</span>`;
          return match;
        }
      );
      return code;
    }
    return code;
  }
}

module.exports = DeepSeekFormatter;
