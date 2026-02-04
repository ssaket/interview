const crypto = require('crypto');
const simpleAI = require('./simple-ai');
const MODEL_PROMPTS = require('../model-prompts');

/**
 * Flow configurations for three-phase sequential execution
 * Phase 0 analyzes the problem, Phase 1 provides solution, Phase 2 verifies/optimizes
 * Defines provider, model, prompt, and parameters for each phase of Cloud and Hybrid flows
 */
const FLOW_CONFIGS = {
  cloud: {
    name: 'cloud',
    displayName: 'Cloud',
    logPrefix: 'Sequential cloud flow',
    phase0: {
      name: 'clarification',
      provider: 'deepseek',
      flowType: 'cloud', // Use deepseek-chat model
      sessionKey: 'deepseek-cloud-clarification',
      header: '🧠 **Brute-Force Pseudo-Code:**\n\n',
      logMessage: 'Phase 0: Brute-force pseudo-code generation (deepseek-chat, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getCloudPrompt('clarification', interviewType),
      promptLogMessage: 'Added cloud CLARIFICATION prompt for brute-force pseudo-code',
      parameters: {
        temperature: 0.5, // Higher temperature for simple, straightforward answers
        max_tokens: 1536,
      },
      includeReasoning: undefined,
    },
    phase1: {
      name: 'answer',
      provider: 'deepseek',
      flowType: 'cloud',
      sessionKey: 'deepseek-cloud-answer',
      header: '💨 **Fast Answer:**\n\n',
      logMessage: 'Phase 1: Fast answer (deepseek-chat, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getCloudPrompt('answer', interviewType),
      promptLogMessage: 'Added cloud ANSWER prompt for fast solution',
      parameters: {
        temperature: 0.3,
        max_tokens: 2048,
      },
      includeReasoning: undefined,
    },
    phase2: {
      name: 'verification',
      provider: 'deepseek',
      flowType: 'hybrid', // Use hybrid flow model (deepseek-reasoner)
      sessionKey: 'deepseek-cloud-verification',
      header: '', // No header - added via separator
      logMessage: 'Phase 2: Verification with Phase 1 solution (deepseek-reasoner, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getCloudPrompt('verification', interviewType),
      promptLogMessage: 'Added cloud VERIFICATION prompt for deep reasoning validation',
      parameters: {
        temperature: 0.1,
        max_tokens: 2048,
      },
      includeReasoning: false,
      logReasonerTimeout: true,
    },
    separator0: '\n\n---\n\n',
    separator1: '\n\n---\n\n**✅ Verification & Improvements:**\n\n',
    phase0CompletionLog: 'Clarification phase completed',
    phase1CompletionLog: 'Answer phase completed',
    phase2CompletionLog: 'Verification phase completed',
    errorPrefix: 'Cloud Flow Error',
  },
  hybrid: {
    name: 'hybrid',
    displayName: 'Hybrid',
    logPrefix: 'Sequential hybrid flow',
    phase0: {
      name: 'clarification',
      provider: 'deepseek',
      flowType: 'cloud', // Use deepseek-chat model
      sessionKey: 'deepseek-hybrid-clarification',
      header: '🔍 **Problem Analysis:**\n\n',
      logMessage: 'Phase 0: Problem clarification, assumptions, and pseudo-code (deepseek-chat, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getHybridPrompt('clarification', interviewType),
      promptLogMessage: 'Added hybrid CLARIFICATION prompt for problem analysis',
      parameters: {
        temperature: 0.3,
        max_tokens: 1024, // Shorter responses for clarification
      },
      includeReasoning: undefined,
    },
    phase1: {
      name: 'local',
      provider: 'ollama',
      flowType: 'hybrid',
      sessionKey: 'ollama-hybrid-local',
      header: '🚀 **Quick Solution (Brute Force):**\n\n',
      logMessage: 'Phase 1: Brute-force solution (local, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getHybridPrompt('local', interviewType),
      promptLogMessage: 'Added hybrid LOCAL prompt for brute-force solution',
      parameters: {
        temperature: 0.7,
        max_tokens: 512,
      },
      includeReasoning: undefined,
    },
    phase2: {
      name: 'cloud',
      provider: 'deepseek',
      flowType: 'hybrid',
      sessionKey: 'deepseek-hybrid-cloud',
      header: '', // No header - added via separator
      logMessage: 'Phase 2: Optimization with Phase 1 solution (cloud, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getHybridPrompt('cloud', interviewType),
      promptLogMessage: 'Added hybrid CLOUD prompt for optimization & deep reasoning',
      parameters: {
        temperature: 0.1,
        max_tokens: 2048,
      },
      includeReasoning: false,
      logReasonerTimeout: true,
    },
    separator0: '\n\n---\n\n',
    separator1: '\n\n---\n\n**🧠 DeepSeek Analysis:**\n\n',
    phase0CompletionLog: 'Clarification phase completed',
    phase1CompletionLog: 'Local phase completed',
    phase2CompletionLog: 'Cloud phase completed',
    errorPrefix: 'DeepSeek Error',
  },
  steps: {
    name: 'steps',
    displayName: 'Steps',
    logPrefix: 'Sequential steps flow',
    phase0: {
      name: 'clarification',
      provider: 'deepseek',
      flowType: 'cloud', // Use deepseek-chat model
      sessionKey: 'deepseek-steps-clarification',
      header: '❓ **Problem Clarification:**\n\n',
      logMessage: 'Phase 0: Problem clarification Q&A (deepseek-chat, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getStepsPrompt('clarification', interviewType),
      promptLogMessage: 'Added steps CLARIFICATION prompt for Q&A analysis',
      parameters: {
        temperature: 0.5, // Higher temperature for generating diverse questions
        max_tokens: 1024,
      },
      includeReasoning: undefined,
    },
    phase1: {
      name: 'bruteforce',
      provider: 'deepseek',
      flowType: 'cloud', // Use deepseek-chat model
      sessionKey: 'deepseek-steps-bruteforce',
      header: '🧠 **Brute-Force Approach:**\n\n',
      logMessage: 'Phase 1: Brute-force algorithm/pseudocode (deepseek-chat, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getStepsPrompt('bruteforce', interviewType),
      promptLogMessage: 'Added steps BRUTEFORCE prompt for simple solution',
      parameters: {
        temperature: 0.3,
        max_tokens: 2048,
      },
      includeReasoning: undefined,
    },
    phase2: {
      name: 'optimization',
      provider: 'deepseek',
      flowType: 'steps', // Use steps flow model (deepseek-reasoner with 240s timeout)
      sessionKey: 'deepseek-steps-optimization',
      header: '', // No header - added via separator
      logMessage: 'Phase 2: Optimization with Phase 1 solution (deepseek-reasoner, sequential)...',
      promptGetter: (interviewType) => MODEL_PROMPTS.getStepsPrompt('optimization', interviewType),
      promptLogMessage: 'Added steps OPTIMIZATION prompt for step-by-step improvement',
      parameters: {
        temperature: 0.1,
        max_tokens: 4096,
      },
      includeReasoning: false,
      logReasonerTimeout: true,
    },
    separator0: '\n\n---\n\n',
    separator1: '\n\n---\n\n**✨ Optimized Solution:**\n\n',
    phase0CompletionLog: 'Clarification phase completed',
    phase1CompletionLog: 'Brute-force phase completed',
    phase2CompletionLog: 'Optimization phase completed',
    errorPrefix: 'Steps Flow Error',
  },
};

