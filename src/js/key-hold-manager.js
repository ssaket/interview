const { uIOhook, UiohookKey } = require('uiohook-napi');
const { screen } = require('electron');
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

    // Double-click detection for mouse events
    this.lastClickTime = 0;
    this.doubleClickThreshold = 500; // milliseconds

    // Mouse follow state tracking (for Cmd/Ctrl + mouse move)
    this.isFollowingMouse = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    // Store window size at start of mouse following to prevent size drift on Windows
    this.followModeSize = null;

    // Track if flow toggle combo was triggered (to prevent repeated triggers)
    this.flowToggleTriggered = false;

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

      // Transparency controls: Cmd/Ctrl+Shift+< (decrease transparency = increase opacity)
      'ControlLeft-ShiftLeft-Comma': () => this.decreaseTransparency(),
      'ControlRight-ShiftRight-Comma': () => this.decreaseTransparency(),
      'MetaLeft-ShiftLeft-Comma': () => this.decreaseTransparency(),
      'MetaRight-ShiftRight-Comma': () => this.decreaseTransparency(),

      // Transparency controls: Cmd/Ctrl+Shift+> (increase transparency = decrease opacity)
      'ControlLeft-ShiftLeft-Period': () => this.increaseTransparency(),
      'ControlRight-ShiftRight-Period': () => this.increaseTransparency(),
      'MetaLeft-ShiftLeft-Period': () => this.increaseTransparency(),
      'MetaRight-ShiftRight-Period': () => this.increaseTransparency(),
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

    // Register mouse event handlers
    uIOhook.on('mousedown', (event) => this.handleMouseDown(event));
    uIOhook.on('mouseup', (event) => this.handleMouseUp(event));
    uIOhook.on('mousemove', (event) => this.handleMouseMove(event));

    // Start the hook
    uIOhook.start();
    this.isListening = true;

    console.log('[KeyHoldManager] Listening for key hold and mouse events');
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

    // Clear mouse follow state
    this.isFollowingMouse = false;
    this.followModeSize = null;
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(event) {
    const keyName = this.getKeyName(event.keycode);
    if (!keyName) return;

    // Add to pressed keys set
    this.pressedKeys.add(keyName);

    // Check for Option/Alt + Command/Meta combination (flow toggle shortcut)
    if (!this.flowToggleTriggered && this.isFlowToggleComboPressed()) {
      this.flowToggleTriggered = true;
      this.triggerFlowToggle();
      return;
    }

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

    // Reset flow toggle trigger flag and mouse following when modifier keys are released
    if (keyName === 'AltLeft' || keyName === 'AltRight' ||
        keyName === 'MetaLeft' || keyName === 'MetaRight' ||
        keyName === 'ControlLeft' || keyName === 'ControlRight') {
      this.flowToggleTriggered = false;
      // Clear mouse following state when Ctrl/Cmd is released
      this.isFollowingMouse = false;
      this.followModeSize = null;
    }

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
   * Handle mouse button down events
   * Detects Cmd/Ctrl + double-click to reposition window
   */
  handleMouseDown(event) {
    // Check if left mouse button (button 1)
    if (event.button !== 1) return;

    // Check if Cmd/Ctrl key is pressed
    const keys = Array.from(this.pressedKeys);
    const hasModifier = keys.some(
      (k) => k === 'MetaLeft' || k === 'MetaRight' || k === 'ControlLeft' || k === 'ControlRight'
    );

    if (!hasModifier) {
      // Reset click time if modifier not pressed
      this.lastClickTime = 0;
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    // Check if this is a double-click (second click within threshold)
    if (timeSinceLastClick > 0 && timeSinceLastClick < this.doubleClickThreshold) {
      console.log('[KeyHoldManager] Cmd/Ctrl + Double-click detected, repositioning window');
      this.positionWindowAtMouseCursor();
      // Reset click time after successful double-click
      this.lastClickTime = 0;
    } else {
      // First click, record the time
      this.lastClickTime = now;
    }
  }

  /**
   * Handle mouse button up events
   */
  handleMouseUp(event) {
    // Check if left mouse button (button 1)
    if (event.button !== 1) return;

    // No special handling needed - mouse following works without clicking
  }

  /**
   * Handle mouse move events
   * Implements Cmd/Ctrl + mouse move to follow cursor and move window
   */
  handleMouseMove(event) {
    // Check if Cmd/Ctrl key is pressed
    const keys = Array.from(this.pressedKeys);
    const hasModifier = keys.some(
      (k) => k === 'MetaLeft' || k === 'MetaRight' || k === 'ControlLeft' || k === 'ControlRight'
    );

    if (!hasModifier) {
      // Modifier key not pressed, stop following and clear saved size
      this.isFollowingMouse = false;
      this.followModeSize = null;
      return;
    }

    const { mainWindow } = this.windowManager;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Initialize tracking on first mouse move with modifier
    if (!this.isFollowingMouse) {
      this.isFollowingMouse = true;
      this.lastMouseX = event.x;
      this.lastMouseY = event.y;
      // IMPORTANT: Capture window size at the START of following
      // This prevents size drift on Windows where getBounds() can return
      // slightly different values during rapid position changes
      const [width, height] = mainWindow.getSize();
      this.followModeSize = { width, height };
      return; // Don't move on first detection, just initialize
    }

    // If we don't have a saved size (shouldn't happen), capture it now
    if (!this.followModeSize) {
      const [width, height] = mainWindow.getSize();
      this.followModeSize = { width, height };
    }

    // Calculate mouse movement delta
    const dx = event.x - this.lastMouseX;
    const dy = event.y - this.lastMouseY;

    // Update last mouse position
    this.lastMouseX = event.x;
    this.lastMouseY = event.y;

    // Move window by delta, using the ORIGINAL captured size to prevent drift
    const [currentX, currentY] = mainWindow.getPosition();
    mainWindow.setBounds({
      x: currentX + dx,
      y: currentY + dy,
      width: this.followModeSize.width,
      height: this.followModeSize.height,
    });
  }

  /**
   * Check if Option/Alt + Command/Meta combination is pressed
   * On macOS: Option + Command
   * On Windows/Linux: Alt + Ctrl
   */
  isFlowToggleComboPressed() {
    const keys = Array.from(this.pressedKeys);

    const hasAlt = keys.some(k => k === 'AltLeft' || k === 'AltRight');
    const hasMeta = keys.some(k => k === 'MetaLeft' || k === 'MetaRight');
    const hasControl = keys.some(k => k === 'ControlLeft' || k === 'ControlRight');

    // macOS: Option + Command (no other keys)
    // Windows/Linux: Alt + Ctrl (no other keys)
    const isMacCombo = hasAlt && hasMeta && keys.length === 2;
    const isWindowsCombo = hasAlt && hasControl && keys.length === 2;

    return isMacCombo || isWindowsCombo;
  }

  /**
   * Trigger AI flow toggle
   */
  triggerFlowToggle() {
    console.log('[KeyHoldManager] Flow toggle shortcut detected (Opt+Cmd / Alt+Ctrl)');
    // Send IPC event to main process to trigger flow toggle
    this.windowManager.send('trigger-flow-toggle');
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
      k === 'ArrowLeft' || k === 'ArrowRight' ||
      k === 'Comma' || k === 'Period'
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

    // Check for resize/transparency keys: (Control/Meta) + Shift + (BracketLeft/BracketRight/ArrowUp/ArrowDown/Comma/Period)
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
      56: 'AltLeft',
      3640: 'AltRight',
      26: 'BracketLeft',
      27: 'BracketRight',
      57416: 'ArrowUp',
      57424: 'ArrowDown',
      57419: 'ArrowLeft',
      57421: 'ArrowRight',

      // Transparency controls: Comma (< with Shift) and Period (> with Shift)
      51: 'Comma', // , key (becomes < with Shift)
      44: 'Comma', // Alternative comma keycode
      52: 'Period', // . key (becomes > with Shift)
      46: 'Period', // Alternative period keycode
    };

    const keyName = keyMap[keycode];
    return keyName || null;
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

  /**
   * Increase transparency (decrease opacity)
   */
  increaseTransparency() {
    // Send IPC event to renderer - status messages are handled there
    this.windowManager.send('increase-transparency');
  }

  /**
   * Decrease transparency (increase opacity)
   */
  decreaseTransparency() {
    // Send IPC event to renderer - status messages are handled there
    this.windowManager.send('decrease-transparency');
  }

  /**
   * Position window at mouse cursor location (top-left corner at cursor)
   * Automatically adjusts window size if needed to fit within display bounds
   */
  positionWindowAtMouseCursor() {
    const { mainWindow } = this.windowManager;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
      const cursor = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(cursor);
      const work = display.workArea; // respects taskbars/docks
      const workLeft = work.x;
      const workTop = work.y;
      const workRight = work.x + work.width;
      const workBottom = work.y + work.height;

      // If maximized or fullscreen, restore so we can resize
      if (typeof mainWindow.isFullScreen === 'function' && mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      }
      if (typeof mainWindow.isMaximized === 'function' && mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      }

      // Remember and temporarily relax constraints so setSize can shrink the window
      const canGetMin = typeof mainWindow.getMinimumSize === 'function';
      const canSetMin = typeof mainWindow.setMinimumSize === 'function';
      const canCheckResizable = typeof mainWindow.isResizable === 'function';
      const canSetResizable = typeof mainWindow.setResizable === 'function';

      let prevMin = null;
      if (canGetMin) {
        try {
          prevMin = mainWindow.getMinimumSize();
        } catch (e) {
          prevMin = null;
        }
      }
      if (canSetMin) {
        try {
          mainWindow.setMinimumSize(1, 1);
        } catch (e) {
          /* ignore */
        }
      }

      let prevResizable = null;
      if (canCheckResizable && canSetResizable) {
        try {
          prevResizable = mainWindow.isResizable();
          if (!prevResizable) mainWindow.setResizable(true);
        } catch (e) {
          prevResizable = null;
        }
      }

      // Current size
      let [curW, curH] = mainWindow.getSize();

      // Constrain to display full workArea as a hard upper bound
      const maxW = work.width;
      const maxH = work.height;
      let newW = Math.min(curW, maxW);
      let newH = Math.min(curH, maxH);

      // Available space to the right/down from the cursor (since cursor = top-left anchor)
      const availableRight = workRight - cursor.x;
      const availableDown = workBottom - cursor.y;

      // If there's less space to the right/down than newW/newH, shrink to available space
      if (availableRight < newW) {
        if (availableRight > 50) newW = availableRight; // shrink to fit to the right
        else newW = Math.min(newW, maxW); // fallback (will be clamped below)
      }
      if (availableDown < newH) {
        if (availableDown > 50) newH = availableDown;
        else newH = Math.min(newH, maxH);
      }

      // Ensure reasonable minimums so we don't set absurdly small sizes
      const MIN_W = 100;
      const MIN_H = 50;
      newW = Math.max(MIN_W, Math.min(newW, maxW));
      newH = Math.max(MIN_H, Math.min(newH, maxH));

      // Apply size first
      mainWindow.setSize(Math.round(newW), Math.round(newH));

      // Compute clamped position so the window fully fits inside the work area
      let x = cursor.x;
      let y = cursor.y;
      if (x < workLeft) x = workLeft;
      if (x + newW > workRight) x = workRight - newW;
      if (y < workTop) y = workTop;
      if (y + newH > workBottom) y = workBottom - newH;

      // Final position
      mainWindow.setPosition(Math.round(x), Math.round(y));

      // Restore previous constraints if we changed them
      if (canSetResizable && prevResizable === false) {
        try {
          mainWindow.setResizable(false);
        } catch (e) {
          /* ignore */
        }
      }
      if (canSetMin && Array.isArray(prevMin)) {
        try {
          mainWindow.setMinimumSize(prevMin[0], prevMin[1]);
        } catch (e) {
          /* ignore */
        }
      }

      this.windowManager.send('show-status-message', `🖱️ Window positioned at cursor`, 2000);
    } catch (error) {
      console.error('[KeyHoldManager] Failed to position window at cursor:', error);
    }
  }
}

module.exports = KeyHoldManager;
