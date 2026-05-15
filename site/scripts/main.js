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

  mobileLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

function closeMenu() {
  burger.classList.remove('active');
  mobileMenu.classList.remove('active');
  overlay.classList.remove('active');
  document.body.classList.remove('menu-open');
}

if (header) {
  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateHeader = () => {
    const currentScrollY = window.scrollY;

    // сжатие хедера после прокрутки
    if (currentScrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // если мобильное меню открыто — не скрываем хедер
    if (document.body.classList.contains('menu-open')) {
      header.classList.remove('header--hidden');
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    // в самом верху страницы хедер всегда виден
    if (currentScrollY <= 10) {
      header.classList.remove('header--hidden');
    }
    // скроллим вниз — прячем
    else if (currentScrollY > lastScrollY && currentScrollY > 100) {
      header.classList.add('header--hidden');
    }
    // скроллим вверх — показываем
    else if (currentScrollY < lastScrollY) {
      header.classList.remove('header--hidden');
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  });
}

// 3. Плавный скролл к секциям

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      const href = this.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      const headerHeight = header?.offsetHeight || 0;
      const topOffset = headerHeight + 20;

      const topPos =
        target.getBoundingClientRect().top + window.pageYOffset - topOffset;

      window.scrollTo({
        top: topPos,
        behavior: 'smooth',
      });

      if (document.body.classList.contains('menu-open')) {
        closeMenu();
      }
    });
  });
});

// модалка карточки карс
const cards = document.querySelectorAll('.cars-card');
const modal = document.getElementById('carsModal');

if (cards.length && modal) {
  const modalOverlay = modal.querySelector('.cars-card__modal-overlay');
  const modalClose = modal.querySelector('.cars-card__modal-close');

  const modalPhoto = document.getElementById('carsModalPhoto');
  const modalBadge = document.getElementById('carsModalBadge');
  const modalTitle = document.getElementById('carsModalTitle');
  const modalPrice = document.getElementById('carsModalPrice');
  const modalGrade = document.getElementById('carsModalGrade');
  const modalComplectation = document.getElementById('carsModalComplectation');
  const modalYear = document.getElementById('carsModalYear');
  const modalEngine = document.getElementById('carsModalEngine');
  const modalMileage = document.getElementById('carsModalMileage');
  const modalDrive = document.getElementById('carsModalDrive');
  const modalGearbox = document.getElementById('carsModalGearbox');
  const modalAuction = document.getElementById('carsModalAuction');

  function openModal(card) {
    const {
      title,
      price,
      badge,
      grade,
      complectation,
      year,
      engine,
      mileage,
      drive,
      gearbox,
      auction,
      image,
    } = card.dataset;

    modalTitle.textContent = title || 'Автомобиль';
    modalPrice.textContent = price || 'Цена уточняется';
    modalBadge.textContent = badge || 'Под заказ';
    modalGrade.textContent = grade || '—';

    if (modalComplectation) {
      modalComplectation.textContent = complectation || '—';
    }
    modalYear.textContent = year || '—';
    modalEngine.textContent = engine || '—';
    modalMileage.textContent = mileage || '—';
    modalDrive.textContent = drive || '—';
    modalGearbox.textContent = gearbox || '—';

    modalAuction.setAttribute('href', auction || '#');

    if (modalPhoto) {
      modalPhoto.src = image || '../img/car.png';
      modalPhoto.alt = title || 'Автомобиль';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      openModal(card);
    });
  });

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

// SWIPER + раскрытие текста в отзывах

const reviewsSwiper = new Swiper('.otzyvy-slider', {
  slidesPerView: 3,
  spaceBetween: 24,
  loop: true,
  speed: 800,
  autoHeight: false,

  navigation: {
    nextEl: '.otzyvy-button-next',
    prevEl: '.otzyvy-button-prev',
  },

  breakpoints: {
    0: {
      slidesPerView: 1.1,
      spaceBetween: 14,
    },
    480: {
      slidesPerView: 1.2,
      spaceBetween: 16,
    },
    768: {
      slidesPerView: 2,
      spaceBetween: 18,
    },
    1200: {
      slidesPerView: 3,
      spaceBetween: 24,
    },
  },

  on: {
    init() {
      initReviewToggles();
    },
  },
});

