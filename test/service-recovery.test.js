const test = require('node:test');
const assert = require('node:assert/strict');
const { restartDecision } = require('../src/service-recovery');

test('service recovery uses bounded increasing delays', () => {
  const now = 1_000_000;
  const first = restartDecision([], now);
  const second = restartDecision(first.attempts, now + 1_000);
  const third = restartDecision(second.attempts, now + 4_000);
  assert.equal(first.delay, 1_000);
  assert.equal(second.delay, 3_000);
  assert.equal(third.delay, 10_000);
  assert.equal(restartDecision(third.attempts, now + 14_000).blocked, true);
});

test('old crashes expire and allow recovery again', () => {
  const now = 2_000_000;
  const result = restartDecision([now - 90_000, now - 70_000, now - 65_000], now);
  assert.equal(result.blocked, false);
  assert.equal(result.delay, 1_000);
  assert.deepEqual(result.attempts, [now]);
});