/**
 * Simplified AI Manager
 *
 * Manages AI interactions without complex provider class hierarchy.
 * Uses simple functions instead of objects for better maintainability.
 */
class SimpleAIManager {
  constructor(appController) {
    this.appController = appController;

    // Configuration
    this.currentProvider = simpleAI.getDefaultProvider();
    this.currentModel = this._getDefaultModelForProvider(this.currentProvider);

    // Session management
    this.sessions = new Map(); // Per-provider-model session storage

    // State
    this.isInitialized = true;
    this.systemPromptsEnabled = true; // Toggle for system prompts
    this.currentInterviewType = MODEL_PROMPTS.INTERVIEW_TYPES.DSA; // Default to DSA

    console.log(
      `[SimpleAIManager] Initialized with ${this.currentProvider} using model: ${this.currentModel}`
    );
    console.log(`[SimpleAIManager] Interview type: ${this.currentInterviewType}`);
  }

  /**
   * Switch to a different provider
   * @param {string} providerName - Target provider name
   * @param {boolean} silent - If true, don't send UI notifications
   */
  async switchProvider(providerName, silent = false) {
    if (!providerName) {
      throw new Error('Provider name is required');
    }

    const previousProvider = this.currentProvider;

    try {
      // Test the provider is available
      const available = await simpleAI.testProvider(providerName);
      if (!available) {
        throw new Error(`Provider ${providerName} is not available`);
      }

      this.currentProvider = providerName;
      this.currentModel = this._getDefaultModelForProvider(providerName);

      // Notify the app controller about the switch (unless silent)
      if (!silent) {
        this.appController.windowManager.send('provider-switched', {
          from: previousProvider,
          to: this.currentProvider,
          provider: this.currentProvider,
          model: this.currentModel,
          isOllama: this.isOllama(),
        });
      }

      console.log(
        `[SimpleAIManager] ${silent ? 'Silently switched' : 'Switched'} to ${providerName} using model: ${this.currentModel}`
      );
      return true;
    } catch (error) {
      console.error(`[SimpleAIManager] Failed to switch to ${providerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Cycle through available providers
   */
  async cycleProvider() {
    const availableProviders = simpleAI.getAllProviders();
    const currentIndex = availableProviders.indexOf(this.currentProvider);
    const nextIndex = (currentIndex + 1) % availableProviders.length;
    const nextProvider = availableProviders[nextIndex];

    await this.switchProvider(nextProvider);
  }

  /**
   * Send a query to the AI
   * @param {string} query - User query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} AI response
   */
  async query(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this._getOrCreateSession(sessionKey);

    // Add system prompt if this is the first message and system prompts are enabled
    if (session.messages.length === 0 && this.systemPromptsEnabled) {
      const systemPrompt = this._getSystemPrompt();
      if (systemPrompt) {
        console.log(
          `[SimpleAIManager] System prompt for ${this.currentProvider}:${this.currentModel}:`
        );
        console.log('--- SYSTEM PROMPT START ---');
        console.log(systemPrompt);
        console.log('--- SYSTEM PROMPT END ---');
        session.messages.push({
          role: 'system',
          content: systemPrompt,
        });
      } else {
        console.log(
          `[SimpleAIManager] No system prompt found for ${this.currentProvider}:${this.currentModel}`
        );
      }
    } else if (session.messages.length === 0 && !this.systemPromptsEnabled) {
      console.log(`[SimpleAIManager] System prompts disabled - skipping system prompt`);
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: query,
    });

    // Limit session history
    this._limitSessionHistory(session);

    // Log the complete message array being sent to AI
    console.log(
      `[SimpleAIManager] Sending ${session.messages.length} messages to ${this.currentProvider}:${this.currentModel}`
    );
    session.messages.forEach((msg, index) => {
      if (msg.role === 'system') {
        console.log(`Message ${index}: [SYSTEM] (${msg.content.length} chars)`);
      } else {
        console.log(
          `Message ${index}: [${msg.role.toUpperCase()}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
        );
      }
    });

