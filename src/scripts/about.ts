/* About page. The hero's photo drift is pure CSS; this pauses it while the hero is off screen. */
const hero = document.querySelector<HTMLElement>('[data-drift]');
if (hero) {
  new IntersectionObserver(([entry]) => hero.classList.toggle('is-paused', !entry.isIntersecting)).observe(hero);
  document.addEventListener('visibilitychange', () => hero.classList.toggle('is-paused', document.hidden));
}

/* Fast facts: each number counts up from zero as the row arrives, easing out so it lands softly */
const counters = document.querySelector<HTMLElement>('[data-count]');
if (counters && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const nums = Array.from(counters.querySelectorAll<HTMLElement>('[data-count-to]'));
  nums.forEach((n) => { n.textContent = '0'; });
  new IntersectionObserver(([entry], io) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start - 150) / 1400);
      const e = t <= 0 ? 0 : 1 - Math.pow(1 - t, 3);
      nums.forEach((n) => { n.textContent = String(Math.round(Number(n.dataset.countTo) * e)); });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.4 }).observe(counters);
}
