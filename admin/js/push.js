(() => {
  const $ = id => document.getElementById(id);
  const status = message => { $('pushStatus').textContent = message; };
  const keyBytes = base64 => {
    const normalized = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(normalized), x => x.charCodeAt(0));
  };
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
  async function registration() { return navigator.serviceWorker.register('/push-sw.js', { scope: '/' }); }
  async function current() { const sw = await registration(); return { sw, sub: await sw.pushManager.getSubscription() }; }
  async function refresh() {
    if (!supported()) { status('Push не поддерживается браузером или отсутствует HTTPS.'); return; }
    try {
      const { sub } = await current();
      status(sub ? 'Этот браузер подписан на уведомления.' : 'Уведомления на этом устройстве выключены.');
      const stats = await Admin.request('/api/admin/push/subscriptions');
      $('pushDevices').textContent = `Сохранённых подписок: ${stats.count}`;
    } catch (error) { status(error.message); }
  }
  document.addEventListener('DOMContentLoaded', async () => {
    if (!$('pushStatus')) return;
    await refresh();
    $('pushEnable').addEventListener('click', async () => {
      try {
        if (!supported()) throw Error('Нужен HTTPS и поддержка Web Push.');
        const config = await Admin.request('/api/admin/push/config');
        if (!config.enabled) throw Error('VAPID не настроен на сервере.');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw Error('Разрешение на уведомления не предоставлено.');
        const { sw, sub } = await current();
        const subscription = sub || await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
        await Admin.request('/api/admin/push/subscribe', { method: 'POST', body: subscription.toJSON() });
        await refresh();
      } catch (error) { status(error.message); }
    });
    $('pushDisable').addEventListener('click', async () => {
      try {
        const { sub } = await current();
        if (sub) {
          await Admin.request('/api/admin/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
          await sub.unsubscribe();
        }
        await refresh();
      } catch (error) { status(error.message); }
    });
    $('pushTest').addEventListener('click', async () => {
      try { await Admin.request('/api/admin/push/test', { method: 'POST', body: {} }); status('Тест отправлен на зарегистрированные устройства.'); }
      catch (error) { status(error.message); }
    });
  });
})();
