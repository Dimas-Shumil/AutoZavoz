(() => {
  let config = null;
  let busy = false;
  let state = {
    kind: "loading",
    text: "Проверяем состояние...",
    enable: false,
    test: false,
    disable: false,
  };
  const node = (name) => document.querySelector(`[data-push-${name}]`);
  const supported = () =>
    window.isSecureContext &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator;
  function render() {
    const status = node("status");
    if (!status) return;
    status.className = `push-settings__status push-settings__status--${state.kind}`;
    status.querySelector("strong").textContent = state.text;
    for (const name of ["enable", "test", "disable"]) {
      const button = node(name);
      button.disabled = busy || !state[name];
      button.setAttribute("aria-busy", String(busy));
    }
  }
  function message(text = "", error = false) {
    const box = node("message");
    box.textContent = text;
    box.hidden = !text;
    box.classList.toggle("push-settings__message--error", error);
  }
  const bytes = (key) =>
    Uint8Array.from(
      atob(
        key.replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - (key.length % 4)) % 4),
      ),
      (char) => char.charCodeAt(0),
    );
  function sameKey(subscription) {
    const current = subscription?.options?.applicationServerKey;
    if (!current || !config?.publicKey) return false;
    const a = new Uint8Array(current),
      b = bytes(config.publicKey);
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }
  async function registration() {
    const reg = await navigator.serviceWorker.register("/push-sw.js", {
      scope: "/admin/",
    });
    if (reg.active) return reg;
    const worker = reg.installing || reg.waiting;
    await new Promise((resolve, reject) => {
      if (!worker)
        return reject(new Error("Не удалось запустить уведомления."));
      const timeout = setTimeout(
        () => reject(new Error("Попробуйте обновить страницу.")),
        10000,
      );
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          clearTimeout(timeout);
          resolve();
        }
        if (worker.state === "redundant") {
          clearTimeout(timeout);
          reject(new Error("Не удалось запустить уведомления."));
        }
      });
      if (worker.state === "activated") {
        clearTimeout(timeout);
        resolve();
      }
    });
    return reg;
  }
  async function current() {
    const reg = await navigator.serviceWorker.getRegistration("/admin/");
    if (
      !reg ||
      new URL(reg.active?.scriptURL || location.href).pathname !== "/push-sw.js"
    )
      return null;
    return reg.pushManager.getSubscription();
  }
  async function refresh() {
    if (!supported()) {
      state = {
        kind: "warning",
        text: "Нужен HTTPS и браузер с поддержкой уведомлений.",
        enable: false,
        test: false,
        disable: false,
      };
      render();
      return;
    }
    config = await Admin.request("/api/admin/push/config");
    if (!config) return;
    const sub = await current();
    const saved = sub
      ? await Admin.request("/api/admin/push/status", {
          method: "POST",
          body: { endpoint: sub.endpoint },
        })
      : null;
    const active = Boolean(
      sub &&
      saved?.subscribed &&
      sameKey(sub) &&
      Notification.permission === "granted",
    );
    state = {
      kind: active ? "active" : "inactive",
      text: active
        ? "Уведомления включены на этом устройстве"
        : "Уведомления на этом устройстве выключены",
      enable: Boolean(
        config.configured && !active && Notification.permission !== "denied",
      ),
      test: Boolean(config.configured && active),
      disable: Boolean(sub),
    };
    if (!config.configured) {
      state.kind = "warning";
      state.text = "Уведомления временно недоступны.";
    } else if (Notification.permission === "denied") {
      state.kind = "warning";
      state.text = "Разрешите уведомления в настройках браузера.";
    }
    render();
  }
  async function action(task) {
    if (busy) return;
    busy = true;
    render();
    message();
    try {
      await task();
    } catch (error) {
      message(error.message || "Не удалось выполнить действие.", true);
    } finally {
      try {
        await refresh();
      } catch {
        state = {
          kind: "warning",
          text: "Не удалось проверить уведомления. Обновите страницу.",
          enable: false,
          test: false,
          disable: false,
        };
      }
      busy = false;
      render();
    }
  }
  async function remove(sub) {
    if (!sub) return;
    const result = await Admin.request("/api/admin/push/unsubscribe", {
      method: "POST",
      body: { endpoint: sub.endpoint },
    });
    if (!result) throw new Error("Войдите в админку заново.");
    if (!(await sub.unsubscribe()))
      throw new Error("Браузер не отключил подписку. Повторите попытку.");
  }
  document.addEventListener("admin:ready", async () => {
    if (!node("status")) return;
    node("enable").addEventListener("click", () => {
      if (busy || !config?.configured) return;
      // Ask before the first await, while the user's click is still active.
      const permission =
        Notification.permission === "granted"
          ? Promise.resolve("granted")
          : Notification.requestPermission();
      void action(async () => {
        if ((await permission) !== "granted")
          throw new Error("Разрешение на уведомления не выдано.");
        let sub = await current();
        if (sub && !sameKey(sub)) {
          await remove(sub);
          sub = null;
        }
        const reg = await registration();
        // Migration from the old root-scope worker keeps only one subscription.
        const owned = await reg.pushManager.getSubscription();
        if (sub && sub.endpoint !== owned?.endpoint) {
          await remove(sub);
          sub = null;
        }
        sub =
          owned ||
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes(config.publicKey),
          }));
        const result = await Admin.request("/api/admin/push/subscribe", {
          method: "POST",
          body: sub.toJSON(),
        });
        if (!result) throw new Error("Войдите в админку заново.");
        message("Уведомления включены на этом устройстве.");
      });
    });
    node("disable").addEventListener("click", () => {
      void action(async () => {
        await remove(await current());
        message("Уведомления отключены на этом устройстве.");
      });
    });
    node("test").addEventListener("click", () => {
      void action(async () => {
        const sub = await current();
        if (!sub) throw new Error("Сначала включите уведомления.");
        const result = await Admin.request("/api/admin/push/test", {
          method: "POST",
          body: { endpoint: sub.endpoint },
        });
        if (result)
          message(
            "Сервис push принял тестовое уведомление для этого устройства.",
          );
      });
    });
    try {
      await refresh();
    } catch {
      state = {
        kind: "warning",
        text: "Не удалось проверить уведомления. Обновите страницу.",
        enable: false,
        test: false,
        disable: false,
      };
      render();
    }
  });
})();
