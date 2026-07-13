const test = require('node:test');
const assert = require('node:assert/strict');
const { placementTransform } = require('../src/obs-layout');

const canvas = { baseWidth: 1920, baseHeight: 1080 };

test('fullscreen preset stretches exactly to the OBS canvas', () => {
  assert.deepEqual(placementTransform('fullscreen', { width: 350, height: 400 }, canvas), {
    positionX: 0, positionY: 0, alignment: 5, boundsType: 'OBS_BOUNDS_STRETCH', boundsWidth: 1920, boundsHeight: 1080
  });
});

test('corner presets keep a safe margin and correct OBS alignment', () => {
  const transform = placementTransform('bottom-right', { width: 350, height: 400 }, canvas);
  assert.equal(transform.positionX, 1884);
  assert.equal(transform.positionY, 1044);
  assert.equal(transform.alignment, 10);
  assert.equal(transform.boundsType, 'OBS_BOUNDS_SCALE_INNER');
  assert.equal(transform.boundsWidth, 350);
  assert.equal(transform.boundsHeight, 400);
});

test('oversized widgets are bounded by the OBS canvas', () => {
  const transform = placementTransform('center', { width: 3840, height: 2160 }, canvas);
  assert.equal(transform.positionX, 960);
  assert.equal(transform.positionY, 540);
  assert.equal(transform.boundsWidth, 1920);
  assert.equal(transform.boundsHeight, 1080);
});
