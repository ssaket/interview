const { ipcRenderer } = require("electron");

let mediaRecorder,
  audioChunks = [];

// Region selector for targeted screenshots
let regionSelector = null;

// Function to format and highlight DeepSeek responses
function formatDeepSeekResponse(text) {
  if (!text) return "";

  // Escape HTML first
  let highlighted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight code blocks with language labels
  highlighted = highlighted.replace(
    /\[([A-Z]+) CODE\]\n([\s\S]*?)\n\[\/CODE\]/g,
    '<div class="code-section"><div class="code-language">$1</div><pre class="code-block"><code>$2</code></pre></div>',
  );

  // Highlight complexity analysis
  highlighted = highlighted.replace(
    /📊 (.*?(?:Time|Space).*?Complexity.*?O\([^)]+\).*?)$/gm,
    '<div class="complexity-section"><span class="complexity-icon">📊</span><span class="complexity-text">$1</span></div>',
  );

  // Highlight reasoning sections
  highlighted = highlighted.replace(
    /💭 REASONING:\n([\s\S]*?)(?=\n\n|\n$|$)/g,
    '<div class="thinking-section"><div class="thinking-header">💭 Reasoning Process</div><div class="thinking-content">$1</div></div>',
  );

  // Highlight inline code (backticks)
  highlighted = highlighted.replace(
    /`([^`]+)`/g,
    '<span class="inline-code">$1</span>',
  );

  // Convert remaining newlines to <br> tags
  highlighted = highlighted.replace(/\n/g, "<br>");

  return `<div class="deepseek-response">${highlighted}</div>`;
}

// Region selection functionality
function initRegionSelector() {
  if (!regionSelector) {
    // Define RegionSelector class inline since we can't import it in renderer
    class RegionSelector {
      constructor() {
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.overlay = null;
        this.selectionBox = null;
        this.callback = null;
      }

      showSelector(callback) {
        this.callback = callback;
        this.createOverlay();
        this.setupEventListeners();
      }

      createOverlay() {
        this.hideSelector();

        this.overlay = document.createElement("div");
        this.overlay.id = "region-selector-overlay";
        this.overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.3);
          cursor: crosshair;
          z-index: 9999;
          user-select: none;
        `;

        this.selectionBox = document.createElement("div");
        this.selectionBox.id = "selection-box";
        this.selectionBox.style.cssText = `
          position: absolute;
          border: 2px solid #0066cc;
          background: rgba(0, 102, 204, 0.1);
          display: none;
          pointer-events: none;
        `;

        const instructions = document.createElement("div");
        instructions.style.cssText = `
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 16px;
          font-weight: 500;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
          text-align: center;
          pointer-events: none;
        `;
        instructions.innerHTML = `
          <div>Click and drag to select region</div>
          <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">Press ESC to cancel</div>
        `;

        this.overlay.appendChild(this.selectionBox);
        this.overlay.appendChild(instructions);
        document.body.appendChild(this.overlay);
      }

      setupEventListeners() {
        this.overlay.addEventListener(
          "mousedown",
          this.handleMouseDown.bind(this),
        );
        this.overlay.addEventListener(
          "mousemove",
          this.handleMouseMove.bind(this),
        );
        this.overlay.addEventListener("mouseup", this.handleMouseUp.bind(this));
        document.addEventListener("keydown", this.handleKeyDown.bind(this));
        this.overlay.addEventListener("contextmenu", (e) => e.preventDefault());
      }

      handleMouseDown(e) {
        this.isSelecting = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.endX = e.clientX;
        this.endY = e.clientY;
        this.selectionBox.style.display = "block";
        this.updateSelectionBox();
      }

      handleMouseMove(e) {
        if (!this.isSelecting) return;
        this.endX = e.clientX;
        this.endY = e.clientY;
        this.updateSelectionBox();
      }

      handleMouseUp(e) {
        if (!this.isSelecting) return;
        this.isSelecting = false;
        this.endX = e.clientX;
        this.endY = e.clientY;

        const bounds = this.getSelectionBounds();
        if (bounds.width >= 20 && bounds.height >= 20) {
          this.completeSelection(bounds);
        } else {
          this.showError("Selection too small. Please select a larger area.");
        }
      }

      handleKeyDown(e) {
        if (e.key === "Escape") {
          this.cancelSelection();
        }
      }

      updateSelectionBox() {
        const bounds = this.getSelectionBounds();
        this.selectionBox.style.left = bounds.x + "px";
        this.selectionBox.style.top = bounds.y + "px";
        this.selectionBox.style.width = bounds.width + "px";
        this.selectionBox.style.height = bounds.height + "px";
      }

      getSelectionBounds() {
        const x = Math.min(this.startX, this.endX);
        const y = Math.min(this.startY, this.endY);
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);
        return { x, y, width, height };
      }

      completeSelection(bounds) {
        this.hideSelector();
        if (this.callback) {
          const scale = window.devicePixelRatio || 1;
          const scaledBounds = {
            x: Math.round(bounds.x * scale),
            y: Math.round(bounds.y * scale),
            width: Math.round(bounds.width * scale),
            height: Math.round(bounds.height * scale),
          };
          this.callback(scaledBounds);
        }
      }

      cancelSelection() {
        this.hideSelector();
        if (this.callback) {
          this.callback(null);
        }
      }

      showError(message) {
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 0, 0, 0.9);
          color: white;
          padding: 12px 20px;
          border-radius: 6px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
          pointer-events: none;
          z-index: 10000;
        `;
        errorDiv.textContent = message;
        this.overlay.appendChild(errorDiv);
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
          }
        }, 2000);
      }

      hideSelector() {
        if (this.overlay) {
          document.body.removeChild(this.overlay);
          this.overlay = null;
          this.selectionBox = null;
        }
        document.removeEventListener("keydown", this.handleKeyDown.bind(this));
        this.isSelecting = false;
      }

      isActive() {
        return this.overlay !== null;
      }
    }

    regionSelector = new RegionSelector();
  }
  return regionSelector;
}

async function captureScreenshot(region = null) {
  const output = document.getElementById("output");
  const img = document.getElementById("screenshot");

  output.textContent = "Capturing screen...";
  const image = region
    ? await ipcRenderer.invoke("capture-screen-region", region)
    : await ipcRenderer.invoke("capture-screen");

  img.src = image;
  img.style.display = "block";

  output.textContent = "Running OCR...";
  const text = await ipcRenderer.invoke("perform-ocr", image);

  output.textContent = `Extracted:\n${text}\n\nQuerying model...`;
  const answer = await ipcRenderer.invoke("ask-chatgpt", text);

  // Hide all UI elements except the response
  const title = document.querySelector("h2");
  const instructions = document.querySelectorAll("p");

  if (title) title.style.display = "none";
  instructions.forEach((p) => (p.style.display = "none"));
  img.style.display = "none";

  // Format and highlight the DeepSeek response
  console.info(answer);
  output.innerHTML = formatDeepSeekResponse(answer);
  // Scroll to top when new answer arrives
  container.scrollTop = 0;
}

ipcRenderer.on("trigger-screenshot", async () => {
  await captureScreenshot();
});

ipcRenderer.on("trigger-region-screenshot", async () => {
  const selector = initRegionSelector();
  const output = document.getElementById("output");

  output.textContent = "Select region to capture...";

  selector.showSelector(async (region) => {
    if (region) {
      await captureScreenshot(region);
    } else {
      output.textContent = "Region selection cancelled.";
    }
  });
});

// Call this when you want to start recording (e.g. hotkey or button)
async function startAudioCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start();
  document.getElementById("output").textContent = "🎙️ Recording audio…";
}

// Call this to stop and process the recording
function stopAudioCapture() {
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      // You can play it back:
      const url = URL.createObjectURL(blob);
      new Audio(url).play();

      // Or send it to your main process for saving/transcription:
      const arrayBuffer = await blob.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      const transcript = await ipcRenderer.invoke(
        "transcribe-audio",
        base64Audio,
      );
      document.getElementById("output").textContent =
        `📝 Transcript:\n${transcript}`;
      resolve();
    };
    mediaRecorder.stop();
    document.getElementById("output").textContent = "🎙️ Recording stopped";
  });
}

ipcRenderer.on("start-audio", startAudioCapture);
ipcRenderer.on("stop-audio", stopAudioCapture);

// Listen for hide/show commands
ipcRenderer.on("hide-ui", () => {
  document.getElementById("container").style.display = "none";
  // document.getElementById("selLayer").style.display = "none";
});
ipcRenderer.on("show-ui", () => {
  document.getElementById("container").style.display = "block";
  // Leave selLayer hidden unless region mode is active
});

// Listen for session reset from keyboard shortcut
ipcRenderer.on("session-reset", () => {
  // Session reset handled in main process, no UI updates needed
});

// Keyboard scrolling with Option + Arrow keys
// Keyboard scrolling with Option (Alt) + Arrow/Page
const SCROLL_AMOUNT = 50;
document.addEventListener("keydown", (e) => {
  if (!e.altKey) return;
  switch (e.key) {
    case "ArrowDown":
      container.scrollBy({ top: SCROLL_AMOUNT, behavior: "smooth" });
      e.preventDefault();
      break;
    case "ArrowUp":
      container.scrollBy({ top: -SCROLL_AMOUNT, behavior: "smooth" });
      e.preventDefault();
      break;
    case "PageDown":
      container.scrollBy({ top: container.clientHeight, behavior: "smooth" });
      e.preventDefault();
      break;
    case "PageUp":
      container.scrollBy({ top: -container.clientHeight, behavior: "smooth" });
      e.preventDefault();
      break;
  }
});
