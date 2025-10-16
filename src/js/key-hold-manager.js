const { uIOhook, UiohookKey } = require('uiohook-napi');
const windowControlsConfig = require('./window-controls-config');

/**
 * KeyHoldManager - Detects and handles continuous key holding for window resizing and movement
 *
 * Uses native keyboard hooks to detect when modifier+key combinations are held down,
 * enabling smooth continuous resizing and movement instead of requiring repeated key presses.
 */
class KeyHoldManager {
  constructor(windowManager) {
    this.windowManager = windowManager;

    // Track which keys are currently pressed
    this.pressedKeys = new Set();

    // Active resize intervals
    this.resizeIntervals = new Map();

    // Configuration - imported from centralized config
    this.holdDelayMs = windowControlsConfig.holdDelayMs;
    this.repeatIntervalMs = windowControlsConfig.repeatIntervalMs;
    this.resizeStep = windowControlsConfig.resizeStep;
    this.moveStep = windowControlsConfig.moveStep;
    this.minSize = windowControlsConfig.minSize;

    // Throttling for status messages
    this.lastMessageTime = 0;
    this.messageThrottleMs = windowControlsConfig.messageThrottleMs;

    // Track if we're currently listening
    this.isListening = false;

    // Key mappings for the actions we care about
    this.keyActions = {
      // Movement controls: Cmd/Ctrl+Arrow keys (without Shift)
      'ControlLeft-ArrowLeft': () => this.moveWindow(-this.moveStep, 0),
      'ControlRight-ArrowLeft': () => this.moveWindow(-this.moveStep, 0),
      'MetaLeft-ArrowLeft': () => this.moveWindow(-this.moveStep, 0),
      'MetaRight-ArrowLeft': () => this.moveWindow(-this.moveStep, 0),

      'ControlLeft-ArrowRight': () => this.moveWindow(this.moveStep, 0),
      'ControlRight-ArrowRight': () => this.moveWindow(this.moveStep, 0),
      'MetaLeft-ArrowRight': () => this.moveWindow(this.moveStep, 0),
      'MetaRight-ArrowRight': () => this.moveWindow(this.moveStep, 0),

      'ControlLeft-ArrowUp': () => this.moveWindow(0, -this.moveStep),
      'ControlRight-ArrowUp': () => this.moveWindow(0, -this.moveStep),
      'MetaLeft-ArrowUp': () => this.moveWindow(0, -this.moveStep),
      'MetaRight-ArrowUp': () => this.moveWindow(0, -this.moveStep),

      'ControlLeft-ArrowDown': () => this.moveWindow(0, this.moveStep),
      'ControlRight-ArrowDown': () => this.moveWindow(0, this.moveStep),
      'MetaLeft-ArrowDown': () => this.moveWindow(0, this.moveStep),
      'MetaRight-ArrowDown': () => this.moveWindow(0, this.moveStep),
      // Width controls: Cmd/Ctrl+Shift+[ and ]
      'ControlLeft-ShiftLeft-BracketLeft': () => this.resizeWidth(-this.resizeStep),
      'ControlRight-ShiftRight-BracketLeft': () => this.resizeWidth(-this.resizeStep),
      'MetaLeft-ShiftLeft-BracketLeft': () => this.resizeWidth(-this.resizeStep),
      'MetaRight-ShiftRight-BracketLeft': () => this.resizeWidth(-this.resizeStep),

      'ControlLeft-ShiftLeft-BracketRight': () => this.resizeWidth(this.resizeStep),
      'ControlRight-ShiftRight-BracketRight': () => this.resizeWidth(this.resizeStep),
      'MetaLeft-ShiftLeft-BracketRight': () => this.resizeWidth(this.resizeStep),
      'MetaRight-ShiftRight-BracketRight': () => this.resizeWidth(this.resizeStep),

      // Height controls: Cmd/Ctrl+Shift+Up/Down
      'ControlLeft-ShiftLeft-ArrowUp': () => this.resizeHeight(-this.resizeStep),
      'ControlRight-ShiftRight-ArrowUp': () => this.resizeHeight(-this.resizeStep),
      'MetaLeft-ShiftLeft-ArrowUp': () => this.resizeHeight(-this.resizeStep),
      'MetaRight-ShiftRight-ArrowUp': () => this.resizeHeight(-this.resizeStep),

      'ControlLeft-ShiftLeft-ArrowDown': () => this.resizeHeight(this.resizeStep),
      'ControlRight-ShiftRight-ArrowDown': () => this.resizeHeight(this.resizeStep),
      'MetaLeft-ShiftLeft-ArrowDown': () => this.resizeHeight(this.resizeStep),
      'MetaRight-ShiftRight-ArrowDown': () => this.resizeHeight(this.resizeStep),
    };
  }

  /**
   * Start listening for keyboard events
   */
  start() {
    if (this.isListening) {
      console.log('[KeyHoldManager] Already listening');
      return;
    }

    console.log('[KeyHoldManager] Starting keyboard hook listener');

    // Register keyboard event handlers
    uIOhook.on('keydown', (event) => this.handleKeyDown(event));
    uIOhook.on('keyup', (event) => this.handleKeyUp(event));

    // Start the hook
    uIOhook.start();
    this.isListening = true;

    console.log('[KeyHoldManager] Listening for key hold events');
  }

