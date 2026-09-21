import { h } from './dom';

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container) {
    container = h('div', { class: 'toast-container', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, kind: 'info' | 'error' = 'info'): void {
  const el = h('div', { class: kind === 'error' ? 'toast toast-error' : 'toast' }, message);
  getContainer().appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3200);
}
