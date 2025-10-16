# Clarification Phase Implementation

## Overview
Successfully implemented a **Phase 0 (Clarification)** for both CLOUD and HYBRID AI flows. This phase runs BEFORE the solution phases and focuses on problem analysis, assumptions, pseudo-code, and dry-run testing.

## Architecture Changes

### Previous Architecture
**CLOUD Flow (2 phases)**:
- Phase 1: Answer (deepseek-chat) - Fast solution
- Phase 2: Verification (deepseek-reasoner) - Validates solution

**HYBRID Flow (2 phases)**:
- Phase 1: Local (Ollama) - Brute-force solution
- Phase 2: Cloud (deepseek-reasoner) - Optimizes solution

### New Architecture (3 phases)
**CLOUD Flow**:
- **Phase 0: Clarification (deepseek-chat)** - Problem analysis, assumptions, pseudo-code, dry-run
- Phase 1: Answer (deepseek-chat) - Fast solution
- Phase 2: Verification (deepseek-reasoner) - Validates solution

**HYBRID Flow**:
- **Phase 0: Clarification (deepseek-chat)** - Problem analysis, assumptions, pseudo-code, dry-run
- Phase 1: Local (Ollama) - Brute-force solution
- Phase 2: Cloud (deepseek-reasoner) - Optimizes solution

## Implementation Details

### 1. Clarification Phase Capabilities
The Phase 0 (Clarification) uses `deepseek-chat` and provides:

**For DSA Problems**:
1. Problem Understanding & Clarifications - Restates problem, lists requirements/constraints
2. Assumptions - Input format, edge cases, scope definition
3. Pseudo-code Approach - High-level algorithm steps, data structures needed

**For System Design**:
1. Requirements Clarification - Functional and non-functional requirements
2. Assumptions & Constraints - Traffic estimates, data volume, geographic distribution
3. High-Level Approach - Core components, data flows, architectural patterns

**For LLD (Low-Level Design)**:
1. Requirements & Use Cases - Core functionality, actors, interactions
2. Assumptions & Constraints - Business rules, concurrency, performance, extensibility
3. High-Level Class Structure - Main entities, relationships, design patterns

### 2. Configuration Details
- **Model**: `deepseek-chat` (configured via `flowType: 'cloud'`)
- **Temperature**: 0.3 (focused and consistent)
- **Max Tokens**: 1024 (shorter responses for analysis phase)
- **Header**: "🔍 **Problem Analysis:**"
- **Separators**: Clean separators between phases for better readability

