# Overlay DeepSeek Helper

A smart overlay application that captures screenshots, performs OCR, and queries AI models to help with coding interviews and programming tasks. Features advanced response formatting with code highlighting and concise output.

## Features

### Core Functionality
- **Screenshot Capture**: Capture selected regions for analysis
- **Region Selection**: Click and drag to capture specific areas
- **OCR Processing**: Extract text from screenshots using Tesseract.js with intelligent filtering
- **Smart Text Cleaning**: Remove UI junk and irrelevant text before sending to AI
- **AI Integration**: Query ChatGPT/DeepSeek models for coding assistance
- **Session Management**: Maintain conversation context across multiple questions
- **Audio Transcription**: Record and transcribe audio using Whisper API
- **Overlay Interface**: Always-on-top transparent overlay window

### Response Formatting
- **Code Highlighting**: Automatic syntax highlighting for Python, JavaScript, and more
- **Concise Output**: Removes verbose AI introductions and fluff
- **Complexity Analysis**: Highlights time/space complexity information
- **Clean Structure**: Organizes responses into logical sections
- **Smart Compression**: Reduces response length by 10-40% while preserving key information

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd interview
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the project root:
   ```env
   # Hugging Face API (for ChatGPT/DeepSeek)
   HF_TOKEN=your_huggingface_token
   HF_PROVIDER=hyperbolic
   HF_MODEL=deepseek-ai/DeepSeek-R1-0528
   
   # OpenAI API (for audio transcription)
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘+A` | Select region to capture and analyze |
| `⌘+←/→/↑/↓` | Move overlay window |
| `⌘+B` | Hide/show application |
| `⌘+Shift+R` | Reset session (clear context) |
| `⌘+R` | Start audio recording |
| `⌘+T` | Stop audio recording |

### Workflow

1. **Position the overlay** where you want it on screen
2. **Capture content**:
   - Use `⌘+A` to select a specific region - reduces OCR noise!
3. **Review the formatted response** with highlighted code and concise explanations
4. **Ask follow-up questions** - the AI will remember previous context in the session
5. **Reset session** using `⌘+Shift+R` when starting a new topic
6. **Navigate** through long responses using keyboard shortcuts

## Session Management

The application maintains conversation context across multiple screenshot captures, allowing for natural follow-up questions and contextual responses.

### How Sessions Work

- **Automatic Context**: Each new screenshot/query is added to the current session
- **Session Indicator**: Visual indicator shows session status and exchange count
- **Context Preservation**: AI remembers previous questions and answers
- **Smart Limits**: Keeps last 10 exchanges (20 messages) to prevent context overflow

### Session Controls

- **Keyboard Reset**: Use `⌘+Shift+R` to reset session and clear context
- **Automatic Context**: Sessions are managed automatically in the background

### Session Workflow

1. **First Question**: Start with any coding problem screenshot
2. **Follow-up Questions**: Ask "Can you show me the implementation?" or "What about edge cases?"
3. **Contextual Responses**: AI references previous discussion appropriately
4. **Reset When Needed**: Use `⌘+Shift+R` to clear context when switching to new topics

### Example Session Flow

```
Screenshot 1: "What is binary search?"
Response: Explanation of binary search algorithm

Screenshot 2: "Show me the Python code"
Response: Python implementation (references previous explanation)

Screenshot 3: "What are the edge cases?"
Response: Edge cases for binary search (builds on previous context)

[Press ⌘+Shift+R to reset session]

Screenshot 4: "What is merge sort?"
Response: Fresh explanation of merge sort (no binary search context)
```

## OCR Text Cleaning

The application includes intelligent OCR text cleaning to remove junk and irrelevant content that can confuse the AI.

### What Gets Filtered Out

- **UI Elements**: Menu items (File, Edit, View), browser controls, system notifications
- **System Junk**: Time stamps, battery indicators, WiFi status, app names
- **OCR Artifacts**: Single characters, special character lines, corrupted text
- **Short Fragments**: Very short lines that don't contain meaningful content
- **Common Patterns**: URLs, single letters/digits, punctuation-only lines

### What Gets Preserved

- **Code Content**: Function definitions, class declarations, code blocks
- **Questions**: Problem statements, interview questions, technical queries  
- **Technical Terms**: Algorithm names, complexity analysis, programming concepts
- **Mathematical Content**: Formulas, equations, numeric expressions
- **Documentation**: Comments, explanations, technical descriptions

### Smart Detection

The cleaner uses pattern matching to identify:
- Programming keywords and structures
- Question indicators ("What is...", "How do...", "?")
- Technical terminology and complexity analysis
- Code characteristics (indentation, brackets, function calls)

### Region Selection Benefits

Using region selection (`⌘+A`):
- **Reduces noise**: Less irrelevant UI elements in OCR
- **Improves accuracy**: Focused on specific content area
- **Faster processing**: Smaller images process quicker
- **Better results**: AI gets cleaner, more relevant text input

### Example Cleaning

**Before (Raw OCR):**
```
File Edit View Window Help
What is binary search?
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
Chrome Safari Settings
WiFi Battery 85% 2:34 PM
Copy Paste Cut
```

**After (Cleaned):**
```
What is binary search?
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
```

## Response Formatting

The application automatically formats AI responses to make them more useful:

### Before (Raw AI Response)
```
Let me help you solve this step by step! I'll provide a clean Python solution.

Here's how you can implement a binary search algorithm:

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    # ... code continues
```

As you can see, this implementation is quite efficient.

Time Complexity: O(log n)
Space Complexity: O(1)

