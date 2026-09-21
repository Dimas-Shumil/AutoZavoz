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
    <img src="/site/img/MAX.svg" alt="" aria-hidden="true" />
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
