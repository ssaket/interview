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
require('dotenv').config();

// -- Global variables -----------------------------------------------------
let mainWindow;
let ocrFilteringEnabled = true; // Default: filtering ON
let currentModelName = process.env.OLLAMA_MODEL || 'myaniu/qwen2.5-1m';
const modelInstances = new Map(); // Map to store model instances

// Available Ollama models
const ollamaModels = {
  primary: 'myaniu/qwen2.5-1m',
  dryRun: ['phi4-mini-reasoning', 'deepseek-r1', 'phi3:mini'],
  explanation: ['mistral'],
  all: function () {
    return [this.primary, ...this.dryRun, ...this.explanation];
  },
};

// Session management
const session = {
  history: [],
  active: false,
};
// -- Helper functions ----------------------------------------------------

function registerShortcuts(mainWindow) {
  // Capture shortcuts
  let moveStep = 20,
    resizeStep = 50;
  // Screenshot shortcuts
  globalShortcut.register('Command+Shift+S', () =>
    mainWindow.webContents.send('trigger-screenshot')
  );
  globalShortcut.register('Command+Shift+A', () =>
    mainWindow.webContents.send('trigger-overlay-region-screenshot')
  );
  // Movement
  ['Left', 'Right', 'Up', 'Down'].forEach((dir) => {
    globalShortcut.register(`Command+${dir}`, () => {
      const [x, y] = mainWindow.getPosition();
      const dx = dir === 'Left' ? -moveStep : dir === 'Right' ? moveStep : 0;
      const dy = dir === 'Up' ? -moveStep : dir === 'Down' ? moveStep : 0;
      mainWindow.setPosition(x + dx, y + dy);
    });
  });
  // Resizing shortcuts...
  const defaultWidth = 800;
  const defaultHeight = 800;
  const minSize = 200;
  // Make window larger/smaller (uniform scaling)
  globalShortcut.register('Command+Shift+=', () => {
    // const [width, height] = mainWindow.getSize();
    // const newWidth = width + resizeStep;
    // const newHeight = height + resizeStep;
    // mainWindow.setSize(newWidth, newHeight);
    // console.log(`Window resized larger: ${newWidth}x${newHeight}`);
    if (moveStep < 400) moveStep *= 2;
  });
  globalShortcut.register('Command+Shift+-', () => {
    // const [width, height] = mainWindow.getSize();
    // const newWidth = Math.max(minSize, width - resizeStep);
    // const newHeight = Math.max(minSize, height - resizeStep);
    // mainWindow.setSize(newWidth, newHeight);
    // console.log(`Window resized smaller: ${newWidth}x${newHeight}`);
    if (moveStep > 20) moveStep /= 2;
  });
  // Width adjustments
  globalShortcut.register('Command+Shift+]', () => {
    const [width, height] = mainWindow.getSize();
    const newWidth = width + resizeStep;
    mainWindow.setSize(newWidth, height);
  });
  globalShortcut.register('Command+Shift+[', () => {
    const [width, height] = mainWindow.getSize();
    const newWidth = Math.max(minSize, width - resizeStep);
    mainWindow.setSize(newWidth, height);
  });
  // Height adjustments (using Shift+Up/Down since regular Up/Down are used for movement)
  globalShortcut.register('Command+Shift+Down', () => {
    const [width, height] = mainWindow.getSize();
    const newHeight = height + resizeStep;
    mainWindow.setSize(width, newHeight);
  });
  globalShortcut.register('Command+Shift+Up', () => {
    const [width, height] = mainWindow.getSize();
    const newHeight = Math.max(minSize, height - resizeStep);
    mainWindow.setSize(width, newHeight);
  });
  // Reset window to default size
  globalShortcut.register('Command+Shift+0', () => {
    mainWindow.setSize(defaultWidth, defaultHeight);
  });
  // Display help with all keyboard shortcuts
  globalShortcut.register('Command+Shift+H', () => {
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
  });
  // Visibility toggle
  globalShortcut.register('Command+B', () =>
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  );
  // Audio
  globalShortcut.register('Command+R', () => mainWindow.webContents.send('start-audio'));
  globalShortcut.register('Command+T', () => mainWindow.webContents.send('stop-audio'));
  // Session & OCR toggles
  globalShortcut.register('Command+Shift+R', () => {
    session.history = [];
    session.active = false;
    mainWindow.webContents.send('session-reset');
  });
  globalShortcut.register('Command+Shift+F', () => {
    ocrFilteringEnabled = !ocrFilteringEnabled;
    console.log(`OCR Filtering: ${ocrFilteringEnabled ? 'ON' : 'OFF'}`);
    mainWindow.webContents.send('ocr-filtering-changed', ocrFilteringEnabled);
  });
  globalShortcut.register('Command+Shift+P', () => {
    switchAIProvider();
  });
  globalShortcut.register('Command+Shift+W', () => {
    if (isOllama) {
      console.log(`Manual ${currentModelName} warmup triggered...`);
      mainWindow.webContents.send(
        'model-warmup-started',
        `Warming up ${currentModelName}... This may take 10-30 seconds.`
      );
    }
  });

  // Theme toggle
  globalShortcut.register('Command+Shift+D', () => {
    mainWindow.webContents.send('toggle-theme');
  });

  // Ollama model switch
  globalShortcut.register('Command+Shift+M', () => {
    if (isOllama) {
      // Get all available models
      const allModels = ollamaModels.all();
      // Get current model index and calculate next
      const currentIndex = allModels.indexOf(currentModelName);
      const nextIndex = (currentIndex + 1) % allModels.length;
      const newModel = allModels[nextIndex];

      // Log system prompt change
      const oldType = getModelType(currentModelName);
      const newType = getModelType(newModel);
      console.log('\nSwitching Model Configuration:');
      console.log(`From: ${currentModelName} (${oldType})`);
      console.log(`To: ${newModel} (${newType})`);
      if (oldType !== newType) {
        console.log('\nNew System Prompt:');
        console.log('----------------------------------------');
        console.log(MODEL_PROMPTS[newType]);
        console.log('----------------------------------------\n');
      }

      // Store current session state
      const prevSessionHistory = session.history.slice(-20); // Keep last 10 exchanges
      const wasActive = session.active;

      // Update model and reinitialize client
      currentModelName = newModel;
      process.env.OLLAMA_MODEL = newModel;

      // Update system prompt for the new model
      const newModelType = getModelType(newModel);
      SYSTEM_PROMPT = MODEL_PROMPTS[newModelType];

      initializeAIClient('ollama');

      // Restore session state
      session.history = prevSessionHistory;
      session.active = wasActive;

      mainWindow.webContents.send('model-switched', {
        model: newModel,
        sessionLength: session.history.length,
        exchanges: Math.floor(session.history.length / 2),
      });

      console.log(`Switched to ${newModel} (${session.history.length} messages preserved)`);
    }
  });

  // Page scrolling shortcuts
  globalShortcut.register('Shift+1', () => {
    mainWindow.webContents.send('scroll-page', 'up');
  });

  globalShortcut.register('Shift+2', () => {
    mainWindow.webContents.send('scroll-page', 'down');
  });
}

