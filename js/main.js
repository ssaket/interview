const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  nativeImage,
  screen,
} = require("electron");
const axios = require("axios");
require("dotenv").config();

let mainWindow;
let ocrFilteringEnabled = true; // Default: filtering ON

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
    backgroundColor: "#00000000",
    focusable: false,
    skipTaskbar: true,
    type: "panel",
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true,
  });

  mainWindow.setContentProtection(true);

  mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver", 1);

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Prevent window from being captured in screenshots
    mainWindow.setHiddenInMissionControl(true);
    mainWindow.setWindowButtonVisibility(false);
    mainWindow.setBackgroundColor("#00000000");

    // Prevent window from being included in window switcher
    mainWindow.setSkipTaskbar(true);

    // Disable window shadow
    mainWindow.setHasShadow(false);
  }

  // Prevent the window from being captured by screen recording
  mainWindow.webContents.setBackgroundThrottling(false);
  mainWindow.webContents.setFrameRate(60);

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  // Capture shortcut
  globalShortcut.register("Command+Shift+S", () => {
    mainWindow.webContents.send("trigger-screenshot");
  });

  // Capture behind overlay shortcut
  globalShortcut.register("Command+Shift+A", () => {
    mainWindow.webContents.send("trigger-overlay-region-screenshot");
  });

  // Movement shortcuts (Cmd + Arrow)
  const moveStep = 20;
  ["Left", "Right", "Up", "Down"].forEach((dir) => {
    globalShortcut.register(`Command+${dir}`, () => {
      const [x, y] = mainWindow.getPosition();
      if (dir === "Left") mainWindow.setPosition(x - moveStep, y);
      if (dir === "Right") mainWindow.setPosition(x + moveStep, y);
      if (dir === "Up") mainWindow.setPosition(x, y - moveStep);
      if (dir === "Down") mainWindow.setPosition(x, y + moveStep);
    });
  });

  // Window resizing shortcuts
  const resizeStep = 50;
  const defaultWidth = 800;
  const defaultHeight = 800;
  const minSize = 200;

  // Make window larger/smaller (uniform scaling)
  globalShortcut.register("Command+Shift+=", () => {
    const [width, height] = mainWindow.getSize();
    const newWidth = width + resizeStep;
    const newHeight = height + resizeStep;
    mainWindow.setSize(newWidth, newHeight);
    console.log(`Window resized larger: ${newWidth}x${newHeight}`);
  });

  globalShortcut.register("Command+Shift+-", () => {
    const [width, height] = mainWindow.getSize();
    const newWidth = Math.max(minSize, width - resizeStep);
    const newHeight = Math.max(minSize, height - resizeStep);
    mainWindow.setSize(newWidth, newHeight);
    console.log(`Window resized smaller: ${newWidth}x${newHeight}`);
  });

  // Width adjustments
  globalShortcut.register("Command+Shift+]", () => {
    const [width, height] = mainWindow.getSize();
    const newWidth = width + resizeStep;
    mainWindow.setSize(newWidth, height);
    console.log(`Window width increased: ${newWidth}x${height}`);
  });

  globalShortcut.register("Command+Shift+[", () => {
    const [width, height] = mainWindow.getSize();
    const newWidth = Math.max(minSize, width - resizeStep);
    mainWindow.setSize(newWidth, height);
    console.log(`Window width decreased: ${newWidth}x${height}`);
  });

  // Height adjustments (using Shift+Up/Down since regular Up/Down are used for movement)
  globalShortcut.register("Command+Shift+Up", () => {
    const [width, height] = mainWindow.getSize();
    const newHeight = height + resizeStep;
    mainWindow.setSize(width, newHeight);
    console.log(`Window height increased: ${width}x${newHeight}`);
  });

  globalShortcut.register("Command+Shift+Down", () => {
    const [width, height] = mainWindow.getSize();
    const newHeight = Math.max(minSize, height - resizeStep);
    mainWindow.setSize(width, newHeight);
    console.log(`Window height decreased: ${width}x${newHeight}`);
  });

  // Reset window to default size
  globalShortcut.register("Command+Shift+0", () => {
    mainWindow.setSize(defaultWidth, defaultHeight);
    console.log(
      `Window reset to default size: ${defaultWidth}x${defaultHeight}`,
    );
  });

  // Display help with all keyboard shortcuts
  globalShortcut.register("Command+Shift+H", () => {
    console.log("\n=== KEYBOARD SHORTCUTS HELP ===");
    console.log("WINDOW MOVEMENT:");
    console.log("  Cmd+Arrow Keys        - Move window in direction");
    console.log("\nWINDOW RESIZING:");
    console.log(
      "  Cmd+Shift+=           - Make window larger (both dimensions)",
    );
    console.log(
      "  Cmd+Shift+-           - Make window smaller (both dimensions)",
    );
    console.log("  Cmd+Shift+]           - Increase window width");
    console.log("  Cmd+Shift+[           - Decrease window width");
    console.log("  Cmd+Shift+Up          - Increase window height");
    console.log("  Cmd+Shift+Down        - Decrease window height");
    console.log(
      "  Cmd+Shift+0           - Reset window to default size (800x800)",
    );
    console.log("\nSCREEN CAPTURE:");
    console.log("  Cmd+Shift+S           - Take screenshot");
    console.log("  Cmd+Shift+A           - Capture behind overlay region");
    console.log("\nWINDOW CONTROL:");
    console.log("  Cmd+B                 - Toggle window visibility");
    console.log("\nAUDIO:");
    console.log("  Cmd+R                 - Start audio");
    console.log("  Cmd+T                 - Stop audio");
    console.log("\nSESSION MANAGEMENT:");
    console.log("  Cmd+Shift+R           - Reset session");
    console.log("  Cmd+Shift+F           - Toggle OCR filtering");
    console.log("  Cmd+Shift+P           - Switch AI provider");
    console.log("  Cmd+Shift+W           - Manual model warmup (Ollama only)");
    console.log("\nHELP:");
    console.log("  Cmd+Shift+H           - Display this help");
    console.log("================================\n");
  });

  // Toggle visibility shortcut
  globalShortcut.register("Command+B", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  globalShortcut.register("Command+R", () => {
    mainWindow.webContents.send("start-audio");
  });
  globalShortcut.register("Command+T", () => {
    mainWindow.webContents.send("stop-audio");
  });

  // Reset session shortcut
  globalShortcut.register("Command+Shift+R", () => {
    sessionHistory = [];
    sessionActive = false;
    mainWindow.webContents.send("session-reset");
  });

  // Toggle OCR filtering shortcut
  globalShortcut.register("Command+Shift+F", () => {
    ocrFilteringEnabled = !ocrFilteringEnabled;
    console.log(`OCR Filtering: ${ocrFilteringEnabled ? "ON" : "OFF"}`);
    mainWindow.webContents.send("ocr-filtering-changed", ocrFilteringEnabled);
  });

  // Switch AI provider shortcut
  globalShortcut.register("Command+Shift+P", () => {
    switchAIProvider();
  });

  // Manual model warmup shortcut (Ollama only)
  globalShortcut.register("Command+Shift+W", () => {
    if (isOllama) {
      console.log("Manual DeepSeek R1 warmup triggered...");
      mainWindow.webContents.send(
        "model-warmup-started",
        "Warming up DeepSeek R1... This may take 10-30 seconds.",
      );
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  // Unregister all global shortcuts before quitting
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") app.quit();
});

// IPC: capture screenshot
ipcMain.handle("capture-screen", async () => {
  mainWindow.webContents.send("hide-ui");
  await new Promise((r) => setTimeout(r, 100));

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  mainWindow.webContents.send("show-ui");
  return sources[0].thumbnail.toDataURL();
});

// IPC: capture screen region behind overlay window
ipcMain.handle("capture-screen-region", async (event) => {
  mainWindow.webContents.send("hide-ui");
  await new Promise((r) => setTimeout(r, 100));

  // Get overlay window position and size
  const [windowX, windowY] = mainWindow.getPosition();
  const [windowWidth, windowHeight] = mainWindow.getSize();

  // Get actual screen dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

  // Use screen resolution for capture to avoid scaling issues
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: screenWidth, height: screenHeight },
  });

  mainWindow.webContents.send("show-ui");

  // Define region as the area behind the overlay window
  const region = {
    x: windowX,
    y: windowY,
    width: windowWidth,
    height: windowHeight,
  };

  // Crop the image to the region behind overlay window
  try {
    const fullImage = nativeImage.createFromDataURL(
      sources[0].thumbnail.toDataURL(),
    );

    const croppedImage = fullImage.crop({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });

    return croppedImage.toDataURL();
  } catch (error) {
    console.error("Error cropping image:", error);
    return sources[0].thumbnail.toDataURL(); // Fallback to full screenshot
  }
});

