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

### AI Response Analysis
- `npm run analyze:responses` - Analyze AI response logs from last 7 days (default)
- `npm run analyze:responses:30d` - Analyze AI response logs from last 30 days

### Development
- `npm start` - Start the Electron application
- `npm run dev` - Start in debug mode
- `npm run lint` - Lint JavaScript files with ESLint
- `npm run format` - Format code with Prettier

### OCR Analysis
- `npm run analyze:ocr` - Analyze OCR logs from last 7 days (default)
- `npm run analyze:ocr:30d` - Analyze OCR logs from last 30 days

## Core Architecture

### AI System with Flow Management
The AI system supports three distinct processing flows for different use cases:

- **SimpleAIManager** (`src/js/ai/simple-ai-manager.js`) - Main AI controller with session management
- **SimpleAI** (`src/js/ai/simple-ai.js`) - Direct HTTP functions for all AI providers
- **AIConfig** (`src/js/ai/ai-config.js`) - Centralized configuration management
- **AI Flows**:
  - **LOCAL** - Ollama local models only (fast, private)
  - **CLOUD** - DeepSeek API only (enhanced reasoning)
  - **HYBRID** - Streaming: local response first, then DeepSeek analysis appended
- **Supported Providers**:
  - Ollama - Local AI models with hybrid model support (`OLLAMA_HYBRID_MODEL`)
  - OpenAI - GPT models via API
  - HuggingFace - Inference API
  - DeepSeek V3.1 - With think mode support for enhanced reasoning

### Interview Types System
The application supports three types of FAANG technical interviews:

- **DSA (Data Structures & Algorithms)** - Default mode
  - Focus: Brute-force reasoning, optimization, complexity analysis
  - Structure: Problem restatement → Step-by-step approach → Edge cases → Code implementation

- **System Design**
  - Focus: Scalability, high-level architecture, trade-offs
  - Components: Load balancers, databases, caches, queues, CDN
  - Topics: CAP theorem, sharding, replication, consistency models

- **LLD (Low-Level Design / Machine Coding)**
  - Focus: OOP principles (SOLID), design patterns, clean code
  - Patterns: Factory, Strategy, Observer, Singleton, State
  - Structure: Requirements → Design patterns → Class hierarchy → Implementation

**Usage:**
- Switch types with `Cmd/Ctrl+Shift+T` (cycles through DSA → System Design → LLD)
- System prompts are automatically tailored for each interview type
- Session is cleared when switching types to apply new prompts

### Application Structure
- **AppController** (`src/js/app-controller.js`) - Main application controller
- **WindowManager** (`src/js/window-manager.js`) - Electron window management
- **ShortcutManager** (`src/js/shortcut-manager.js`) - Global keyboard shortcuts
- **RegionSelector** (`src/js/region-selector.js`) - Screen region selection
- **Formatter** (`src/js/formatter.js`) - AI response formatting and code highlighting
- **AIResponseLogger** (`src/js/ai-response-logger.js`) - Logs all AI responses for formatter analysis and improvement
- **ConversationWebSocketServer** (`src/js/conversation-websocket-server.js`) - Real-time WebSocket server for live conversation history updates

### OCR and Text Processing
- **LLMFriendlyOCRCleaner** (`src/js/llm-friendly-ocr-cleaner.js`) - Simple text cleaning to remove obvious UI junk while preserving useful content
- Region selection capability to reduce OCR noise

### AI Response Logging & Analysis
The application automatically logs all AI responses to help improve the formatter and analyze patterns:

- **Automatic Logging**: Every AI response is logged to `logs/ai-responses/YYYY-MM-DD.jsonl`
- **Rich Metadata**: Includes provider, model, interview type, flow type, question, response, timestamps
- **Analysis Tools**: Use `npm run analyze:responses` to analyze logged responses
- **Formatter Improvements**: Use logged responses to test and improve formatter patterns
- **Privacy**: Logs are gitignored and stored locally only

**What's Logged:**
- Provider and model information
- Interview type (DSA, System Design, LLD)
- Flow type (local, cloud, hybrid)
- Complete question and response text
- Response length and session message count
- Error status
- Timestamp

**Analysis Features:**
- Response statistics by provider, model, and interview type
- Markdown pattern detection (code blocks, headers, lists, tables, math)
- Common structure identification
- Response length analytics
- Recommendations for formatter improvements

