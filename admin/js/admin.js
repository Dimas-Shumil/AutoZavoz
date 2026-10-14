const Admin = (() => {
  function redirectToLogin() {
    window.location.href =
      "/admin/login.html?next=" +
      encodeURIComponent(location.pathname + location.search);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function request(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    const config = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
    };

    if (options.body !== undefined) {
      const isFormData = options.body instanceof FormData;

      if (isFormData) {
        config.body = options.body;
      } else {
        headers["Content-Type"] = "application/json";
        config.body = JSON.stringify(options.body);
      }
    }

    let response;

    try {
      response = await fetch(url, config);
    } catch (error) {
      const requestError = new Error(
        "Сервер не ответил. Проверьте интернет и попробуйте ещё раз.",
      );

      requestError.cause = error;
      throw requestError;
    }

    const responseText = await response.text();
    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        data = {};
      }
    }

    if (response.status === 401) {
      redirectToLogin();
      return null;
    }

    if (!response.ok) {
      const fallbackMessages = {
        413: "Фотографии слишком большие для загрузки.",
        429: "Слишком много запросов. Подождите минуту и повторите.",
        502: "Сервер временно недоступен. Попробуйте ещё раз.",
        503: "Сервер временно недоступен. Попробуйте ещё раз.",
        504: "Обработка фотографий заняла слишком много времени.",
      };

      const requestError = new Error(
        data.message ||
          fallbackMessages[response.status] ||
          `Не удалось выполнить запрос (ошибка ${response.status})`,
      );

      requestError.status = response.status;
      requestError.code = data.code || null;
      requestError.errors = data.errors || null;

      throw requestError;
    }

    return data;
  }

  async function checkAuth() {
    return request("/api/admin/me");
  }

  function setActiveNav() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll(
      "[data-admin-nav], [data-admin-mobile-nav]",
    );

    links.forEach((link) => {
      const href = link.getAttribute("href");
      const isCarList =
        href === "/admin/cars.html" &&
        (currentPath === "/admin/cars.html" ||
          (currentPath === "/admin/car-edit.html" &&
            !link.matches("[data-admin-mobile-nav]")));

      if (href === currentPath || isCarList) {
        link.classList.add("active");
      }
    });
  }

  function createMobileNav() {
    if (document.querySelector(".admin-mobile-nav")) return;

    const nav = document.createElement("nav");
    nav.className = "admin-mobile-nav";
    nav.setAttribute("aria-label", "Навигация админки");
    nav.innerHTML = `
      <a href="/admin/cars.html" data-admin-mobile-nav>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l1.4-5.2A2 2 0 0 1 8.3 9.3h7.4a2 2 0 0 1 1.9 1.5L19 16m-14 0h14m-14 0v2.2c0 .4.4.8.8.8h.7c.4 0 .8-.4.8-.8V17m9.4 0v1.2c0 .4.4.8.8.8h.7c.4 0 .8-.4.8-.8V16M8 14h.01M16 14h.01"/></svg>
        <span>Авто</span>
      </a>
      <a href="/admin/leads.html" data-admin-mobile-nav>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 4h6M9 13h4M9 17h2"/></svg>
        <span>Заявки</span>
      </a>
      <a href="/admin/car-edit.html" data-admin-mobile-nav>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        <span>Добавить</span>
      </a>
      <button type="button" data-admin-logout class="admin-mobile-nav__logout">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4m4-4 4-3-4-3m4 3H9"/></svg>
        <span>Выйти</span>
      </button>
    `;

    document.body.append(nav);
  }

  function bindLogout() {
    const logoutButtons = document.querySelectorAll("[data-admin-logout]");

    logoutButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          button.disabled = true;
          button.textContent = "Выходим...";

          const registration =
            "serviceWorker" in navigator
              ? await navigator.serviceWorker.getRegistration("/admin/")
              : null;
          const ownWorker =
            registration &&
            new URL(registration.active?.scriptURL || location.href)
              .pathname === "/push-sw.js";
          const subscription = ownWorker
            ? await registration.pushManager.getSubscription()
            : null;
          const result = await request("/api/admin/logout", {
            method: "POST",
            body: subscription ? { endpoint: subscription.endpoint } : {},
          });
          if (!result) return;
          if (subscription) await subscription.unsubscribe().catch(() => false);

          window.location.href = "/admin/login.html";
        } catch (error) {
          console.error("Logout error:", error);
          alert("Не удалось выйти из админки");
        } finally {
          button.disabled = false;
          button.textContent = "Выйти";
        }
      });
    });
  }

  async function init() {
    try {
      const auth = await checkAuth();
      if (!auth?.success) return;
      createMobileNav();
      setActiveNav();
      bindLogout();
      document.dispatchEvent(new Event("admin:ready"));
    } catch (error) {
      console.error("Admin init error:", error);
    }
  }

  return {
    init,
    request,
    escapeHTML,
    formatDate,
  };
})();

document.addEventListener("DOMContentLoaded", Admin.init);
