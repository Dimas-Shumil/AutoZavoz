document.addEventListener("admin:ready", initLeadsPage);

async function initLeadsPage() {
  const tableBody = document.querySelector("#leadsTableBody");
  const countBox = document.querySelector("#leadsCount");
  const emptyBox = document.querySelector("#leadsEmpty");

  if (!tableBody) return;

  try {
    const data = await Admin.request("/api/admin/leads");
    const leads = data && Array.isArray(data.leads) ? data.leads : [];

    if (countBox) {
      countBox.textContent = formatLeadCount(leads.length);
    }

    if (!leads.length) {
      tableBody.innerHTML = "";
      if (emptyBox) emptyBox.hidden = false;
      return;
    }

    if (emptyBox) emptyBox.hidden = true;

    tableBody.innerHTML = leads.map(createLeadRow).join("");

    bindLeadStatusSelects();
    bindLeadDeleteButtons();
    highlightRequestedLead();
  } catch (error) {
    console.error("Leads load error:", error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="7">Не удалось загрузить заявки</td>
      </tr>
    `;

    if (countBox) {
      countBox.textContent = "Ошибка загрузки";
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
  const carTitle = lead.car?.title || lead.carTitleSnapshot || "—";
  const carSlug = lead.car?.slug || lead.carSlugSnapshot || "";

  return `
    <tr data-lead-id="${lead.id}">
      <td data-label="Клиент">
        <strong>${Admin.escapeHTML(lead.customerName || "Без имени")}</strong>
        <small>${Admin.escapeHTML(lead.city || "Город не указан")}</small>
      </td>

      <td data-label="Контакты">
        <strong>
          <a href="tel:${Admin.escapeHTML(lead.phone)}">
            ${Admin.escapeHTML(lead.phone)}
          </a>
        </strong>
        <small>${Admin.escapeHTML(lead.messenger || "Мессенджер не указан")}</small>
      </td>

      <td data-label="Автомобиль">
        <strong>${Admin.escapeHTML(carTitle)}</strong>
        ${
          carSlug
            ? `<small><a href="/cars/${encodeURIComponent(carSlug)}" target="_blank" rel="noopener">Открыть авто</a></small>`
            : "<small>Без привязки к авто</small>"
        }
      </td>

      <td data-label="Сообщение">
        <small>${Admin.escapeHTML(lead.message || lead.budget || "—")}</small>
      </td>

      <td data-label="Статус">
        <select class="admin-status-select" data-lead-status="${lead.id}">
          <option value="new" ${lead.status === "new" ? "selected" : ""}>Новая</option>
          <option value="in_work" ${lead.status === "in_work" ? "selected" : ""}>В работе</option>
          <option value="done" ${lead.status === "done" ? "selected" : ""}>Закрыта</option>
          <option value="cancelled" ${lead.status === "cancelled" ? "selected" : ""}>Отмена</option>
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
  const selects = document.querySelectorAll("[data-lead-status]");

  selects.forEach((select) => {
    select.addEventListener("change", async () => {
      const leadId = select.dataset.leadStatus;
      const status = select.value;

      if (!leadId) return;

      try {
        select.disabled = true;

        await Admin.request(`/api/admin/leads/${leadId}/status`, {
          method: "PATCH",
          body: { status },
        });
      } catch (error) {
        console.error("Lead status error:", error);
        alert(error.message || "Не удалось изменить статус заявки");
        await initLeadsPage();
      } finally {
        select.disabled = false;
      }
    });
  });
}

function bindLeadDeleteButtons() {
  const buttons = document.querySelectorAll("[data-lead-delete]");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const leadId = button.dataset.leadDelete;

      if (!leadId) return;

      const confirmed = confirm(
        "Удалить заявку? Это действие нельзя отменить.",
      );

      if (!confirmed) return;

      try {
        button.disabled = true;

        await Admin.request(`/api/admin/leads/${leadId}`, {
          method: "DELETE",
        });

        await initLeadsPage();
      } catch (error) {
        console.error("Lead delete error:", error);
        alert(error.message || "Не удалось удалить заявку");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function highlightRequestedLead() {
  const id = new URLSearchParams(location.search).get("leadId");
  if (!/^[1-9]\d*$/.test(id || "")) return;
  const row = document.querySelector(`[data-lead-id="${id}"]`);
  if (!row) return;
  row.classList.add("admin-lead--highlight");
  row.scrollIntoView({
    block: "center",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
