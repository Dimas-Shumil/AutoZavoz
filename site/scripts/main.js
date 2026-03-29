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

    mobileLinks.forEach(link => {
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
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            const href = this.getAttribute('href');
            if (!href || href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            const headerHeight = header?.offsetHeight || 0;
            const topOffset = headerHeight + 20;

            const topPos = target.getBoundingClientRect().top + window.pageYOffset - topOffset;

            window.scrollTo({
                top: topPos,
                behavior: 'smooth'
            });

            if (burger && nav && nav.classList.contains('active')) {
                burger.classList.remove('active');
                nav.classList.remove('active');
            }
        });
    });
});

// модалка секции cars
const cards = document.querySelectorAll('.cars-card');
const modals = document.querySelectorAll('.cars-card__modal');

// открыть
cards.forEach(card => {
    card.addEventListener('click', () => {
        const id = card.dataset.id;

        const modal = document.querySelector(`.cars-card__modal[data-id="${id}"]`);
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

// закрытие
modals.forEach(modal => {
    const closeBtn = modal.querySelector('.cars-card__modal-close');
    const overlay = modal.querySelector('.cars-card__modal-overlay');

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (overlay) {
        overlay.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
});

// SWIPER

const reviewsSwiper = new Swiper('.otzyvy-slider', {
    slidesPerView: 3,
    spaceBetween: 24,
    loop: true,
    speed: 800,

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
        }
    }
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

    if (!submitBtn || !notice || !noticeClose || !noticeTitle || !noticeDescr || !noticeIcon) {
        console.error('Не найдены элементы формы или уведомления.');
        return;
    }

    const originalBtnText = submitBtn.textContent;
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
        const commentInput = form.querySelector('textarea[name="comment"]');
        const botcheckInput = form.querySelector('input[name="botcheck"]');

        const phone = phoneInput?.value.trim() || '';
        const email = emailInput?.value.trim() || '';
        const comment = commentInput?.value.trim() || '';

        if (!phone || !email) {
            showNotice('error', 'Ошибка формы', 'Заполните телефон и email.');
            return;
        }

        if (botcheckInput && botcheckInput.checked) {
            showNotice('error', 'Ошибка отправки', 'Проверка не пройдена.');
            return;
        }

        isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'ОТПРАВКА...';

        try {
            const formData = new FormData(form);

            // Дополнительные поля для письма
            formData.set('subject', 'Новая заявка с сайта');
            formData.set('from_name', 'Форма обратной связи');
            formData.set('replyto', email);
            formData.set(
                'message',
                `Телефон: ${phone}\nEmail: ${email}\nКомментарий: ${comment || 'Не указан'}`
            );

            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    Accept: 'application/json'
                },
                body: formData
            });

            const data = await response.json();
            console.log('Web3Forms response:', data);

            if (response.ok && data.success) {
                showNotice(
                    'success',
                    'Заявка отправлена',
                    'Мы свяжемся с вами в ближайшее время.'
                );
                form.reset();
            } else {
                showNotice(
                    'error',
                    'Ошибка отправки',
                    data.message || 'Не удалось отправить форму. Попробуйте еще раз.'
                );
            }
        } catch (error) {
            console.error('Web3Forms error:', error);
            showNotice(
                'error',
                'Ошибка соединения',
                'Проверьте интернет и попробуйте снова.'
            );
        } finally {
            isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
});