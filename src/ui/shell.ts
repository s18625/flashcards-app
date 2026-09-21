import { h, icon, mount } from './dom';
import { navigate, getCurrentPath } from '../router';

export interface NavItem {
  path: string;
  label: string;
  iconName: Parameters<typeof icon>[0];
  matches: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/decks', label: 'Talie', iconName: 'cards', matches: (p) => p === '/decks' || p.startsWith('/decks/') },
  { path: '/study', label: 'Nauka', iconName: 'graduate', matches: (p) => p.startsWith('/study') },
  { path: '/stats', label: 'Statystyki', iconName: 'chart', matches: (p) => p.startsWith('/stats') },
  { path: '/settings', label: 'Ustawienia', iconName: 'gear', matches: (p) => p.startsWith('/settings') }
];

let topbarTitleEl: HTMLElement;
let topbarBackEl: HTMLElement;
let topbarActionsEl: HTMLElement;
let viewEl: HTMLElement;
let bottomNavEl: HTMLElement;
let currentBackPath: string | null = null;

export function buildShell(root: HTMLElement): HTMLElement {
  topbarTitleEl = h('h1', null, 'Fiszki');
  topbarBackEl = h('div', { class: 'row' });
  topbarActionsEl = h('div', { class: 'row' });
  const topbar = h('header', { class: 'topbar' }, topbarBackEl, topbarTitleEl, topbarActionsEl);

  viewEl = h('main', { id: 'view' });

  bottomNavEl = h('nav', { class: 'bottom-nav', 'aria-label': 'Główna nawigacja' });

  mount(root, topbar, viewEl, bottomNavEl);
  renderBottomNav();
  return viewEl;
}

function renderBottomNav(): void {
  const path = getCurrentPath();
  const links = NAV_ITEMS.map((item) => {
    const active = item.matches(path);
    return h(
      'a',
      {
        href: `#${item.path}`,
        class: active ? 'active' : '',
        'aria-current': active ? 'page' : undefined,
        onclick: (e: Event) => {
          e.preventDefault();
          navigate(item.path);
        }
      },
      icon(item.iconName),
      h('span', null, item.label)
    );
  });
  mount(bottomNavEl, ...links);
}

export interface TopbarOptions {
  title: string;
  backPath?: string | null;
  actions?: HTMLElement[];
}

export function setTopbar(options: TopbarOptions): void {
  topbarTitleEl.textContent = options.title;
  document.title = `${options.title} – Fiszki`;
  currentBackPath = options.backPath ?? null;

  if (currentBackPath) {
    const backBtn = h(
      'button',
      { class: 'icon-button', 'aria-label': 'Wstecz', onclick: () => navigate(currentBackPath!) },
      icon('back')
    );
    mount(topbarBackEl, backBtn);
  } else {
    mount(topbarBackEl);
  }

  mount(topbarActionsEl, ...(options.actions ?? []));
  renderBottomNav();
}

export function getViewContainer(): HTMLElement {
  return viewEl;
}
