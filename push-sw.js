self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'АвтоZавоз', {
      body: data.body || 'Новая заявка',
      icon: '/site/img/logoIcon.png',
      badge: '/site/img/logoIcon.png',
      requireInteraction: true,
      renotify: true,
      tag: data.tag || 'avtozavoz-lead',
      data: {
        url: data.url || '/admin/leads.html',
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/admin/leads.html';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then(async (windows) => {
        const existing = windows.find((client) =>
          client.url.includes('/admin/'),
        );

        if (existing) {
          await existing.navigate(targetUrl);
          return existing.focus();
        }

        return clients.openWindow(targetUrl);
      }),
  );
});
