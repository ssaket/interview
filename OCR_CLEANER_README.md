# OCR Cleaner for LLM Processing

A production-ready OCR text cleaner designed to filter screenshot OCR output and prepare it for LLM consumption. Optimized for coding interviews, technical documentation, algorithm explanations, and notepad-style content.

## Key Features

✅ **Text Integrity Preservation** - No corruption from aggressive OCR correction  
✅ **Smart Content Detection** - Identifies questions, code blocks, and technical content  
✅ **Notepad Content Support** - Handles numbered lists, bullet points, and informal explanations  
✅ **UI Junk Removal** - Filters out browser menus, system notifications, and artifacts  
✅ **LLM-Ready Output** - Clean, structured text optimized for language model processing  
✅ **Fast Performance** - Simple, predictable filtering logic with minimal dependencies  
✅ **Context Extraction** - Automatically categorizes content for better LLM prompting

## Quick Start

```javascript
const LLMFriendlyOCRCleaner = require('./js/llm-friendly-ocr-cleaner');

const cleaner = new LLMFriendlyOCRCleaner();
const cleanedText = cleaner.cleanText(ocrText);

// Check if suitable for LLM processing
if (cleaner.isLLMWorthy(cleanedText)) {
  // Extract structured context
  const context = cleaner.extractLLMContext(cleanedText);
  console.log('Questions:', context.questions.length);
  console.log('Code blocks:', context.codeBlocks.length);
  console.log('Technical concepts:', context.technicalConcepts);
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `maxLines` | 50 | Maximum lines to keep in output |
| `minLineLength` | 2 | Minimum character length for lines |
| `preserveQuestions` | true | Keep question and problem descriptions |
| `preserveCode` | true | Keep code blocks and programming content |
| `removeJunk` | true | Filter out UI elements and system text |
| `applyOCRFixes` | false | Apply conservative OCR error corrections |
| `logResults` | false | Enable detailed logging for debugging |

## Usage Examples

### Basic Cleaning
```javascript
const cleaner = new LLMFriendlyOCRCleaner();
const result = cleaner.cleanText(`
File Edit View
What is binary search?
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    return -1
Chrome WiFi 89%
`);
// Output: "What is binary search?\ndef binary_search(arr, target):\nleft, right = 0, len(arr) - 1\nreturn -1"
```

### Notepad-Style Content
```javascript
const notepadContent = `Let's solve this step by step:

1. First, understand the problem
2. Think of the approach:
   def solution(arr):
       return max(arr)
3. Time complexity: O(n)

Note: This is the simple approach`;

const cleaned = cleaner.cleanText(notepadContent);
// Preserves numbered steps, code, and explanations
```

### Custom Configuration
```javascript
const result = cleaner.cleanText(ocrText, {
  maxLines: 40,
  preserveQuestions: true,
  preserveCode: true,
  removeJunk: true,
  logResults: true
});
```

### LLM Integration Pattern
```javascript
const cleaned = cleaner.cleanText(ocrText);

if (cleaner.isLLMWorthy(cleaned)) {
  const context = cleaner.extractLLMContext(cleaned);
  
  // Build enhanced LLM prompt
  let prompt = "Based on this technical content:\n\n" + cleaned;
  
  if (context.questions.length > 0) {
    prompt += "\n\nQuestions: " + context.questions.join(", ");
  }
  
  // Send to LLM...
}
```

## What Gets Filtered Out

- **UI Elements**: File, Edit, View, Chrome, Safari, etc.
- **System Indicators**: WiFi, Battery, timestamps, notifications
- **Artifacts**: Lines of special characters (||||, ---, ===)
- **Single Characters**: Isolated letters/numbers that are likely OCR noise
- **URLs**: Web addresses and domain names
- **Short Junk**: Meaningless short strings

## What Gets Preserved

- **Questions**: Any interrogative sentences or problem descriptions
- **Code Blocks**: Function definitions, code snippets, algorithms
- **Notepad Content**: Numbered lists, bullet points, step-by-step explanations
- **Technical Content**: Algorithm explanations, complexity analysis
- **Examples**: Input/output examples, test cases, walkthroughs
- **Documentation**: Technical explanations and descriptions
- **Informal Content**: "Let's try", "Here's how", explanatory text

## Quality Metrics

The cleaner provides comprehensive metrics:

```javascript
const metrics = cleaner.getQualityMetrics(originalText, cleanedText);
console.log(metrics);
// {
//   originalLineCount: 25,
//   cleanedLineCount: 12,
//   reductionPercentage: 52,
//   questionsPreserved: 2,
//   codeBlocksPreserved: 8,
//   technicalTermsPreserved: 15
// }
```

## Testing

Run the comprehensive test suite:

```bash
node test-llm-friendly-cleaner.js
```

Tests cover:
- Mixed UI and coding content
- LeetCode problem descriptions
- Technical documentation
- Edge cases and error handling
- Performance benchmarks

## Performance

- **Fast processing**: ~2-5ms per typical screenshot
- **Memory efficient**: Minimal memory footprint
- **Predictable**: Consistent performance across content types
- **Reliable**: No crashes or corruption in production use

## Common Use Cases

1. **Coding Interview Screenshots** - Clean OCR from LeetCode, HackerRank, etc.
2. **Technical Documentation** - Process algorithm explanations and tutorials
3. **Notepad Explanations** - Handle numbered steps, bullet points, informal Q&A
4. **Whiteboard Photos** - Clean handwritten technical content
5. **Code Editor Screenshots** - Extract clean code from IDE screenshots
6. **Academic Content** - Process computer science textbook pages
7. **Tutorial Content** - Step-by-step programming guides and walkthroughs

## Integration Notes

- Designed for English technical content
- Optimized for programming/algorithms context
- Supports both formal (LeetCode) and informal (notepad) content styles
- Conservative filtering approach (keeps more than it removes)
- Minimal dependencies (only `natural` for tokenization)
- No external API dependencies
- Works with any OCR library output

## Files

- `js/llm-friendly-ocr-cleaner.js` - Main cleaner implementation
- `test-llm-friendly-cleaner.js` - Comprehensive test suite
- `OCR_CLEANER_README.md` - This documentation

Built for production use in OCR → LLM pipelines where text quality and reliability are critical.