function initReviewToggles() {
  const reviewCards = document.querySelectorAll('.otzyvy-card');

  reviewCards.forEach((card) => {
    if (card.dataset.ready === 'true') return;
    card.dataset.ready = 'true';

    const text = card.querySelector('.otzyvy-card__text');
    const toggle = card.querySelector('.otzyvy-card__toggle');

    if (!text || !toggle) return;

    const updateState = () => {
      const wasOpen = card.classList.contains('is-open');

      if (wasOpen) {
        card.classList.remove('is-open');
        toggle.textContent = 'Читать больше';
        toggle.setAttribute('aria-expanded', 'false');
      }

      card.classList.remove('is-short');

      const isOverflowing = text.scrollHeight > text.clientHeight + 2;

      if (!isOverflowing) {
        card.classList.add('is-short');
      }

      if (wasOpen && !card.classList.contains('is-short')) {
        card.classList.add('is-open');
        toggle.textContent = 'Свернуть';
        toggle.setAttribute('aria-expanded', 'true');
      }
    };

    requestAnimationFrame(() => {
      updateState();
      reviewsSwiper.update();
    });

    toggle.addEventListener('click', () => {
      const isOpen = card.classList.toggle('is-open');

      toggle.textContent = isOpen ? 'Свернуть' : 'Читать больше';
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

      setTimeout(() => {
        reviewsSwiper.update();
      }, 50);
    });

    window.addEventListener('resize', updateState);
  });
}

reviewsSwiper.on('slideChangeTransitionEnd', () => {
  reviewsSwiper.update();
});

// FAQ

document.addEventListener('DOMContentLoaded', () => {
  const faqItems = document.querySelectorAll('.faq__item');

  faqItems.forEach((item) => {
    const question = item.querySelector('.faq__question');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach((faqItem) => {
        faqItem.classList.remove('active');
      });

      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
});

// сборка номера
const phoneInput = document.querySelector('input[name="phone"]');

if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');

        if (value === '') {
            e.target.value = '';
            return;
        }

        if (value[0] === '8') {
            value = '7' + value.slice(1);
        } else if (value[0] !== '7') {
            value = '7' + value;
        }

        value = value.slice(0, 11);

        let result = '+7';

        if (value.length > 1) result += ' (' + value.slice(1, 4);
        if (value.length >= 5) result += ') ' + value.slice(4, 7);
        if (value.length >= 8) result += '-' + value.slice(7, 9);
        if (value.length >= 10) result += '-' + value.slice(9, 11);

        e.target.value = result;
    });
}
//  форма

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const submitBtn = form.querySelector('.contact-form__btn');
  const notice = document.getElementById('formNotice');
  const noticeClose = document.getElementById('formNoticeClose');
  const noticeTitle = notice?.querySelector('.contact-form-notice__title');
  const noticeDescr = notice?.querySelector('.contact-form-notice__descr');
  const noticeIcon = notice?.querySelector('.contact-form-notice__icon');

  if (
    !submitBtn ||
    !notice ||
    !noticeClose ||
    !noticeTitle ||
    !noticeDescr ||
    !noticeIcon
  ) {
    console.error('Не найдены элементы формы или уведомления.');
    return;
  }

  const originalBtnText = submitBtn.textContent;
  const formStartTime = Date.now();

  let isSubmitting = false;
  let noticeTimer = null;

  const showNotice = (type, title, text) => {
    notice.classList.remove('contact-form-notice--error', 'show');

    if (type === 'error') {
      notice.classList.add('contact-form-notice--error');
      noticeIcon.textContent = '!';
    } else {
      noticeIcon.textContent = '✓';
    }

    noticeTitle.textContent = title;
    noticeDescr.textContent = text;
    notice.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      notice.classList.add('show');
    });

    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.classList.remove('show');
      notice.setAttribute('aria-hidden', 'true');
    }, 4000);
  };

  noticeClose.addEventListener('click', () => {
    notice.classList.remove('show');
    notice.setAttribute('aria-hidden', 'true');
    clearTimeout(noticeTimer);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    const phoneInput = form.querySelector('input[name="phone"]');
    const emailInput = form.querySelector('input[name="email"]');
    const carInput = form.querySelector('input[name="car"]');
    const commentInput = form.querySelector('textarea[name="comment"]');
    const companyInput = form.querySelector('input[name="company"]');

    const phone = phoneInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const car = carInput?.value.trim() || '';
    const comment = commentInput?.value.trim() || '';
    const company = companyInput?.value.trim() || '';

    if (!phone || !email) {
      showNotice('error', 'Ошибка формы', 'Заполните телефон и email.');
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'ОТПРАВКА...';

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phone,
          email,
          car,
          comment,
          company,
          page: window.location.href,
          form_time: formStartTime,
        }),
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok && data?.success) {
        showNotice(
          'success',
          'Заявка отправлена',
          data.message || 'Мы свяжемся с вами в ближайшее время.',
        );

        form.reset();
      } else {
        showNotice(
          'error',
          'Ошибка отправки',
          data?.message || 'Не удалось отправить форму. Попробуйте еще раз.',
        );
      }
    } catch (error) {
      console.error('Form send error:', error);

      showNotice(
        'error',
        'Ошибка соединения',
        'Проверьте интернет и попробуйте снова.',
      );
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
});
