/* About page. The hero's photo drift is pure CSS; this pauses it while the hero is
   off screen, and adds a subtle pointer depth: the photo layers lean away from the
   cursor by their depth (the faint back layer least), the words a touch the other way. */
const hero = document.querySelector<HTMLElement>('[data-drift]');
if (hero) {
  new IntersectionObserver(([entry]) => hero.classList.toggle('is-paused', !entry.isIntersecting)).observe(hero);
  document.addEventListener('visibilitychange', () => hero.classList.toggle('is-paused', document.hidden));

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine && !still) {
    let tx = 0, ty = 0; // where the pointer is, -1 to 1 from the centre
    let x = 0, y = 0;   // where the layers are, easing towards it
    let frame = 0;
    const step = () => {
      // Ease about 8% of the way each frame: soft to start, settles without a bounce
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      hero.style.setProperty('--mx', x.toFixed(4));
      hero.style.setProperty('--my', y.toFixed(4));
      frame = Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001 ? requestAnimationFrame(step) : 0;
    };
    const run = () => { if (!frame) frame = requestAnimationFrame(step); };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      run();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; run(); });
  }
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

/* Office addresses: copy to the clipboard, the button confirming for a moment */
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
  const label = btn.querySelector<HTMLElement>('[data-copy-label]')!;
  const idle = label.textContent;
  let timer = 0;
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy!;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: copy through a hidden field
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    label.textContent = 'Copied';
    btn.classList.add('is-copied');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { label.textContent = idle; btn.classList.remove('is-copied'); }, 1800);
  });
});
