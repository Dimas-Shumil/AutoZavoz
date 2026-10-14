const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { setImmediate: tick } = require('node:timers/promises');
function harness() {
  const nodes = {}, listeners = {}, requests = [];
  let current = null, saved = false, testFails = false;
  const key = Buffer.alloc(65, 4).toString('base64url');
  for (const name of ['status', 'enable', 'test', 'disable', 'message']) {
    nodes[name] = { textContent: '', hidden: false, disabled: false, attrs: {}, handlers: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(k, fn) { this.handlers[k] = fn; },
      querySelector() { return this.strong ||= { textContent: '' }; },
      classList: { toggle() {} },
    };
  }
  const reg = {
    active: { scriptURL: 'http://localhost:3000/push-sw.js' },
    pushManager: {
      async getSubscription() { return current; },
      async subscribe({ applicationServerKey }) {
        current = { endpoint: 'https://fcm.googleapis.com/fcm/send/device', options: { applicationServerKey }, toJSON() { return { endpoint: this.endpoint, keys: {} }; }, async unsubscribe() { current = null; return true; } };
        return current;
      },
    },
  };
  const Notification = { permission: 'default', requests: 0, async requestPermission() { this.requests++; this.permission = 'granted'; return 'granted'; } };
  const context = {
    window: { isSecureContext: true, Notification, PushManager: {} }, Notification,
    navigator: { serviceWorker: { async getRegistration() { return current ? reg : undefined; }, async register() { return reg; } } },
    document: { querySelector(selector) { return nodes[selector.match(/data-push-(.+)\]/)[1]]; }, addEventListener(name, fn) { listeners[name] = fn; } },
    location: { href: 'http://localhost:3000/admin/leads.html' }, URL, Uint8Array, atob, setTimeout, clearTimeout,
    Admin: { async request(url, options) {
      requests.push({ url, options });
      if (url.endsWith('/config')) return { configured: true, publicKey: key };
      if (url.endsWith('/status')) return { subscribed: saved };
      if (url.endsWith('/subscribe')) { saved = true; return { success: true }; }
      if (url.endsWith('/unsubscribe')) { saved = false; return { success: true }; }
      if (url.endsWith('/test')) { if (testFails) throw new Error('Delivery unavailable'); return { success: true }; }
    } },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../admin/js/push.js'), 'utf8'), context);
  async function click(name) {
    nodes[name].handlers.click();
    for (let i = 0; i < 100 && nodes[name].attrs['aria-busy'] === 'true'; i++) await tick();
    assert.notEqual(nodes[name].attrs['aria-busy'], 'true', 'action completed');
  }
  return { nodes, requests, Notification, init: listeners['admin:ready'], click, failTest() { testFails = true; } };
}
test('enable, test, disable keep button state usable and test only the current device', async () => {
  const h = harness(); await h.init();
  assert.equal(h.nodes.enable.disabled, false); assert.equal(h.nodes.test.disabled, true);
  await h.click('enable'); assert.equal(h.Notification.requests, 1);
  assert.equal(h.nodes.enable.disabled, true); assert.equal(h.nodes.test.disabled, false);
  await h.click('test'); assert.equal(h.nodes.test.disabled, false);
  assert.equal(h.requests.find((x) => x.url.endsWith('/test')).options.body.endpoint, 'https://fcm.googleapis.com/fcm/send/device');
  await h.click('disable'); assert.equal(h.nodes.enable.disabled, false); assert.equal(h.nodes.test.disabled, true);
});
test('a failed test does not leave controls stuck busy', async () => {
  const h = harness(); await h.init(); await h.click('enable'); h.failTest(); await h.click('test');
  assert.equal(h.nodes.test.disabled, false); assert.equal(h.nodes.disable.disabled, false); assert.equal(h.nodes.message.textContent, 'Delivery unavailable');
});
