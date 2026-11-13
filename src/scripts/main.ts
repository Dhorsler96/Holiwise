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
export const setText = (el: HTMLElement, text: string) => {
  const m = morphers.get(el);
  if (m) m.set(text);
  else el.textContent = text;
};
if (!reduceMotion) {
  const load = () => import('./calligraph').then(({ morph }) => {
    for (const el of $$('[data-value], [data-where-label], [data-submit-label], [data-brief-status], [data-morph]')) morphers.set(el, morph(el, { animation: 'snappy' }));
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
  // Fade the video in once it's actually playing. A cached video can start before this script runs,
  // so check its state as well as listening for the event.
  const ready = () => heroVideo.classList.add('is-ready');
  heroVideo.addEventListener('playing', ready, { once: true });
  heroVideo.play().then(ready).catch(() => {});
  if (!heroVideo.paused && heroVideo.readyState >= 3) ready();
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
  // A section marked data-theme-early takes over as soon as its top edge enters from below,
  // so it never shows the previous section's colour first. Scrolling back up still uses the middle line.
  const earlyIO = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.boundingClientRect.top > 0) document.body.dataset.theme = (entry.target as HTMLElement).dataset.theme!;
    }
  }, { threshold: 0.001 }); // a sliver must show: a section only touching the screen's edge doesn't count
  $$('[data-theme-early]').forEach((el) => earlyIO.observe(el));
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

