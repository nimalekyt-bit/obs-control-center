const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, '..');
const config = JSON.parse(fs.readFileSync(path.join(appRoot, 'config', 'widgets.json'), 'utf8'));

test('widget registry has unique IDs and valid entry files', () => {
  const ids = config.widgets.map(widget => widget.id);
  assert.equal(new Set(ids).size, ids.length, 'Widget IDs must be unique');
  for (const widget of config.widgets) {
    assert.match(widget.id, /^[a-z0-9-]+$/);
    assert.ok(Number.isInteger(widget.width) && widget.width > 0);
    assert.ok(Number.isInteger(widget.height) && widget.height > 0);
    assert.ok([30, 60].includes(widget.fps));
    assert.ok(fs.existsSync(path.join(workspaceRoot, widget.folder, widget.entry)), `${widget.id}: entry file is missing`);
  }
});

test('services have unique IDs and valid dependency references', () => {
  const serviceIds = config.services.map(service => service.id);
  assert.equal(new Set(serviceIds).size, serviceIds.length, 'Service IDs must be unique');
  const serviceIdSet = new Set(serviceIds);
  for (const widget of config.widgets) for (const dependency of widget.dependencies || []) assert.ok(serviceIdSet.has(dependency), `${widget.id}: unknown dependency ${dependency}`);
});

test('configured service ports do not conflict', () => {
  const ports = config.services.flatMap(service => (service.health || []).filter(rule => rule.type === 'port').map(rule => ({ service: service.id, port: rule.port })));
  const seen = new Map();
  for (const item of ports) {
    assert.ok(!seen.has(item.port), `Port ${item.port} is assigned to both ${seen.get(item.port)} and ${item.service}`);
    seen.set(item.port, item.service);
  }
});
