const test = require('node:test');
const assert = require('node:assert/strict');
const { TelemetryStore, percentile } = require('../src/telemetry-store');

test('percentile and telemetry summary are calculated from real samples', () => {
  assert.equal(percentile([1, 2, 3, 9], .95), 9);
  const store = new TelemetryStore();
  const now = Date.now();
  store.add({ widgetId: 'sample', at: now - 1000, fps: 60, longFrames: 1, renderDelay: 4 }, false);
  store.add({ widgetId: 'sample', at: now, fps: 54, longFrames: 2, renderDelay: 12 }, false);
  const summary = store.summary('sample');
  assert.equal(summary.samples, 2);
  assert.equal(summary.averageFps, 57);
  assert.equal(summary.minFps, 54);
  assert.equal(summary.longFrames, 3);
  assert.equal(summary.p95FrameDelay, 12);
});

test('telemetry store keeps a bounded history per widget', () => {
  const store = new TelemetryStore(3);
  for (let index = 0; index < 5; index += 1) store.add({ widgetId: 'sample', fps: 50 + index, at: Date.now() }, false);
  assert.equal(store.summary('sample').samples, 3);
  assert.equal(store.summary('sample').minFps, 52);
});