/* ---------- Brief flow (prototype): the sheet that answers a written brief ---------- */
let openBrief: ((brief: string, parts: string[], returnFocus: HTMLElement, place?: string) => void) | null = null;
const flow = $('[data-brief]');
if (flow) {
  const sheet = $('.brief__sheet', flow)!;
  const quote = $('[data-brief-quote]', flow)!;
  const tags = $('[data-brief-tags]', flow)!;
  const status = $('[data-brief-status]', flow)!;
  const bar = $('[data-brief-bar]', flow)!;
  const cards = $$('[data-option]', flow);
  const refine = $<HTMLFormElement>('[data-brief-refine]', flow)!;
  const steps = $$('.brief__step', flow);
  const channels = $$<HTMLButtonElement>('[data-channel]', flow);
  let channel = 'WhatsApp';
  // A short trip gets three options straight away. A long one (8+ nights, weeks away, several stops,
  // flights or an occasion) goes to the agent: the sheet says what happens next, how long it takes
  // and where the reply arrives (11 Nov call).
  type Mode = 'options' | 'trip';
  let mode: Mode = 'options';
  let place = '';
  const LONG = /\b(weeks?|fortnight|month|several|stops|multi|tour|road ?trip|itinerary|island[- ]hopping|safari|flights?|occasion|anniversary|honeymoon|wedding|not sure)\b/i;
  const classify = (text: string): Mode => {
    const nights = Number(text.match(/(\d+)\s*nights?/i)?.[1] ?? 0);
    return LONG.test(text) || nights >= 8 ? 'trip' : 'options';
  };
  const on = () => (channel === 'email' ? 'By email' : 'On WhatsApp');
  const fillSteps = () => {
    const rows = [
      ['Albin reads your brief', 'A person, not an algorithm, looks at what you’ve asked for.', 'Now'],
      ['A quick question, if anything’s unclear', 'Usually about budget, rooms or flight times.', on()],
      ['Your itinerary, as a PDF', 'Hotels, flights and prices for the whole trip, ready to book or tweak.', 'Within a few hours'],
    ];
    steps.forEach((li, i) => {
      $('[data-step-title]', li)!.textContent = rows[i][0];
      $('[data-step-text]', li)!.textContent = rows[i][1];
      $('[data-step-when]', li)!.textContent = rows[i][2];
    });
  };
  for (const c of channels) c.addEventListener('click', () => {
    channel = c.dataset.channel!;
    channels.forEach((o) => o.setAttribute('aria-pressed', String(o === c)));
    fillSteps();
  });
  let timers: number[] = [];
  let lastFocus: HTMLElement | null = null;
  let briefText = '';
  let latest = '';
  let round = 0;

  const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, reduceMotion ? 0 : ms)); };
  const clearTimers = () => { timers.forEach(window.clearTimeout); timers = []; };

  // Score each stay by the words in the brief. The latest change counts most, then the Where choice.
  const choose = (text: string, where: string) => {
    const words = `${text} ${where}`.toLowerCase();
    const fresh = latest.toLowerCase();
    const scored = cards.map((card, i) => {
      const cardTags = card.dataset.tags!.split(' ');
      let score = cardTags.filter((t) => words.includes(t)).length + cardTags.filter((t) => fresh.includes(t)).length * 3;
      if (words.includes(card.dataset.option!.toLowerCase())) score += 3;
      if (fresh.includes(card.dataset.option!.toLowerCase())) score += 6;
      return { card, score: score - (round ? ((i + round) % cards.length) * 0.01 : i * 0.01) };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.card);
  };

  const showOptions = (where: string, text: string) => {
    const picks = choose(briefText, where);
    const list = picks[0].parentElement!;
    picks.forEach((card, n) => { card.hidden = false; card.classList.toggle('is-pick', n === 0); card.style.setProperty('--n', String(n)); list.append(card); });
    setText(status, text);
    flow.classList.add('is-done');
    flow.dataset.stage = 'options';
    requestAnimationFrame(() => requestAnimationFrame(() => picks.forEach((c) => c.classList.add('is-in'))));
  };

  const run = (where: string) => {
    clearTimers();
    flow.classList.remove('is-done');
    flow.dataset.stage = 'working';
    cards.forEach((c) => { c.classList.remove('is-in'); c.hidden = true; });
    bar.style.transform = 'scaleX(0)';
    setText(status, 'Reading your brief');
    later(120, () => { bar.style.transform = 'scaleX(0.3)'; });
    if (mode === 'trip') {
      // A long trip goes to the agent: what happens next, how long it takes and where the reply arrives
      later(1100, () => { bar.style.transform = 'scaleX(1)'; });
      later(1700, () => {
        fillSteps();
        setText(status, 'Planning your trip. This takes a few hours.');
        flow.classList.add('is-done');
        flow.dataset.stage = 'handoff';
      });
      return;
    }
    later(1100, () => { setText(status, 'Checking prices and availability'); bar.style.transform = 'scaleX(0.7)'; });
    later(2300, () => { setText(status, 'Choosing three options'); bar.style.transform = 'scaleX(1)'; });
    later(3300, () => showOptions(where, 'Three options, ready when you are'));
  };

  const close = () => {
    clearTimers();
    flow.classList.remove('is-open');
    root.classList.remove('is-locked');
    window.setTimeout(() => { flow.hidden = true; }, reduceMotion ? 0 : 220);
    lastFocus?.focus({ preventScroll: true });
  };

  openBrief = (brief, parts, returnFocus, where = '') => {
    lastFocus = returnFocus;
    briefText = brief;
    place = where;
    mode = classify(brief);
    latest = '';
    round = 0;
    quote.textContent = `“${brief.replace(/[.…]+$/, '')}”`;
    tags.replaceChildren(...parts.map((p) => { const li = document.createElement('li'); li.textContent = p; return li; }));
    root.style.setProperty('--sbw', `${window.innerWidth - root.clientWidth}px`);
    root.classList.add('is-locked');
    flow.hidden = false;
    sheet.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => flow.classList.add('is-open')));
    sheet.focus({ preventScroll: true });
    run(where);
  };

  for (const el of $$('[data-brief-close]', flow)) el.addEventListener('click', close);
  flow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      // Keep focus inside the sheet while it's open
      const focusables = $$<HTMLElement>('button, a[href], input', sheet).filter((el) => !el.closest('[hidden]'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  refine.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = refine.elements.namedItem('refine') as HTMLInputElement;
    const extra = input.value.trim();
    if (!extra) { input.focus(); return; }
    briefText = `${briefText}, ${extra}`;
    latest = extra;
    quote.textContent = `“${briefText.replace(/[.…]+$/, '')}”`;
    input.value = '';
    round++;
    mode = 'options';
    run(place);
  });
}