// IPC: perform OCR
ipcMain.handle("perform-ocr", async (event, image) => {
  const Tesseract = require("tesseract.js");

  const {
    data: { text },
  } = await Tesseract.recognize(image, "eng");

  let finalText = text;

  if (ocrFilteringEnabled) {
    // Clean the OCR text using ML-based approach
    const LLMFriendlyOCRCleaner = require("./llm-friendly-ocr-cleaner");
    const cleaner = new LLMFriendlyOCRCleaner();
    finalText = cleaner.cleanText(text, {
      maxLines: 30,
      preserveQuestions: true,
      preserveCode: true,
      removeJunk: true,
      logResults: true,
    });

    console.log(
      `OCR cleaned: ${text.length} chars -> ${finalText.length} chars`,
    );
  } else {
    console.log(`OCR raw text: ${text.length} chars (filtering disabled)`);
  }

  return finalText;
});

// IPC: ChatGPT
const { InferenceClient } = require("@huggingface/inference");
const OllamaClient = require("./ollama-client");
const DeepSeekFormatter = require("./formatter");

// Initialize AI clients based on provider
let currentProvider = process.env.AI_PROVIDER || "ollama";
let aiClient;
let isOllama = false;

function initializeAIClient(provider = currentProvider) {
  const providerLower = provider.toLowerCase();

  if (providerLower === "ollama") {
    aiClient = new OllamaClient(
      process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      process.env.OLLAMA_MODEL || "deepseek-r1",
    );
    isOllama = true;
    console.log(
      "Using Ollama provider with model:",
      process.env.OLLAMA_MODEL || "deepseek-r1",
    );

    // Optional warmup on startup (can be disabled by setting OLLAMA_WARMUP=false)
    if (process.env.OLLAMA_WARMUP !== "false" && provider === currentProvider) {
      setTimeout(async () => {
        try {
          console.log("Starting model warmup...");
          await aiClient.warmupModel();
        } catch (error) {
          console.log("Model warmup failed, but continuing:", error.message);
        }
      }, 2000); // Wait 2 seconds after startup
    }
  } else {
    if (!process.env.HF_TOKEN) {
      console.warn(
        "HF_TOKEN not found in environment variables. HuggingFace provider may not work.",
      );
    }
    aiClient = new InferenceClient(process.env.HF_TOKEN);
    isOllama = false;
    console.log(
      "Using HuggingFace provider with model:",
      process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
    );
  }

  currentProvider = provider;
  return { provider: currentProvider, isOllama };
}

