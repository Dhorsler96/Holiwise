/* Holiwise homepage interactions. No dependencies. */

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(sel: string, el: ParentNode = document) => el.querySelector<T>(sel);
const $$ = <T extends HTMLElement>(sel: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(sel));
const nextFrame = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

/* ---------- Text transitions (Calligraph) ----------
   Field values, the Where label and the guest counters morph between states:
   shared characters slide, new ones fade in, digits roll. Calligraph needs React and Motion,
   so it loads once the page is idle; until then, and under reduced motion, text swaps instantly. */
type Morpher = { set: (text: string) => void };
const morphers = new Map<HTMLElement, Morpher>();
const setText = (el: HTMLElement, text: string) => {
  const m = morphers.get(el);
  if (m) m.set(text);
  else el.textContent = text;
};
if (!reduceMotion) {
  const load = () => import('./calligraph').then(({ morph }) => {
    for (const el of $$('[data-value], [data-where-label]')) morphers.set(el, morph(el, { animation: 'snappy' }));
    for (const el of $$('.stepper output')) morphers.set(el, morph(el, { variant: 'number', animation: 'snappy' }));
  });
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 });
  else window.setTimeout(load, 1200);
}

/* ---------- Page load ---------- */
nextFrame(() => root.classList.add('is-loaded'));
window.setTimeout(() => root.classList.add('is-settled'), 1600);

const heroVideo = $<HTMLVideoElement>('[data-hero-video]');
if (heroVideo && !reduceMotion) {
  heroVideo.addEventListener('canplay', () => heroVideo.classList.add('is-ready'), { once: true });
  heroVideo.play().catch(() => {});
}

/* ---------- Scroll reveals: once, then the observer lets go ---------- */
const observers = new Map<number, IntersectionObserver>();
for (const el of $$('[data-inview]')) {
  const threshold = Number(el.dataset.threshold ?? 0.15);
  if (!observers.has(threshold)) {
    observers.set(
      threshold,
      new IntersectionObserver(
        (entries, io) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        },
        { threshold, rootMargin: '0px 0px -8% 0px' },
      ),
    );
  }
  observers.get(threshold)!.observe(el);
}

/* ---------- Hover: buttons take a rising fill and a rolling label ---------- */
const makeRoll = (text: string) => {
  const roll = document.createElement('span');
  roll.className = 'roll';
  const inner = document.createElement('span');
  inner.className = 'roll__text';
  inner.dataset.text = text;
  inner.textContent = text;
  roll.append(inner);
  return roll;
};
for (const btn of $$('.btn')) {
  const fill = document.createElement('span');
  fill.className = 'btn__fill';
  fill.setAttribute('aria-hidden', 'true');
  // The search button swaps its own label to "Sent", so it only takes the fill.
  if (!btn.matches('[data-submit]')) btn.replaceChildren(makeRoll(btn.textContent!.trim()));
  btn.prepend(fill);
  btn.classList.add('is-rolling');
}
// Text links don't roll: they draw an underline (CSS only).

/* ---------- Scroll themes: the section across the middle of the viewport sets the page palette ---------- */
const themed = $$('[data-theme]');
if (themed.length) {
  document.body.dataset.theme = themed[0].dataset.theme!;
  const themeIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) document.body.dataset.theme = (entry.target as HTMLElement).dataset.theme!;
      }
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );
  themed.forEach((el) => themeIO.observe(el));
}