  /**
   * Stop listening and cleanup
   */
  stop() {
    if (!this.isListening) {
      return;
    }

    console.log('[KeyHoldManager] Stopping keyboard hook listener');

    // Clear all active intervals
    for (const interval of this.resizeIntervals.values()) {
      clearInterval(interval);
    }
    this.resizeIntervals.clear();

    // Stop the hook
    uIOhook.stop();
    this.isListening = false;

    // Clear pressed keys
    this.pressedKeys.clear();
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(event) {
    const keyName = this.getKeyName(event.keycode);
    if (!keyName) return;

    // Add to pressed keys set
    this.pressedKeys.add(keyName);

    // Check if we have a matching action
    const combo = this.getCurrentCombo();
    if (combo && this.keyActions[combo]) {
      // If we don't have an interval running for this combo, start one
      if (!this.resizeIntervals.has(combo)) {
        // Execute immediately
        this.keyActions[combo]();

        // Start continuous execution after delay
        const timeout = setTimeout(() => {
          const interval = setInterval(() => {
            if (this.pressedKeys.has(keyName)) {
              this.keyActions[combo]();
            } else {
              // Key was released, clear interval
              clearInterval(interval);
              this.resizeIntervals.delete(combo);
            }
          }, this.repeatIntervalMs);

          this.resizeIntervals.set(combo, interval);
        }, this.holdDelayMs);

        // Store the timeout so we can clear it if key is released quickly
        this.resizeIntervals.set(combo, timeout);
      }
    }
  }

  /**
   * Handle keyup events
   */
  handleKeyUp(event) {
    const keyName = this.getKeyName(event.keycode);
    if (!keyName) return;

    // Remove from pressed keys
    this.pressedKeys.delete(keyName);

    // Clear any intervals that involved this key
    for (const [combo, interval] of this.resizeIntervals.entries()) {
      if (combo.includes(keyName)) {
        clearInterval(interval);
        clearTimeout(interval);
        this.resizeIntervals.delete(combo);
      }
    }
  }

  /**
   * Get the current key combination as a string
   */
  getCurrentCombo() {
    const keys = Array.from(this.pressedKeys).sort();

    const hasControl = keys.some(k => k === 'ControlLeft' || k === 'ControlRight');
    const hasMeta = keys.some(k => k === 'MetaLeft' || k === 'MetaRight');
    const hasShift = keys.some(k => k === 'ShiftLeft' || k === 'ShiftRight');

    const actionKeys = keys.filter(k =>
      k === 'BracketLeft' || k === 'BracketRight' ||
      k === 'ArrowUp' || k === 'ArrowDown' ||
      k === 'ArrowLeft' || k === 'ArrowRight'
    );

    // Check for movement keys: (Control/Meta) + Arrow (without Shift)
    if ((hasControl || hasMeta) && !hasShift && actionKeys.length === 1) {
      const modifier = hasControl ?
        (keys.includes('ControlLeft') ? 'ControlLeft' : 'ControlRight') :
        (keys.includes('MetaLeft') ? 'MetaLeft' : 'MetaRight');

      const action = actionKeys[0];

      // Only handle arrow keys for movement (not brackets)
      if (action.startsWith('Arrow')) {
        return `${modifier}-${action}`;
      }
    }

    // Check for resize keys: (Control/Meta) + Shift + (BracketLeft/BracketRight/ArrowUp/ArrowDown)
    if ((hasControl || hasMeta) && hasShift && actionKeys.length === 1) {
      const modifier = hasControl ?
        (keys.includes('ControlLeft') ? 'ControlLeft' : 'ControlRight') :
        (keys.includes('MetaLeft') ? 'MetaLeft' : 'MetaRight');

      const shift = keys.includes('ShiftLeft') ? 'ShiftLeft' : 'ShiftRight';
      const action = actionKeys[0];

      return `${modifier}-${shift}-${action}`;
    }

    return null;
  }

  /**
   * Convert keycode to key name
   */
  getKeyName(keycode) {
    const keyMap = {
      29: 'ControlLeft',
      3613: 'ControlRight',
      42: 'ShiftLeft',
      3654: 'ShiftRight',
      3675: 'MetaLeft',
      3676: 'MetaRight',
      26: 'BracketLeft',
      27: 'BracketRight',
      57416: 'ArrowUp',
      57424: 'ArrowDown',
      57419: 'ArrowLeft',
      57421: 'ArrowRight',
    };

    return keyMap[keycode] || null;
  }

  /**
   * Move window position
   */
  moveWindow(dx, dy) {
    const { mainWindow } = this.windowManager;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + dx, y + dy);

    // Throttle status messages
    const now = Date.now();
    if (now - this.lastMessageTime >= this.messageThrottleMs) {
      const direction = dx < 0 ? 'Left' : dx > 0 ? 'Right' : dy < 0 ? 'Up' : 'Down';
      this.windowManager.send(
        'show-status-message',
        `↔️ Moved ${direction} (step: ${this.moveStep}px)`,
        2000
      );
      this.lastMessageTime = now;
    }
  }

  /**
   * Resize window width
   */
  resizeWidth(delta) {
    const { mainWindow } = this.windowManager;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const [width, height] = mainWindow.getSize();
    const newWidth = Math.max(this.minSize, width + delta);
    mainWindow.setSize(newWidth, height);

    // Throttle status messages
    const now = Date.now();
    if (now - this.lastMessageTime >= this.messageThrottleMs) {
      this.windowManager.send('show-status-message', `📐 Width: ${newWidth}px`, 2000);
      this.lastMessageTime = now;
    }
  }

  /**
   * Resize window height
   */
  resizeHeight(delta) {
    const { mainWindow } = this.windowManager;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const [width, height] = mainWindow.getSize();
    const newHeight = Math.max(this.minSize, height + delta);
    mainWindow.setSize(width, newHeight);

    // Throttle status messages
    const now = Date.now();
    if (now - this.lastMessageTime >= this.messageThrottleMs) {
      this.windowManager.send('show-status-message', `📏 Height: ${newHeight}px`, 2000);
      this.lastMessageTime = now;
    }
  }
}

module.exports = KeyHoldManager;
