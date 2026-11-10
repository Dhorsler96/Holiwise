/* Calligraph text transitions, mounted as tiny React islands inside otherwise static markup.
   Loaded lazily by main.ts; each element keeps working as plain text until this arrives. */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Calligraph, type CalligraphProps } from 'calligraph';

export type Morph = { set: (text: string) => void };

export function morph(el: HTMLElement, props: Omit<CalligraphProps, 'children'> = {}): Morph {
  let current = el.textContent ?? '';
  const root = createRoot(el);
  const render = () => root.render(createElement(Calligraph, props, current));
  el.textContent = '';
  render();
  return {
    set(text) {
      if (text === current) return;
      current = text;
      render();
    },
  };
}