/* ---------- Nav: solid after the fold, tucks away on the way down ---------- */
const nav = $('[data-nav]');
if (nav) {
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const delta = y - lastY;
    nav.classList.toggle('is-solid', y > 40);
    if (Math.abs(delta) > 4) {
      const hide = delta > 0 && y > window.innerHeight * 0.8 && !nav.contains(document.activeElement);
      nav.classList.toggle('is-hidden', hide);
      lastY = y;
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------- Input modality: keyboard-initiated actions never animate ---------- */
let keyboard = false;
window.addEventListener('keydown', () => { keyboard = true; }, true);
window.addEventListener('pointerdown', () => { keyboard = false; }, true);

/* ---------- Search ---------- */
const search = $<HTMLFormElement>('[data-search]');
if (search) {
  const fields = $$('.field[data-field]', search);
  const tell = $<HTMLTextAreaElement>('[data-tell]', search)!;
  let open: HTMLElement | null = null;

  const instantly = (fn: () => void) => {
    search.setAttribute('data-instant', '');
    fn();
    nextFrame(() => search.removeAttribute('data-instant'));
  };

  const setOpen = (field: HTMLElement | null, instant = false) => {
    if (field === open) return;
    const apply = () => {
      for (const f of fields) {
        const on = f === field;
        f.classList.toggle('is-open', on);
        $('.field__btn', f)?.setAttribute('aria-expanded', String(on));
      }
      search.classList.toggle('is-open', Boolean(field));
      // Freeze the page behind an open popover, keeping the scrollbar's space so nothing shifts
      if (field && !root.classList.contains('is-locked')) root.style.setProperty('--sbw', `${window.innerWidth - root.clientWidth}px`);
      root.classList.toggle('is-locked', Boolean(field));
    };
    // Switching between fields, or opening with the keyboard, skips the animation.
    if (instant || (open && field)) instantly(apply); else apply();
    open = field;
  };

  /** Morph a field value to its new text. */
  const setValue = (field: HTMLElement, text: string, isDefault = false) => {
    const value = $('[data-value]', field)!;
    if (field.dataset.current === text) return;
    setText(value, text);
    value.classList.toggle('is-set', !isDefault);
    field.dataset.current = text;
  };

  for (const field of fields) {
    const btn = $<HTMLButtonElement>('.field__btn', field)!;
    const pop = $('.pop', field)!;
    btn.addEventListener('click', () => {
      const willOpen = open !== field;
      setOpen(willOpen ? field : null, keyboard);
      if (willOpen && keyboard) $<HTMLElement>('button', pop)?.focus();
    });
    pop.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (e.target instanceof HTMLTextAreaElement) return;
      const items = $$<HTMLButtonElement>('button:not(:disabled)', pop);
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      items[(i + dir + items.length) % items.length]?.focus();
      e.preventDefault();
    });
  }

  // Where
  const where = fields.find((f) => f.dataset.field === 'where')!;
  $$('[data-opt]', where).forEach((opt, i) => opt.addEventListener('click', () => {
    $$('[data-opt]', where).forEach((o) => o.setAttribute('aria-selected', String(o === opt)));
    setValue(where, opt.dataset.opt!, i === 0);
    setOpen(null, keyboard);
    $<HTMLElement>('.field__btn', where)!.focus({ preventScroll: true });
  }));

  // When
  const when = fields.find((f) => f.dataset.field === 'when')!;
  $$('[data-opt]', when).forEach((chip, i) => chip.addEventListener('click', () => {
    $$('[data-opt]', when).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    setValue(when, chip.dataset.opt!, i === 0);
    setOpen(null, keyboard);
    $<HTMLElement>('.field__btn', when)!.focus({ preventScroll: true });
  }));

  // Who
  const who = fields.find((f) => f.dataset.field === 'who')!;
  const counts: Record<string, number> = {};
  const syncWho = () => {
    const guests = counts.adults + counts.children;
    const text = `${guests} guest${guests === 1 ? '' : 's'}${counts.rooms > 1 ? ` · ${counts.rooms} rooms` : ''}`;
    setText($('[data-value]', who)!, text);
    $('[data-value]', who)!.classList.toggle('is-set', text !== '2 guests');
    who.dataset.current = text;
  };
  for (const step of $$('[data-step]', who)) {
    const key = step.dataset.step!;
    const min = Number(step.dataset.min);
    const out = $('output', step)!;
    const [minus, plus] = $$<HTMLButtonElement>('button', step);
    counts[key] = Number(out.textContent);
    const sync = () => { setText(out, String(counts[key])); minus.disabled = counts[key] <= min; plus.disabled = counts[key] >= 9; };
    for (const b of [minus, plus]) b.addEventListener('click', () => { counts[key] = Math.min(9, Math.max(min, counts[key] + Number(b.dataset.dir))); sync(); syncWho(); });
    sync();
  }

  document.addEventListener('pointerdown', (e) => { if (open && !open.contains(e.target as Node)) setOpen(null); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    const btn = $<HTMLElement>('.field__btn', open)!;
    setOpen(null, true);
    btn.focus({ preventScroll: true });
  });
  search.addEventListener('focusout', (e) => {
    const to = e.relatedTarget as Node | null;
    if (open && to && !open.contains(to)) setOpen(null, true);
  });

  // Tabs: a clipped duplicate layer slides between tabs, so the colour change is one wipe.
  const tabs = $('[data-tabs]');
  if (tabs) {
    const tabButtons = $$<HTMLButtonElement>('.tabs__tab', tabs);
    const layer = $('.tabs__active', tabs)!;
    const place = (btn: HTMLElement, animate: boolean) => {
      const right = Math.max(0, tabs.offsetWidth - btn.offsetLeft - btn.offsetWidth);
      layer.style.transitionDuration = animate ? '' : '0ms';
      layer.style.clipPath = `inset(0 ${right}px 0 ${btn.offsetLeft}px round 4px)`;
    };
    const select = (btn: HTMLButtonElement, animate: boolean) => {
      tabButtons.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      place(btn, animate);
      const flights = btn.dataset.tab === 'flights';
      setText($('[data-where-label]', where)!, flights ? 'From → To' : 'Where');
      const current = where.dataset.current;
      if (!current || current === 'Anywhere' || current === 'London → Anywhere') setValue(where, flights ? 'London → Anywhere' : 'Anywhere', true);
    };
    tabButtons.forEach((btn) => btn.addEventListener('click', () => select(btn, !keyboard && !reduceMotion)));
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = tabButtons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
      const next = tabButtons[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length];
      next.focus(); select(next, false);
    });
    const current = () => tabButtons.find((b) => b.getAttribute('aria-selected') === 'true')!;
    place(current(), false);
    document.fonts?.ready.then(() => place(current(), false));
    window.addEventListener('resize', () => place(current(), false));
  }

  // "Or just tell us": a panel to write the brief, with suggestions; the field shows what was written.
  const tellField = fields.find((f) => f.dataset.field === 'tell')!;
  const tellValue = $('[data-tell-value]', tellField)!;
  const suggests = $$<HTMLButtonElement>('[data-suggest]', tellField);
  const ghost = $('[data-ghost]', search)!;
  const examples: string[] = JSON.parse(ghost.dataset.examples || '[]');
  let example = 0;
  const syncGhost = () => {
    const brief = tell.value.trim().replace(/\s+/g, ' ');
    tellValue.textContent = brief ? `“${brief}”` : '';
    tellValue.classList.toggle('is-set', Boolean(brief));
    ghost.classList.toggle('is-hidden', Boolean(brief));
    const lower = tell.value.toLowerCase();
    for (const chip of suggests) chip.setAttribute('aria-pressed', String(lower.includes(chip.dataset.suggest!.toLowerCase())));
  };
  tell.addEventListener('input', syncGhost);
  const focusBrief = () => { tell.focus({ preventScroll: true }); tell.setSelectionRange(tell.value.length, tell.value.length); };
  $('.field__btn', tellField)!.addEventListener('click', () => { if (open === tellField) focusBrief(); });
  for (const chip of suggests) chip.addEventListener('click', () => {
    const text = chip.dataset.suggest!;
    const pressed = chip.getAttribute('aria-pressed') === 'true';
    if (pressed) {
      // Take the suggestion back out, along with the separator it brought
      const i = tell.value.toLowerCase().indexOf(text.toLowerCase());
      tell.value = (tell.value.slice(0, i) + tell.value.slice(i + text.length)).replace(/^[\s,]+|[\s,]+$/g, '').replace(/,\s*,/g, ',');
    } else {
      tell.value = tell.value.trim() ? `${tell.value.trim().replace(/[,.]$/, '')}, ${text.toLowerCase()}` : text;
    }
    syncGhost();
    focusBrief();
  });
  $('[data-tell-reset]', tellField)!.addEventListener('click', () => { tell.value = ''; syncGhost(); focusBrief(); });
  const closeBrief = () => { setOpen(null, keyboard); $<HTMLElement>('.field__btn', tellField)!.focus({ preventScroll: true }); };
  $('[data-tell-done]', tellField)!.addEventListener('click', closeBrief);
  tell.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeBrief(); } });
  if (examples.length > 1 && !reduceMotion) {
    window.setInterval(() => {
      if (document.hidden || tell.value || open === tellField) return;
      ghost.classList.add('is-out');
      window.setTimeout(() => {
        example = (example + 1) % examples.length;
        ghost.textContent = `“${examples[example]}”`;
        ghost.classList.remove('is-out');
      }, 150);
    }, 3600);
  }

  const focusTell = (prefill?: string) => {
    if (prefill !== undefined) { tell.value = prefill; syncGhost(); }
    const open = () => { setOpen(tellField, true); focusBrief(); };
    if (window.scrollY < 2 || reduceMotion) { window.scrollTo({ top: 0 }); open(); return; }
    // Scroll up first; the panel (and the scroll lock) waits until the page has arrived
    let done = false;
    const finish = () => { if (!done) { done = true; open(); } };
    window.addEventListener('scrollend', finish, { once: true });
    window.setTimeout(finish, 900);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  for (const link of $$('[data-focus-tell]')) link.addEventListener('click', (e) => { e.preventDefault(); focusTell(); });
  for (const link of $$('[data-ask]')) link.addEventListener('click', (e) => {
    e.preventDefault();
    const opt = $$('[data-opt]', where).find((o) => o.dataset.opt === link.dataset.ask);
    $$('[data-opt]', where).forEach((o) => o.setAttribute('aria-selected', String(o === opt)));
    setValue(where, link.dataset.ask!);
    focusTell();
  });

  // Submit: confirm in place, then a toast. (Front-end only for now: nothing is sent anywhere.)
  const submit = $<HTMLButtonElement>('[data-submit]', search)!;
  const toast = $('[data-toast]')!;
  let toastTimer = 0;
  let toastLeft = 0;
  let toastStart = 0;
  const hideToast = () => toast.classList.remove('is-on');
  const runToast = (ms: number) => { window.clearTimeout(toastTimer); toastLeft = ms; toastStart = performance.now(); toastTimer = window.setTimeout(hideToast, ms); };
  const pauseToast = () => { window.clearTimeout(toastTimer); toastLeft = Math.max(1200, toastLeft - (performance.now() - toastStart)); };
  toast.addEventListener('pointerenter', pauseToast);
  toast.addEventListener('pointerleave', () => runToast(toastLeft));
  document.addEventListener('visibilitychange', () => {
    if (!toast.classList.contains('is-on')) return;
    if (document.hidden) pauseToast(); else runToast(toastLeft);
  });

  search.addEventListener('submit', (e) => {
    e.preventDefault();
    setOpen(null, true);
    const parts = [where.dataset.current || 'Anywhere', when.dataset.current || 'Any dates', who.dataset.current || '2 guests'];
    $('[data-toast-body]', toast)!.textContent = tell.value.trim() ? `“${tell.value.trim()}”` : parts.join(' · ');
    $('[data-toast-title]', toast)!.textContent = 'Leave it with us. Your agent will send three options.';
    submit.classList.add('is-sent');
    window.setTimeout(() => submit.classList.remove('is-sent'), 1800);
    toast.classList.add('is-on');
    runToast(4500);
  });
}