function registerIpcHandlers(mainWindow) {
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
  ipcMain.handle('capture-screen-region', async (event) => {
    mainWindow.webContents.send('hide-ui');
    await new Promise((r) => setTimeout(r, 100));
    // Get overlay window position and size
    const [windowX, windowY] = mainWindow.getPosition();
    const [windowWidth, windowHeight] = mainWindow.getSize();
    // Get actual screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    // Use screen resolution for capture to avoid scaling issues
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: screenWidth, height: screenHeight },
    });
    mainWindow.webContents.send('show-ui');
    // Define region as the area behind the overlay window
    const region = {
      x: windowX,
      y: windowY,
      width: windowWidth,
      height: windowHeight,
    };
    // Crop the image to the region behind overlay window
    try {
      const fullImage = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL());
      const croppedImage = fullImage.crop({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      });
      return croppedImage.toDataURL();
    } catch (error) {
      console.error('Error cropping image:', error);
      return sources[0].thumbnail.toDataURL(); // Fallback to full screenshot
    }
  });
  ipcMain.handle('perform-ocr', async (event, image) => {
    const Tesseract = require('tesseract.js');
    const {
      data: { text },
    } = await Tesseract.recognize(image, 'eng');
    let finalText = text;
    if (ocrFilteringEnabled) {
      // Clean the OCR text using ML-based approach
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
    try {
      // Notify UI that processing has started
      if (isOllama) {
        mainWindow.webContents.send(
          'ai-processing-started',
          `${currentModelName} is thinking... This may take 60-90 seconds for complex coding questions.`
        );
      }
      // Build messages array with session history
      const messages = [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...session.history,
        { role: 'user', content: question },
      ];
      let chatCompletion;
      if (isOllama) {
        // Log system prompt being used
        const modelType = getModelType(currentModelName);
        console.log('\nModel Configuration:');
        console.log(`- Model: ${currentModelName}`);
        console.log(`- Type: ${modelType}`);
        console.log('System Prompt:');
        console.log('----------------------------------------');
        console.log(SYSTEM_PROMPT);
        console.log('----------------------------------------\n');
        console.log(messages);

        // Use Ollama with progress feedback
        chatCompletion = await aiClient.chatCompletion({
          messages: messages,
          stream: false,
        });
      } else {
        // Use HuggingFace
        chatCompletion = await aiClient.chatCompletion({
          provider: process.env.HF_PROVIDER || 'hyperbolic',
          model: process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
          messages: messages,
          stream: false,
        });
      }
      const choice = chatCompletion.choices[0].message;
      // message could be string or object
      const rawResponse =
        typeof choice === 'string' ? choice : choice.content || JSON.stringify(choice);
      // Add to session history
      session.history.push({ role: 'user', content: question });
      session.history.push({ role: 'assistant', content: rawResponse });
      session.active = true;
      // Keep only last 10 exchanges (20 messages) to prevent context overflow
      if (session.history.length > 20) {
        session.history = session.history.slice(-20);
      }
      // Notify UI that processing is complete
      if (isOllama) {
        mainWindow.webContents.send('ai-processing-complete');
      }
      // Format the response for better display
      const formatted = formatter.formatResponse(rawResponse);
      return formatted.text; // Return plain text version for the overlay
    } catch (err) {
      console.error(`${isOllama ? 'Ollama' : 'InferenceClient'} error:`, err);
      // Notify UI that processing failed
      if (isOllama) {
        mainWindow.webContents.send('ai-processing-complete');
      }
      // Handle specific errors based on provider
      if (isOllama) {
        if (err.message.includes('Ollama server not running')) {
          const errorMsg = '⚠️ Ollama server not running. Please start with: ollama serve';
          return formatter.formatResponse(errorMsg).text;
        }
        if (err.message.includes('model not found') || err.message.includes('Model')) {
          const errorMsg = `⚠️ ${currentModelName} model not found. Please pull with: ollama pull ${currentModelName}`;
          return formatter.formatResponse(errorMsg).text;
        }
        if (err.message.includes('timeout')) {
          const errorMsg = `⚠️ ${currentModelName} timeout. This reasoning model typically takes 60-90 seconds for complex coding questions. For very complex problems, it may take up to 5 minutes. Please wait and try again, or consider using a simpler question.`;
          return formatter.formatResponse(errorMsg).text;
        }
      } else {
        if (err.status === 429 || (err.response && err.response.status === 429)) {
          const errorMsg = '⚠️ Rate limit exceeded. Please try again later.';
          return formatter.formatResponse(errorMsg).text;
        }
      }
      const errorMsg =
        `⚠️ ${isOllama ? 'Ollama' : 'HuggingFace'} inference failed: ` + (err.message || err);
      return formatter.formatResponse(errorMsg).text;
    }
  });
  // IPC: get OCR filtering state
  ipcMain.handle('get-ocr-filtering-state', async () => {
    return ocrFilteringEnabled;
  });
  // IPC: toggle OCR filtering
  ipcMain.handle('toggle-ocr-filtering', async () => {
    ocrFilteringEnabled = !ocrFilteringEnabled;
    console.log(`OCR Filtering: ${ocrFilteringEnabled ? 'ON' : 'OFF'}`);
    return ocrFilteringEnabled;
  });
  ipcMain.handle('transcribe-audio', async (evt, b64) => {
    const buffer = Buffer.from(b64, 'base64');
    // Save to disk or send directly:
    const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', buffer, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      params: { model: 'whisper-1' },
    });
    return resp.data.text;
  });
  // IPC: get provider status
  ipcMain.handle('get-provider-status', async () => {
    return {
      provider: process.env.AI_PROVIDER,
      isOllama: isOllama,
      model: isOllama
        ? process.env.OLLAMA_MODEL || 'deepseek-r1'
        : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
    };
  });
  // IPC: check Ollama connection
  ipcMain.handle('check-ollama-connection', async () => {
    if (!isOllama) {
      return {
        error: 'Not using Ollama provider',
        connected: false,
        modelAvailable: false,
      };
    }
    try {
      const status = await aiClient.checkConnection();
      return status;
    } catch (error) {
      return {
        error: error.message,
        connected: false,
        modelAvailable: false,
      };
    }
  });
  // IPC: switch AI provider
  ipcMain.handle('switch-ai-provider', async (event, targetProvider) => {
    try {
      if (targetProvider) {
        // Switch to specific provider
        if (targetProvider.toLowerCase() !== currentProvider.toLowerCase()) {
          const result = initializeAIClient(targetProvider);
          return {
            success: true,
            provider: result.provider,
            isOllama: result.isOllama,
            sessionPreserved: session.history.length,
            model: result.isOllama
              ? process.env.OLLAMA_MODEL || 'deepseek-r1'
              : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
          };
        } else {
          return {
            success: false,
            error: `Already using ${currentProvider} provider`,
          };
        }
      } else {
        // Toggle between providers
        switchAIProvider();
        return {
          success: true,
          provider: currentProvider,
          isOllama: isOllama,
          sessionPreserved: session.history.length,
          model: isOllama
            ? process.env.OLLAMA_MODEL || 'deepseek-r1'
            : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        currentProvider: currentProvider,
      };
    }
  });
  // IPC: warmup Ollama model
  ipcMain.handle('warmup-ollama-model', async () => {
    if (!isOllama) {
      return {
        success: false,
        error: 'Not using Ollama provider',
      };
    }
    try {
      console.log('Starting manual model warmup...');
      const result = await aiClient.warmupModel();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });
}

function initializeAIClient(provider = currentProvider) {
  const providerLower = provider.toLowerCase();
  const modelName =
    providerLower === 'ollama'
      ? process.env.OLLAMA_MODEL || 'deepseek-r1'
      : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528';

  // Create a unique key for the model instance
  const instanceKey = `${providerLower}-${modelName}`;

  // Return existing instance if available
  if (modelInstances.has(instanceKey)) {
    const instance = modelInstances.get(instanceKey);
    aiClient = instance.client;
    isOllama = instance.isOllama;
    SYSTEM_PROMPT = instance.systemPrompt;
    currentProvider = provider;
    return { provider: currentProvider, isOllama };
  }

  // Create new instance if not exists
  let newInstance;
  if (providerLower === 'ollama') {
    const client = new OllamaClient(
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      modelName
    );
    newInstance = {
      client,
      isOllama: true,
      systemPrompt: MODEL_PROMPTS[getModelType(modelName)] || MODEL_PROMPTS.default,
    };

    // Optional warmup on startup
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
      systemPrompt: MODEL_PROMPTS[getModelType(modelName)] || MODEL_PROMPTS.default,
    };
    console.log('Using HuggingFace provider with model:', modelName);
  }

  // Store the new instance
  modelInstances.set(instanceKey, newInstance);

  // Set current state
  aiClient = newInstance.client;
  isOllama = newInstance.isOllama;
  SYSTEM_PROMPT = newInstance.systemPrompt;
  currentProvider = provider;

  return { provider: currentProvider, isOllama };
}
// ------------------------------------------------------------------------

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

  mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  // Additional screen capture resistance settings
  if (process.platform === 'darwin') {
    // Prevent window from being captured in screenshots
    mainWindow.setHiddenInMissionControl(true);
    mainWindow.setWindowButtonVisibility(false);
    mainWindow.setBackgroundColor('#00000000');
    // Prevent window from being included in window switcher
    mainWindow.setSkipTaskbar(true);
    // Disable window shadow
    mainWindow.setHasShadow(false);
  }
  // Prevent the window from being captured by screen recording
  mainWindow.webContents.setBackgroundThrottling(false);
  mainWindow.webContents.setFrameRate(60);
  // mainWindow.webContents.openDevTools();
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  registerShortcuts(mainWindow);
  registerIpcHandlers(mainWindow);
  initializeAIClient();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  // Unregister all global shortcuts before quitting
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

