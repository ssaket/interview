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

  /**
   * Show region selection overlay
   * @param {Function} callback - Called with selected region coordinates
   */
  showSelector(callback) {
    this.callback = callback;
    this.createOverlay();
    this.setupEventListeners();
  }

  /**
   * Create the selection overlay
   */
  createOverlay() {
    // Remove existing overlay if present
    this.hideSelector();

    // Create overlay element
    this.overlay = document.createElement('div');
    this.overlay.id = 'region-selector-overlay';
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

    // Create selection box
    this.selectionBox = document.createElement('div');
    this.selectionBox.id = 'selection-box';
    this.selectionBox.style.cssText = `
      position: absolute;
      border: 2px solid #0066cc;
      background: rgba(0, 102, 204, 0.1);
      display: none;
      pointer-events: none;
    `;

    // Create instruction text
    const instructions = document.createElement('div');
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

  /**
   * Setup mouse and keyboard event listeners
   */
  setupEventListeners() {
    // Mouse events
    this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.overlay.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.overlay.addEventListener('mouseup', this.handleMouseUp.bind(this));

    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Prevent context menu
    this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Handle mouse down event - start selection
   */
  handleMouseDown(e) {
    this.isSelecting = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.endX = e.clientX;
    this.endY = e.clientY;

    this.selectionBox.style.display = 'block';
    this.updateSelectionBox();
  }

  /**
   * Handle mouse move event - update selection
   */
  handleMouseMove(e) {
    if (!this.isSelecting) return;

    this.endX = e.clientX;
    this.endY = e.clientY;
    this.updateSelectionBox();
  }

  /**
   * Handle mouse up event - complete selection
   */
  handleMouseUp(e) {
    if (!this.isSelecting) return;

    this.isSelecting = false;
    this.endX = e.clientX;
    this.endY = e.clientY;

    // Calculate selection bounds
    const bounds = this.getSelectionBounds();

    // Only proceed if we have a meaningful selection (at least 20x20 pixels)
    if (bounds.width >= 20 && bounds.height >= 20) {
      this.completeSelection(bounds);
    } else {
      // Selection too small, show error and continue
      this.showError('Selection too small. Please select a larger area.');
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.cancelSelection();
    }
  }

  /**
   * Update the visual selection box
   */
  updateSelectionBox() {
    const bounds = this.getSelectionBounds();

    this.selectionBox.style.left = bounds.x + 'px';
    this.selectionBox.style.top = bounds.y + 'px';
    this.selectionBox.style.width = bounds.width + 'px';
    this.selectionBox.style.height = bounds.height + 'px';
  }

  /**
   * Get normalized selection bounds
   */
  getSelectionBounds() {
    const x = Math.min(this.startX, this.endX);
    const y = Math.min(this.startY, this.endY);
    const width = Math.abs(this.endX - this.startX);
    const height = Math.abs(this.endY - this.startY);

    return { x, y, width, height };
  }

  /**
   * Complete the selection and call callback
   */
  completeSelection(bounds) {
    this.hideSelector();

    if (this.callback) {
      // Convert screen coordinates to capture coordinates
      // Account for device pixel ratio for high-DPI displays
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

  /**
   * Cancel the selection
   */
  cancelSelection() {
    this.hideSelector();

    if (this.callback) {
      this.callback(null); // null indicates cancellation
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // Create temporary error message
    const errorDiv = document.createElement('div');
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

    // Remove error after 2 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 2000);
  }

  /**
   * Hide and cleanup the selector
   */
  hideSelector() {
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
      this.selectionBox = null;
    }

    // Cleanup event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));

    this.isSelecting = false;
  }

  /**
   * Check if selector is currently active
   */
  isActive() {
    return this.overlay !== null;
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RegionSelector;
}

// Make available globally in renderer context
if (typeof window !== 'undefined') {
  window.RegionSelector = RegionSelector;
}
