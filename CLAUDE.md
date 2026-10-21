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
The AI system supports four distinct processing flows for different use cases:

- **SimpleAIManager** (`src/js/ai/simple-ai-manager.js`) - Main AI controller with session management
- **SimpleAI** (`src/js/ai/simple-ai.js`) - Direct HTTP functions for all AI providers
- **AIConfig** (`src/js/ai/ai-config.js`) - Centralized configuration management
- **AI Flows**:
  - **LOCAL** - Ollama local models only (fast, private, single-phase)
  - **CLOUD** - Two-phase parallel: `deepseek-v4-pro` non-thinking fast answer → thinking-mode verification
  - **HYBRID** - Two-phase parallel: Ollama brute-force → `deepseek-v4-pro` thinking-mode optimization
  - **STEPS** - Three-phase sequential: Problem clarification → Brute-force approach → Optimized solution (human-like problem solving)
- **Supported Providers**:
  - Ollama - Local AI models with hybrid model support (`OLLAMA_HYBRID_MODEL`)
  - OpenAI - GPT models via API
  - HuggingFace - Inference API
  - DeepSeek V4 - Single model with per-request thinking/non-thinking mode

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
- **KeyHoldManager** (`src/js/key-hold-manager.js`) - Continuous window movement and resizing on key hold
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

# Hybrid Flow Model Configuration (Phase 1: Brute-force solution)
OLLAMA_HYBRID_MODEL=qwen3:4b-instruct-2507-fp16  # Global fallback for all interview types

# Optional: Interview-type-specific hybrid models (overrides OLLAMA_HYBRID_MODEL)
# OLLAMA_HYBRID_MODEL_DSA=qwen3:4b-instruct-2507-fp16           # For DSA interviews
# OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN=magistral                   # For System Design interviews
# OLLAMA_HYBRID_MODEL_LLD=magistral                             # For Low-Level Design interviews

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# HuggingFace Configuration
HF_TOKEN=your_huggingface_token
HF_PROVIDER=hyperbolic
HF_MODEL=deepseek-ai/DeepSeek-R1-0528

# DeepSeek Configuration (V4 with Thinking Mode) - Required for CLOUD, HYBRID, and STEPS AI flows
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-v4-pro  # Default model (optional, defaults to deepseek-v4-pro)

# Optional: Override flow-specific DeepSeek models
# DEEPSEEK_CLOUD_MODEL=deepseek-v4-flash  # Model for non-thinking phases (CLOUD flow)
# DEEPSEEK_HYBRID_MODEL=deepseek-v4-pro   # Model for thinking-mode optimization (HYBRID flow)
# DEEPSEEK_STEPS_MODEL=deepseek-v4-pro    # Model for STEPS flow optimization phase (default: deepseek-v4-pro)
# DEEPSEEK_REASONING_EFFORT=high          # Thinking effort: high or max (default: high)

# Optional: Timeout configuration
# DEEPSEEK_TIMEOUT=120000                 # General timeout in ms (default: 120000 = 2 minutes)

# Global timeouts for thinking mode (applies to all interview types unless overridden)
# DEEPSEEK_REASONER_TIMEOUT=100000        # Timeout for thinking mode in CLOUD/HYBRID flows (default: 100000 = 100 seconds)
# DEEPSEEK_STEPS_TIMEOUT=240000           # Timeout for thinking mode in STEPS flow optimization (default: 240000 = 4 minutes)

# Optional: Interview-type-specific timeouts for thinking mode in CLOUD/HYBRID flows
# DEEPSEEK_REASONER_TIMEOUT_DSA=100000            # DSA interviews (default: 100 seconds)
# DEEPSEEK_REASONER_TIMEOUT_SYSTEM_DESIGN=180000  # System Design interviews (default: 180 seconds = 3 minutes)
# DEEPSEEK_REASONER_TIMEOUT_LLD=180000            # Low-Level Design interviews (default: 180 seconds = 3 minutes)