const { InferenceClient } = require('@huggingface/inference');
const OllamaClient = require('./ollama-client');
const DeepSeekFormatter = require('./formatter');

// Initialize AI clients based on provider
let currentProvider = process.env.AI_PROVIDER || 'ollama';
let aiClient;
let isOllama = false;

const formatter = new DeepSeekFormatter();
// System prompts for different model types
const MODEL_PROMPTS = {
  default:
    'You are my coding interview assistant. Ignore any junk or unclear text from OCR. Focus on clear explanations, clean Python code, and time and space complexity for solving the core problem. Reference previous context appropriately.',
  mistral:
    'You are my coding interview assistant. Ignore junk or unreadable OCR text. For each question:\n- Explain simply\n- Provide clean Python code\n- Time and space complexity\nBe direct and concise.\nReference previous context appropriately.',
  qwen: 'You are a coding interview tutor. The input may have errors or junk from OCR—ignore those. Provide:\n1. Clear, beginner-friendly explanation\n2. Clean Python code\n3. Time and space complexity\nResponses should be structured and easy to follow.\nReference previous context appropriately.',
  deepseek:
    'You are my coding interview assistant. Focus on professional solutions. For each question:\n- Technical explanation with key insights\n- Clean Python code with optimal solution\n- Detailed time and space complexity analysis\nBe thorough and reference previous context appropriately.',
  phi: 'You are a coding assistant. I will give you a coding problem. The input may have errors or junk from OCR—ignore those. \n\nI do not want code yet.\n\nFirst:\n1. Explain a simple, brute-force approach to solve the problem\n2. Mention basic examples or simple test cases to explain how the approach would work\n3. Only after that, briefly mention possible edge cases to think about (but no code)\n\nDo not over-optimize or jump to complex solutions. Start with basic reasoning to brainstorm.\n\nProblem:',
};