I hope this helps! Let me know if you need clarification.
```

### After (Formatted Response)
```
[PYTHON CODE]
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    # ... code continues
[/CODE]

📊 Time Complexity: O(log n)
📊 Space Complexity: O(1)
```

### Formatting Features

- **Removes verbose intros**: Eliminates "Let me help you", "I'll provide", etc.
- **Code highlighting**: Syntax highlighting for Python, JavaScript, Java, C++
- **Complexity emphasis**: Highlights time/space complexity with 📊 icon
- **Section organization**: Groups related content together
- **Inline code formatting**: Highlights `code snippets` in text
- **Header preservation**: Keeps important section headers

## Configuration

### Supported Languages
The formatter provides syntax highlighting for:
- Python
- JavaScript
- Java
- C/C++
- Go
- Rust
- SQL
- HTML/CSS

### Model Configuration
You can customize the AI model in your `.env` file:
```env
HF_PROVIDER=hyperbolic
HF_MODEL=deepseek-ai/DeepSeek-R1-0528
```

## Testing

Test the response formatter:
```bash
node test-formatter.js
```

This will run through various test cases and show:
- Original vs formatted output
- Compression ratios
- Code detection accuracy
- HTML rendering examples

Test session management:
```bash
node test-session.js
```

This will test:
- Session initialization and state
- Context preservation across multiple questions
- Keyboard session reset functionality
- Memory management for long conversations

Test OCR text cleaning:
```bash
node test-ocr-cleaner.js
```

This will test:
- UI junk filtering accuracy
- Code and question preservation
- Edge case handling
- Different cleaning option configurations
- Performance and reduction statistics

## Project Structure

```
interview/
├── main.js           # Electron main process
├── renderer.js       # Frontend JavaScript
├── formatter.js      # Response formatting logic
├── index.html        # UI layout and styles
├── preload.js        # Electron preload script
├── test-formatter.js # Formatter test suite
├── test-session.js   # Session management tests
├── test-ocr-cleaner.js # OCR cleaning tests
├── ocr-cleaner.js    # OCR text cleaning logic
├── region-selector.js # Region selection functionality
├── package.json      # Dependencies
└── .env             # Environment variables
```

## API Integration

### Hugging Face Inference
Used for ChatGPT/DeepSeek model queries:
- Supports multiple providers (Hyperbolic, etc.)
- Configurable models
- Error handling for rate limits

### OpenAI Whisper
Used for audio transcription:
- Real-time audio recording
- Automatic transcription
- WebM audio format support

## Development

### Adding New Language Support
To add syntax highlighting for a new language:

1. Update `formatter.js` in the `formatCode` method
2. Add language patterns to the `codeLanguages` array
3. Define highlighting rules for keywords, strings, numbers, comments

### Customizing Formatting Rules
Modify `formatter.js` to adjust:
- Verbose pattern detection
- Section extraction logic
- HTML/CSS styling
- Compression algorithms

## Troubleshooting

### Common Issues

**OCR not working**: Ensure `eng.traineddata` is in the `assets/` directory

**Poor OCR quality**: Use region selection (`⌘+Shift+A`) instead of full screen to reduce noise

**API errors**: Check your `.env` file and API key validity

**Window positioning**: Use `⌘+←/→/↑/↓` to reposition if overlay is off-screen

**Audio recording fails**: Check microphone permissions in System Preferences

**Region selection not working**: Make sure to click and drag to create a selection area

**Canvas errors**: Ensure the `canvas` package is properly installed with `npm install canvas`

### Debug Mode
Enable detailed logging by setting:
```env
DEBUG=true
```

## Performance

- **Response time**: ~2-3 seconds for screenshot + OCR + AI query
**Memory usage**: ~50-100MB typical

## OCR Text Processing Logging

The application includes comprehensive logging to track OCR text cleaning effectiveness. Every OCR processing session is automatically logged with before/after text comparison and quality metrics.

### Log Structure

Logs are organized by month with timestamp-based files:
```
logs/ocr/
├── 2025-01/
│   ├── 2025-01-15_14-30-25_ocr.json
│   ├── 2025-01-15_14-32-10_ocr.json
│   └── ...
└── 2025-02/
    └── ...
```

### Analyzing OCR Performance

Use the built-in analysis script to evaluate cleaning effectiveness:

```bash
# Analyze last 7 days
npm run analyze:ocr

# Analyze last 30 days  
npm run analyze:ocr:30d

# Custom time period
node scripts/analyze-ocr-logs.js 90
```

### Sample Analysis Output

```
📊 OCR TEXT CLEANING ANALYSIS RESULTS
══════════════════════════════════════

📈 OVERVIEW STATISTICS
Total Sessions: 45
Average OCR Confidence: 84.2%
Overall Text Reduction: 30.1%

🧹 CLEANING EFFECTIVENESS
🟢 excellent    12 (26.7%)
🟡 good         20 (44.4%)
🟠 fair          8 (17.8%)
🔴 poor          5 (11.1%)

💡 RECOMMENDATIONS
✅ OCR text cleaning is working well!
```

### Key Metrics

- **Quality Score**: Overall cleaning effectiveness (0.0-1.0)
- **Reduction Percentage**: Amount of text removed during cleaning
- **Content Preservation**: Questions, code blocks, and meaningful words kept
- **Processing Time**: OCR and cleaning performance

See `docs/OCR_LOGGING.md` for detailed documentation.
- **Compression**: 10-40% reduction in response length
- **Code detection**: 95%+ accuracy for common languages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## License

ISC License - see package.json for details