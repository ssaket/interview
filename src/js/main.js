const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  nativeImage,
  screen,
} = require('electron');
const axios = require('axios');
const crypto = require('crypto');

require('dotenv').config();

const { InferenceClient } = require('@huggingface/inference');
const OllamaClient = require('./ollama-client');
const DeepSeekFormatter = require('./formatter');

const MODEL_PROMPTS = {
  /* Generic fallback — balanced detail */
  default: `You are my coding interview assistant. Ignore any junk or unclear OCR text.

Respond in three **clearly-labeled phases**:

1. 🐢**Brute-force reasoning**  
   • Describe the simplest correct approach conceptually.  
   • Provide its time and space complexity.  
   • **Do *not* show any code yet.**

2. 🔍**Guided examples**  
   • Walk through 2-3 small inputs step-by-step to illustrate the brute-force idea.  
   • Surface any corner-cases and pitfalls.

3. ⚡ **Optimised solution**  
   • Explain the key insight that leads to the optimal algorithm.  
   • Present clean, idiomatic Python code.  
   • Analyse its time and space complexity.

Keep the tone human and conversational, and reference earlier context when helpful.`,

  /* Mistral models — concise & to‑the‑point */
  mistral: `You are my coding interview assistant. Ignore junk or unreadable OCR text.

For each problem answer **in order**:
1. Brute-force idea (concept + Big-O, **no code**)  
2. Two concise worked examples  
3. Optimised approach → explanation → Python code → complexity

Stay direct and concise. Reference previous context appropriately.`,

  /* Qwen models — beginner‑friendly teaching style */
  qwen: `You are a coding interview tutor. The input may have OCR noise—ignore it.

Structure your response in three steps:
1. Beginner-friendly brute-force explanation with complexity (**no code**)  
2. Walkthrough of 2-3 simple examples  
3. Optimised solution: key insight, Python code, detailed complexity

Keep the language clear and approachable, and reference prior context when relevant.`,

  /* CodeLlama — fast, clear coding help */
  codellama: `You are my coding assistant. The input may contain OCR noise—ignore it.

For each problem:
1. Briefly explain the simplest approach with time and space complexity. Keep it short. No code yet.
2. Show 1-2 small examples to illustrate.
3. Present the efficient solution:
   - Explain why it's better
   - Provide clean Python code
   - State precise time and space complexity

Be clear and concise. Avoid long explanations or excessive brainstorming. Focus on working code and correctness. Reference prior context if helpful.`,

  /* Phi models — quick, simple Python-first output */
  phi: `You are a coding assistant focused on quick, easy-to-understand solutions. The input may contain OCR noise—ignore it.

For each problem:
1. Briefly describe the simplest correct approach in plain language.
2. Show clean, minimal Python code immediately.
3. Mention time and space complexity after the code.

Keep your explanation short. Use simple words. No complex theory or long sentences. Focus on practical, working code`,
};

const ollamaModels = {
  primary: 'myaniu/qwen2.5-1m',
  dryRun: ['phi3:mini', 'codellama:7b-instruct'],
  explanation: ['mistral'],
  all: function () {
    return [this.primary, ...this.dryRun, ...this.explanation];
  },
};