/* ---------- Search ---------- */
const search = $<HTMLFormElement>('[data-search]');
if (search) {
  const fields = $$('.field[data-field]', search);
  const tell = $<HTMLTextAreaElement>('[data-tell]', search)!;
  // Search is a place and real dates; these are the empty states
  const WHERE_EMPTY = 'Search a city or hotel';
  const FLIGHT_EMPTY = 'London → Where to?';
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
      if (willOpen && keyboard) $<HTMLElement>('input, button', pop)?.focus();
    });
    pop.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || (e.target as Element).closest('.cal')) return;
      const items = $$<HTMLButtonElement>('button:not(:disabled)', pop);
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      items[(i + dir + items.length) % items.length]?.focus();
      e.preventDefault();
    });
  }

  // Where
  const where = fields.find((f) => f.dataset.field === 'where')!;
  $$('[data-opt]', where).forEach((opt) => opt.addEventListener('click', () => {
    if (!opt.dataset.opt) return;
    const picked = opt.hasAttribute('data-opt-custom') ? null : opt;
    $$('[data-opt]', where).forEach((o) => o.setAttribute('aria-selected', String(o === picked)));
    setValue(where, opt.dataset.opt!);
    setOpen(null, keyboard);
    $<HTMLElement>('.field__btn', where)!.focus({ preventScroll: true });
  }));

  // Where: type to filter the list, or use exactly what was typed
  const whereSearch = $<HTMLInputElement>('[data-where-search]', where)!;
  const custom = $<HTMLButtonElement>('[data-opt-custom]', where)!;
  const listed = $$<HTMLButtonElement>('[data-opt]:not([data-opt-custom])', where);
  const whereEmpty = $('[data-where-empty]', where)!;
  const filterWhere = () => {
    const q = whereSearch.value.trim();
    const needle = q.toLowerCase();
    let shown = 0;
    for (const opt of listed) {
      const match = !needle || opt.dataset.opt!.toLowerCase().includes(needle);
      opt.hidden = !match;
      if (match) shown++;
    }
    const exact = listed.some((o) => o.dataset.opt!.toLowerCase() === needle);
    custom.hidden = !q || exact;
    custom.dataset.opt = q;
    custom.innerHTML = '';
    if (q) { custom.append('Use '); const quote = document.createElement('q'); quote.textContent = q; custom.append(quote); }
    whereEmpty.hidden = shown > 0 || !q;
  };
  whereSearch.addEventListener('input', filterWhere);
  whereSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = listed.find((o) => !o.hidden && whereSearch.value.trim()) ?? (custom.hidden ? null : custom);
      (first ?? (!custom.hidden ? custom : null))?.click();
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); $$<HTMLButtonElement>('[data-opt]:not([hidden])', where)[0]?.focus(); }
  });
  $('.field__btn', where)!.addEventListener('click', () => {
    if (open !== where) return;
    whereSearch.value = '';
    filterWhere();
    // Hold the panel at its full size while people type, so filtering never collapses or stretches it
    const pop = $('.pop', where)!;
    pop.style.height = '';
    pop.style.width = '';
    pop.style.height = `${pop.offsetHeight}px`;
    pop.style.width = `${pop.offsetWidth}px`;
    whereSearch.focus({ preventScroll: true });
  });

  const whereSet = () => Boolean(where.dataset.current) && where.dataset.current !== WHERE_EMPTY && where.dataset.current !== FLIGHT_EMPTY;

  // When: an Airbnb-style range calendar in our own style. Two months side by side (one on phones),
  // check-in then check-out, a band joining them, and how flexible the dates are.
  const when = fields.find((f) => f.dataset.field === 'when')!;
  const whenPop = $('.pop', when)!;
  const cal = $('[data-cal]', when)!;
  const months = $('[data-cal-months]', when)!;
  const prev = $<HTMLButtonElement>('[data-cal-prev]', when)!;
  const next = $<HTMLButtonElement>('[data-cal-next]', when)!;
  const nightsLabel = $('[data-nights]', when)!;
  const flexChips = $$<HTMLButtonElement>('[data-flex]', when);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const month = (d: Date) => d.toLocaleString('en-GB', { month: 'short' });
  const range = (a: Date, b: Date) => (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`);
  const today = iso(new Date());
  const firstOfThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let checkIn = '';
  let checkOut = '';
  let flex = 0;
  let view = firstOfThisMonth;
  let hover = '';
  let focusDay = today;
  let dateMode: 'dates' | 'flexible' = 'dates';
  const twoUp = () => window.matchMedia('(min-width: 720px)').matches;

  // Flexible: how long, and which months (pick as many as you like)
  const lengths = $$<HTMLButtonElement>('[data-length]', when);
  const monthTrack = $('[data-months]', when)!;
  const LENGTH: Record<string, { label: string; nights: number }> = { weekend: { label: 'A weekend', nights: 2 }, week: { label: 'A week', nights: 7 }, month: { label: 'A month', nights: 28 } };
  let stayLength = 'week';
  const picked = new Set<string>();
  const nextMonths = Array.from({ length: 12 }, (_, i) => new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth() + i, 1));
  monthTrack.innerHTML = nextMonths.map((m) => `<button class="flexi__month" type="button" aria-pressed="false" data-month="${iso(m).slice(0, 7)}">${'<svg width=\"30\" height=\"30\" viewBox=\"0 0 30 30\" fill=\"none\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"6\" width=\"23\" height=\"20.5\" rx=\"3\" stroke=\"currentColor\" stroke-width=\"1.25\"/><path d=\"M3.5 12h23M10 3.5v5M20 3.5v5\" stroke=\"currentColor\" stroke-width=\"1.25\" stroke-linecap=\"round\"/></svg>'}<b>${m.toLocaleString('en-GB', { month: 'long' })}</b><span>${m.getFullYear()}</span></button>`).join('');
  const listMonths = (style: 'long' | 'short') => nextMonths.filter((m) => picked.has(iso(m).slice(0, 7))).map((m) => m.toLocaleString('en-GB', { month: style }));
  const joinOr = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
  const syncFlexible = () => {
    const len = LENGTH[stayLength];
    if (!picked.size) {
      setText(nightsLabel, 'Choose one or more months');
      delete when.dataset.range;
      setValue(when, 'Add dates', true);
      return;
    }
    const short = listMonths('short');
    const text = `${len.label} in ${short.length > 2 ? `${short.length} months` : joinOr(short)}`;
    setText(nightsLabel, `${len.label}, sometime in ${joinOr(listMonths('long'))}`);
    when.dataset.range = text;
    when.dataset.stay = String(len.nights);
    when.dataset.phrase = `for ${len.label.toLowerCase()}, sometime in ${joinOr(listMonths('long'))}`;
    setValue(when, text);
  };
  for (const b of lengths) b.addEventListener('click', () => {
    stayLength = b.dataset.length!;
    lengths.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    syncFlexible();
  });
  monthTrack.addEventListener('click', (e) => {
    const card = (e.target as Element).closest<HTMLButtonElement>('[data-month]');
    if (!card) return;
    const key = card.dataset.month!;
    if (picked.has(key)) picked.delete(key); else picked.add(key);
    card.setAttribute('aria-pressed', String(picked.has(key)));
    syncFlexible();
  });
  const monthsPrev = $<HTMLButtonElement>('[data-months-prev]', when)!;
  const monthsNext = $<HTMLButtonElement>('[data-months-next]', when)!;
  const syncMonthArrows = () => {
    monthsPrev.disabled = monthTrack.scrollLeft < 4;
    monthsNext.disabled = monthTrack.scrollLeft + monthTrack.clientWidth > monthTrack.scrollWidth - 4;
  };
  const scrollMonths = (dir: number) => monthTrack.scrollBy({ left: dir * monthTrack.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  monthsPrev.addEventListener('click', () => scrollMonths(-1));
  monthsNext.addEventListener('click', () => scrollMonths(1));
  monthTrack.addEventListener('scroll', syncMonthArrows, { passive: true });

  // Dates or Flexible, as one movement: the highlight slides across, the old panel blurs out,
  // the popover eases to its new height and the new panel's rows arrive one after another.
  const modeTabs = $$<HTMLButtonElement>('[data-date-mode]', when);
  const modeSwitch = $('.dates__mode', when)!;
  const panels = $$('[data-date-panel]', when);
  const drawer = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const settle = 'cubic-bezier(0.23, 1, 0.32, 1)';
  let switching: Animation[] = [];
  let swapToken = 0;
  for (const tab of modeTabs) tab.addEventListener('click', async () => {
    const next = tab.dataset.dateMode as 'dates' | 'flexible';
    if (next === dateMode) return;
    dateMode = next;
    modeSwitch.dataset.mode = next;
    modeTabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    const outgoing = panels.find((p) => !p.hidden)!;
    const incoming = panels.find((p) => p.dataset.datePanel === next)!;
    const swap = () => {
      outgoing.hidden = true;
      incoming.hidden = false;
      syncDates();
      if (next === 'flexible') requestAnimationFrame(syncMonthArrows);
    };
    if (reduceMotion) { swap(); placeWhen(); return; }
    // A quick second click takes over from wherever the first one got to
    const token = ++swapToken;
    switching.forEach((a) => a.cancel());
    switching = [];
    const from = whenPop.offsetHeight;
    const out = outgoing.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    switching.push(out);
    try { await out.finished; } catch { return; }
    if (token !== swapToken) return;
    out.cancel();
    swap();
    const to = whenPop.offsetHeight;
    whenPop.style.overflow = 'hidden';
    const grow = whenPop.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 380, easing: drawer });
    switching.push(grow);
    grow.finished.then(() => { whenPop.style.overflow = ''; }, () => { whenPop.style.overflow = ''; });
    [...incoming.children].forEach((row, i) => {
      switching.push((row as HTMLElement).animate(
        [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 320, delay: 60 + i * 50, easing: settle, fill: 'backwards' },
      ));
    });
    placeWhen();
  });

  const renderMonth = (first: Date) => {
    const title = first.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const lead = (first.getDay() + 6) % 7; // weeks start on Monday
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal__pad" aria-hidden="true"></span>';
    const end = checkOut || (checkIn && hover > checkIn ? hover : '');
    for (let d = 1; d <= days; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      const id = iso(date);
      const past = id < today;
      const cls = ['cal__day'];
      if (id === checkIn) cls.push('is-start');
      if (id === checkOut) cls.push('is-end');
      if (checkIn && end && id > checkIn && id < end) cls.push(checkOut ? 'is-range' : 'is-preview');
      if (checkIn && end && id === end && !checkOut) cls.push('is-preview-end');
      if (checkIn && end && id === checkIn) cls.push('has-band');
      if (id === today) cls.push('is-today');
      const label = date.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const state = id === checkIn ? ', check-in' : id === checkOut ? ', check-out' : '';
      cells += `<button type="button" class="${cls.join(' ')}" data-day="${id}" tabindex="${id === focusDay ? 0 : -1}" aria-label="${label}${state}" aria-pressed="${id === checkIn || id === checkOut}"${past ? ' disabled' : ''}><span>${d}</span></button>`;
    }
    return `<div class="cal__month"><p class="cal__title">${title}</p><div class="cal__dow" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span>${x}</span>`).join('')}</div><div class="cal__grid" role="group" aria-label="${title}">${cells}</div></div>`;
  };
  const render = (refocus = false) => {
    const second = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    months.innerHTML = renderMonth(view) + (twoUp() ? renderMonth(second) : '');
    prev.disabled = view <= firstOfThisMonth;
    if (refocus) $<HTMLButtonElement>(`[data-day="${focusDay}"]`, months)?.focus({ preventScroll: true });
  };
  const slide = (dir: number) => {
    view = new Date(view.getFullYear(), view.getMonth() + dir, 1);
    render();
    if (!reduceMotion) months.animate([{ opacity: 0, transform: `translateX(${dir * 16}px)`, filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  };
  prev.addEventListener('click', () => slide(-1));
  next.addEventListener('click', () => slide(1));

  const syncDates = () => {
    if (dateMode === 'flexible') { syncFlexible(); return; }
    if (checkIn && checkOut) {
      const a = parse(checkIn);
      const b = parse(checkOut);
      const n = Math.round((b.getTime() - a.getTime()) / 864e5);
      const nights = `${n} night${n === 1 ? '' : 's'}`;
      const plus = flex ? ` ± ${flex}` : '';
      setText(nightsLabel, `${nights} · ${range(a, b)}${flex ? ` · ± ${flex} day${flex === 1 ? '' : 's'}` : ''}`);
      when.dataset.range = range(a, b);
      when.dataset.stay = String(n);
      when.dataset.phrase = `${range(a, b)} (${nights}${flex ? `, ± ${flex} days` : ''})`;
      setValue(when, `${range(a, b)}${plus} · ${nights}`);
    } else {
      setText(nightsLabel, checkIn ? 'Now choose your check-out' : 'Choose your check-in');
      delete when.dataset.range;
      delete when.dataset.phrase;
      setValue(when, 'Add dates', true);
    }
  };
  const pick = (id: string) => {
    if (!checkIn || checkOut || id <= checkIn) { checkIn = id; checkOut = ''; }
    else checkOut = id;
    hover = '';
    focusDay = id;
    render(true);
    syncDates();
  };
  months.addEventListener('click', (e) => {
    const day = (e.target as Element).closest<HTMLButtonElement>('[data-day]');
    if (day && !day.disabled) pick(day.dataset.day!);
  });
  // Choosing a check-out: the band follows the pointer from the check-in
  months.addEventListener('pointerover', (e) => {
    if (!checkIn || checkOut) return;
    const day = (e.target as Element).closest<HTMLButtonElement>('[data-day]');
    const id = day && !day.disabled ? day.dataset.day! : '';
    if (id !== hover) { hover = id; render(); }
  });
  months.addEventListener('pointerleave', () => { if (hover) { hover = ''; render(); } });
  // Keyboard: arrows move a day or a week, Page Up/Down a month, Enter or Space picks
  months.addEventListener('keydown', (e) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target: Date | null = null;
    const current = parse(focusDay);
    if (e.key in steps) target = addDays(current, steps[e.key]);
    if (e.key === 'PageUp') target = new Date(current.getFullYear(), current.getMonth() - 1, current.getDate());
    if (e.key === 'PageDown') target = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    if (iso(target) < today) return;
    focusDay = iso(target);
    const shown = twoUp() ? 2 : 1;
    const last = new Date(view.getFullYear(), view.getMonth() + shown, 0);
    if (target < view) view = new Date(target.getFullYear(), target.getMonth(), 1);
    else if (target > last) view = new Date(target.getFullYear(), target.getMonth() - shown + 1, 1);
    if (!checkOut && checkIn) hover = focusDay;
    render(true);
  });
  for (const chip of flexChips) chip.addEventListener('click', () => {
    flex = Number(chip.dataset.flex);
    flexChips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    syncDates();
  });
  $('[data-dates-clear]', when)!.addEventListener('click', () => {
    if (dateMode === 'flexible') {
      picked.clear();
      $$('[data-month]', when).forEach((c) => c.setAttribute('aria-pressed', 'false'));
    } else {
      checkIn = ''; checkOut = ''; hover = ''; focusDay = today;
      render(true);
    }
    syncDates();
  });
  $('[data-dates-done]', when)!.addEventListener('click', () => {
    setOpen(null, keyboard);
    $<HTMLElement>('.field__btn', when)!.focus({ preventScroll: true });
  });
  // The panel is wider than its field: centre it over the search bar, and show the check-in month
  const placeWhen = () => {
    if (window.matchMedia('(max-width: 900px)').matches) { whenPop.style.left = ''; return; }
    const width = whenPop.offsetWidth;
    whenPop.style.left = `${Math.round((search.offsetWidth - width) / 2 - when.offsetLeft)}px`;
  };
  const focusCalendar = () => { render(); $<HTMLButtonElement>(`[data-day="${focusDay}"]`, months)?.focus({ preventScroll: true }); };
  $('.field__btn', when)!.addEventListener('click', () => {
    if (open !== when) return;
    view = checkIn ? new Date(parse(checkIn).getFullYear(), parse(checkIn).getMonth(), 1) : firstOfThisMonth;
    focusDay = checkIn || today;
    render();
    placeWhen();
    if (keyboard) focusCalendar();
  });
  window.addEventListener('resize', () => { render(); if (open === when) placeWhen(); });
  render();

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
      if (!whereSet()) setValue(where, flights ? FLIGHT_EMPTY : WHERE_EMPTY, true);
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
  const briefGhost = $('[data-brief-ghost]', tellField)!;
  const examples: string[] = JSON.parse(ghost.dataset.examples || '[]');
  let example = 0;
  const syncGhost = () => {
    const brief = tell.value.trim().replace(/\s+/g, ' ');
    tellValue.textContent = brief ? `“${brief}”` : '';
    tellValue.classList.toggle('is-set', Boolean(brief));
    ghost.classList.toggle('is-hidden', Boolean(brief));
    briefGhost.parentElement!.classList.toggle('has-value', tell.value.length > 0);
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
  // "Send to agent" (or Enter) sends the brief straight away; an empty brief keeps the cursor in the box
  const sendBrief = () => {
    if (!tell.value.trim()) { focusBrief(); return; }
    setOpen(null, true);
    search.requestSubmit();
  };
  $('[data-tell-done]', tellField)!.addEventListener('click', sendBrief);
  tell.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBrief(); } });
  // Every few seconds the example changes: in the field while the panel is closed, in the brief box while it's open.
  if (examples.length > 1 && !reduceMotion) {
    window.setInterval(() => {
      if (document.hidden || tell.value) return;
      const shown = open === tellField ? briefGhost : ghost;
      shown.classList.add('is-out');
      window.setTimeout(() => {
        example = (example + 1) % examples.length;
        ghost.textContent = `“${examples[example]}”`;
        briefGhost.textContent = examples[example];
        shown.classList.remove('is-out');
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
    const brief = tell.value.trim();
    const place = whereSet() ? where.dataset.current! : '';
    // A search needs a place and dates: open whichever is missing. A written brief can go straight to the agent.
    if (!brief && !place) {
      setOpen(where, true);
      whereSearch.value = '';
      filterWhere();
      whereSearch.focus({ preventScroll: true });
      return;
    }
    if (!brief && !when.dataset.range) { setOpen(when, true); render(); placeWhen(); if (dateMode === 'dates') focusCalendar(); return; }
    setOpen(null, true);
    const guests = who.dataset.current || '2 guests';
    const parts = [place, when.dataset.range ? when.dataset.current! : '', guests].filter(Boolean);
    if (openBrief) {
      const flights = $('[data-tab="flights"]')?.getAttribute('aria-selected') === 'true';
      const composed = `${flights ? `Flights from London and a hotel in ${place}` : `A hotel in ${place}`}, ${when.dataset.phrase}, for ${guests}`;
      openBrief(brief || composed, parts, submit, place);
      return;
    }
    $('[data-toast-body]', toast)!.textContent = tell.value.trim() ? `“${tell.value.trim()}”` : parts.join(' · ');
    $('[data-toast-title]', toast)!.textContent = 'Leave it with us. Your agent will be in touch on WhatsApp.';
    // "Search" morphs to "Sent" and back, the same way the field values change
    const label = $('[data-submit-label]', submit)!;
    setText(label, 'Sent');
    window.clearTimeout(Number(submit.dataset.resetTimer || 0));
    submit.dataset.resetTimer = String(window.setTimeout(() => setText(label, 'Search'), 1800));
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

/* ---------- Where next videos: play while on screen, pause when not ---------- */
const cardVideos = $$<HTMLVideoElement>('[data-card-video]');
if (cardVideos.length && !reduceMotion) {
  for (const v of cardVideos) v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const v = target as HTMLVideoElement;
      if (isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    }
  }, { threshold: 0 });
  cardVideos.forEach((v) => io.observe(v));
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

/* ---------- Member log in: open from the nav, email a one-time link (front end only) ---------- */
const login = $<HTMLDialogElement>('[data-login]');
if (login) {
  const form = $<HTMLFormElement>('[data-login-form]', login)!;
  const email = $<HTMLInputElement>('input[name="email"]', form)!;
  const field = email.closest('.pfield')!;
  const err = $('.pfield__err', field)!;
  const step = (name: 'form' | 'sent') => $$('[data-login-step]', login).forEach((el) => { el.hidden = el.dataset.loginStep !== name; });
  const open = () => { step('form'); login.showModal(); email.focus(); };
  $$('[data-login-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(); }));
  $('[data-login-close]', login)!.addEventListener('click', () => login.close());
  login.addEventListener('click', (e) => { if (e.target === login) login.close(); }); // click on the backdrop
  $('[data-login-request]', login)!.addEventListener('click', () => login.close());
  $('[data-login-again]', login)!.addEventListener('click', () => { step('form'); email.select(); });
  email.addEventListener('input', () => { field.classList.remove('is-invalid'); err.textContent = ''; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      field.classList.add('is-invalid');
      err.textContent = value ? 'That email doesn\u2019t look quite right' : email.dataset.error!;
      email.focus();
      return;
    }
    $('[data-login-email]', login)!.textContent = value;
    step('sent');
    $<HTMLButtonElement>('[data-login-again]', login)!.focus();
  });
  if (location.hash === '#login') open();
}
