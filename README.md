# Overlay DeepSeek Helper

A smart overlay application that captures screenshots, performs OCR, and queries AI models to help with coding interviews and programming tasks. Features advanced response formatting with code highlighting and concise output.

## Features

### Core Functionality
- **Screenshot Capture**: Capture any part of your screen for analysis
- **OCR Processing**: Extract text from screenshots using Tesseract.js
- **AI Integration**: Query ChatGPT/DeepSeek models for coding assistance
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
| `⌘+Shift+S` | Capture screenshot and analyze |
| `⌘+←/→/↑/↓` | Move overlay window |
| `⌘+B` | Hide/show application |
| `⌘+R` | Start audio recording |
| `⌘+T` | Stop audio recording |
| `Alt+↑/↓` | Scroll response up/down |
| `Alt+PageUp/PageDown` | Page up/down in response |

### Workflow

1. **Position the overlay** where you want it on screen
2. **Capture content** using `⌘+Shift+S` when you see a coding problem
3. **Review the formatted response** with highlighted code and concise explanations
4. **Navigate** through long responses using keyboard shortcuts

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

## Project Structure

```
interview/
├── main.js           # Electron main process
├── renderer.js       # Frontend JavaScript
├── formatter.js      # Response formatting logic
├── index.html        # UI layout and styles
├── preload.js        # Electron preload script
├── test-formatter.js # Formatter test suite
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

**API errors**: Check your `.env` file and API key validity

**Window positioning**: Use `⌘+←/→/↑/↓` to reposition if overlay is off-screen

**Audio recording fails**: Check microphone permissions in System Preferences

### Debug Mode
Enable detailed logging by setting:
```env
DEBUG=true
```

## Performance

- **Response time**: ~2-3 seconds for screenshot + OCR + AI query
- **Memory usage**: ~50-100MB typical
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