# Optional: Interview-type-specific timeouts for thinking mode in STEPS flow
# DEEPSEEK_STEPS_TIMEOUT_DSA=240000               # DSA interviews (default: 240 seconds = 4 minutes)
# DEEPSEEK_STEPS_TIMEOUT_SYSTEM_DESIGN=360000     # System Design interviews (default: 360 seconds = 6 minutes)
# DEEPSEEK_STEPS_TIMEOUT_LLD=360000               # Low-Level Design interviews (default: 360 seconds = 6 minutes)

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

### DeepSeek V4
The app uses **`deepseek-v4-pro`** (1M context). `deepseek-v4-flash` is the cheaper
alternative and can be swapped in per flow via environment variables.

**Important:** V4 replaced the V3.1 model split. `deepseek-chat` and `deepseek-reasoner`
were retired on 2026-07-24 and no longer resolve. Thinking mode is now a **per-request
switch on a single model**, not a separate model id:

```json
{ "model": "deepseek-v4-pro", "thinking": { "type": "enabled", "reasoning_effort": "high" } }
```

- **Non-thinking mode** (`{"type": "disabled"}`): fast responses, no reasoning loop.
  Used for clarification, fast-answer, and brute-force phases.
  Honours `temperature` / `top_p`.
- **Thinking mode** (`{"type": "enabled"}`): deep step-by-step reasoning, streamed via
  `reasoning_content` deltas. Used for verification and optimization phases.
  - **Timeout Protection**: 100s default (up to 360s) to prevent endless thinking
  - Sampling parameters (`temperature`, `top_p`, `presence_penalty`, `frequency_penalty`)
    have **no effect** in thinking mode and are stripped from the request
  - `reasoning_effort` is `high` by default; `max` for deeper analysis
    (`low`/`medium` map to `high`, `xhigh` maps to `max`)
- **Mode selection**: driven by flow type, not model name — see `thinkingByFlow` in
  `ai-config.js` and `AIConfig.isThinkingFlow()`. CLOUD flow → non-thinking,
  HYBRID/STEPS flows → thinking.
- **Fallback**: if a thinking request times out or returns reasoning without a final
  answer, the phase automatically retries the same model in non-thinking mode.

### Timeout Configuration
To prevent thinking mode from running too long:

**CLOUD/HYBRID Flows:**
- **Default Timeouts by Interview Type**:
  - **DSA**: 100 seconds - reasonable for algorithmic problems
  - **System Design**: 180 seconds (3 minutes) - more time for architecture decisions
  - **LLD**: 180 seconds (3 minutes) - more time for design pattern selection
- **Global Override**: Set `DEEPSEEK_REASONER_TIMEOUT` to apply same timeout to all interview types
- **Interview-Specific Override**: Set `DEEPSEEK_REASONER_TIMEOUT_SYSTEM_DESIGN` or `DEEPSEEK_REASONER_TIMEOUT_LLD` for specific types
- **Examples**:
  - `DEEPSEEK_REASONER_TIMEOUT=120000` - 2 minutes for all interview types
  - `DEEPSEEK_REASONER_TIMEOUT_SYSTEM_DESIGN=240000` - 4 minutes for System Design only
  - `DEEPSEEK_REASONER_TIMEOUT_LLD=210000` - 3.5 minutes for LLD only
- **Behavior**: If timeout is hit, request is cancelled and error is returned

**STEPS Flow:**
- **Default Timeouts by Interview Type**:
  - **DSA**: 240 seconds (4 minutes) - allows deep algorithmic optimization
  - **System Design**: 360 seconds (6 minutes) - more time for scalability analysis
  - **LLD**: 360 seconds (6 minutes) - more time for design pattern refinement
- **Global Override**: Set `DEEPSEEK_STEPS_TIMEOUT` to apply same timeout to all interview types
- **Interview-Specific Override**: Set `DEEPSEEK_STEPS_TIMEOUT_SYSTEM_DESIGN` or `DEEPSEEK_STEPS_TIMEOUT_LLD` for specific types
- **Examples**:
  - `DEEPSEEK_STEPS_TIMEOUT=300000` - 5 minutes for all interview types
  - `DEEPSEEK_STEPS_TIMEOUT_SYSTEM_DESIGN=420000` - 7 minutes for System Design only
