const { ipcRenderer } = require("electron");

let mediaRecorder,
  audioChunks = [];

// Function to add basic highlighting to text responses
function highlightResponse(text) {
  if (!text) return "";

  // Escape HTML first
  let highlighted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight code blocks
  highlighted = highlighted.replace(
    /\[([A-Z]+) CODE\]\n([\s\S]*?)\n\[\/CODE\]/g,
    '<div class="code-highlight"><div style="color: #87ceeb; font-size: 11px; margin-bottom: 4px;">$1</div>$2</div>',
  );

  // Highlight complexity analysis
  highlighted = highlighted.replace(
    /📊 (.*?(?:Time|Space).*?Complexity.*?O\([^)]+\).*?)$/gm,
    '<span class="complexity-highlight">📊 $1</span>',
  );

  // Highlight inline code (backticks)
  highlighted = highlighted.replace(
    /`([^`]+)`/g,
    '<span class="inline-code">$1</span>',
  );

  // Convert newlines to <br> tags
  highlighted = highlighted.replace(/\n/g, "<br>");

  return highlighted;
}

ipcRenderer.on("trigger-screenshot", async () => {
  const output = document.getElementById("output");
  const img = document.getElementById("screenshot");

  output.textContent = "Capturing screen...";
  const image = await ipcRenderer.invoke("capture-screen");

  img.src = image;
  img.style.display = "block";

  output.textContent = "Running OCR...";
  const text = await ipcRenderer.invoke("perform-ocr", image);

  output.textContent = `Extracted:\n${text}\n\nQuerying model...`;
  const answer = await ipcRenderer.invoke("ask-chatgpt", text);

  // Only show the answer with highlighting, remove parsed question text
  output.innerHTML = highlightResponse(answer);
  // Scroll to top when new answer arrives
  container.scrollTop = 0;
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
