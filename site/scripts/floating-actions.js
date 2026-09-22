document.addEventListener('DOMContentLoaded', () => {
  const footer = document.querySelector('.footer');

  const isHomePage =
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/index.html');

  const formHref = isHomePage ? '#form' : '/#form';

  const actions = document.createElement('div');

  actions.className = 'floating-actions';
  actions.setAttribute('aria-label', 'Быстрые действия');

actions.innerHTML = `
  <a
    class="floating-actions__button floating-actions__button--primary"
    href="https://max.ru/join/QFkmT692hPqa-LyEp2NVgbnrvVFBLAH5ETSlnUm_1AY"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Написать в MAX АвтоЗавоз19"
    title="Написать в MAX"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect
            x="9"
            y="3"
            width="6"
            height="4"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <path
            d="M9 12h6M9 16h4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
  </a>

  <a
    class="floating-actions__button floating-actions__button--glass"
    href="tel:+79339943070"
    aria-label="Позвонить в АвтоЗавоз19"
    title="Позвонить"
  >
    <img src="/site/img/phone.webp" alt="" aria-hidden="true" />
  </a>
`;

  if (footer) {
    footer.before(actions);
  } else {
    document.body.append(actions);
  }

  let footerVisible = false;

  const updateVisibility = () => {
    const shouldShow =
      window.scrollY > 20 &&
      !footerVisible;

    actions.classList.toggle('floating-actions--visible', shouldShow);
  };

  if (footer && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        footerVisible = entry.isIntersecting;
        updateVisibility();
      },
      {
        threshold: 0.05,
      },
    );

    observer.observe(footer);
  }

  window.addEventListener('scroll', updateVisibility, {
    passive: true,
  });

  updateVisibility();
});
