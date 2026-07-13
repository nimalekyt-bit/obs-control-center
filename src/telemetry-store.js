const fs = require('node:fs');
const fsp = require('node:fs/promises');

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

class TelemetryStore {
  constructor(limitPerWidget = 900) { this.limitPerWidget = limitPerWidget; this.file = null; this.samples = new Map(); }
  async initialize(file) {
    this.file = file;
    try {
      const lines = (await fsp.readFile(file, 'utf8')).trim().split('\n').slice(-5000);
      for (const line of lines) { try { this.add(JSON.parse(line), false); } catch {} }
    } catch { /* First run. */ }
  }
  add(sample, persist = true) {
    if (!sample?.widgetId || !Number.isFinite(Number(sample.fps))) return;
    const normalized = { widgetId: String(sample.widgetId), at: Number(sample.at || sample.receivedAt || Date.now()), fps: Math.max(0, Number(sample.fps)), longFrames: Math.max(0, Number(sample.longFrames || 0)), sourceDelay: Number.isFinite(Number(sample.sourceDelay)) ? Number(sample.sourceDelay) : null, renderDelay: Number.isFinite(Number(sample.renderDelay)) ? Number(sample.renderDelay) : null };
    const history = this.samples.get(normalized.widgetId) || [];
    history.push(normalized);
    if (history.length > this.limitPerWidget) history.splice(0, history.length - this.limitPerWidget);
    this.samples.set(normalized.widgetId, history);
    if (persist && this.file) fsp.appendFile(this.file, `${JSON.stringify(normalized)}\n`, 'utf8').catch(() => {});
  }
  clear(widgetId) { if (widgetId) this.samples.delete(widgetId); else this.samples.clear(); }
  summary(widgetId, windowMs = 30 * 60 * 1000) {
    const cutoff = Date.now() - windowMs;
    const history = (this.samples.get(widgetId) || []).filter(item => item.at >= cutoff);
    if (!history.length) return { samples: 0, points: [], averageFps: null, minFps: null, p95FrameDelay: null, longFrames: 0 };
    const fps = history.map(item => item.fps);
    const delays = history.map(item => item.renderDelay).filter(Number.isFinite);
    const stride = Math.max(1, Math.ceil(history.length / 60));
    return { samples: history.length, points: history.filter((_, index) => index % stride === 0).slice(-60).map(item => ({ at: item.at, fps: item.fps, longFrames: item.longFrames })), averageFps: Math.round((fps.reduce((sum, value) => sum + value, 0) / fps.length) * 10) / 10, minFps: Math.round(Math.min(...fps) * 10) / 10, p95FrameDelay: percentile(delays, .95), longFrames: history.reduce((sum, item) => sum + item.longFrames, 0) };
  }
}

module.exports = { TelemetryStore, percentile };
