/**
 * Extremely-lightweight formatter for AI responses.
 * -------------------------------------------------
 * • Strips <think> … </think> blocks.
 * • Separates Markdown code fences (```lang ... ```) from plain text.
 * • Returns:
 *     { text: cleanPlainText, html: basicHTML, hasCode: boolean }
 * • No heavy re-ordering – content stays in original order.
 */
class DeepSeekFormatter {
  constructor() {
    this.codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    this.thinkingRegex  = /<think>[\s\S]*?<\/think>/gi;
  }

  /**
   * @param {string} raw – raw model response
   * @param {boolean} formatterEnabled – bypass if false
   */
  formatResponse(raw, formatterEnabled = true) {
    if (!raw || typeof raw !== 'string') {
      return { text: '', html: '', hasCode: false };
    }

    // Normalize custom "[LANG CODE]" headings into fenced blocks
    // e.g., "[PYTHON CODE]" → "```python"
    raw = raw.replace(/^\[ *([A-Za-z]+) CODE *\]\s*$/gim, (_, lang) =>
      '```' + lang.toLowerCase()
    );
    if (!formatterEnabled) {
      return { text: raw, html: this.escapeHtml(raw), hasCode: false };
    }

    // --- slice into segments ---
    const segments = [];
    let last = 0, m;
    while ((m = this.codeBlockRegex.exec(raw)) !== null) {
      if (m.index > last) segments.push({ type: 'text', content: raw.slice(last, m.index) });
      segments.push({ type: 'code', language: m[1] || 'text', content: m[2] });
      last = this.codeBlockRegex.lastIndex;
    }
    if (last < raw.length) segments.push({ type: 'text', content: raw.slice(last) });

    // --- build outputs ---
    const plain = [], html = [];
    let hasCode = false;

    for (const seg of segments) {
      if (seg.type === 'text') {
        const cleaned = seg.content.replace(this.thinkingRegex, '').trim();
        if (!cleaned) continue;
        plain.push(cleaned);
        html.push(`<p>${this.escapeHtml(cleaned)}</p>`);
      } else { // code
        hasCode = true;
        plain.push(`\n[${seg.language.toUpperCase()} CODE]\n${seg.content}\n`);
        html.push(
          `<pre class="code-block"><code>${
            this.highlightCode(this.escapeHtml(seg.content), seg.language)
          }</code></pre>`
        );
      }
    }

    return {
      text: plain.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      html: `<div class="formatted-response">\n${html.join('\n')}\n</div>`,
      hasCode,
    };
  }

  // --- helpers ---
  escapeHtml(s) {
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
  }

  highlightCode(code, lang) {
    if (['python','py'].includes(lang)) {
      return code
        // Comments
        .replace(/(#.*?$)/gm, '<span class="comment">$1</span>')
        // Strings
        .replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>')
        // Numbers (integer, float)
        .replace(/\b(\d+\.?\d*|\.\d+)\b/g, '<span class="number">$1</span>')
        // Keywords
        .replace(
          /\b(def|class|if|else|elif|for|while|try|except|finally|with|return|import|from|as|lambda|True|False|None)\b/g,
          '<span class="keyword">$1</span>'
        );
    }
    if (['javascript','js'].includes(lang)) {
      return code
        // Line comments
        .replace(/(\/\/.*?$)/gm, '<span class="comment">$1</span>')
        // Strings
        .replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>')
        // Numbers (integer, float)
        .replace(/\b(\d+\.?\d*|\.\d+)\b/g, '<span class="number">$1</span>')
        // Keywords
        .replace(
          /\b(const|let|var|function|if|else|for|while|return|class|extends|import|export|async|await|true|false|null|undefined)\b/g,
          '<span class="keyword">$1</span>'
        );
    }
    return code;
  }
}

module.exports = DeepSeekFormatter;