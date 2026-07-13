(() => {
  const widgetId = new URL(document.currentScript.src).searchParams.get('widgetId');
  if (!widgetId) return;
  let frames = 0;
  let lastFrameAt = performance.now();
  let longFrames = 0;
  const errors = [];
  let lastDataEvent = null;
  const tick = now => {
    frames += 1;
    if (now - lastFrameAt > 34) longFrames += 1;
    lastFrameAt = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener('error', event => errors.push(String(event.message || 'Ошибка страницы').slice(0, 180)));
  window.addEventListener('unhandledrejection', event => errors.push(String(event.reason || 'Необработанное отклонение').slice(0, 180)));
  window.__obsControl = {
    reportData(detail = {}) {
      const receivedAt = Date.now();
      requestAnimationFrame(() => {
        lastDataEvent = { ...detail, receivedAt, renderedAt: Date.now() };
        window.dispatchEvent(new CustomEvent('obs-control-data', { detail: lastDataEvent }));
      });
    }
  };
  setInterval(() => {
    const fps = Math.round(frames / 2);
    fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgetId, fps, longFrames, errors: errors.splice(0, 5), lastDataEvent, href: location.href, timestamp: Date.now() }) }).catch(() => {});
    frames = 0;
    longFrames = 0;
  }, 2000);
})();