// Function to get system prompt based on model name
function getModelType(modelName = '') {
  modelName = modelName.toLowerCase();
  if (modelName.includes('phi')) return 'phi';
  if (modelName.includes('mistral')) return 'mistral';
  if (modelName.includes('qwen')) return 'qwen';
  if (modelName.includes('deepseek')) return 'deepseek';
  return 'default';
}

// Get system prompt based on current model
let SYSTEM_PROMPT =
  MODEL_PROMPTS[getModelType(process.env.OLLAMA_MODEL || process.env.HF_MODEL)] ||
  MODEL_PROMPTS.default;

function switchAIProvider() {
  const newProvider = isOllama ? 'huggingface' : 'ollama';
  console.log(`Switching from ${currentProvider} to ${newProvider}...`);
  console.log(`Session history preserved: ${session.history.length} messages`);
  // Notify UI about the switch
  mainWindow.webContents.send('provider-switching', {
    from: currentProvider,
    to: newProvider,
    sessionLength: session.history.length,
  });
  try {
    // Update system prompt for the new provider
    SYSTEM_PROMPT =
      MODEL_PROMPTS[
        getModelType(newProvider === 'ollama' ? process.env.OLLAMA_MODEL : process.env.HF_MODEL)
      ] || MODEL_PROMPTS.default;

    const result = initializeAIClient(newProvider);
    // Notify UI about successful switch
    mainWindow.webContents.send('provider-switched', {
      provider: result.provider,
      isOllama: result.isOllama,
      sessionPreserved: session.history.length,
      model: result.isOllama
        ? process.env.OLLAMA_MODEL || 'deepseek-r1'
        : process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1-0528',
    });
  } catch (error) {
    console.error('Failed to switch provider:', error.message);
    // Notify UI about failed switch
    mainWindow.webContents.send('provider-switch-failed', {
      error: error.message,
      currentProvider: currentProvider,
    });
  }
}
