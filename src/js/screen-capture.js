/**
 * Pure helpers for screen capture. They have no Electron dependency, so tests can run them
 * in plain Node (see tests/test-capture-region.js).
 */

/**
 * Find the desktopCapturer source for a display.
 * desktopCapturer does not promise an order, so sources[0] is not always the display that
 * holds the window. Match by display id first. Some platforms leave display_id empty, and the
 * id format can differ from Display.id. Then match by aspect ratio: each thumbnail keeps the
 * aspect ratio of its screen. Use sources[0] only when nothing matches.
 * @param {Array<{display_id: string, thumbnail: {getSize: Function}}>} sources -
 *   desktopCapturer.getSources() result
 * @param {{id: number, bounds: {width: number, height: number}}} display - Electron Display
 * @returns {Object|undefined} The matching source
 */
function pickSourceForDisplay(sources, display) {
  const byId = sources.find((source) => source.display_id === String(display.id));
  if (byId || sources.length <= 1) return byId || sources[0];

  const ratio = display.bounds.width / display.bounds.height;
  const byAspect = sources.find((source) => {
    const { width, height } = source.thumbnail.getSize();
    return height > 0 && Math.abs(width / height - ratio) < 0.01;
  });
  return byAspect || sources[0];
}

/**
 * Calculate the crop rectangle for the window, in thumbnail pixels.
 * The window bounds are global screen coordinates, so subtract the display origin. Scale with
 * the real thumbnail size, because the capturer can return a smaller image than requested.
 * NativeImage.crop() returns an empty image for a rectangle outside the image, and it does
 * not throw an error. Thus clamp the rectangle to the image here.
 * @param {{x: number, y: number, width: number, height: number}} windowBounds - Global, logical
 * @param {{x: number, y: number, width: number, height: number}} displayBounds - Global, logical
 * @param {{width: number, height: number}} imageSize - Thumbnail size in pixels
 * @returns {{x: number, y: number, width: number, height: number}|null} Null when the window
 *   is not on the captured display
 */
function computeCropRegion(windowBounds, displayBounds, imageSize) {
  const scaleX = imageSize.width / displayBounds.width;
  const scaleY = imageSize.height / displayBounds.height;

  const left = Math.max(0, Math.round((windowBounds.x - displayBounds.x) * scaleX));
  const top = Math.max(0, Math.round((windowBounds.y - displayBounds.y) * scaleY));
  const right = Math.min(
    imageSize.width,
    Math.round((windowBounds.x + windowBounds.width - displayBounds.x) * scaleX)
  );
  const bottom = Math.min(
    imageSize.height,
    Math.round((windowBounds.y + windowBounds.height - displayBounds.y) * scaleY)
  );

  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

module.exports = { pickSourceForDisplay, computeCropRegion };