### 3. Execution Flow
1. **Phase 0** receives the **original question** - analyzes and clarifies
2. **Phase 1** receives the **original question** - solves (NOT Phase 0's output)
3. **Phase 2** receives **Phase 1's solution** - verifies/optimizes

This design ensures:
- Phase 0 provides pure analysis without implementation
- Phase 1 has a clean solution context
- Phase 2 focuses on improving Phase 1's work

### 4. Session Management
- Each phase has its own independent session (prevents context pollution)
- Session keys:
  - CLOUD clarification: `deepseek-cloud-clarification`
  - CLOUD answer: `deepseek-cloud-answer`
  - CLOUD verification: `deepseek-cloud-verification`
  - HYBRID clarification: `deepseek-hybrid-clarification`
  - HYBRID local: `ollama-hybrid-local`
  - HYBRID cloud: `deepseek-hybrid-cloud`

## Files Modified

### 1. `src/js/model-prompts.js`
**Changes**:
- Added `clarification` prompts for CLOUD flow (DSA, System Design, LLD)
- Added `clarification` prompts for HYBRID flow (DSA, System Design, LLD)
- Updated `getCloudPrompt()` to handle 'clarification' phase
- Updated `getHybridPrompt()` to handle 'clarification' phase
- Updated documentation to reflect 3-phase structure

### 2. `src/js/ai/simple-ai-manager.js`
**Changes**:
- Added `phase0` configuration to `FLOW_CONFIGS.cloud`
- Added `phase0` configuration to `FLOW_CONFIGS.hybrid`
- Added `separator0` and updated separator naming (separator0, separator1)
- Added `phase0CompletionLog` to both configs
- Updated `_executeTwoPhaseSequentialFlow()` to handle optional Phase 0
- Updated `_executeCloudFlow()` and `_executeHybridFlow()` documentation
- Updated top-level flow configuration comment

## Testing

### Unit Tests ✅ PASSED
Created comprehensive unit tests in `tests/test-clarification-phase.js`:
- ✅ All 12 tests passed
- Validates prompts are accessible for all interview types
- Confirms all phases (clarification, answer, verification, local, cloud) work correctly
- Verifies helper functions handle all phase types

**Run unit tests**:
```bash
node tests/test-clarification-phase.js
```

### Manual Testing Instructions

#### Prerequisites
1. Ensure DeepSeek API key is configured in `.env`:
   ```
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

2. For HYBRID flow, ensure Ollama is running:
   ```bash
   ollama serve
   ```

#### Test CLOUD Flow

1. **Start the application**:
   ```bash
   npm start
   ```

2. **Switch to CLOUD flow**:
   - Press `Cmd+Shift+F` repeatedly until you see "CLOUD" flow

3. **Test with DSA problem**:
   - Ensure interview type is DSA (press `Cmd+Shift+T` to cycle if needed)
   - Take a screenshot of a coding problem (e.g., "Find two numbers that sum to target")
   - Press `Cmd+A` to capture region and ask a question
   - **Expected output**:
     - 🔍 **Problem Analysis:** (Phase 0 clarification)
     - Separator
     - 💨 **Fast Answer:** (Phase 1 solution)
     - Separator
     - ✅ **Verification & Improvements:** (Phase 2 verification)

4. **Test with System Design**:
   - Press `Cmd+Shift+T` to switch to System Design
   - Ask: "Design a URL shortener service"
   - **Expected**: 3 phases with system design focused analysis

5. **Test with LLD**:
   - Press `Cmd+Shift+T` to switch to LLD
   - Ask: "Design a parking lot system"
   - **Expected**: 3 phases with OOP design focused analysis

#### Test HYBRID Flow

1. **Switch to HYBRID flow**:
   - Press `Cmd+Shift+F` until you see "HYBRID" flow

2. **Test with DSA problem**:
   - Use the same testing approach as CLOUD flow
   - **Expected output**:
     - 🔍 **Problem Analysis:** (Phase 0 clarification with deepseek-chat)
     - Separator
     - 🚀 **Quick Solution (Brute Force):** (Phase 1 local solution with Ollama)
     - Separator
     - 🧠 **DeepSeek Analysis:** (Phase 2 optimization with deepseek-reasoner)

3. **Verify Phase 0 uses deepseek-chat**:
   - Check console logs for: "Phase 0: Problem clarification and analysis (deepseek-chat, sequential)..."
   - Verify the clarification output appears before the local solution

#### Console Log Verification

Watch for these log messages indicating proper execution:

**CLOUD Flow**:
```
[SimpleAIManager] Starting Sequential cloud flow (clarification → answer → verification)...
[SimpleAIManager] ===== PHASE 0: CLARIFICATION =====
[SimpleAIManager] Phase 0: Problem clarification and analysis (deepseek-chat, sequential)...
[SimpleAIManager] Clarification phase completed (XXX chars)
[SimpleAIManager] ===== PHASE 1: ANSWER =====
[SimpleAIManager] Phase 1: Fast answer (deepseek-chat, sequential)...
[SimpleAIManager] Answer phase completed (XXX chars)
[SimpleAIManager] ===== PHASE 2: VERIFICATION =====
[SimpleAIManager] Phase 2: Verification with Phase 1 solution (deepseek-reasoner, sequential)...
[SimpleAIManager] Verification phase completed (XXX chars)
```

**HYBRID Flow**:
```
[SimpleAIManager] Starting Sequential hybrid flow (clarification → local → cloud)...
[SimpleAIManager] ===== PHASE 0: CLARIFICATION =====
[SimpleAIManager] Phase 0: Problem clarification and analysis (deepseek-chat, sequential)...
[SimpleAIManager] Clarification phase completed (XXX chars)
[SimpleAIManager] ===== PHASE 1: LOCAL =====
[SimpleAIManager] Phase 1: Brute-force solution (local, sequential)...
[SimpleAIManager] Local phase completed (XXX chars)
[SimpleAIManager] ===== PHASE 2: CLOUD =====
[SimpleAIManager] Phase 2: Optimization with Phase 1 solution (cloud, sequential)...
[SimpleAIManager] Cloud phase completed (XXX chars)
```

## Benefits

### For Users
1. **Better Problem Understanding**: Phase 0 ensures the problem is well-understood before coding
2. **Clear Assumptions**: Explicitly states what assumptions are being made
3. **Pseudo-code First**: High-level approach before diving into implementation
4. **Interview-Like Experience**: Mimics real FAANG interview structure where clarification comes first

### For Development
1. **Modular Design**: Each phase is independent with its own session
2. **Backward Compatible**: LOCAL flow remains unchanged (single phase)
3. **Flexible Configuration**: Easy to disable Phase 0 by removing `phase0` from config
4. **Consistent Prompts**: Reusable structure across interview types

## Performance Impact

### Time
- **Previous**: phase1_time + phase2_time
- **New**: phase0_time + phase1_time + phase2_time
- **User Experience**: Streaming means user sees each phase immediately

### Token Usage
- **Phase 0**: ~1024 tokens max (configurable via `max_tokens`)
- **Optimized**: Lower max_tokens than solution phases (1024 vs 2048)
- **Cost**: Marginal increase, using efficient `deepseek-chat` model

## Troubleshooting

### Issue: Phase 0 not appearing
**Solution**: Ensure DEEPSEEK_API_KEY is set in `.env`

### Issue: Phases running in wrong order
**Check**: Console logs should show PHASE 0 → PHASE 1 → PHASE 2

### Issue: Phase 0 output too long/short
**Solution**: Adjust `max_tokens` in phase0 config (currently 1024)

### Issue: Want to disable Phase 0
**Solution**: Remove or comment out `phase0` object in FLOW_CONFIGS

## Future Enhancements

Potential improvements:
1. **User Configurable**: Allow users to toggle Phase 0 on/off via keyboard shortcut
2. **Adaptive Tokens**: Adjust max_tokens based on problem complexity
3. **Phase 0 Context**: Optionally pass Phase 0 analysis to Phase 1 (currently isolated)
4. **Prompt Refinement**: Iterate on prompts based on user feedback

## Summary

✅ **Implementation Complete**
- 3-phase flow for CLOUD and HYBRID
- Clarification phase uses `deepseek-chat`
- All interview types supported (DSA, System Design, LLD)
- Unit tests passing (12/12)
- Backward compatible with existing flows

✅ **Ready for Manual Testing**
- Follow testing instructions above
- Verify console logs
- Test all interview types
- Test both CLOUD and HYBRID flows

✅ **Production Ready**
- No syntax errors
- Proper error handling
- Independent session management
- Clean separation of concerns
