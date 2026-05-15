const burger = document.querySelector('.header__burger');
const mobileMenu = document.querySelector('.mobile-menu');
const overlay = document.querySelector('.mobile-menu-overlay');
const mobileLinks = document.querySelectorAll('.mobile-menu a');
const header = document.querySelector('.header');

if (burger && mobileMenu && overlay) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  });

  overlay.addEventListener('click', closeMenu);
  mobileLinks.forEach((link) => link.addEventListener('click', closeMenu));
}

function closeMenu() {
  burger?.classList.remove('active');
  mobileMenu?.classList.remove('active');
  overlay?.classList.remove('active');
  document.body.classList.remove('menu-open');
}

if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
  });
}

const catalogGrid = document.getElementById('catalogGrid');
const catalogSearch = document.getElementById('catalogSearch');

let cars = [];

document.addEventListener('DOMContentLoaded', loadCars);

async function loadCars() {
  if (!catalogGrid) return;

  try {
    const response = await fetch('/api/cars');
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Ошибка загрузки каталога');
    }

    cars = data.cars || [];

    const catalogHeroCount = document.getElementById('catalogHeroCount');

    if (catalogHeroCount) {
      catalogHeroCount.textContent = cars.length;
    }

    renderCars(cars);
  } catch (error) {
    console.error('Catalog load error:', error);
    catalogGrid.innerHTML =
      '<div class="catalog-empty">Не удалось загрузить каталог. Попробуйте позже.</div>';
  }
}

function renderCars(items) {
  if (!items.length) {
    catalogGrid.innerHTML =
      '<div class="catalog-empty">Автомобили скоро появятся в каталоге.</div>';
    return;
  }

  catalogGrid.innerHTML = items.map(createCarCard).join('');

  document.querySelectorAll('.cars-card').forEach((card) => {
    card.addEventListener('click', () => openCarModal(card.dataset));

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        openCarModal(card.dataset);
      }
    });
  });
}

function createCarCard(car) {
  const image = car.previewImage || car.image || '/site/img/logoIcon.png';
  const title = car.title || 'Автомобиль';

  return `
    <article
      class="cars-card"
      role="listitem"
      tabindex="0"
      data-title="${escapeHtml(title)}"
      data-price="${escapeHtml(car.price || 'Цена уточняется')}"
      data-badge="${escapeHtml(car.badge || 'Под заказ')}"
      data-grade="${escapeHtml(car.grade || '—')}"
      data-year="${escapeHtml(car.year || '—')}"
      data-engine="${escapeHtml(car.engine || '—')}"
      data-mileage="${escapeHtml(car.mileage || '—')}"
      data-drive="${escapeHtml(car.drive || '—')}"
      data-gearbox="${escapeHtml(car.gearbox || '—')}"
      data-complectation="${escapeHtml(car.complectation || '—')}"
      data-auction="${escapeHtml(car.auctionUrl || '#')}"
      data-image="${escapeHtml(car.image || image)}"
    >
      <div class="cars-card__image">
        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(title)}"
          loading="lazy"
          decoding="async"
        >

        <span class="cars-card__badge">
          ${escapeHtml(car.badge || 'Под заказ')}
        </span>

        <span class="cars-card__grade">
          ${escapeHtml(car.grade || '—')}
        </span>
      </div>

      <div class="cars-card__content">
        <div class="cars-card__head">
          <h3 class="cars-card__title">${escapeHtml(title)}</h3>
          <p class="cars-card__complectation">
            ${escapeHtml(car.complectation || 'Комплектация уточняется')}
          </p>
        </div>

        <div class="cars-card__specs">
          <div>
            <span>Год</span>
            <strong>${escapeHtml(car.year || '—')}</strong>
          </div>

          <div>
            <span>Пробег</span>
            <strong>${escapeHtml(car.mileage || '—')}</strong>
          </div>

          <div>
            <span>Двигатель</span>
            <strong>${escapeHtml(car.engine || '—')}</strong>
          </div>

          <div>
            <span>Привод</span>
            <strong>${escapeHtml(car.drive || '—')}</strong>
          </div>
        </div>

        <div class="cars-card__bottom">
          <div>
            <span class="cars-card__price-label">Стоимость под ключ</span>
            <div class="cars-card__price">
              ${escapeHtml(car.price || 'Цена уточняется')}
            </div>
          </div>

          <button
            type="button"
            class="cars-card__arrow"
            aria-label="Подробнее об автомобиле ${escapeHtml(title)}"
          >
            ›
          </button>
        </div>
      </div>
    </article>
  `;
}

catalogSearch?.addEventListener('input', () => {
  const value = catalogSearch.value.trim().toLowerCase();

  const filteredCars = cars.filter((car) => {
    const searchable = [
      car.title,
      car.year,
      car.engine,
      car.drive,
      car.gearbox,
      car.complectation,
      car.badge,
      car.price
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(value);
  });

  renderCars(filteredCars);
});

function openCarModal(car) {
  const modal = document.getElementById('carsModal');
  if (!modal) return;

  setText('carsModalTitle', car.title || 'Автомобиль');
  setText('carsModalPrice', car.price || 'Цена уточняется');
  setText('carsModalBadge', car.badge || 'Под заказ');
  setText('carsModalGrade', car.grade || '—');
  setText('carsModalComplectation', car.complectation || '—');
  setText('carsModalYear', car.year || '—');
  setText('carsModalEngine', car.engine || '—');
  setText('carsModalMileage', car.mileage || '—');
  setText('carsModalDrive', car.drive || '—');
  setText('carsModalGearbox', car.gearbox || '—');

  const photo = document.getElementById('carsModalPhoto');
  if (photo) {
    photo.src = car.image || '/site/img/logoIcon.png';
    photo.alt = car.title || 'Автомобиль';
  }

  const auction = document.getElementById('carsModalAuction');
  if (auction) {
    auction.href = car.auction || '#';
    auction.style.display =
      car.auction && car.auction !== '#' ? 'inline-flex' : 'none';
  }

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCarModal() {
  const modal = document.getElementById('carsModal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document
  .querySelector('.cars-card__modal-close')
  ?.addEventListener('click', closeCarModal);
document
  .querySelector('.cars-card__modal-overlay')
  ?.addEventListener('click', closeCarModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCarModal();
});

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