function switchAIProvider() {
  const newProvider = isOllama ? "huggingface" : "ollama";

  console.log(`Switching from ${currentProvider} to ${newProvider}...`);
  console.log(`Session history preserved: ${sessionHistory.length} messages`);

  // Notify UI about the switch
  mainWindow.webContents.send("provider-switching", {
    from: currentProvider,
    to: newProvider,
    sessionLength: sessionHistory.length,
  });

  try {
    const result = initializeAIClient(newProvider);

    // Notify UI about successful switch
    mainWindow.webContents.send("provider-switched", {
      provider: result.provider,
      isOllama: result.isOllama,
      sessionPreserved: sessionHistory.length,
      model: result.isOllama
        ? process.env.OLLAMA_MODEL || "deepseek-r1"
        : process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
    });

    console.log(`✅ Successfully switched to ${newProvider}`);
    console.log(
      `📚 Session history preserved: ${sessionHistory.length} messages`,
    );
  } catch (error) {
    console.error("❌ Failed to switch provider:", error.message);

    // Notify UI about failed switch
    mainWindow.webContents.send("provider-switch-failed", {
      error: error.message,
      currentProvider: currentProvider,
    });
  }
}

// Initialize on startup
initializeAIClient();

const formatter = new DeepSeekFormatter();

// Session management
let sessionHistory = [];
let sessionActive = false;

