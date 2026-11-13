/* Holiwise Premium interactions: getting to the form, the request form itself,
   the member quotes and the FAQ. Shared behaviour (reveals, buttons, themes, nav)
   comes from main.ts. */
import { setText } from './main';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(sel: string, el: ParentNode = document) => el.querySelector<T>(sel);
const $$ = <T extends HTMLElement>(sel: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(sel));

/* ---------- Getting to the form ----------
   "Request an invitation" scrolls to the form and puts the cursor in First name.
   "Enter your invite code" and the nav's "Have an invite?" go to the code field and light it up.
   Focus waits for the scroll to finish, so it never cuts the smooth scroll short. */
const request = $('#request');
const form = $<HTMLFormElement>('[data-invite-form]');
const invite = $<HTMLInputElement>('#invite');
const afterScroll = (fn: () => void) => {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  if ('onscrollend' in window) window.addEventListener('scrollend', run, { once: true });
  window.setTimeout(run, 1100);
};
const goTo = (field: HTMLInputElement | null, flash = false) => {
  if (!request || !field) return;
  const target = form?.closest('.preq') ?? request;
  const top = target.getBoundingClientRect().top + window.scrollY - (window.innerHeight - target.getBoundingClientRect().height) / 2;
  const y = Math.max(0, Math.min(top, request.getBoundingClientRect().top + window.scrollY));
  const needsScroll = Math.abs(window.scrollY - y) > 4;
  const focus = () => {
    field.focus({ preventScroll: true });
    if (flash) {
      const wrap = field.closest('.pfield');
      wrap?.classList.add('is-flash');
      window.setTimeout(() => wrap?.classList.remove('is-flash'), 1200);
    }
  };
  if (needsScroll) {
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (reduceMotion) focus(); else afterScroll(focus);
  } else focus();
};
const firstName = $<HTMLInputElement>('input[name="firstName"]');
for (const a of $$('[data-to-request]')) a.addEventListener('click', (e) => { e.preventDefault(); goTo(firstName); });
for (const a of $$('[data-to-invite], [data-invite-link]')) a.addEventListener('click', (e) => { e.preventDefault(); goTo(invite, true); });

// A shared link can carry the code: /premium?invite=ABC123 fills it in; /premium#invite goes straight to it.
const params = new URLSearchParams(location.search);
if (invite && params.get('invite')) invite.value = params.get('invite')!.toUpperCase();
if (location.hash === '#invite' || params.get('invite')) {
  history.replaceState(null, '', location.pathname);
  window.addEventListener('load', () => window.setTimeout(() => goTo(invite, true), 600), { once: true });
}

