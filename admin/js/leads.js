document.addEventListener('DOMContentLoaded', () => {
  initLeadsPage();
  initPushSettings();
});

async function initLeadsPage() {
  const tableBody = document.querySelector('#leadsTableBody');
  const countBox = document.querySelector('#leadsCount');
  const emptyBox = document.querySelector('#leadsEmpty');

  if (!tableBody) return;

  try {
    const data = await Admin.request('/api/admin/leads');
    const leads = data && Array.isArray(data.leads) ? data.leads : [];

    if (countBox) {
      countBox.textContent = formatLeadCount(leads.length);
    }

    if (!leads.length) {
      tableBody.innerHTML = '';
      if (emptyBox) emptyBox.hidden = false;
      return;
    }

    if (emptyBox) emptyBox.hidden = true;

    tableBody.innerHTML = leads.map(createLeadRow).join('');

    bindLeadStatusSelects();
    bindLeadDeleteButtons();
  } catch (error) {
    console.error('Leads load error:', error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="7">Не удалось загрузить заявки</td>
      </tr>
    `;

    if (countBox) {
      countBox.textContent = 'Ошибка загрузки';
    }
  }
}

function formatLeadCount(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} заявка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} заявки`;
  }

  return `${count} заявок`;
}

function createLeadRow(lead) {
  const carTitle = lead.car?.title || lead.carTitleSnapshot || '—';
  const carSlug = lead.car?.slug || lead.carSlugSnapshot || '';

  return `
    <tr>
      <td data-label="Клиент">
        <strong>${Admin.escapeHTML(lead.customerName || 'Без имени')}</strong>
        <small>${Admin.escapeHTML(lead.city || 'Город не указан')}</small>
      </td>

      <td data-label="Контакты">
        <strong>
          <a href="tel:${Admin.escapeHTML(lead.phone)}">
            ${Admin.escapeHTML(lead.phone)}
          </a>
        </strong>
        <small>${Admin.escapeHTML(lead.messenger || 'Мессенджер не указан')}</small>
      </td>

      <td data-label="Автомобиль">
        <strong>${Admin.escapeHTML(carTitle)}</strong>
        ${
          carSlug
            ? `<small><a href="/cars/${encodeURIComponent(carSlug)}" target="_blank" rel="noopener">Открыть авто</a></small>`
            : '<small>Без привязки к авто</small>'
        }
      </td>

      <td data-label="Сообщение">
        <small>${Admin.escapeHTML(lead.message || lead.budget || '—')}</small>
      </td>

      <td data-label="Статус">
        <select class="admin-status-select" data-lead-status="${lead.id}">
          <option value="new" ${lead.status === 'new' ? 'selected' : ''}>Новая</option>
          <option value="in_work" ${lead.status === 'in_work' ? 'selected' : ''}>В работе</option>
          <option value="done" ${lead.status === 'done' ? 'selected' : ''}>Закрыта</option>
          <option value="cancelled" ${lead.status === 'cancelled' ? 'selected' : ''}>Отмена</option>
        </select>
      </td>

      <td data-label="Дата">
        <small>${Admin.formatDate(lead.createdAt)}</small>
      </td>

      <td data-label="Действия">
        <div class="admin-actions">
          <button
            class="admin-action admin-action--danger"
            type="button"
            data-lead-delete="${lead.id}"
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  `;
}

function bindLeadStatusSelects() {
  const selects = document.querySelectorAll('[data-lead-status]');

  selects.forEach((select) => {
    select.addEventListener('change', async () => {
      const leadId = select.dataset.leadStatus;
      const status = select.value;

      if (!leadId) return;

      try {
        select.disabled = true;

        await Admin.request(`/api/admin/leads/${leadId}/status`, {
          method: 'PATCH',
          body: { status },
        });
      } catch (error) {
        console.error('Lead status error:', error);
        alert(error.message || 'Не удалось изменить статус заявки');
        await initLeadsPage();
      } finally {
        select.disabled = false;
      }
    });
  });
}

function bindLeadDeleteButtons() {
  const buttons = document.querySelectorAll('[data-lead-delete]');

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const leadId = button.dataset.leadDelete;

      if (!leadId) return;

      const confirmed = confirm(
        'Удалить заявку? Это действие нельзя отменить.',
      );

      if (!confirmed) return;

      try {
        button.disabled = true;

        await Admin.request(`/api/admin/leads/${leadId}`, {
          method: 'DELETE',
        });

        await initLeadsPage();
      } catch (error) {
        console.error('Lead delete error:', error);
        alert(error.message || 'Не удалось удалить заявку');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getPushRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Этот браузер не поддерживает Service Worker.');
  }

  await navigator.serviceWorker.register('/push-sw.js', {
    scope: '/',
  });

  return navigator.serviceWorker.ready;
}

async function getCurrentPushSubscription() {
  const registration = await getPushRegistration();
  return registration.pushManager.getSubscription();
}

function subscriptionUsesVapidKey(subscription, publicKey) {
  const currentKey = subscription?.options?.applicationServerKey;

  if (!currentKey || !publicKey) return false;

  const actual = new Uint8Array(currentKey);
  const expected = urlBase64ToUint8Array(publicKey);

  if (actual.length !== expected.length) return false;

  return actual.every((value, index) => value === expected[index]);
}

async function removePushSubscription(subscription) {
  if (!subscription) return;

  try {
    await Admin.request('/api/admin/push/unsubscribe', {
      method: 'POST',
      body: { endpoint: subscription.endpoint },
    });
  } catch (error) {
    console.warn('Push unsubscribe sync warning:', error);
  }

  await subscription.unsubscribe().catch(() => false);
}

async function initPushSettings() {
  const status = document.querySelector('[data-push-status]');
  const enableButton = document.querySelector('[data-push-enable]');
  const testButton = document.querySelector('[data-push-test]');
  const disableButton = document.querySelector('[data-push-disable]');

  if (!status || !enableButton || !testButton || !disableButton) return;

  enableButton.addEventListener('click', enablePushNotifications);
  testButton.addEventListener('click', sendTestPush);
  disableButton.addEventListener('click', disablePushNotifications);

  await refreshPushSettingsState();
}

async function refreshPushSettingsState() {
  try {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPushStatus('unsupported', 'Web Push не поддерживается этим браузером');
      setPushButtons({ canEnable: false, canTest: false, canDisable: false });
      return;
    }

    const config = await Admin.request('/api/admin/push/config');

    if (!config?.configured) {
      setPushStatus('warning', 'Нужно добавить VAPID-ключи в .env');
      setPushButtons({ canEnable: false, canTest: false, canDisable: false });
      return;
    }

    let subscription = await getCurrentPushSubscription();

    if (subscription && !subscriptionUsesVapidKey(subscription, config.publicKey)) {
      await removePushSubscription(subscription);
      subscription = null;
      showPushMessage(
        'Локальная push-подписка была устаревшей. Нажмите «Включить уведомления» ещё раз.',
      );
    }

    if (subscription) {
      await syncPushSubscription(subscription);
      setPushStatus('active', 'Уведомления включены на этом устройстве');
      setPushButtons({ canEnable: false, canTest: true, canDisable: true });
      return;
    }

    if (Notification.permission === 'denied') {
      setPushStatus(
        'warning',
        'Уведомления запрещены в настройках браузера',
      );
      setPushButtons({ canEnable: false, canTest: false, canDisable: false });
      return;
    }

    setPushStatus('inactive', 'Уведомления на этом устройстве выключены');
    setPushButtons({ canEnable: true, canTest: false, canDisable: false });
  } catch (error) {
    console.error('Push init error:', error);
    setPushStatus('warning', 'Не удалось проверить Web Push');
    setPushButtons({ canEnable: false, canTest: false, canDisable: false });
    showPushMessage(error.message || 'Ошибка проверки уведомлений', true);
  }
}

