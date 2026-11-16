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

test('window partly off the display is clamped to the image', () => {
  const window = { x: 1000, y: 2200, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, portraitImage), {
    x: 2000,
    y: 4400,
    width: 880,
    height: 720,
  });
});

test('window fully off the display gives null (caller uses the full screen)', () => {
  const window = { x: 2000, y: 100, width: 700, height: 680 };
  assertRegion(computeCropRegion(window, portrait, portraitImage), null);
});

test('source is matched by display id, not taken from sources[0]', () => {
  const sources = [{ display_id: '1' }, { display_id: '2' }];
  assertRegion(pickSourceForDisplay(sources, { id: 2 }), { display_id: '2' });
});

test('source falls back to sources[0] when display ids are empty', () => {
  const sources = [{ display_id: '' }, { display_id: '' }];
  assertRegion(pickSourceForDisplay(sources, { id: 2 }), { display_id: '' });
});

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} capture region test(s) failed`);
  process.exit(1);
}
console.log('🎉 All capture region tests passed');
