self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  let target = '/admin/leads.html';
  try {
    const url = new URL(payload.url, self.location.origin);
    if (url.origin === self.location.origin && url.pathname === '/admin/leads.html') target = url.pathname + url.search;
  } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || 'АвтоZавоз', {
    body: payload.body || 'Новая заявка', icon: '/site/img/logoIcon.png', badge: '/site/img/logoIcon.png',
    tag: payload.tag || 'avtozavoz-lead', renotify: true, data: { url: target },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/admin/leads.html', self.location.origin);
  if (url.origin !== self.location.origin || url.pathname !== '/admin/leads.html') return;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => {
      const current = new URL(client.url); return current.origin === self.location.origin && current.pathname.startsWith('/admin/');
    });
    if (existing) { await existing.navigate(url.href); return existing.focus(); }
    return clients.openWindow(url.href);
  })());
});
