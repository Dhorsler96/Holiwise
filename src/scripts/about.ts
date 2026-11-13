/* About page. The hero's photo drift is pure CSS; this only pauses it while the
   hero is off screen, so it never costs anything further down the page. */
const hero = document.querySelector<HTMLElement>('[data-drift]');
if (hero) {
  new IntersectionObserver(([entry]) => hero.classList.toggle('is-paused', !entry.isIntersecting)).observe(hero);
  document.addEventListener('visibilitychange', () => hero.classList.toggle('is-paused', document.hidden));
}