## Environment Configuration

Create a `.env` file with these settings:

```bash
# AI Provider Selection
AI_PROVIDER=ollama

# Ollama Configuration
OLLAMA_MODEL=gpt-oss
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_HYBRID_MODEL=qwen3:4b-instruct-2507-fp16

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# HuggingFace Configuration
HF_TOKEN=your_huggingface_token
HF_PROVIDER=hyperbolic
HF_MODEL=deepseek-ai/DeepSeek-R1-0528

# DeepSeek Configuration (V3.1 with Think Mode) - Required for HYBRID AI flow
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-reasoner

# AssemblyAI Configuration (for speech-to-text)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
ASSEMBLYAI_LANGUAGE=en
ASSEMBLYAI_AUTO_DETECT=false
```

## Key Patterns and Conventions

### AI Provider Development
The system now uses simple functions instead of classes:
1. Add provider configuration to `ai-config.js`
2. Implement handler function in `simple-ai.js` (follow existing patterns)
3. Most providers use OpenAI-compatible APIs for easy integration

### DeepSeek V3.1
DeepSeek V3.1 is configured with optimized parameters for enhanced reasoning:
- **Think mode**: Uses `<think>` tags automatically for step-by-step reasoning
- **Optimized parameters**: Lower temperature (0.1) and higher token limits (4096)
- **Version**: Automatically uses V3.1 API features

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

## Psychology-Optimized Keyboard Shortcuts

*Designed using cognitive psychology principles for better memorability, reduced key distance, and lower mental load. Works cross-platform with Cmd (macOS) or Ctrl (Windows/Linux).*

### **TIER 1: Core Functions** *(Single Modifier - Most Used)*
**Easy-to-reach keys with strong mnemonics:**
- `Cmd/Ctrl+Q` - **Q**uit application
- `Cmd/Ctrl+A` - **A**rea screenshot (region selection)
- `Cmd/Ctrl+B` - Show/hide window (preserving original)
- `Cmd/Ctrl+Arrow Keys` - Move window (natural directional mapping with visual feedback)

### **TIER 2: Workflows** *(Numbers - Sequential Operations)*
**1→2→3 natural sequence for screenshot stack workflow:**
- `Cmd/Ctrl+1` - Add region screenshot to stack
- `Cmd/Ctrl+2` - Process screenshot stack
- `Cmd/Ctrl+3` - Clear screenshot stack

### **TIER 3: Utilities** *(Function Keys - Universal Standards)*
- `F1` - Help (universal help key)
- `F11` - Toggle small window / fullscreen (alternative)

### **TIER 4: Advanced Features** *(Double Modifier - Less Frequent)*
**Grouped by function with memorable mnemonics:**
- `Cmd/Ctrl+Shift+0` - Toggle small window / fullscreen
- `Cmd/Ctrl+Shift+R` - **R**eset AI session
- `Cmd/Ctrl+Shift+F` - AI **F**low toggle (LOCAL→CLOUD→HYBRID)
- `Cmd/Ctrl+Shift+O` - **O**CR filter toggle (shows status message)
- `Cmd/Ctrl+Shift+D` - **D**ark/light theme toggle
- `Cmd/Ctrl+Shift+V` - **V**iew conversation history in browser
- `Cmd/Ctrl+Shift+C` - **C**enter window

### **TIER 5: Fine Control** *(Double Modifier + Arrows/Symbols)*
**Precise adjustments for power users:**
- `Cmd/Ctrl+Shift+Up/Down` - Resize window height (shows dimensions)
- `Cmd/Ctrl+Shift+[ ]` - Resize window width (shows dimensions)
- `Cmd/Ctrl+Shift+Plus/Minus` - Adjust CodeMirror transparency (shows transparency %)

### **Additional Features**
- `Alt/Opt+Z/X` - Scroll page up/down
- `Cmd/Ctrl+Shift+M` - Switch Ollama **M**odel (shows model info)
- `Cmd/Ctrl+Shift+T` - Cycle interview **T**ype (DSA → System Design → LLD)
- `Cmd/Ctrl+Shift+Y` - Toggle s**Y**stem prompts
- `Cmd/Ctrl+Shift+W` - Model **W**armup (Ollama, shows warmup status)
- `Cmd/Ctrl+Shift+L` - Toggle code-only view (**L**anguage mode)
- `Cmd/Ctrl+Shift+I` - Developer tools (**I**nspect)

