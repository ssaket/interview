/**
 * Centralized configuration for window movement and resizing controls
 * Used by both KeyHoldManager (continuous holding) and ShortcutManager (single press fallback)
 */
module.exports = {
  // Step sizes for window operations (in pixels)
  moveStep: 20, // Pixels per move action
  resizeStep: 10, // Pixels per resize action

  // Transparency adjustment step (0.1 = 10% change per action)
  transparencyStep: 0.1, // Opacity change per transparency action

  // Timing configuration for continuous key holding
  holdDelayMs: 300, // Delay before continuous action starts (ms)
  repeatIntervalMs: 50, // How often to repeat the action - 20 times per second (ms)

  // Size constraints
  minSize: 50, // Minimum window width or height (pixels)

  // Status message throttling
  messageThrottleMs: 500, // Only show status messages every 500ms to prevent flooding
};
