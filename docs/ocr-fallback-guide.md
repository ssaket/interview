# OCR Fallback Guide

## Overview

The OCR Fallback system provides intelligent AI model selection for screenshot analysis. It automatically uses local Ollama models for fast, private processing, with an optional fallback to DeepSeek's cloud models for enhanced analysis when needed.

## Key Features

- **Local-First Processing**: Always starts with Ollama (runs locally, private, fast)
- **Cloud Fallback**: Optionally queries DeepSeek for additional insights when Burn Mode is enabled
- **Dual Response**: Shows both local and cloud responses side-by-side in Burn Mode
- **Smart Provider Management**: Automatically switches providers and restores context
- **Formatter Integration**: Works seamlessly with the existing response formatter

## How It Works

### Normal Mode (Default)
1. Take screenshot (Cmd+Shift+S or Cmd+Shift+A)
2. OCR extracts text from image
3. Query sent to **Ollama only** (local processing)
4. Response displayed with formatting

### Burn Mode (Enhanced)
1. Take screenshot (Cmd+Shift+S or Cmd+Shift+A)  
2. OCR extracts text from image
3. Query sent to **both Ollama AND DeepSeek**
4. Dual response displayed showing both perspectives

## User Interface

### Status Messages

**Normal Mode:**
```
🤖 Querying Ollama (local)...
```

**Burn Mode:**
```
🤖 Querying Ollama (local) + 🔥 DeepSeek (cloud)...
```

### Response Format

**Normal Mode Response:**
```
[Standard AI response from Ollama model]
```

**Burn Mode Response:**
```
🤖 phi3:mini (Local)
[Ollama response here]

---

🔥 deepseek-chat (Cloud)
[DeepSeek response here]

*Burn mode: Showing responses from both local and cloud providers*
```

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd+Shift+S` | Full Screenshot | Capture entire screen + OCR + AI query |
| `Cmd+Shift+A` | Region Screenshot | Capture window region + OCR + AI query |
| `Cmd+Shift+Q` | Toggle Burn Mode | Enable/disable dual provider queries |
| `Cmd+Shift+M` | Cycle Ollama Models | Switch between available Ollama models |
| `Cmd+Shift+F` | Toggle OCR Filtering | Enable/disable text cleanup |
| `Cmd+Shift+L` | Toggle Formatter | Enable/disable response formatting |

## Configuration

### Environment Variables

```bash
# Ollama Configuration (for local processing)
OLLAMA_MODEL=phi3:mini           # Default Ollama model

# DeepSeek Configuration (for cloud fallback)
DEEPSEEK_API_KEY=your-api-key    # Required for Burn Mode
DEEPSEEK_MODEL=deepseek-chat     # Model for OCR queries
```

### Available Ollama Models

**Simple Models** (default set):
- `phi3:mini` - Fast, lightweight reasoning
- `codellama:7b-instruct` - Code-focused responses  
- `mistral` - General purpose model

**Extended Models** (available in Burn Mode):
- All simple models plus additional models configured in your system

## Usage Examples

### Example 1: Code Screenshot Analysis

**Normal Mode Output:**
```
This appears to be a JavaScript function that handles user authentication...
```

**Burn Mode Output:**
```
🤖 phi3:mini (Local)
This appears to be a JavaScript function that handles user authentication...

---

🔥 deepseek-chat (Cloud)  
This is a JavaScript authentication handler with the following components:
1. Input validation for email/password
2. JWT token generation
3. Error handling for invalid credentials
[More detailed analysis...]

*Burn mode: Showing responses from both local and cloud providers*
```

### Example 2: Error Message Analysis

**Workflow:**
1. See error on screen
2. Press `Cmd+Shift+A` to capture region
3. OCR extracts error text
4. AI analyzes and suggests solutions

### Example 3: Document/PDF Content

**With OCR Filtering ON:**
- Cleans up messy OCR text
- Removes artifacts and formatting issues
- Preserves code blocks and questions

**With OCR Filtering OFF:**
- Raw OCR text sent to AI
- Useful for analyzing OCR quality issues

## Model Cycling

### Switching Ollama Models

Press `Cmd+Shift+M` to cycle through available models:

1. **If using Ollama**: Cycles to next model in sequence
2. **If using other provider**: Switches to Ollama first, then enables cycling

**Normal Mode Sequence:**
```
phi3:mini → codellama:7b-instruct → mistral → phi3:mini...
```

**Burn Mode Sequence:**
```
[All available models including extended set]
```

### Context Preservation

When switching models:
- Previous conversation context is preserved
- Last user question is maintained in new session
- Session statistics are updated

## Status Indicators

### Visual Indicators

- **🔥 Burn Mode**: Visible when dual-provider mode is active
- **📷 OCR Filter**: Shows when text cleanup is enabled
- **Model Name**: Current Ollama model displayed in status

### Status Messages

```bash
# Burn Mode Toggle
🔥 Burn Mode: ON - OCR queries will use both Ollama (local) + DeepSeek (cloud)
🤖 Burn Mode: OFF - OCR queries will use Ollama (local) only