/* ---------- Carousel: loops, drag with momentum, snaps to a card ---------- */
const carousel = $('[data-carousel]');
if (carousel) {
  const track = $('[data-track]', carousel)!;
  const cards = $$('.card', track);
  const n = Number(track.dataset.count) || cards.length; // cards are rendered as three copies
  const prev = $<HTMLButtonElement>('[data-prev]');
  const next = $<HTMLButtonElement>('[data-next]');
  let index = n; // start on the first card of the middle copy
  let step = 0;
  let settle = 0;

  const measure = () => { step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth; };
  const currentX = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
  const setX = (x: number, duration = 0) => {
    track.style.transition = duration && !reduceMotion ? `transform ${duration}ms cubic-bezier(0.32, 0.72, 0, 1)` : 'none';
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  };
  const wrap = (i: number) => ((i % n) + n) % n;
  // Every copy of the current card is marked active, so hopping between copies is invisible.
  const markActive = () => cards.forEach((card, k) => card.classList.toggle('is-active', k % n === wrap(index)));
  // After a move ends, hop back into the middle copy without animation.
  const recentre = () => {
    if (index >= n && index < 2 * n) return;
    index = wrap(index) + n;
    setX(-index * step);
  };
  const goTo = (i: number, duration = 560) => {
    window.clearTimeout(settle);
    index = i;
    setX(-index * step, duration);
    markActive();
    settle = window.setTimeout(recentre, reduceMotion ? 0 : duration + 20);
  };

  measure();
  goTo(index, 0);
  window.addEventListener('resize', () => { measure(); recentre(); setX(-index * step); });
  prev?.addEventListener('click', () => goTo(index - 1, keyboard ? 0 : 560));
  next?.addEventListener('click', () => goTo(index + 1, keyboard ? 0 : 560));
  carousel.addEventListener('keydown', (e) => {
    if (e.target !== carousel) return;
    if (e.key === 'ArrowRight') { goTo(index + 1, 0); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { goTo(index - 1, 0); e.preventDefault(); }
  });

  let pointerId: number | null = null;
  let dragging = false;
  let startPointer = 0;
  let startX = 0;
  let samples: { x: number; t: number }[] = [];

  carousel.addEventListener('pointerdown', (e) => {
    if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return; // ignore extra touches
    pointerId = e.pointerId;
    dragging = false;
    startPointer = e.clientX;
    window.clearTimeout(settle);
    // Pick the track up wherever it is, even mid-animation, shifted into the middle copy.
    const x = currentX();
    const at = Math.round(-x / step);
    startX = at < n ? x - n * step : at >= 2 * n ? x + n * step : x;
    index = Math.round(-startX / step);
    setX(startX);
    samples = [{ x: e.clientX, t: e.timeStamp }];
  });

  carousel.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startPointer;
    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      dragging = true;
      carousel.setPointerCapture(e.pointerId);
      carousel.classList.add('is-dragging');
    }
    setX(startX + dx);
    samples.push({ x: e.clientX, t: e.timeStamp });
    if (samples.length > 6) samples.shift();
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!dragging) { goTo(Math.round(-currentX() / step), 300); return; }
    dragging = false;
    carousel.classList.remove('is-dragging');
    const first = samples[0];
    const lastSample = samples[samples.length - 1];
    const dt = Math.max(1, lastSample.t - first.t);
    const velocity = (lastSample.x - first.x) / dt; // px per ms
    const from = Math.round(-startX / step);
    let target = Math.round(-(currentX() + velocity * 220) / step);
    // A quick flick is enough: no need to drag past half a card.
    if (Math.abs(velocity) > 0.11 && target === from) target += velocity < 0 ? 1 : -1;
    goTo(target, 620);
    // The click that follows a drag should not follow a link.
    const swallow = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
    carousel.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => carousel.removeEventListener('click', swallow, true), 50);
  };
  carousel.addEventListener('pointerup', release);
  carousel.addEventListener('pointercancel', release);

  // Trackpads: horizontal swipes move one card at a time.
  let wheelSum = 0;
  let wheelLocked = false;
  let wheelReset = 0;
  carousel.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    window.clearTimeout(wheelReset);
    wheelReset = window.setTimeout(() => { wheelSum = 0; wheelLocked = false; }, 160);
    if (wheelLocked) return;
    wheelSum += e.deltaX;
    if (Math.abs(wheelSum) > 50) { goTo(index + (wheelSum > 0 ? 1 : -1)); wheelLocked = true; wheelSum = 0; }
  }, { passive: false });
}

/* ---------- Final CTA parallax: transform written straight to the element ---------- */
if (!reduceMotion) {
  for (const section of $$('[data-parallax]')) {
    const img = $('[data-parallax-img]', section);
    if (!img) continue;
    let active = false;
    let ticking = false;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2 + rect.height / 2);
      img.style.transform = `translate3d(0, ${(-progress * 8).toFixed(2)}%, 0)`;
      ticking = false;
    };
    new IntersectionObserver(([entry]) => { active = entry.isIntersecting; if (active) update(); }).observe(section);
    window.addEventListener('scroll', () => { if (active && !ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }
}
