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
    width: 600,
    height: 800,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
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
const DeepSeekFormatter = require("./formatter");
const hfClient = new InferenceClient(process.env.HF_TOKEN);
const formatter = new DeepSeekFormatter();

// Session management
let sessionHistory = [];
let sessionActive = false;

ipcMain.handle("ask-chatgpt", async (event, question) => {
  try {
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

    const chatCompletion = await hfClient.chatCompletion({
      provider: process.env.HF_PROVIDER || "hyperbolic",
      model: process.env.HF_MODEL || "deepseek-ai/DeepSeek-R1-0528",
      messages: messages,
      stream: false,
    });
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

    // Format the response for better display
    const formatted = formatter.formatResponse(rawResponse);
    return formatted.text; // Return plain text version for the overlay
  } catch (err) {
    console.error("InferenceClient error:", err);
    if (err.status === 429 || (err.response && err.response.status === 429)) {
      const errorMsg = "⚠️ Rate limit exceeded. Please try again later.";
      return formatter.formatResponse(errorMsg).text;
    }
    const errorMsg = "⚠️ Model inference failed: " + (err.message || err);
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