ipcMain.handle("ask-chatgpt", async (event, question) => {
  try {
    // Notify UI that processing has started
    if (isOllama) {
      mainWindow.webContents.send(
        "ai-processing-started",
        "DeepSeek R1 is thinking... This may take 60-90 seconds for complex coding questions.",
      );
    }

    // Build messages array with session history
    const messages = [
      {
        role: "system",
        content:
          "You are a coding interview tutor. Provide explanation, clean Python code, and time/space complexity. When answering follow-up questions, reference previous context appropriately.",
      },
      ...sessionHistory,
      { role: "user", content: question },
    ];

    let chatCompletion;

    if (isOllama) {
      // Use Ollama with progress feedback
      console.log(
        "Starting DeepSeek R1 inference - this may take 60-90 seconds...",
      );
      chatCompletion = await aiClient.chatCompletion({
        messages: messages,
        stream: false,
      });
    } else {
      // Use HuggingFace
      chatCompletion = await aiClient.chatCompletion({
        provider: process.env.HF_PROVIDER || "hyperbolic",
        model: process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
        messages: messages,
        stream: false,
      });
    }

    const choice = chatCompletion.choices[0].message;
    // message could be string or object
    const rawResponse =
      typeof choice === "string"
        ? choice
        : choice.content || JSON.stringify(choice);

    // Add to session history
    sessionHistory.push({ role: "user", content: question });
    sessionHistory.push({ role: "assistant", content: rawResponse });
    sessionActive = true;

    // Keep only last 10 exchanges (20 messages) to prevent context overflow
    if (sessionHistory.length > 20) {
      sessionHistory = sessionHistory.slice(-20);
    }

    // Notify UI that processing is complete
    if (isOllama) {
      mainWindow.webContents.send("ai-processing-complete");
    }

    // Format the response for better display
    const formatted = formatter.formatResponse(rawResponse);
    return formatted.text; // Return plain text version for the overlay
  } catch (err) {
    console.error(`${isOllama ? "Ollama" : "InferenceClient"} error:`, err);

    // Notify UI that processing failed
    if (isOllama) {
      mainWindow.webContents.send("ai-processing-complete");
    }

    // Handle specific errors based on provider
    if (isOllama) {
      if (err.message.includes("Ollama server not running")) {
        const errorMsg =
          "⚠️ Ollama server not running. Please start with: ollama serve";
        return formatter.formatResponse(errorMsg).text;
      }
      if (
        err.message.includes("model not found") ||
        err.message.includes("Model")
      ) {
        const errorMsg =
          "⚠️ DeepSeek R1 model not found. Please pull with: ollama pull deepseek-r1";
        return formatter.formatResponse(errorMsg).text;
      }
      if (err.message.includes("timeout")) {
        const errorMsg =
          "⚠️ DeepSeek R1 timeout. This reasoning model typically takes 60-90 seconds for complex coding questions. For very complex problems, it may take up to 5 minutes. Please wait and try again, or consider using a simpler question.";
        return formatter.formatResponse(errorMsg).text;
      }
    } else {
      if (err.status === 429 || (err.response && err.response.status === 429)) {
        const errorMsg = "⚠️ Rate limit exceeded. Please try again later.";
        return formatter.formatResponse(errorMsg).text;
      }
    }

    const errorMsg =
      `⚠️ ${isOllama ? "Ollama" : "HuggingFace"} inference failed: ` +
      (err.message || err);
    return formatter.formatResponse(errorMsg).text;
  }
});

// IPC: get OCR filtering state
ipcMain.handle("get-ocr-filtering-state", async () => {
  return ocrFilteringEnabled;
});

// IPC: toggle OCR filtering
ipcMain.handle("toggle-ocr-filtering", async () => {
  ocrFilteringEnabled = !ocrFilteringEnabled;
  console.log(`OCR Filtering: ${ocrFilteringEnabled ? "ON" : "OFF"}`);
  return ocrFilteringEnabled;
});

ipcMain.handle("transcribe-audio", async (evt, b64) => {
  const buffer = Buffer.from(b64, "base64");
  // Save to disk or send directly:
  const resp = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    buffer,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "audio/webm",
      },
      params: { model: "whisper-1" },
    },
  );
  return resp.data.text;
});

// IPC: get provider status
ipcMain.handle("get-provider-status", async () => {
  return {
    provider: AI_PROVIDER,
    isOllama: isOllama,
    model: isOllama
      ? process.env.OLLAMA_MODEL || "deepseek-r1"
      : process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
  };
});

// IPC: check Ollama connection
ipcMain.handle("check-ollama-connection", async () => {
  if (!isOllama) {
    return {
      error: "Not using Ollama provider",
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
ipcMain.handle("switch-ai-provider", async (event, targetProvider) => {
  try {
    if (targetProvider) {
      // Switch to specific provider
      if (targetProvider.toLowerCase() !== currentProvider.toLowerCase()) {
        const result = initializeAIClient(targetProvider);
        return {
          success: true,
          provider: result.provider,
          isOllama: result.isOllama,
          sessionPreserved: sessionHistory.length,
          model: result.isOllama
            ? process.env.OLLAMA_MODEL || "deepseek-r1"
            : process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
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
        sessionPreserved: sessionHistory.length,
        model: isOllama
          ? process.env.OLLAMA_MODEL || "deepseek-r1"
          : process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
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
ipcMain.handle("warmup-ollama-model", async () => {
  if (!isOllama) {
    return {
      success: false,
      error: "Not using Ollama provider",
    };
  }

  try {
    console.log("Starting manual model warmup...");
    const result = await aiClient.warmupModel();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});