- **Purpose**: STEPS flow Phase 2 (optimization) benefits from extended thinking time, especially for design problems
- **Behavior**: If timeout is hit, automatic fallback to non-thinking mode for faster optimization

**Why Different Timeouts?**
- System Design and LLD problems typically require more reasoning time than DSA problems
- Architecture decisions and design pattern selection need deeper analysis than algorithmic optimization
- Default timeouts are tuned based on typical interview problem complexity

### Flow Details

#### LOCAL Flow (Single-Phase)
- **Model**: Ollama (configurable)
- **Speed**: Fastest (local execution)
- **Use Case**: Quick responses, privacy-focused, offline

#### CLOUD Flow (Two-Phase Sequential)
- **Phase 1 - Fast Answer**: `deepseek-v4-pro` in non-thinking mode provides correct, efficient solution (streams immediately to UI)
- **Phase 2 - Verification**: `deepseek-v4-pro` in thinking mode receives Phase 1's answer and validates/suggests improvements
- **Sequential Execution**: Phase 2 starts after Phase 1 completes with Phase 1's solution as context
- **Total Time**: answer_time + verification_time
- **Perceived Latency**: answer_time (user sees Phase 1 results immediately)
- **Use Case**: Cloud-powered answer with deep verification for confidence

#### HYBRID Flow (Two-Phase Sequential)
- **Phase 1 - Brute Force**: Ollama provides working solution quickly (streams immediately to UI)
- **Phase 2 - Optimization**: `deepseek-v4-pro` in thinking mode receives Phase 1's solution and optimizes it
- **Sequential Execution**: Phase 2 starts after Phase 1 completes with Phase 1's solution as context
- **Total Time**: local_time + cloud_time
- **Perceived Latency**: local_time (user sees Phase 1 results immediately)
- **Use Case**: Instant local answer with cloud-powered optimization
- **Interview-Type-Specific Models**: Phase 1 supports different Ollama models for each interview type:
  - **DSA**: Uses `OLLAMA_HYBRID_MODEL_DSA` (default: `qwen3:4b-instruct-2507-fp16`)
  - **System Design**: Uses `OLLAMA_HYBRID_MODEL_SYSTEM_DESIGN` (default: `magistral`)
  - **Low-Level Design**: Uses `OLLAMA_HYBRID_MODEL_LLD` (default: `magistral`)
  - **Fallback**: If interview-specific model not set, uses `OLLAMA_HYBRID_MODEL`
  - **Rationale**: Different models excel at different interview types (e.g., Magistral for design, Qwen for algorithms)

#### STEPS Flow (Three-Phase Sequential)
Human-like problem-solving approach with systematic step-by-step reasoning:

- **Phase 0 - Clarification**: `deepseek-v4-pro` in non-thinking mode generates clarifying questions and immediately answers them with reasonable assumptions (auto-Q&A format, no code)
- **Phase 1 - Brute Force**: `deepseek-v4-pro` in non-thinking mode provides simple brute-force algorithm/pseudocode with step-by-step breakdown
- **Phase 2 - Optimization**: `deepseek-v4-pro` in thinking mode receives Phase 1's solution and optimizes it (4-minute timeout for deep reasoning)
- **Sequential Execution**: Each phase builds on the previous phase's output as context
- **Total Time**: clarification_time + bruteforce_time + optimization_time
- **Perceived Latency**: clarification_time (user sees each phase immediately as it completes)
- **Key Features**:
  - Minimal, step-by-step answers at each phase
  - Auto-generated Q&A in Phase 0 (no user interaction needed)
  - Extended reasoning timeout (240s) for Phase 2 optimization
  - If optimization isn't possible within timeout, AI explicitly states "already optimal"
- **Use Case**: Systematic interview-style problem solving, mimicking human thought process with clarification → simple solution → optimization

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
- `Cmd/Ctrl+Arrow Keys` - Move window (hold for continuous movement)
- `Cmd/Ctrl+Mouse Move` - Move window to follow cursor (no clicking needed)

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
- `Opt+Cmd` / `Alt+Ctrl` - AI flow toggle (LOCAL→CLOUD→HYBRID→STEPS)
- `Cmd/Ctrl+Shift+O` - **O**CR filter toggle (shows status message)
- `Cmd/Ctrl+Shift+D` - **D**ark/light theme toggle
- `Cmd/Ctrl+Shift+V` - **V**iew conversation history in browser
- `Cmd/Ctrl+Shift+C` - **C**enter window