async function enablePushNotifications() {
  setPushBusy(true);
  showPushMessage('');

  try {
    const config = await Admin.request('/api/admin/push/config');

    if (!config?.configured || !config.publicKey) {
      throw new Error('Сначала настройте VAPID-ключи в .env.');
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      throw new Error('Браузер не разрешил показывать уведомления.');
    }

    const registration = await getPushRegistration();
    let subscription = await registration.pushManager.getSubscription();

    if (subscription && !subscriptionUsesVapidKey(subscription, config.publicKey)) {
      await removePushSubscription(subscription);
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
    }

    await syncPushSubscription(subscription);

    setPushStatus('active', 'Уведомления включены на этом устройстве');
    setPushButtons({ canEnable: false, canTest: true, canDisable: true });
    showPushMessage('Готово. Новые заявки будут приходить Web Push.');
  } catch (error) {
    console.error('Push enable error:', error);
    showPushMessage(error.message || 'Не удалось включить уведомления', true);
    await refreshPushSettingsState();
  } finally {
    setPushBusy(false);
  }
}

async function syncPushSubscription(subscription) {
  return Admin.request('/api/admin/push/subscribe', {
    method: 'POST',
    body: subscription.toJSON(),
  });
}

async function disablePushNotifications() {
  setPushBusy(true);
  showPushMessage('');

  try {
    const subscription = await getCurrentPushSubscription();

    if (subscription) {
      await Admin.request('/api/admin/push/unsubscribe', {
        method: 'POST',
        body: {
          endpoint: subscription.endpoint,
        },
      });

      await subscription.unsubscribe();
    }

    setPushStatus('inactive', 'Уведомления на этом устройстве выключены');
    setPushButtons({ canEnable: true, canTest: false, canDisable: false });
    showPushMessage('Уведомления отключены на этом устройстве.');
  } catch (error) {
    console.error('Push disable error:', error);
    showPushMessage(error.message || 'Не удалось отключить уведомления', true);
    await refreshPushSettingsState();
  } finally {
    setPushBusy(false);
  }
}

