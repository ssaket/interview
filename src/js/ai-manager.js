const crypto = require('crypto');
const { InferenceClient } = require('@huggingface/inference');
const OllamaClient = require('./ollama-client');
const MODEL_PROMPTS = require('./model-prompts');   // <- see note below

/**
 * ----------------------------------------------------------
 *  Local list of known Ollama images.
 *  (Pulled out of main.js – feel free to move to its own file later.)
 * ----------------------------------------------------------
 */
const ollamaModels = {
  simple: ['phi3:mini', 'codellama:7b-instruct', 'mistral'],
  primary: 'phi3:mini',
  /** Return every model name available (simple list for now). */
  all() {
    // Expand this later if you need a longer list
    return [...this.simple];
  },
};


class AIManager {
  constructor(appController) {
    this.appController = appController;

    // ---- Current model / provider ----
    this.currentModelName = ollamaModels.primary || process.env.OLLAMA_MODEL || 'phi3:mini';
    this.currentProvider = process.env.AI_PROVIDER || 'ollama';

    // ---- Runtime state ----
    this.isOllama = false;
    this.aiClient = null;
    this.SYSTEM_PROMPT = this.getSystemPrompt(this.currentModelName);

    // One shared cache of instantiated clients
    this._modelInstances = new Map();
    this._sessions = new Map();
  }

  /* ---------- Helpers ---------- */
  _getModelType(modelName = '') {
    const name = modelName.toLowerCase();
    if (name.includes('phi')) return 'phi';
    if (name.includes('mistral')) return 'mistral';
    if (name.includes('qwen')) return 'qwen';
    if (name.includes('codellama')) return 'codellama';
    return 'default';
  }
  getSystemPrompt(modelName) {
    return MODEL_PROMPTS[this._getModelType(modelName)] || MODEL_PROMPTS.default;
  }

  /* ---------- Core ---------- */
  initialize(provider = this.currentProvider) {
    const providerLower = provider.toLowerCase();
    const modelName =
      providerLower === 'ollama'
        ? this.currentModelName
        : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528';
    const key = `${providerLower}-${modelName}`;

    // Re‑use an existing client if we’ve seen this (provider, model) combo
    if (this._modelInstances.has(key)) {
      const inst = this._modelInstances.get(key);
      this.aiClient = inst.client;
      this.isOllama = inst.isOllama;
      this.SYSTEM_PROMPT = inst.systemPrompt;
      this.currentProvider = provider;
      return;
    }

    let newInstance;
    if (providerLower === 'ollama') {
      const client = new OllamaClient(
        process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        modelName
      );
      newInstance = {
        client,
        isOllama: true,
        systemPrompt: this.getSystemPrompt(modelName),
      };
    } else {
      const client = new InferenceClient(process.env.HF_TOKEN);
      newInstance = {
        client,
        isOllama: false,
        systemPrompt: this.getSystemPrompt(modelName),
      };
    }

    this._modelInstances.set(key, newInstance);
    this.aiClient = newInstance.client;
    this.isOllama = newInstance.isOllama;
    this.SYSTEM_PROMPT = newInstance.systemPrompt;
    this.currentProvider = provider;
  }

  switchProvider() {
    const target = this.isOllama ? 'huggingface' : 'ollama';
    this.initialize(target);
    this.appController.windowManager.send('provider-switched', {
      provider: this.currentProvider,
      isOllama: this.isOllama,
    });
  }

  /** Retrieve (or lazily create) the session object for the current model. */
  getSession() {
    if (!this._sessions.has(this.currentModelName)) {
      this._sessions.set(this.currentModelName, {
        history: [],
        active: false,
        cache: new Map(),
      });
    }
    return this._sessions.get(this.currentModelName);
  }

  /* ---------- Public Ask API ---------- */
  /**
   * Ask the current model a question and return the raw assistant response
   * (string). Handles session caching, history trimming, and UI events.
   * @param {string} question
   */
  async ask(question) {
    const session = this.getSession();

    /* ---- 1. Cache check -------------------------------------------------- */
    const questionHash = crypto.createHash('md5').update(question).digest('hex');
    if (session.cache.has(questionHash)) {
      console.log(`[AIManager] cache hit for hash ${questionHash}`);
      return session.cache.get(questionHash);
    }

    console.log(`[AIManager] cache miss for hash ${questionHash}, querying model...`);

    /* ---- 2. Notify renderer (for long Ollama calls) ---------------------- */
    if (this.isOllama) {
      this.appController.windowManager.send(
        'ai-processing-started',
        `${this.currentModelName} is thinking... This may take 60‑90 seconds for complex coding questions.`
      );
    }

    /* ---- 3. Build message array & call provider ------------------------- */
    const messages = [
      { role: 'system', content: this.SYSTEM_PROMPT },
      ...session.history,
      { role: 'user', content: question },
    ];

    let chatCompletion;
    try {
      if (this.isOllama) {
        chatCompletion = await this.aiClient.chatCompletion({ messages, stream: false });
      } else {
        chatCompletion = await this.aiClient.chatCompletion({
          provider: process.env.HF_PROVIDER || 'hyperbolic',
          model: process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
          messages,
          stream: false,
        });
      }
    } catch (err) {
      if (this.isOllama) this.appController.windowManager.send('ai-processing-complete');
      throw err;
    }

    /* ---- 4. Extract content --------------------------------------------- */
    const choice = chatCompletion.choices[0].message;
    const rawResponse =
      typeof choice === 'string' ? choice : choice.content || JSON.stringify(choice);

    /* ---- 5. Update session ---------------------------------------------- */
    session.history.push({ role: 'user', content: question });
    session.history.push({ role: 'assistant', content: rawResponse });
    session.cache.set(questionHash, rawResponse);
    session.active = true;

    if (session.history.length > 20) session.history = session.history.slice(-20);

    /* ---- 6. Notify renderer --------------------------------------------- */
    if (this.isOllama) this.appController.windowManager.send('ai-processing-complete');
    this.appController.windowManager.send('session-length', session.history.length);

    return rawResponse;
  }

  /** Ping the current provider/model to make sure it’s alive. */
  async warmup() {
    if (this.isOllama) {
      try {
        await this.aiClient.chatCompletion({
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
        });
        return true;
      } catch (_) {
        return false;
      }
    } else {
      // HuggingFace – we just do a tiny empty completion
      try {
        await this.aiClient.chatCompletion({
          provider: process.env.HF_PROVIDER || 'hyperbolic',
          model: process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
        });
        return true;
      } catch (_) {
        return false;
      }
    }
  }

}


module.exports = AIManager;
// Expose the shared Ollama model list so other modules (e.g., ShortcutManager) can use it
AIManager.ollamaModels = ollamaModels;
