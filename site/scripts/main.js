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

// =========================
// 3. Плавный скролл к секциям
// =========================
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