### **TIER 5: Fine Control** *(Double Modifier + Arrows/Symbols)*
**Precise adjustments for power users:**
- `Cmd/Ctrl+Shift+Up/Down` - Resize window height (hold for continuous)
- `Cmd/Ctrl+Shift+[ ]` - Resize window width (hold for continuous)
- `Cmd/Ctrl+Shift+Left/Right` - Scroll page up/down
- `Cmd/Ctrl+Shift+< >` - Adjust CodeMirror transparency (hold for continuous, shows transparency %)

### **Additional Features**
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
- **Continuous Actions**: Hold window movement and resize keys for smooth continuous adjustments

### **Status Message System**
- All shortcut operations provide visual feedback with status messages
- Messages display for 3-4 seconds with message queuing
- Clear emoji indicators for operation types
- Window operations show dimensions and step sizes
- Model operations show current model and session info

### **Continuous Window Controls**
The application uses native keyboard and mouse hooks (`uiohook-napi`) for smooth continuous window operations:

**Features:**
- Hold any movement or resize key for continuous action (20 updates/second)
- 300ms initial delay before continuous action starts
- Automatic stop when key is released
- Keys blocked from other apps when window is visible
- Single-press fallback for quick adjustments
- **Mouse Following**: Hold `Cmd/Ctrl` and move mouse to make window follow cursor
  - Works cross-platform (Cmd on macOS, Ctrl on Windows/Linux)
  - No clicking or dragging required - just hold modifier and move mouse
  - No visual feedback (invisible follow mode)
  - Smooth following at native mouse refresh rate
  - Stops following when modifier key is released
  - Compatible with existing keyboard-based movement

**Implementation:**
- **KeyHoldManager** (`src/js/key-hold-manager.js`) - Native keyboard and mouse event listener
  - Handles keyboard-based continuous movement and resizing
  - Handles mouse following with `Cmd/Ctrl` modifier (no clicking needed)
  - Preserves existing `Cmd/Ctrl+Double-Click` repositioning feature
- **ShortcutManager** (`src/js/shortcut-manager.js`) - Single-press fallback handlers
- **Centralized Configuration** (`src/js/window-controls-config.js`) - Single source of truth for all step sizes
  - `moveStep`: 10px - Window movement increment (used by both managers)
  - `resizeStep`: 10px - Window resize increment (used by both managers)
  - `holdDelayMs`: 300ms - Delay before continuous action starts
  - `repeatIntervalMs`: 50ms - Update frequency (20 times per second)
  - `minSize`: 50px - Minimum window dimension
  - `messageThrottleMs`: 500ms - Status message throttling
- **Movement**: `Cmd/Ctrl+Arrow Keys` - Uses `moveStep` from config
- **Resizing**: `Cmd/Ctrl+Shift+Arrows/Brackets` - Uses `resizeStep` from config
- **Mouse Following**: `Cmd/Ctrl+Mouse Move` - Direct window positioning at mouse movement rate (no clicking)
- Status messages throttled to prevent flooding

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

### Modifying Window Control Settings
- All window movement and resize step sizes are centralized in `window-controls-config.js`
- **Single source of truth**: Both `KeyHoldManager` and `ShortcutManager` import from this file
- **Step sizes**: `moveStep` (10px) and `resizeStep` (10px) control increment amounts
- **Timing**: `holdDelayMs` (300ms) and `repeatIntervalMs` (50ms) control continuous action behavior
- **Constraints**: `minSize` (50px) prevents window from becoming too small
- **No code duplication**: Changes automatically apply to both continuous holding and single-press actions
- Restart the application to apply configuration changes

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
├── key-hold-manager.js    # Continuous window movement and resizing
├── window-controls-config.js # Centralized configuration for window controls
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