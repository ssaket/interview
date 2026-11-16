/**
 * Test Suite: Screen capture region
 *
 * Verifies the crop math in src/js/screen-capture.js (no Electron needed):
 * 1. The crop is relative to the display that holds the window, not to the global origin
 * 2. The scale comes from the real thumbnail size
 * 3. The crop stays inside the image, so NativeImage.crop() never returns an empty image
 * 4. The capture source matches the window's display, not always sources[0]
 */

const { pickSourceForDisplay, computeCropRegion } = require('../src/js/screen-capture');

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failures++;
    console.error(`❌ ${name}\n   ${error.message}`);
  }
}

function assertRegion(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`expected ${e}, got ${a}`);
}

// The display from the bug report: 1440x2560 logical, 2x scale, 2880x5120 thumbnail
const portrait = { x: 0, y: 0, width: 1440, height: 2560 };
const portraitImage = { width: 2880, height: 5120 };

test('window on the primary display crops at 2x', () => {
  const window = { x: 100, y: 200, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, portraitImage), {
    x: 200,
    y: 400,
    width: 1400,
    height: 1360,
  });
});

test('window on a secondary display is relative to that display origin', () => {
  // A laptop display to the left of the primary display has a negative origin
  const laptop = { x: -1512, y: 800, width: 1512, height: 982 };
  const window = { x: -1400, y: 900, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, laptop, { width: 3024, height: 1964 }), {
    x: 224,
    y: 200,
    width: 1400,
    height: 1360,
  });
});

test('scale comes from the real thumbnail size, not the requested size', () => {
  // The capturer returned a 1x image although 2x was requested
  const window = { x: 100, y: 200, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, { width: 1440, height: 2560 }), {
    x: 100,
    y: 200,
    width: 700,
    height: 680,
  });
});

test('crop clamps a window that goes past the right and bottom edges', () => {
  const window = { x: 1000, y: 2200, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, portraitImage), {
    x: 2000,
    y: 4400,
    width: 880,
    height: 720,
  });
});

test('crop clamps a window that starts left of and above the display', () => {
  const window = { x: -100, y: -50, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, portraitImage), {
    x: 0,
    y: 0,
    width: 1200,
    height: 1260,
  });
});

test('window fully off the display gives null (caller uses the full screen)', () => {
  const window = { x: 2000, y: 100, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, portraitImage), null);
});

/** Fake desktopCapturer source with a thumbnail of the given size */
function fakeSource(name, displayId, width, height) {
  return { name, display_id: displayId, thumbnail: { getSize: () => ({ width, height }) } };
}

const portraitDisplay = { id: 2, bounds: portrait };

test('picker matches the source by display id, not by position in the list', () => {
  const sources = [fakeSource('laptop', '1', 2880, 1870), fakeSource('portrait', '2', 2880, 5120)];
  assertRegion(pickSourceForDisplay(sources, portraitDisplay).name, 'portrait');
});

test('picker matches by aspect ratio when the ids are empty', () => {
  const sources = [fakeSource('laptop', '', 2880, 1870), fakeSource('portrait', '', 2880, 5120)];
  assertRegion(pickSourceForDisplay(sources, portraitDisplay).name, 'portrait');
});

test('picker matches by aspect ratio when the ids have a different format', () => {
  const sources = [
    fakeSource('laptop', '69733632', 2880, 1870),
    fakeSource('portrait', '69733633', 2880, 5120),
  ];
  assertRegion(pickSourceForDisplay(sources, portraitDisplay).name, 'portrait');
});

test('picker uses sources[0] when no id or aspect ratio matches', () => {
  const sources = [fakeSource('first', '', 1000, 1000), fakeSource('second', '', 1600, 900)];
  assertRegion(pickSourceForDisplay(sources, portraitDisplay).name, 'first');
});

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} capture region test(s) failed`);
  process.exit(1);
}
console.log('🎉 All capture region tests passed');