const AppController = (() => {
  // --- State ---
  let mainWindow;
  let ocrFilteringEnabled = true;
  let formatterEnabled = true;
  let currentModelName = process.env.OLLAMA_MODEL || ollamaModels.primary;
  let currentProvider = process.env.AI_PROVIDER || 'ollama';
  let aiClient;
  let isOllama = false;
  let SYSTEM_PROMPT = getSystemPrompt(currentModelName);
  const modelInstances = new Map();
  const formatter = new DeepSeekFormatter();
  const sessions = new Map();

  function getSession() {
    if (!sessions.has(currentModelName)) {
      sessions.set(currentModelName, { history: [], active: false, cache: new Map() });
    }
    return sessions.get(currentModelName);
  }

  // --- Utility ---
  function getModelType(modelName = '') {
    modelName = modelName.toLowerCase();
    if (modelName.includes('phi')) return 'phi';
    if (modelName.includes('mistral')) return 'mistral';
    if (modelName.includes('qwen')) return 'qwen';
    if (modelName.includes('codellama')) return 'codellama';
    return 'default';
  }
  function getSystemPrompt(modelName) {
    return MODEL_PROMPTS[getModelType(modelName)] || MODEL_PROMPTS.default;
  }

  // --- Window ---
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 800,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      show: true,
      fullscreenable: false,
      backgroundColor: '#00000000',
      focusable: false,
      skipTaskbar: true,
      type: 'panel',
      paintWhenInitiallyHidden: true,
      titleBarStyle: 'hidden',
      enableLargerThanScreen: true,
      movable: true,
    });

    mainWindow.setContentProtection(true);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

    if (process.platform === 'darwin') {
      mainWindow.setHiddenInMissionControl(true);
      mainWindow.setWindowButtonVisibility(false);
      mainWindow.setBackgroundColor('#00000000');
      mainWindow.setSkipTaskbar(true);
      mainWindow.setHasShadow(false);
    }
    mainWindow.webContents.setBackgroundThrottling(false);
    mainWindow.webContents.setFrameRate(60);
    mainWindow.loadFile('index.html');
  }

  // -- Formatting --
  function toggleFormatter() {
    formatterEnabled = !formatterEnabled;
    mainWindow.webContents.send('formatter-toggled', formatterEnabled);
  }

  // --- AI Client ---
  function initializeAIClient(provider = currentProvider) {
    const providerLower = provider.toLowerCase();
    const modelName =
      providerLower === 'ollama'
        ? currentModelName
        : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528';
    const instanceKey = `${providerLower}-${modelName}`;

    if (modelInstances.has(instanceKey)) {
      const instance = modelInstances.get(instanceKey);
      aiClient = instance.client;
      isOllama = instance.isOllama;
      SYSTEM_PROMPT = instance.systemPrompt;
      currentProvider = provider;
      return { provider: currentProvider, isOllama };
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
        systemPrompt: getSystemPrompt(modelName),
      };
      if (process.env.OLLAMA_WARMUP !== 'false' && provider === currentProvider) {
        setTimeout(async () => {
          try {
            console.log('Starting model warmup...');
            await client.warmupModel();
          } catch (error) {
            console.log('Model warmup failed, but continuing:', error.message);
          }
        }, 2000);
      }
    } else {
      if (!process.env.HF_TOKEN) {
        console.warn(
          'HF_TOKEN not found in environment variables. HuggingFace provider may not work.'
        );
      }
      const client = new InferenceClient(process.env.HF_TOKEN);
      newInstance = {
        client,
        isOllama: false,
        systemPrompt: getSystemPrompt(modelName),
      };
      console.log('Using HuggingFace provider with model:', modelName);
    }
    modelInstances.set(instanceKey, newInstance);
    aiClient = newInstance.client;
    isOllama = newInstance.isOllama;
    SYSTEM_PROMPT = newInstance.systemPrompt;
    currentProvider = provider;
    return { provider: currentProvider, isOllama };
  }

  function switchAIProvider() {
    const newProvider = isOllama ? 'huggingface' : 'ollama';
    mainWindow.webContents.send('provider-switching', {
      from: currentProvider,
      to: newProvider,
      sessionLength: session.history.length,
    });
    try {
      SYSTEM_PROMPT = getSystemPrompt(
        newProvider === 'ollama' ? currentModelName : process.env.HF_MODEL
      );
      const result = initializeAIClient(newProvider);
      mainWindow.webContents.send('provider-switched', {
        provider: result.provider,
        isOllama: result.isOllama,
        sessionPreserved: session.history.length,
        model: result.isOllama
          ? currentModelName
          : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
      });
    } catch (error) {
      console.error('Failed to switch provider:', error.message);
      mainWindow.webContents.send('provider-switch-failed', {
        error: error.message,
        currentProvider: currentProvider,
      });
    }
  }

  // --- Shortcuts ---
  function registerShortcuts() {
    let moveStep = 20,
      resizeStep = 50;
    const defaultWidth = 800,
      defaultHeight = 800,
      minSize = 100;

    // Window movement, resizing, and help
    ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
      globalShortcut.register(`Command+${dir}`, () => {
        const [x, y] = mainWindow.getPosition();
        const dx = dir === 'Left' ? -moveStep : dir === 'Right' ? moveStep : 0;
        const dy = dir === 'Up' ? -moveStep : dir === 'Down' ? moveStep : 0;
        mainWindow.setPosition(x + dx, y + dy);
      });
    });
    globalShortcut.register('Command+Shift+=', () => {
      if (moveStep < 400) moveStep *= 2;
    });
    globalShortcut.register('Command+Shift+-', () => {
      if (moveStep > 20) moveStep /= 2;
    });
    globalShortcut.register('Command+Shift+]', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width + resizeStep, height);
    });
    globalShortcut.register('Command+Shift+[', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(Math.max(minSize, width - resizeStep), height);
    });
    globalShortcut.register('Command+Shift+Down', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width, height + resizeStep);
    });
    globalShortcut.register('Command+Shift+Up', () => {
      const [width, height] = mainWindow.getSize();
      mainWindow.setSize(width, Math.max(minSize, height - resizeStep));
    });
    globalShortcut.register('Command+Shift+0', () => {
      mainWindow.setSize(defaultWidth, defaultHeight);
    });
    globalShortcut.register('Command+Shift+H', showHelp);

    // Window, audio, session, OCR, theme, and model switching
    globalShortcut.register('Command+B', () =>
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    );
    globalShortcut.register('Command+R', () => mainWindow.webContents.send('start-audio'));
    globalShortcut.register('Command+T', () => mainWindow.webContents.send('stop-audio'));
    globalShortcut.register('Command+Shift+R', () => {
      sessions.set(currentModelName, { history: [], active: false });
      mainWindow.webContents.send('session-reset');
      mainWindow.webContents.send('session-length', 0);
    });
    globalShortcut.register('Command+Shift+F', () => {
      ocrFilteringEnabled = !ocrFilteringEnabled;
      mainWindow.webContents.send('ocr-filtering-changed', ocrFilteringEnabled);
    });
    globalShortcut.register('Command+Shift+P', switchAIProvider);
    globalShortcut.register('Command+Shift+W', () => {
      if (isOllama) {
        mainWindow.webContents.send(
          'model-warmup-started',
          `Warming up ${currentModelName}... This may take 10-30 seconds.`
        );
      }
    });
    globalShortcut.register('Command+Shift+D', () => mainWindow.webContents.send('toggle-theme'));
    globalShortcut.register('Command+Shift+M', switchOllamaModel);
    globalShortcut.register('Shift+1', () => mainWindow.webContents.send('scroll-page', 'up'));
    globalShortcut.register('Shift+2', () => mainWindow.webContents.send('scroll-page', 'down'));
    globalShortcut.register('Command+Shift+S', () =>
      mainWindow.webContents.send('trigger-screenshot')
    );
    globalShortcut.register('Command+Shift+A', () =>
      mainWindow.webContents.send('trigger-overlay-region-screenshot')
    );
    globalShortcut.register('Command+Shift+L', toggleFormatter);
  }

  function showHelp() {
    console.log('\n=== KEYBOARD SHORTCUTS HELP ===');
    console.log('WINDOW MOVEMENT:');
    console.log('  Cmd+Arrow Keys        - Move window in direction');
    console.log('\nWINDOW RESIZING:');
    console.log('  Cmd+Shift+=           - Make window larger (both dimensions)');
    console.log('  Cmd+Shift+-           - Make window smaller (both dimensions)');
    console.log('  Cmd+Shift+]           - Increase window width');
    console.log('  Cmd+Shift+[           - Decrease window width');
    console.log('  Cmd+Shift+Up          - Increase window height');
    console.log('  Cmd+Shift+Down        - Decrease window height');
    console.log('  Cmd+Shift+0           - Reset window to default size (800x800)');
    console.log('\nSCREEN CAPTURE:');
    console.log('  Cmd+Shift+S           - Take screenshot');
    console.log('  Cmd+Shift+A           - Capture behind overlay region');
    console.log('\nWINDOW CONTROL:');
    console.log('  Cmd+B                 - Toggle window visibility');
    console.log('\nAUDIO:');
    console.log('  Cmd+R                 - Start audio');
    console.log('  Cmd+T                 - Stop audio');
    console.log('\nSESSION MANAGEMENT:');
    console.log('  Cmd+Shift+R           - Reset session');
    console.log('  Cmd+Shift+F           - Toggle OCR filtering');
    console.log('  Cmd+Shift+P           - Switch AI provider');
    console.log('  Cmd+Shift+W           - Manual model warmup (Ollama only)');
    console.log('  Cmd+Shift+D           - Toggle dark/light theme');
    console.log('  Cmd+Shift+M           - Switch Ollama model');
    console.log('\nPAGE SCROLLING:');
    console.log('  Shift+1               - Scroll page up');
    console.log('  Shift+2               - Scroll page down');
    console.log('\nHELP:');
    console.log('  Cmd+Shift+H           - Display this help');
    console.log('================================\n');
  }

  function switchOllamaModel() {
    if (!isOllama) return;
    const allModels = ollamaModels.all();
    const currentIndex = allModels.indexOf(currentModelName);
    const nextIndex = (currentIndex + 1) % allModels.length;
    const newModel = allModels[nextIndex];

    const oldType = getModelType(currentModelName);
    const newType = getModelType(newModel);
    if (oldType !== newType) {
      console.log('\nNew System Prompt:');
      console.log('----------------------------------------');
      console.log(MODEL_PROMPTS[newType]);
      console.log('----------------------------------------\n');
    }

    const oldSession = getSession();
    const prevSessionHistory = oldSession.history.slice(-20);
    const lastUserMsg = prevSessionHistory.reverse().find((m) => m.role === 'user');

    currentModelName = newModel;
    process.env.OLLAMA_MODEL = newModel;
    SYSTEM_PROMPT = getSystemPrompt(newModel);

    initializeAIClient('ollama');

    const existed = sessions.has(newModel);
    if (existed) {
      newSession = sessions.get(newModel);
    } else {
      newSession = {
        history: lastUserMsg ? [lastUserMsg] : [],
        active: Boolean(lastUserMsg),
        cache: new Map(),
      };
      sessions.set(newModel, newSession);
    }

    mainWindow.webContents.send('model-switched', {
      model: newModel,
      question: lastUserMsg ? lastUserMsg.content : '',
      sessionLength: newSession.history.length,
      exchanges: Math.floor(newSession.history.length / 2),
    });
    console.log(`Switched to ${newModel} (${newSession.history.length} messages preserved)`);
  }

  // --- IPC Handlers ---
  function registerIpcHandlers() {
    ipcMain.handle('capture-screen', async () => {
      mainWindow.webContents.send('hide-ui');
      await new Promise((r) => setTimeout(r, 100));
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      mainWindow.webContents.send('show-ui');
      return sources[0].thumbnail.toDataURL();
    });

    ipcMain.handle('capture-screen-region', async () => {
      mainWindow.webContents.send('hide-ui');
      await new Promise((r) => setTimeout(r, 100));
      const [windowX, windowY] = mainWindow.getPosition();
      const [windowWidth, windowHeight] = mainWindow.getSize();
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: screenWidth, height: screenHeight },
      });
      mainWindow.webContents.send('show-ui');
      const region = { x: windowX, y: windowY, width: windowWidth, height: windowHeight };
      try {
        const fullImage = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL());
        const croppedImage = fullImage.crop(region);
        return croppedImage.toDataURL();
      } catch (error) {
        console.error('Error cropping image:', error);
        return sources[0].thumbnail.toDataURL();
      }
    });

    ipcMain.handle('perform-ocr', async (event, image) => {
      const Tesseract = require('tesseract.js');
      const {
        data: { text },
      } = await Tesseract.recognize(image, 'eng');
      let finalText = text;
      if (ocrFilteringEnabled) {
        const LLMFriendlyOCRCleaner = require('./llm-friendly-ocr-cleaner');
        const cleaner = new LLMFriendlyOCRCleaner();
        finalText = cleaner.cleanText(text, {
          maxLines: 30,
          preserveQuestions: true,
          preserveCode: true,
          removeJunk: true,
          logResults: false,
        });
      }
      return finalText;
    });

    ipcMain.handle('ask-chatgpt', async (event, question) => {
      const session = getSession();
      // 1) If we’ve already answered this exact question, return it immediately
      const questionHash = crypto.createHash('md5').update(question).digest('hex');
      console.log(`[DEBUG] questionHash = ${questionHash}`);
      console.log(
        `[DEBUG] cache size = ${session.cache.size}; keys = ${JSON.stringify(
          Array.from(session.cache.keys())
        )}`
      );

      if (session.cache.has(questionHash)) {
        const cachedResponse = session.cache.get(questionHash);
        console.log(`[DEBUG] cache hit for hash ${questionHash}`);
        return formatter.formatResponse(cachedResponse, formatterEnabled).text;
      }

      console.log(`[DEBUG] cache miss for hash ${questionHash}, calling model...`);
      try {
        if (isOllama) {
          mainWindow.webContents.send(
            'ai-processing-started',
            `${currentModelName} is thinking... This may take 60-90 seconds for complex coding questions.`
          );
        }
        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...session.history,
          { role: 'user', content: question },
        ];
        let chatCompletion;
        if (isOllama) {
          chatCompletion = await aiClient.chatCompletion({ messages, stream: false });
        } else {
          chatCompletion = await aiClient.chatCompletion({
            provider: process.env.HF_PROVIDER || 'hyperbolic',
            model: process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
            messages,
            stream: false,
          });
        }
        const choice = chatCompletion.choices[0].message;
        const rawResponse =
          typeof choice === 'string' ? choice : choice.content || JSON.stringify(choice);
        session.history.push({ role: 'user', content: question });
        session.history.push({ role: 'assistant', content: rawResponse });
        session.cache.set(questionHash, rawResponse);

        session.active = true;
        if (session.history.length > 20) session.history = session.history.slice(-20);
        if (isOllama) mainWindow.webContents.send('ai-processing-complete');
        const formatted = formatter.formatResponse(rawResponse, formatterEnabled);
        return formatted.text;
      } catch (err) {
        if (isOllama) mainWindow.webContents.send('ai-processing-complete');
        let errorMsg =
          `⚠️ ${isOllama ? 'Ollama' : 'HuggingFace'} inference failed: ` + (err.message || err);
        if (isOllama) {
          if (err.message.includes('Ollama server not running')) {
            errorMsg = '⚠️ Ollama server not running. Please start with: ollama serve';
          }
          if (err.message.includes('model not found') || err.message.includes('Model')) {
            errorMsg = `⚠️ ${currentModelName} model not found. Please pull with: ollama pull ${currentModelName}`;
          }
          if (err.message.includes('timeout')) {
            errorMsg = `⚠️ ${currentModelName} timeout. This reasoning model typically takes 60-90 seconds for complex coding questions. For very complex problems, it may take up to 5 minutes. Please wait and try again, or consider using a simpler question.`;
          }
        } else if (err.status === 429 || (err.response && err.response.status === 429)) {
          errorMsg = '⚠️ Rate limit exceeded. Please try again later.';
        }
        // Update the UI with the new session length
        mainWindow.webContents.send('session-length', session.history.length);
        return formatter.formatResponse(errorMsg, formatterEnabled).text;
      }
    });

    ipcMain.handle('get-ocr-filtering-state', async () => ocrFilteringEnabled);
    ipcMain.handle('toggle-ocr-filtering', async () => {
      ocrFilteringEnabled = !ocrFilteringEnabled;
      return ocrFilteringEnabled;
    });
    ipcMain.handle('transcribe-audio', async (evt, b64) => {
      const buffer = Buffer.from(b64, 'base64');
      const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', buffer, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'audio/webm',
        },
        params: { model: 'whisper-1' },
      });
      return resp.data.text;
    });
    ipcMain.handle('get-provider-status', async () => ({
      provider: currentProvider,
      isOllama: isOllama,
      model: isOllama ? currentModelName : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
    }));
    ipcMain.handle('check-ollama-connection', async () => {
      if (!isOllama) {
        return { error: 'Not using Ollama provider', connected: false, modelAvailable: false };
      }
      try {
        const status = await aiClient.checkConnection();
        return status;
      } catch (error) {
        return { error: error.message, connected: false, modelAvailable: false };
      }
    });
    ipcMain.handle('switch-ai-provider', async (event, targetProvider) => {
      const session = getSession();
      try {
        if (targetProvider) {
          if (targetProvider.toLowerCase() !== currentProvider.toLowerCase()) {
            const result = initializeAIClient(targetProvider);
            return {
              success: true,
              provider: result.provider,
              isOllama: result.isOllama,
              sessionPreserved: session.history.length,
              model: result.isOllama
                ? currentModelName
                : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
            };
          } else {
            return { success: false, error: `Already using ${currentProvider} provider` };
          }
        } else {
          switchAIProvider();
          return {
            success: true,
            provider: currentProvider,
            isOllama: isOllama,
            sessionPreserved: session.history.length,
            model: isOllama
              ? currentModelName
              : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
          };
        }
      } catch (error) {
        return { success: false, error: error.message, currentProvider: currentProvider };
      }
    });
    ipcMain.handle('warmup-ollama-model', async () => {
      if (!isOllama) return { success: false, error: 'Not using Ollama provider' };
      try {
        const result = await aiClient.warmupModel();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  // --- App Lifecycle ---
  function start() {
    app.whenReady().then(() => {
      createWindow();
      registerShortcuts();
      registerIpcHandlers();
      initializeAIClient();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    });
    app.on('before-quit', () => globalShortcut.unregisterAll());
    app.on('window-all-closed', () => {
      globalShortcut.unregisterAll();
      if (process.platform !== 'darwin') app.quit();
    });
  }

  // --- Expose only start ---
  return { start };
})();

AppController.start();
