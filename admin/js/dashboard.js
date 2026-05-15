const adminName = document.getElementById('adminName');
const logoutButton = document.getElementById('adminLogoutButton');
const carsTableBody = document.getElementById('carsTableBody');
const carsCount = document.getElementById('carsCount');
const adminToast = document.getElementById('adminToast');

const previewImageInput = document.getElementById('carPreviewImage');
const imageInput = document.getElementById('carImage');

const previewImagePreview = document.getElementById('previewImagePreview');
const imagePreview = document.getElementById('imagePreview');

let carsState = [];
let currentCarId = null;
let formMode = 'create';
let csrfToken = '';

initDashboard();

async function initDashboard() {
  const isAuthorized = await checkAdminAuth();

  if (!isAuthorized) return;

  await loadCsrfToken();
  await loadCars();
}

async function checkAdminAuth() {
  try {
    const response = await fetch('/api/admin/me', {
      method: 'GET',
      credentials: 'same-origin',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      window.location.replace('/admin/login.html');
      return false;
    }

    if (adminName) {
      adminName.textContent = data.admin?.name || data.admin?.email || 'Admin';
    }

    return true;
  } catch (error) {
    console.error('Dashboard auth error:', error);
    window.location.replace('/admin/login.html');
    return false;
  }
}

logoutButton?.addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    window.location.replace('/admin/login.html');
  }
});

async function loadCars() {
  if (!carsTableBody) return;

  renderTableMessage('Загружаем автомобили...', 4);

  try {
    const response = await fetch('/api/admin/cars', {
      method: 'GET',
      credentials: 'same-origin',
    });

    const data = await response.json();

    if (!response.ok || !data.success || !Array.isArray(data.cars)) {
      throw new Error(data.message || 'Ошибка загрузки автомобилей');
    }

    const cars = data.cars;

    carsState = cars;

    if (carsCount) {
      carsCount.textContent = String(cars.length);
    }

    clearTable();

    if (!cars.length) {
      renderTableMessage('Автомобили не найдены', 4);
      return;
    }

    cars.forEach((car) => {
      carsTableBody.appendChild(createCarRow(car));
    });
  } catch (error) {
    console.error('Cars loading error:', error);

    if (carsCount) {
      carsCount.textContent = '—';
    }

    clearTable();
    renderTableMessage('Не удалось загрузить автомобили', 4);
  }
}

function createCarRow(car) {
  const row = document.createElement('tr');

  const titleCell = document.createElement('td');
  const title = document.createElement('strong');
  const subtitle = document.createElement('span');

  title.textContent = car.title || '—';
  subtitle.textContent = car.complectation || 'Комплектация не указана';

  titleCell.append(title, subtitle);

  const yearCell = document.createElement('td');
  yearCell.textContent = car.year || '—';

  const priceCell = document.createElement('td');
  priceCell.textContent = car.price || '—';

  const statusCell = document.createElement('td');
  const status = document.createElement('span');

  status.classList.add('admin-status');
  status.classList.add(car.isActive ? 'is-active' : 'is-hidden');

  status.textContent = car.isActive ? 'Активно' : 'Скрыто';

  statusCell.appendChild(status);

  // ACTIONS

  const actionsCell = document.createElement('td');

  const actions = document.createElement('div');

  const editButton = document.createElement('button');
  const deleteButton = document.createElement('button');

  actions.classList.add('admin-table-actions');

  editButton.type = 'button';
  editButton.textContent = 'Изменить';
  editButton.dataset.action = 'edit';
  editButton.dataset.id = car.id;

  deleteButton.type = 'button';
  deleteButton.textContent = 'Удалить';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = car.id;

  actions.append(editButton, deleteButton);

  actionsCell.appendChild(actions);

  row.append(titleCell, yearCell, priceCell, statusCell, actionsCell);

  return row;
}

function renderTableMessage(text, colspan = 4) {
  if (!carsTableBody) return;

  clearTable();

  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = colspan;
  cell.textContent = text;

  row.appendChild(cell);
  carsTableBody.appendChild(row);
}

function clearTable() {
  if (!carsTableBody) return;

  while (carsTableBody.firstChild) {
    carsTableBody.removeChild(carsTableBody.firstChild);
  }
}

const navLinks = document.querySelectorAll('.admin-sidebar__nav a');
const panels = document.querySelectorAll('.admin-panel');

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();

    const targetPanel = link.dataset.panel;

    navLinks.forEach((item) => {
      item.classList.remove('active');
    });

    panels.forEach((panel) => {
      panel.classList.remove('is-active');
    });

    link.classList.add('active');

    const activePanel = document.querySelector(
      `[data-panel-content="${targetPanel}"]`,
    );

    activePanel?.classList.add('is-active');
  });
});

// изменить удалить клики
carsTableBody?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const action = button.dataset.action;
  const carId = button.dataset.id;

  if (!carId) return;

  if (action === 'edit') {
    const car = carsState.find((item) => String(item.id) === String(carId));

    if (!car) {
      alert('Автомобиль не найден');
      return;
    }

    openEditCarModal(car);
    return;
  }

  if (action === 'delete') {
    const confirmed = confirm('Удалить автомобиль?');

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/cars/${carId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'CSRF-Token': csrfToken,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Ошибка удаления');
      }

      await loadCars();

      showToast('Автомобиль удалён');
    } catch (error) {
      console.error('Delete car error:', error);
      showToast(error.message || 'Не удалось удалить автомобиль', 'error');
    }
  }
});