# Model Switching  
🔄 Switched to phi3:mini
💬 Session preserved: 2 exchanges (4 messages)

# OCR Filtering
📝 OCR Filtering: ON
📝 OCR Filtering: OFF
```

## Advanced Usage

### Provider Management

The system intelligently manages AI providers:

1. **OCR Context**: Always defaults to Ollama for local processing
2. **Provider Switching**: Temporarily switches to DeepSeek when needed
3. **Context Restoration**: Returns to Ollama after cloud queries
4. **Session Management**: Maintains separate sessions per provider

### Performance Optimization

**Local Processing Benefits:**
- No network dependency
- Private (data stays local)
- Fast response times
- No rate limits or costs

**Cloud Processing Benefits:**
- More sophisticated analysis
- Better reasoning capabilities
- Larger context windows
- Advanced formatting

### Formatter Integration

Works with the existing response formatter:

**Formatted Output:**
- Syntax highlighting for code
- Structured lists and headers
- Improved readability

**Raw Output:**
- Plain text responses
- Useful for copying/pasting
- Faster rendering

## Troubleshooting

### Common Issues

**Ollama Not Responding:**
```
⚠️ Ollama server not running. Please start with: ollama serve
```
**Solution:** Start Ollama service

**Model Not Found:**
```
⚠️ phi3:mini model not found. Please pull with: ollama pull phi3:mini
```
**Solution:** Download the required model

**DeepSeek API Issues:**
```
⚠️ DeepSeek query failed: Invalid API key
```
**Solution:** Check `DEEPSEEK_API_KEY` environment variable

### Performance Issues

**Slow Responses:**
- Ollama models may take 10-30 seconds for complex queries
- DeepSeek adds additional latency in Burn Mode
- Use model switching to find faster alternatives

**Memory Usage:**
- Large models require more RAM
- Consider switching to lighter models like `phi3:mini`
- Monitor system resources during usage

### Debug Information

Enable debug logging by checking the console output:
```bash
[OCR Query] Processing OCR query with fallback mechanism...
[OCR Query] Querying Ollama (local)...
[OCR Query] Using phi3:mini...
[OCR Query] Ollama response received
[OCR Query] Burn mode enabled - querying DeepSeek...
[OCR Query] Using deepseek-chat...
[OCR Query] DeepSeek response received and formatted
[OCR Query] Switched back to Ollama
```

## Best Practices

### When to Use Normal Mode
- Quick OCR analysis
- Privacy-sensitive content
- Offline usage
- Battery conservation
- Cost-conscious usage

### When to Use Burn Mode
- Complex technical content
- Need multiple perspectives
- Detailed analysis required
- Comparison of approaches
- Learning/educational scenarios

### Model Selection Tips

**For Code Analysis:**
- `codellama:7b-instruct` - Best for programming questions
- `phi3:mini` - Good balance of speed and capability

**For General Text:**
- `phi3:mini` - Fast and capable
- `mistral` - Alternative perspective

**For Complex Reasoning:**
- Enable Burn Mode for DeepSeek analysis
- Use larger Ollama models if available

## Integration with Workflow

### Screenshot → Analysis Workflow

1. **Identify Content**: What type of content needs analysis?
2. **Choose Mode**: Normal for speed, Burn for depth
3. **Select Region**: Full screen vs. targeted region
4. **Review Results**: Single or dual responses
5. **Follow Up**: Use regular chat for clarification

### Productivity Tips

- **Hotkey Muscle Memory**: Practice the key combinations
- **Context Switching**: Use model switching for different tasks
- **Formatter Toggle**: Switch based on content type
- **Burn Mode Strategy**: Enable for important analysis, disable for quick queries

## Technical Details

### Provider Switching Logic

```javascript
// OCR Query Processing
1. Store original provider state
2. Switch to Ollama for local processing
3. Query Ollama and store response
4. If Burn Mode: Switch to DeepSeek and query
5. Format responses appropriately
6. Restore Ollama as active provider
7. Update UI with results
```

### Session Management

- **Separate Sessions**: Each provider maintains its own session
- **Context Preservation**: Conversation history preserved across switches
- **Cache Management**: Responses cached to avoid duplicate queries
- **Statistics Tracking**: Session length and exchange counts maintained

### Error Handling

- **Graceful Degradation**: Falls back to single provider on errors
- **Provider Restoration**: Always attempts to restore stable state
- **User Feedback**: Clear error messages with actionable solutions
- **Retry Logic**: Built-in resilience for temporary failures

---

## Quick Reference

**Essential Shortcuts:**
- `Cmd+Shift+S` - Screenshot + OCR + AI
- `Cmd+Shift+Q` - Toggle Burn Mode  
- `Cmd+Shift+M` - Cycle Ollama Models

**Modes:**
- **Normal**: Ollama only (fast, private)
- **Burn**: Ollama + DeepSeek (comprehensive)

**Status:**
- 🤖 = Ollama (local)
- 🔥 = DeepSeek (cloud)  
- 📷 = OCR filtering active