/* ---------- Request form (prototype: nothing is sent yet) ---------- */
if (form) {
  const card = form.closest<HTMLElement>('.preq')!;
  const thanks = $('[data-thanks]', card)!;
  const thanksTitle = $('[data-thanks-title]', card)!;
  const submit = $<HTMLButtonElement>('button[type="submit"]', form)!;
  const submitText = $('[data-submit-text]', submit)!;
  const occupation = $<HTMLInputElement>('[data-occupation]', form)!;
  const occupationLabel = $('[data-occupation-label]', form)!;

  // Individual or company: one is always picked; the occupation field becomes the company name.
  const seg = $$<HTMLButtonElement>('[data-seg]', form);
  for (const b of seg) b.addEventListener('click', () => {
    for (const o of seg) o.setAttribute('aria-pressed', String(o === b));
    const company = b.dataset.seg === 'company';
    setText(occupationLabel, company ? 'Company' : 'Occupation');
    occupation.placeholder = company ? 'Company name' : 'What you do';
    occupation.setAttribute('autocomplete', company ? 'organization' : 'organization-title');
  });

  // How you travel: pick one, or tap it again to clear.
  const travel = $$<HTMLButtonElement>('[data-travel]', form);
  for (const b of travel) b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    for (const o of travel) o.setAttribute('aria-pressed', String(o === b && on));
  });

  const select = $<HTMLSelectElement>('select', form)!;
  const syncSelect = () => select.classList.toggle('is-empty', !select.value);
  select.addEventListener('change', syncSelect);
  syncSelect();

  // Validation speaks up on submit, then clears as soon as the field is fixed.
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const check = (input: HTMLInputElement) => {
    const wrap = input.closest('.pfield')!;
    const err = $('.pfield__err', wrap)!;
    const v = input.value.trim();
    const bad = (input.required && !v) || (input.type === 'email' && v !== '' && !emailOk(v));
    wrap.classList.toggle('is-invalid', bad);
    input.setAttribute('aria-invalid', String(bad));
    err.textContent = bad ? (input.type === 'email' && v ? 'That email doesn’t look quite right' : input.dataset.error ?? 'Please fill this in') : '';
    return !bad;
  };
  const required = $$<HTMLInputElement>('input[required], input[type="email"]', form);
  for (const input of required) input.addEventListener('input', () => { if (input.closest('.is-invalid')) check(input); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = required.filter((i) => !check(i));
    if (bad.length) { bad[0].focus(); return; }
    submit.disabled = true;
    setText(submitText, 'Sending…');
    const name = firstName?.value.trim();
    window.setTimeout(() => {
      setText(submitText, 'Request sent');
      window.setTimeout(() => {
        if (name) thanksTitle.textContent = `Thank you, ${name}. Leave it with us.`;
        card.style.minHeight = `${card.offsetHeight}px`;
        thanks.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          card.classList.add('is-sent');
          form.setAttribute('aria-hidden', 'true');
          form.inert = true;
          thanksTitle.focus({ preventScroll: true });
        }));
      }, 600);
    }, reduceMotion ? 300 : 900);
  });
}

/* ---------- Member quotes: one at a time, dots and arrows, turns itself while on screen ---------- */
const quotes = $('[data-quotes]');
if (quotes) {
  const slides = $$('[data-quote]', quotes);
  const dots = $$<HTMLButtonElement>('[data-dot]', quotes);
  let index = 0;
  let paused = false;
  let visible = false;
  const show = (i: number) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      s.classList.toggle('is-active', n === index);
      if (n === index) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    dots.forEach((d, n) => d.setAttribute('aria-current', String(n === index)));
  };
  // The active dot's fill is the timer: a CSS animation that runs while the quotes are on screen
  // and nobody is reading, and moves to the next review when it completes.
  const hold = () => quotes.classList.toggle('is-held', paused || !visible);
  const restart = () => {
    if (reduceMotion) return;
    quotes.classList.remove('is-timing');
    void quotes.offsetWidth; // restart the fill from empty
    quotes.classList.add('is-timing');
    hold();
  };
  dots.forEach((d) => d.addEventListener('animationend', () => { show(index + 1); restart(); }));
  const go = (i: number) => { show(i); restart(); };
  dots.forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.dot))));
  $('[data-prev]', quotes)!.addEventListener('click', () => go(index - 1));
  $('[data-next]', quotes)!.addEventListener('click', () => go(index + 1));
  quotes.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });
  // Pause while someone is reading or using the controls (mouse only, so a tap doesn't freeze it)
  quotes.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { paused = true; hold(); } });
  quotes.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { paused = false; hold(); } });
  quotes.addEventListener('focusin', () => { if (quotes.matches(':focus-visible, :has(:focus-visible)')) { paused = true; hold(); } });
  quotes.addEventListener('focusout', (e) => { if (!quotes.contains(e.relatedTarget as Node)) { paused = false; hold(); } });
  // Swipe on touch
  let x0: number | null = null;
  const stage = $('.pquotes__stage', quotes)!;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; hold(); }, { threshold: 0.4 }).observe(quotes);
  restart();
}

/* ---------- FAQ: one answer open at a time ---------- */
const faq = $('[data-faq]');
if (faq) {
  const items = $$('.faq__item', faq);
  for (const item of items) {
    const q = $<HTMLButtonElement>('.faq__q', item)!;
    q.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      for (const other of items) {
        const on = other === item && open;
        other.classList.toggle('is-open', on);
        $('.faq__q', other)!.setAttribute('aria-expanded', String(on));
      }
    });
  }
}