    try {
      const response = await simpleAI.chatCompletion({
        provider: this.currentProvider,
        messages: session.messages,
        parameters: options.parameters || {},
        stream: options.stream || false,
        onChunk: options.onChunk || null,
        signal: options.signal || null,
        interviewType: this.currentInterviewType,
      });

      const content = this._extractContent(response);

      // Add assistant response to session
      session.messages.push({
        role: 'assistant',
        content: content,
      });

      // Update session metadata
      session.lastUsed = Date.now();
      session.requestCount++;

      return {
        content,
        provider: this.currentProvider,
        model: this.currentModel,
        sessionKey,
        response,
      };
    } catch (error) {
      console.error(`[SimpleAIManager] Query failed:`, error.message);
      throw error;
    }
  }

  /**
   * Test if current provider is available
   * @returns {Promise<boolean>} True if available
   */
  async warmup() {
    if (!this.currentProvider) {
      return false;
    }

    try {
      return await simpleAI.testProvider(this.currentProvider);
    } catch (error) {
      console.warn(`[SimpleAIManager] Warmup failed:`, error.message);
      return false;
    }
  }

  /**
   * Clear session history
   * @param {string} sessionKey - Optional specific session to clear
   */
  clearSession(sessionKey = null) {
    if (sessionKey) {
      this.sessions.delete(sessionKey);
    } else {
      const currentSessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
      this.sessions.delete(currentSessionKey);
    }
  }

  /**
   * Clear all sessions
   */
  clearAllSessions() {
    this.sessions.clear();
  }

  /**
   * Get session information
   * @returns {Object} Session info
   */
  getSessionInfo() {
    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        provider: this.currentProvider,
        model: this.currentModel,
        messageCount: 0,
        lastUsed: null,
      };
    }

    return {
      provider: this.currentProvider,
      model: this.currentModel,
      messageCount: session.messages.length,
      lastUsed: session.lastUsed,
      requestCount: session.requestCount,
    };
  }

  /**
   * Get session statistics (compatibility method for WebSocket server)
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        historyLength: 0,
        isActive: false,
        provider: this.currentProvider,
        model: this.currentModel,
      };
    }

    return {
      historyLength: session.messages.length,
      isActive: true,
      provider: this.currentProvider,
      model: this.currentModel,
    };
  }

  /**
   * Set model for current provider
   * @param {string} modelName - Model name
   */
  setModel(modelName) {
    this.currentModel = modelName;
    simpleAI.updateProviderConfig(this.currentProvider, { model: modelName });
  }

  /**
   * Get available models for current provider
   * @returns {Array} Available models
   */
  getAvailableModels() {
    return simpleAI.getAvailableModels(this.currentProvider);
  }

  /**
   * Ask the AI a question (compatibility method)
   * @param {string} question - The question to ask
   * @param {Object} options - Additional options including flow information
   * @returns {Promise<string>} The AI's response content
   */
  async ask(question, options = {}) {
    const flow = options.flow;

    // Handle special flows with streaming
    if (flow && ['local', 'cloud', 'hybrid', 'steps'].includes(flow)) {
      return await this._executeFlow(question, options, flow);
    }

    // Default non-streaming query
    const response = await this.query(question, options);
    return response.content;
  }

  /**
   * Unified flow execution handler
   * @private
   */
  async _executeFlow(question, options, flow) {
    console.log(`[SimpleAIManager] Starting ${flow} flow with streaming...`);

    const state = this._saveCurrentState();

    try {
      if (flow === 'hybrid') {
        return await this._executeHybridFlow(question, options);
      } else if (flow === 'steps') {
        return await this._executeStepsFlow(question, options);
      } else {
        return await this._executeSingleProviderFlow(question, options, flow);
      }
    } catch (error) {
      console.error(`[SimpleAIManager] ${flow} flow failed:`, error.message);
      throw error;
    } finally {
      await this._restoreState(state);
    }
  }

  /**
   * Execute single provider flow (local or cloud)
   * @private
   */
  async _executeSingleProviderFlow(question, options, flow) {
    if (flow === 'cloud') {
      // Cloud flow uses two-phase approach: answer → verification
      return await this._executeCloudFlow(question, options);
    }

    // Local flow uses single phase
    const provider = 'ollama';

    // Check if we need to switch provider
    const needsProviderSwitch = this.currentProvider !== provider;

    if (needsProviderSwitch) {
      await this.switchProvider(provider, true);
    }

    // For LOCAL flow: Preserve user's active model if already on correct provider
    // For other flows: Use flow-specific optimized models
    const aiConfig = require('./ai-config');

    if (flow === 'local' && !needsProviderSwitch && this.currentModel) {
      // User is already on Ollama with an active model - preserve their choice
      console.log(
        `[SimpleAIManager] Preserving user's active model ${this.currentModel} for ${flow} flow`
      );
    } else {
      // Either switching providers or using flow-specific model
      const flowModel = aiConfig.getFlowModel(provider, flow, this.currentInterviewType);
      this.setModel(flowModel);
      console.log(`[SimpleAIManager] Using flow model ${flowModel} for ${flow} flow (interview type: ${this.currentInterviewType})`);
    }

    const response = await this.query(question, {
      stream: true,
      onChunk: options.onChunk,
      parameters: options.parameters || {},
      signal: options.signal || null,
    });

    console.log(`[SimpleAIManager] ${flow} flow completed successfully`);
    return response.content;
  }

  /**
   * Generic phase execution method
   * Executes a single phase (answer, verification, local, or cloud) with streaming
   * @private
   */
  async _executePhase(question, phaseConfig, options) {
    console.log(`[SimpleAIManager] ${phaseConfig.logMessage}`);

    // Add phase header if specified
    if (phaseConfig.header && options.onChunk) {
      options.onChunk(phaseConfig.header);
    }

    try {
      const aiConfig = require('./ai-config');
      const simpleAI = require('./simple-ai');

      // Switch to appropriate provider
      if (this.currentProvider !== phaseConfig.provider) {
        await this.switchProvider(phaseConfig.provider, true);
      }

      // Get flow-specific model (pass interview type for hybrid flow)
      const model = aiConfig.getFlowModel(phaseConfig.provider, phaseConfig.flowType, this.currentInterviewType);
      this.setModel(model);

      console.log(`[SimpleAIManager] Using ${model} for ${phaseConfig.name} phase (interview type: ${this.currentInterviewType})`);

      // Log reasoner timeout if specified
      if (phaseConfig.logReasonerTimeout) {
        const reasonerTimeout = aiConfig.getProviderConfig(phaseConfig.provider).reasonerTimeout;
        console.log(
          `[SimpleAIManager] Reasoner timeout: ${reasonerTimeout}ms (configurable via DEEPSEEK_REASONER_TIMEOUT)`
        );
      }

      // Create session with appropriate prompt
      const sessionKey = this._getSessionKey(phaseConfig.sessionKey, model);
      const session = this._getOrCreateSession(sessionKey);

      // Add system prompt only if this is the first message in this phase session
      // AND system prompts are enabled
      // This allows conversation history to be maintained across multiple screenshots
      if (session.messages.length === 0 && this.systemPromptsEnabled) {
        const systemPrompt = phaseConfig.promptGetter(this.currentInterviewType);
        session.messages.push({
          role: 'system',
          content: systemPrompt,
        });
        console.log(`[SimpleAIManager] ${phaseConfig.promptLogMessage}`);
      } else if (session.messages.length === 0 && !this.systemPromptsEnabled) {
        console.log(`[SimpleAIManager] System prompts disabled - skipping ${phaseConfig.name} phase prompt`);
      } else {
        console.log(`[SimpleAIManager] Reusing existing ${phaseConfig.name} phase session (${session.messages.length} messages)`);
      }

      // Add user question
      session.messages.push({ role: 'user', content: question });

      // Execute AI completion with streaming
      const response = await simpleAI.chatCompletion({
        provider: phaseConfig.provider,
        messages: session.messages,
        stream: true,
        onChunk: options.onChunk,
        includeReasoning: phaseConfig.includeReasoning,
        signal: options.signal || null,
        flowType: phaseConfig.flowType, // Pass flowType for timeout selection
        interviewType: this.currentInterviewType, // Pass interviewType for interview-specific timeout
        parameters: {
          ...phaseConfig.parameters,
          ...options.parameters,
        },
      });

      const content = this._extractContent(response);

      // Add assistant response to session for context
      session.messages.push({
        role: 'assistant',
        content: content,
      });

      console.log(`[SimpleAIManager] ${phaseConfig.name} phase completed`);
      return content;
    } catch (error) {
      // Log error without full stack trace for cleaner output
      console.error(`[SimpleAIManager] ${phaseConfig.name} phase failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute phase with automatic fallback to deepseek-chat on failure
   * Used for Phase 2 optimization/verification to ensure user always gets content
   * @private
   */
  async _executePhaseWithFallback(question, phaseConfig, options) {
    try {
      // Try primary model (e.g., deepseek-reasoner)
      const content = await this._executePhase(question, phaseConfig, options);

      // Check if content is empty, just whitespace, or the reasoning-only fallback message
      // The reasoning-only fallback is created by simple-ai.js when deepseek-reasoner
      // returns only <think> tags without a final answer
      const isEmptyResponse = !content || content.trim().length === 0;
      const isReasoningOnlyFallback = content && content.includes('**🧠 Reasoning Process** (no final answer provided)');

      if (isEmptyResponse || isReasoningOnlyFallback) {
        const errorMsg = isReasoningOnlyFallback
          ? 'Reasoner provided only thinking process without final answer'
          : 'Empty response from primary model';
        throw new Error(errorMsg);
      }

      return content;
    } catch (primaryError) {
      // Check if error is timeout, network-related, or reasoning-only response
      const isTimeout = primaryError.message.includes('timeout') ||
                       primaryError.message.includes('ECONNABORTED');
      const isNetworkError = primaryError.message.includes('request failed') ||
                            primaryError.message.includes('Empty response');
      const isReasoningOnly = primaryError.message.includes('only thinking process');

      if (!isTimeout && !isNetworkError && !isReasoningOnly) {
        // Not a timeout/network/reasoning-only error - re-throw
        throw primaryError;
      }

      // Log fallback attempt
      console.warn(`[SimpleAIManager] ${phaseConfig.name} phase failed (${primaryError.message}), attempting fallback to deepseek-chat...`);

      // Notify user via UI with appropriate message
      if (options.onChunk) {
        let warningMsg;
        if (isReasoningOnly) {
          warningMsg = `\n\n⚠️ **Note**: Deep reasoner provided only thinking process without final answer, using fast model for optimization...\n\n`;
        } else if (isTimeout) {
          const timeoutSecs = Math.floor(require('./ai-config').getProviderConfig('deepseek').reasonerTimeout / 1000);
          warningMsg = `\n\n⚠️ **Note**: Deep reasoning timed out (${timeoutSecs}s limit), using fast model for optimization...\n\n`;
        } else {
          warningMsg = `\n\n⚠️ **Note**: Deep reasoning failed, using fast model for optimization...\n\n`;
        }
        options.onChunk(warningMsg);
      }

      // Create fallback phase config with deepseek-chat
      const aiConfig = require('./ai-config');
      const fallbackConfig = {
        ...phaseConfig,
        flowType: 'cloud', // Use cloud flow model (deepseek-chat)
        logMessage: `${phaseConfig.logMessage.replace('deepseek-reasoner', 'deepseek-chat')} [FALLBACK]`,
        logReasonerTimeout: false, // Don't log timeout for fallback
      };

      try {
        // Execute with fallback model
        const fallbackContent = await this._executePhase(question, fallbackConfig, {
          ...options,
          // Don't duplicate the warning message when streaming fallback content
        });

        console.log(`[SimpleAIManager] ${phaseConfig.name} phase completed via fallback (deepseek-chat)`);
        return fallbackContent;
      } catch (fallbackError) {
        // Both primary and fallback failed - throw original error
        console.error(`[SimpleAIManager] Fallback also failed: ${fallbackError.message}`);
        throw primaryError; // Throw original error, not fallback error
      }
    }
  }

  /**
   * Unified multi-phase sequential flow execution (2 or 3 phases)
   * Phase 0 (optional): Clarification - analyzes problem, assumptions, pseudo-code
   * Phase 1: Solution - provides working code/architecture
   * Phase 2: Verification/Optimization - verifies or optimizes Phase 1's solution
   * Total time = phase0_time + phase1_time + phase2_time, but user sees each phase immediately as it completes
   * @private
   */
  async _executeTwoPhaseSequentialFlow(question, options, flowConfig) {
    const hasPhase0 = !!flowConfig.phase0;
    const phaseNames = hasPhase0
      ? `${flowConfig.phase0.name} → ${flowConfig.phase1.name} → ${flowConfig.phase2.name}`
      : `${flowConfig.phase1.name} → ${flowConfig.phase2.name}`;

    console.log(`[SimpleAIManager] Starting ${flowConfig.logPrefix} (${phaseNames})...`);
    console.log(`[SimpleAIManager] Question length: ${question.length} chars`);

    const startTime = Date.now();
    let phase0Response = '';

    try {
      // Phase 0 (optional): Clarification - analyze problem, assumptions, pseudo-code
      if (hasPhase0) {
        console.log(`[SimpleAIManager] ===== PHASE 0: ${flowConfig.phase0.name.toUpperCase()} =====`);
        phase0Response = await this._executePhase(question, flowConfig.phase0, {
          ...options,
          onChunk: options.onChunk, // Stream Phase 0 directly to UI
        });

        console.log(`[SimpleAIManager] ${flowConfig.phase0CompletionLog} (${phase0Response.length} chars)`);

        // Add separator before Phase 1
        if (options.onChunk) {
          options.onChunk(flowConfig.separator0);
        }
      }

      // Phase 1: Execute and stream to UI immediately (uses original question + Phase 0's pseudo-code as context)
      console.log(`[SimpleAIManager] ===== PHASE 1: ${flowConfig.phase1.name.toUpperCase()} =====`);

      // Construct Phase 1 query with original question + Phase 0's pseudo-code
      const phase1Query = hasPhase0
        ? `Brute-force approach from initial analysis:
${phase0Response}

Now provide an optimized solution for the following problem:
${question}`
        : question;

      if (hasPhase0) {
        console.log(`[SimpleAIManager] Phase 1 query constructed (${phase1Query.length} chars total: ${phase0Response.length} phase0 pseudo-code + ${question.length} question)`);
      }

      const phase1Response = await this._executePhase(phase1Query, flowConfig.phase1, {
        ...options,
        onChunk: options.onChunk, // Stream Phase 1 directly to UI
      });

      console.log(`[SimpleAIManager] ${flowConfig.phase1CompletionLog} (${phase1Response.length} chars)`);

      // Add separator before Phase 2
      if (options.onChunk) {
        options.onChunk(flowConfig.separator1);
      }

      // Phase 2: Execute with Phase 1's solution as context
      console.log(`[SimpleAIManager] ===== PHASE 2: ${flowConfig.phase2.name.toUpperCase()} =====`);

      // Construct Phase 2 query with original question + Phase 1's solution
      const phase2Query = `Original question:
${question}

Solution provided:
${phase1Response}

Please ${flowConfig.name === 'hybrid' ? 'optimize' : 'verify'} this solution.`;

      console.log(`[SimpleAIManager] Phase 2 query constructed (${phase2Query.length} chars total: ${question.length} question + ${phase1Response.length} phase1 response)`);

      // Use fallback for Phase 2 to ensure user always gets optimization/verification
      // If deepseek-reasoner times out, automatically retry with deepseek-chat
      const phase2Response = await this._executePhaseWithFallback(phase2Query, flowConfig.phase2, {
        ...options,
        onChunk: options.onChunk, // Stream Phase 2 directly to UI
      });

      console.log(`[SimpleAIManager] ${flowConfig.phase2CompletionLog} (${phase2Response.length} chars)`);

      const totalTime = Date.now() - startTime;
      console.log(`[SimpleAIManager] ${flowConfig.logPrefix} completed in ${totalTime}ms`);

      // Return combined response WITHOUT separators (separators were already streamed via onChunk)
      // Use simple newlines for the return value to avoid duplication
      if (hasPhase0) {
        return phase0Response + '\n\n' + phase1Response + '\n\n' + phase2Response;
      } else {
        return phase1Response + '\n\n' + phase2Response;
      }

    } catch (error) {
      // Log error without stack trace for cleaner output
      console.error(`[SimpleAIManager] ${flowConfig.displayName} flow failed: ${error.message}`);
      return this._handleFlowError(flowConfig.errorPrefix, error, '', options.onChunk);
    }
  }

  /**
   * Execute cloud flow with three-phase sequential execution
   * Phase 0 (deepseek-chat) clarifies problem and creates pseudo-code
   * Phase 1 (deepseek-chat) provides fast correct answer
   * Phase 2 (deepseek-reasoner) verifies and suggests improvements
   * Total time = clarification_time + answer_time + verification_time
   * User sees each phase immediately as it completes
   * @private
   */
  async _executeCloudFlow(question, options) {
    return await this._executeTwoPhaseSequentialFlow(question, options, FLOW_CONFIGS.cloud);
  }

  /**
   * Execute hybrid flow with three-phase sequential execution
   * Phase 0 (deepseek-chat) clarifies problem and creates pseudo-code
   * Phase 1 (Ollama) provides brute-force solution
   * Phase 2 (deepseek-reasoner) optimizes the solution
   * Total time = clarification_time + local_time + cloud_time
   * User sees each phase immediately as it completes
   * @private
   */
  async _executeHybridFlow(question, options) {
    return await this._executeTwoPhaseSequentialFlow(question, options, FLOW_CONFIGS.hybrid);
  }

  /**
   * Execute steps flow with three-phase sequential execution
   * Phase 0 (deepseek-chat) clarifies problem with Q&A format
   * Phase 1 (deepseek-chat) provides brute-force algorithm/pseudocode
   * Phase 2 (deepseek-reasoner) optimizes Phase 1's solution with 240s timeout
   * Total time = clarification_time + bruteforce_time + optimization_time
   * User sees each phase immediately as it completes
   * @private
   */
  async _executeStepsFlow(question, options) {
    return await this._executeTwoPhaseSequentialFlow(question, options, FLOW_CONFIGS.steps);
  }

  /**
   * Unified error handler for flow execution
   * @private
   */
  _handleFlowError(errorPrefix, error, combinedResponse, onChunk) {
    // Provide user-friendly error messages
    let errorMessage = error.message;

    // Handle cancellation errors gracefully
    if (errorMessage.includes('canceled')) {
      errorMessage = 'Request was canceled. This can happen if the previous request was still running.';
    }

    const errorMsg = `\n\n**❌ ${errorPrefix}:** ${errorMessage}`;
    if (onChunk) {
      onChunk(errorMsg);
    }
    return combinedResponse + errorMsg;
  }

  /**
   * Save current provider state
   * @private
   */
  _saveCurrentState() {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
    };
  }

  /**
   * Restore provider state
   * @private
   */
  async _restoreState(state) {
    try {
      // Always restore both provider and model
      if (state.provider !== this.currentProvider) {
        await this.switchProvider(state.provider, true);
      }

      // Always restore model, even if provider didn't change
      // (hybrid flow uses different models for the same provider)
      if (state.model !== this.currentModel) {
        this.setModel(state.model);
        console.log(
          `[SimpleAIManager] Restored to ${state.provider} using model: ${state.model}`
        );
      }
    } catch (restoreError) {
      console.error('[SimpleAIManager] Failed to restore provider:', restoreError.message);
      // Gracefully handle restoration failure - don't propagate error
      // The flow has already completed, this is just cleanup
    }
  }

  /**
   * Get current provider information (compatibility method)
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: this.currentProvider,
      model: this.currentModel,
      isOllama: this.isOllama(),
    };
  }

  /**
   * Get session (compatibility method)
   * @returns {Object} Session object with history
   */
  getSession() {
    // Check if there are any phase sessions (CLOUD, HYBRID, STEPS flows)
    const phaseSessions = [];

    for (const [key, session] of this.sessions.entries()) {
      // Identify phase sessions by their key patterns
      if (key.includes('-cloud-') || key.includes('-hybrid-') || key.includes('-steps-')) {
        phaseSessions.push({ key, session });
      }
    }

    // If phase sessions exist, aggregate messages from all phase sessions
    if (phaseSessions.length > 0) {
      // Aggregate all messages from phase sessions
      const allMessages = [];

      for (const { session } of phaseSessions) {
        // Add all non-system messages from this phase
        const phaseMessages = session.messages
          .filter((msg) => msg.role !== 'system')
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
        allMessages.push(...phaseMessages);
      }

      return {
        history: allMessages,
        active: allMessages.length > 0,
      };
    }

    // No phase sessions found - use current provider/model session (LOCAL flow)
    const sessionKey = this._getSessionKey(this.currentProvider, this.currentModel);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return {
        history: [],
        active: false,
      };
    }

    // Convert messages to history format for compatibility
    const history = session.messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    return {
      history,
      active: true,
    };
  }

  /**
   * Initialize method (compatibility - already initialized in constructor)
   */
  initialize() {
    // Already initialized in constructor
    return Promise.resolve();
  }

  /**
   * Check if current provider is Ollama
   * @returns {boolean} True if Ollama
   */
  isOllama() {
    return this.currentProvider === 'ollama';
  }

  /**
   * Get current provider name
   * @returns {string} Provider name
   */
  getCurrentProvider() {
    return this.currentProvider;
  }

  /**
   * Get current model name
   * @returns {string} Model name
   */
  getCurrentModel() {
    return this.currentModel;
  }

  /**
   * Toggle system prompts on/off
   * @returns {boolean} New state of system prompts
   */
  toggleSystemPrompts() {
    this.systemPromptsEnabled = !this.systemPromptsEnabled;
    console.log(
      `[SimpleAIManager] System prompts ${this.systemPromptsEnabled ? 'enabled' : 'disabled'}`
    );
    return this.systemPromptsEnabled;
  }

  /**
   * Get system prompts enabled state
   * @returns {boolean} Whether system prompts are enabled
   */
  getSystemPromptsEnabled() {
    return this.systemPromptsEnabled;
  }

  /**
   * Cycle through interview types (DSA -> System Design -> LLD -> DSA)
   * @returns {string} New interview type
   */
  cycleInterviewType() {
    const types = Object.values(MODEL_PROMPTS.INTERVIEW_TYPES);
    const currentIndex = types.indexOf(this.currentInterviewType);
    const nextIndex = (currentIndex + 1) % types.length;
    this.currentInterviewType = types[nextIndex];

    console.log(`[SimpleAIManager] Interview type changed to: ${this.currentInterviewType}`);

    // Clear all sessions (including phase sessions) to apply new system prompts on next query
    this.clearAllSessions();

    return this.currentInterviewType;
  }

  /**
   * Get current interview type
   * @returns {string} Current interview type
   */
  getCurrentInterviewType() {
    return this.currentInterviewType;
  }

  /**
   * Get interview type display name
   * @returns {string} Human-readable interview type name
   */
  getInterviewTypeDisplayName() {
    const displayNames = {
      [MODEL_PROMPTS.INTERVIEW_TYPES.DSA]: 'DSA (Data Structures & Algorithms)',
      [MODEL_PROMPTS.INTERVIEW_TYPES.SYSTEM_DESIGN]: 'System Design',
      [MODEL_PROMPTS.INTERVIEW_TYPES.LLD]: 'LLD (Low-Level Design / Machine Coding)',
    };
    return displayNames[this.currentInterviewType] || this.currentInterviewType;
  }

  // Private methods

  _getDefaultModelForProvider(providerName) {
    return simpleAI.getCurrentModel(providerName);
  }

  _getSessionKey(provider, model) {
    return `${provider}:${model}`;
  }

  _getOrCreateSession(sessionKey) {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, {
        id: crypto.randomUUID(),
        messages: [],
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
      });
    }
    return this.sessions.get(sessionKey);
  }

  _limitSessionHistory(session, maxMessages = 20) {
    if (session.messages.length > maxMessages) {
      // Keep system message (if exists) and last maxMessages - 1 messages
      const systemMessage = session.messages[0]?.role === 'system' ? [session.messages[0]] : [];
      const recentMessages = session.messages.slice(-(maxMessages - systemMessage.length));
      session.messages = [...systemMessage, ...recentMessages];
    }
  }

  _getSystemPrompt() {
    const modelType = this._getModelType(this.currentModel);
    console.log(`[SimpleAIManager] Model: ${this.currentModel} -> Type: ${modelType}`);
    console.log(
      `[SimpleAIManager] Interview Type: ${this.currentInterviewType} (${this.getInterviewTypeDisplayName()})`
    );

    const prompt = MODEL_PROMPTS.getModelPrompt(modelType, this.currentInterviewType);

    if (prompt && typeof prompt === 'string') {
      return prompt;
    }

    // Fallback to default prompt
    return prompt || null;
  }

  _getModelType(modelName = '') {
    const name = modelName.toLowerCase();
    if (name.includes('mistral') || name.includes('magistral')) return 'mistral';
    if (name.includes('qwen')) return 'qwen';
    if (name.includes('codellama')) return 'codellama';
    if (name.includes('deepseek')) return 'deepseek';
    return 'default';
  }

  _extractContent(response) {
    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      if (choice.message) {
        // Only use 'content' field, ignore 'reasoning_content' (thinking process)
        const content = choice.message.content;

        // Return content even if it's an empty string (empty response is valid)
        if (content !== undefined && content !== null) {
          return content;
        }
      }
    }

    // Fallback for different response formats
    if (typeof response === 'string') {
      return response;
    }

    if (response.content !== undefined && response.content !== null) {
      return response.content;
    }

    throw new Error('Invalid response format: no content found');
  }
}

module.exports = SimpleAIManager;