**Note:** Speech recording is now handled via WebSocket in browser interface.

### **Psychology Benefits**
- **Visual Feedback**: All operations now show status messages (improved UX)
- **Better Mnemonics**: Q=Quit, A=Area, O=OCR, D=Dark, V=View
- **Muscle Memory**: Consistent modifier patterns across tiers
- **Logical Grouping**: Functions organized by frequency and relatedness
- **Cross-Platform**: Same logical keys work on macOS (Cmd) and Windows (Ctrl)

### **Status Message System**
- All shortcut operations provide visual feedback with status messages
- Messages display for 3-4 seconds with message queuing
- Clear emoji indicators for operation types
- Window operations show dimensions and step sizes
- Model operations show current model and session info

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

### Math Formula Support
- **LaTeX Rendering**: Full support for LaTeX math formulas using KaTeX
- **Inline Math**: Use `$formula$` for inline mathematical expressions
- **Block Math**: Use `$$formula$$` for centered display equations
- **Advanced Features**: Supports complex formulas, integrals, summations, fractions, Greek letters
- **Theme Integration**: Math formulas automatically adapt to light/dark themes
- **Error Handling**: Invalid formulas show in red with error tooltips
- **Examples**: `$E = mc^2$`, `$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$`

### Conversation History Management
- **Real-time WebSocket Updates**: Conversation history is broadcast instantly via WebSocket after each AI query
- **Live Browser URL**: Use `Cmd+Shift+V` to open the live conversation history at `http://localhost:[port]`
- **WebSocket Server**: Automatically starts on app launch, serves HTML and provides real-time updates
- **Connection Status**: Browser page shows live connection status with automatic reconnection
- **Full Context**: History includes provider info, session stats, and complete conversation context
- **Session Clearing**: `Cmd+Shift+R` clears session and broadcasts update to connected browsers

### Speech-to-Text Language Configuration
- **English Optimization**: By default, speech recognition is configured for English (`ASSEMBLYAI_LANGUAGE=en`)
- **Language Options**: Support for 90+ languages including Spanish (`es`), French (`fr`), German (`de`), etc.
- **Auto Detection**: Set `ASSEMBLYAI_AUTO_DETECT=true` to enable automatic language detection
- **English Features**: When using English, additional features are enabled:
  - Auto highlights of important phrases
  - Profanity filtering
  - Enhanced punctuation and formatting
- **Runtime Changes**: Language can be changed programmatically via IPC without restart

### OCR + Speech Integrated Features
- **Session-Based Context**: All conversation history (OCR + speech + text) maintained in AI session
- **Automatic Context Inheritance**: Speech input automatically benefits from previous conversation context
- **No Manual Context Management**: AI session handles all context automatically (up to 20 messages)
- **Visual Indicators**: UI shows when speech is processing with conversation context (purple indicator)
- **Seamless Workflow**: Screenshot → Ask question via speech → Get contextual AI response
- **Simplified Architecture**: Uses existing session system instead of separate OCR context tracking

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
├── ai-response-logger.js  # AI response logging for formatter analysis
├── shortcut-manager.js    # Keyboard shortcuts
├── conversation-websocket-server.js # WebSocket server for real-time conversation history updates
└── window-manager.js      # Electron window management

tests/                     # Node.js test files
scripts/                   # Utility scripts
└── analyze-ai-responses.js # Analyze AI response logs
docs/                      # Additional documentation
logs/
├── ai-responses/          # AI response logs for formatter analysis
└── ocr/                   # OCR processing logs for analysis (future)
conversation-history-websocket.html # WebSocket-powered live viewer (served by server)
```

## Important Implementation Notes

- The application maintains conversation context across screenshot captures
- OCR text cleaning is critical for reducing AI confusion from UI elements
- Region selection (`Cmd+Shift+A`) significantly improves OCR accuracy
- Provider switching allows fallback options when primary AI service fails
- Session management prevents context overflow while maintaining conversation flow
- Response formatting includes syntax highlighting for multiple programming languages