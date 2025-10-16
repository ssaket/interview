/**
 * Centralized configuration for window movement and resizing controls
 * Used by both KeyHoldManager (continuous holding) and ShortcutManager (single press fallback)
 */
module.exports = {
  // Step sizes for window operations (in pixels)
  moveStep: 10, // Pixels per move action
  resizeStep: 10, // Pixels per resize action

  // Timing configuration for continuous key holding
  holdDelayMs: 300, // Delay before continuous action starts (ms)
  repeatIntervalMs: 50, // How often to repeat the action - 20 times per second (ms)

  // Size constraints
  minSize: 50, // Minimum window width or height (pixels)

  // Status message throttling
  messageThrottleMs: 500, // Only show status messages every 500ms to prevent flooding
};
