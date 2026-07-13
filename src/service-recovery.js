const WINDOW_MS = 60_000;
const DELAYS_MS = [1_000, 3_000, 10_000];

function restartDecision(attempts, now = Date.now()) {
  const recentAttempts = (attempts || []).filter(value => Number.isFinite(value) && value >= now - WINDOW_MS && value <= now);
  if (recentAttempts.length >= DELAYS_MS.length) return { blocked: true, attempts: recentAttempts, delay: null };
  return { blocked: false, attempts: [...recentAttempts, now], delay: DELAYS_MS[recentAttempts.length] };
}

module.exports = { DELAYS_MS, WINDOW_MS, restartDecision };