function openCreateCarModalHandler() {
  formMode = 'create';
  currentCarId = null;

  carForm?.reset();
  resetImagePreviews();

  const title = document.getElementById('carModalTitle');
  if (title) title.textContent = 'Добавить автомобиль';

  openCarModal();
}

function openEditCarModal(car) {
  formMode = 'edit';
  currentCarId = car.id;

  const title = document.getElementById('carModalTitle');
  if (title) title.textContent = 'Редактировать автомобиль';

  setFormValue('carTitle', car.title);
  setFormValue('carPrice', car.price);
  setFormValue('carYear', car.year);
  setFormValue('carEngine', car.engine);
  setFormValue('carMileage', car.mileage);
  setFormValue('carDrive', car.drive);
  setFormValue('carGearbox', car.gearbox);
  setFormValue('carGrade', car.grade);
  setFormValue('carComplectation', car.complectation);

  openCarModal();
}

function setFormValue(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value || '';
}

// Модальное окно для авто
const carModal = document.getElementById('carModal');
const closeCarModal = document.getElementById('closeCarModal');
const openCreateCarModal = document.getElementById('openCreateCarModal');

openCreateCarModal?.addEventListener('click', openCreateCarModalHandler);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
});

function openCarModal() {
  carModal?.classList.add('is-active');
}

function closeModal() {
  carModal?.classList.remove('is-active');
}

closeCarModal?.addEventListener('click', closeModal);

document
  .querySelector('.admin-modal__overlay')
  ?.addEventListener('click', closeModal);

const carForm = document.getElementById('carForm');
const cancelCarForm = document.getElementById('cancelCarForm');
const carFormSubmitButton = carForm?.querySelector('button[type="submit"]');

cancelCarForm?.addEventListener('click', closeModal);

carForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(carForm);

  const title = String(formData.get('title') || '').trim();
  const price = String(formData.get('price') || '').trim();
  const previewImage = formData.get('previewImage');
  const image = formData.get('image');

  if (title.length < 2) {
    showToast('Введите нормальное название автомобиля', 'error');
    return;
  }

  if (price.length < 2) {
    showToast('Введите стоимость автомобиля', 'error');
    return;
  }

  if (formMode === 'create') {
    if (!(previewImage instanceof File) || !previewImage.size) {
      showToast('Загрузите фото для карточки', 'error');
      return;
    }

    if (!(image instanceof File) || !image.size) {
      showToast('Загрузите фото для модалки', 'error');
      return;
    }
  }

  setFormLoading(true);

  try {
    const url =
      formMode === 'edit'
        ? `/api/admin/cars/${currentCarId}`
        : '/api/admin/cars';

    const method = formMode === 'edit' ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        'CSRF-Token': csrfToken,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Ошибка сохранения автомобиля');
    }

    carForm.reset();
    resetImagePreviews();
    closeModal();

    await loadCars();

    showToast(
      formMode === 'edit' ? 'Автомобиль обновлён' : 'Автомобиль добавлен',
    );

    console.log(
      formMode === 'edit' ? 'Автомобиль обновлён:' : 'Автомобиль создан:',
      data.car,
    );

    formMode = 'create';
    currentCarId = null;
  } catch (error) {
    console.error('Create car error:', error);

    showToast(error.message || 'Не удалось сохранить автомобиль', 'error');
  } finally {
    setFormLoading(false);
  }
});

function showToast(message, type = 'success') {
  if (!adminToast) return;

  const toast = document.createElement('div');

  toast.classList.add('admin-toast__item');
  toast.classList.add(type === 'error' ? 'is-error' : 'is-success');

  toast.textContent = message;

  adminToast.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function resetImagePreviews() {
  [previewImagePreview, imagePreview].forEach((imageElement) => {
    if (!imageElement) return;

    imageElement.src = '';
    imageElement.classList.remove('is-visible');
  });
}

function setFormLoading(isLoading) {
  if (!carFormSubmitButton) return;

  carFormSubmitButton.disabled = isLoading;
  carFormSubmitButton.textContent = isLoading ? 'Сохраняем...' : 'Сохранить';
}

previewImageInput?.addEventListener('change', (event) => {
  updateImagePreview(event.target.files?.[0], previewImagePreview);
});

imageInput?.addEventListener('change', (event) => {
  updateImagePreview(event.target.files?.[0], imagePreview);
});

function updateImagePreview(file, imageElement) {
  if (!file || !imageElement) return;

  const imageUrl = URL.createObjectURL(file);

  imageElement.src = imageUrl;
  imageElement.classList.add('is-visible');
}

document.querySelectorAll('[data-upload-zone]').forEach((zone) => {
  const input = zone.querySelector('input[type="file"]');
  const preview = zone.querySelector('.admin-upload__preview');

  if (!input || !preview) return;

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('is-dragover');
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');

    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    input.files = event.dataTransfer.files;

    updateImagePreview(file, preview);
  });
});

async function loadCsrfToken() {
  try {
    const response = await fetch('/api/admin/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.csrfToken) {
      throw new Error('Не удалось получить CSRF token');
    }

    csrfToken = data.csrfToken;
  } catch (error) {
    console.error('CSRF token error:', error);
    showToast('Ошибка безопасности. Обновите страницу.', 'error');
  }
}
