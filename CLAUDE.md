# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron-based DeepSeek Overlay Helper application that captures screenshots, performs OCR, and queries AI models for coding interview assistance. The application features a transparent overlay interface with advanced AI integration, session management, and response formatting.

## Development Commands

### Testing
- `npm test` - Run all tests (cleaner, markdown, session)
- `npm run test:cleaner` - Test OCR text cleaning functionality
- `npm run test:markdown` - Test markdown section processing
- `npm run test:session` - Test session management

### Development
- `npm start` - Start the Electron application
- `npm run dev` - Start in debug mode
- `npm run lint` - Lint JavaScript files with ESLint
- `npm run format` - Format code with Prettier

### OCR Analysis
- `npm run analyze:ocr` - Analyze OCR logs from last 7 days (default)
- `npm run analyze:ocr:30d` - Analyze OCR logs from last 30 days

## Core Architecture

### AI System (Modern Object-Oriented)
The AI system uses Strategy and Factory patterns for extensible provider management:

- **AIManager** (`src/js/ai/ai-manager.js`) - Main AI controller with session management
- **ProviderFactory** (`src/js/ai/provider-factory.js`) - Creates AI provider instances
- **AIConfig** (`src/js/ai/ai-config.js`) - Centralized configuration management
- **Providers** (`src/js/ai/providers/`) - Individual AI provider implementations
  - `base-provider.js` - Abstract base class for all providers
  - `ollama-provider.js` - Local Ollama integration
  - `openai-provider.js` - OpenAI API integration
  - `huggingface-provider.js` - HuggingFace Inference API
  - `deepseek-provider.js` - DeepSeek API integration

### Application Structure
- **AppController** (`src/js/app-controller.js`) - Main application controller
- **WindowManager** (`src/js/window-manager.js`) - Electron window management
- **ShortcutManager** (`src/js/shortcut-manager.js`) - Global keyboard shortcuts
- **RegionSelector** (`src/js/region-selector.js`) - Screen region selection
- **Formatter** (`src/js/formatter.js`) - AI response formatting and code highlighting
- **OCRLogger** (`src/js/ocr-logger.js`) - OCR session logging and analysis

### OCR and Text Processing
- **LLMFriendlyOCRCleaner** (`src/js/llm-friendly-ocr-cleaner.js`) - Simple text cleaning to remove obvious UI junk while preserving useful content
- **OCRLogger** - Comprehensive logging for OCR performance analysis
- Region selection capability to reduce OCR noise

## Environment Configuration

Create a `.env` file with these settings:

```bash
# AI Provider Selection
AI_PROVIDER=ollama

# Ollama Configuration
OLLAMA_MODEL=gpt-oss
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# HuggingFace Configuration
HF_TOKEN=your_huggingface_token
HF_PROVIDER=hyperbolic
HF_MODEL=deepseek-ai/DeepSeek-R1-0528

# DeepSeek Configuration
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
```

## Key Patterns and Conventions

### AI Provider Development
When adding new AI providers:
1. Extend `BaseAIProvider` class
2. Implement required methods: `chatCompletion()`, `warmup()`, `getConfig()`
3. Register with ProviderFactory
4. Add configuration template to AIConfig

### Session Management
- Sessions are maintained per provider-model combination
- History limited to last 20 messages to prevent context overflow
- Use `clearSession()` or `clearAllSessions()` for memory management

### Error Handling
- All AI operations should handle provider failures gracefully
- Use warmup checks before making requests
- Implement fallback providers when possible

### Code Style
- Prettier configuration in `.prettierrc`
- ESLint for code quality
- Single quotes, 2-space tabs, 100-char line limit
- Use semicolons and trailing commas

## Keyboard Shortcuts

### Screen Capture
- `Cmd+Shift+S` - Capture full screen
- `Cmd+Shift+A` - Select region to capture (reduces OCR noise)

### Window Management
- `Cmd+←/→/↑/↓` - Move overlay window
- `Cmd+Shift+=/−` - Resize window
- `Cmd+B` - Hide/show application
- `Cmd+Shift+0` - Toggle window size

### AI and Session Control
- `Cmd+Shift+R` - Reset session (clear context)
- `Cmd+Shift+P` - Switch AI provider
- `Cmd+Shift+W` - Manual model warmup (Ollama)
- `Cmd+Shift+F` - Toggle OCR filtering

### Audio
- `Cmd+R` - Start audio recording
- `Cmd+T` - Stop audio recording

## Testing Approach

The project uses Node.js-based testing without external frameworks:
- Test files are in the `/tests` directory
- Run individual test suites with `npm run test:*` commands
- Tests cover OCR cleaning, session management, and response formatting
- All tests should pass before committing changes

## Common Development Tasks

### Adding a New AI Provider
1. Create new provider class in `src/js/ai/providers/`
2. Register in `provider-factory.js`
3. Add configuration in `ai-config.js`
4. Update environment variables documentation
5. Add tests in `/tests` directory

### Modifying OCR Text Cleaning
- The OCR cleaner has been simplified to only remove obvious UI junk (single characters, timestamps, system indicators)
- Update `junkPatterns` array in `llm-friendly-ocr-cleaner.js` to add/remove filtering patterns
- Test with `npm run test:cleaner` - all 20 tests should pass
- Use OCR logging analysis to verify improvements with `npm run analyze:ocr`

### Response Formatting Changes
- Modify `formatter.js` for code highlighting and response processing
- Test with various AI responses to ensure compatibility
- Update tests as needed

## File Structure Context

```
src/js/
├── ai/                     # Modern AI system with Strategy pattern
│   ├── ai-manager.js       # Main AI controller
│   ├── ai-config.js        # Configuration management
│   ├── provider-factory.js # Provider creation
│   └── providers/          # Individual provider implementations
├── app-controller.js       # Main application controller
├── formatter.js           # Response formatting and code highlighting
├── llm-friendly-ocr-cleaner.js # OCR text cleaning
├── ocr-logger.js          # OCR performance logging
├── shortcut-manager.js    # Keyboard shortcuts
└── window-manager.js      # Electron window management

tests/                     # Node.js test files
docs/                      # Additional documentation
logs/ocr/                  # OCR processing logs for analysis
```

## Important Implementation Notes

- The application maintains conversation context across screenshot captures
- OCR text cleaning is critical for reducing AI confusion from UI elements
- Region selection (`Cmd+Shift+A`) significantly improves OCR accuracy
- Provider switching allows fallback options when primary AI service fails
- Session management prevents context overflow while maintaining conversation flow
- Response formatting includes syntax highlighting for multiple programming languages