async function sendTestPush() {
  setPushBusy(true);
  showPushMessage('');

  try {
    const data = await Admin.request('/api/admin/push/test', {
      method: 'POST',
    });

    showPushMessage(
      `Тестовое уведомление отправлено${data?.sent ? ` (${data.sent})` : ''}.`,
    );
  } catch (error) {
    console.error('Push test error:', error);
    showPushMessage(error.message || 'Не удалось отправить тестовый Push', true);
  } finally {
    setPushBusy(false);
    await refreshPushSettingsState();
  }
}

function setPushStatus(type, text) {
  const status = document.querySelector('[data-push-status]');

  if (!status) return;

  status.className = `push-settings__status push-settings__status--${type}`;
  status.innerHTML = `
    <span class="push-settings__status-dot"></span>
    <strong>${Admin.escapeHTML(text)}</strong>
  `;
}

function setPushButtons({ canEnable, canTest, canDisable }) {
  const enableButton = document.querySelector('[data-push-enable]');
  const testButton = document.querySelector('[data-push-test]');
  const disableButton = document.querySelector('[data-push-disable]');

  if (enableButton) enableButton.disabled = !canEnable;
  if (testButton) testButton.disabled = !canTest;
  if (disableButton) disableButton.disabled = !canDisable;
}

function setPushBusy(isBusy) {
  document
    .querySelectorAll(
      '[data-push-enable], [data-push-test], [data-push-disable]',
    )
    .forEach((button) => {
      button.dataset.busy = isBusy ? 'true' : 'false';

      if (isBusy) {
        button.disabled = true;
      }
    });
}

function showPushMessage(message, isError = false) {
  const box = document.querySelector('[data-push-message]');

  if (!box) return;

  if (!message) {
    box.hidden = true;
    box.textContent = '';
    box.classList.remove('push-settings__message--error');
    return;
  }

  box.hidden = false;
  box.textContent = message;
  box.classList.toggle('push-settings__message--error', isError);
}
