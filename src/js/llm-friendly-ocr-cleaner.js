class LLMFriendlyOCRCleaner {
  constructor() {
    // Minimal cleanup for region screenshots - remove only obvious OCR noise
    this.junkPatterns = [
      /^[a-z]$/i, // Single letters
      /^[0-9]$/, // Single digits
      /^[|\\\\/\-=_+\\[\]{}()<>,.;:'"!@#$%^&*`~]+$/, // Pure punctuation lines
    ];

    // AI enhancement prompt for restructuring OCR text into clean interview questions
    this.enhancementPrompt = `You are given raw OCR text from an interview question.
- The text may be messy, have inconsistent formatting, or contain broken tables.
- If the OCR text contains sample input and output, identify them and format them clearly.
- Frame the content into a clean, well-structured coding interview question with these sections (if applicable):

1. Problem Statement - concise and clear description of the task.
2. Input Format - structured and properly formatted.
3. Output Format - structured and properly formatted.
4. Constraints - if present.
5. Example(s) - cleanly formatted input/output pairs.

If some details are missing or unclear in the OCR, make reasonable assumptions and fill them in. Do not change the intent of the question.`;
  }

  /**
   * Clean OCR text and optionally enhance with AI
   * @param {string} rawText - Raw OCR text
   * @param {Object} options - Cleaning options
   * @param {boolean} options.enhanceWithAI - Use AI to restructure text (default: false)
   * @returns {Promise<string>|string} - Cleaned text (async if enhanceWithAI is true)
   */
  cleanText(rawText, options = {}) {
    const { enhanceWithAI = false } = options;

    if (!rawText || typeof rawText !== 'string') {
      return enhanceWithAI ? Promise.resolve('') : '';
    }

    // Basic cleanup: trim lines, remove empty lines and junk patterns
    const cleanedLines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (line.length === 0) return false; // Remove empty lines
        return !this.junkPatterns.some((pattern) => pattern.test(line)); // Remove junk
      });

    const cleanedText = cleanedLines.join('\n');

    // AI enhancement handles all context extraction and restructuring
    return enhanceWithAI ? this.enhanceWithAI(cleanedText) : cleanedText;
  }

  /**
   * Enhance cleaned OCR text using AI to restructure into clean interview question
   * @param {string} cleanedText - Basic cleaned text
   * @returns {Promise<string>} - AI-enhanced structured interview question
   */
  async enhanceWithAI(cleanedText) {
    if (!cleanedText || cleanedText.trim().length === 0) {
      return cleanedText;
    }

    try {
      const simpleAI = require('./ai/simple-ai');
      const aiConfig = require('./ai/ai-config');

      console.log('[OCRCleaner] Enhancing OCR text with AI...');

      // Use primary Ollama model (default: gpt-oss)
      const model = aiConfig.getPrimaryModel('ollama');
      console.log(`[OCRCleaner] Using model: ${model}`);

      const response = await simpleAI.chatCompletion({
        provider: 'ollama',
        messages: [
          {
            role: 'system',
            content: this.enhancementPrompt,
          },
          {
            role: 'user',
            content: cleanedText,
          },
        ],
        parameters: {
          model: model,
          temperature: 0.1, // Low temperature for accuracy
          num_predict: 1000, // Allow longer structured output
          keep_alive: '30s', // Keep model loaded for 30 seconds
        },
      });

      // Extract enhanced text
      let enhancedText = '';
      if (response.choices && response.choices[0]?.message?.content) {
        enhancedText = response.choices[0].message.content;
      } else if (typeof response === 'string') {
        enhancedText = response;
      } else if (response.content) {
        enhancedText = response.content;
      }

      if (!enhancedText) {
        console.warn('[OCRCleaner] AI enhancement returned empty, using cleaned text');
        return cleanedText;
      }

      console.log('[OCRCleaner] ✅ AI enhancement completed');
      console.log(`[OCRCleaner] Original length: ${cleanedText.length} chars`);
      console.log(`[OCRCleaner] Enhanced length: ${enhancedText.length} chars`);

      return enhancedText.trim();
    } catch (error) {
      console.error('[OCRCleaner] ❌ AI enhancement failed:', error.message);
      console.log('[OCRCleaner] Falling back to basic cleaned text');
      return cleanedText;
    }
  }
}

module.exports = LLMFriendlyOCRCleaner;
