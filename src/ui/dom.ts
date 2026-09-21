/** Minimalny helper hyperscript do budowania DOM bez frameworka i bez innerHTML. */

type Child = Node | string | number | null | undefined | false;
type Children = Child[];

type ElementProps = {
  class?: string;
  dataset?: Record<string, string>;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps | null,
  ...children: Children
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

function applyProps(el: HTMLElement, props?: ElementProps | null): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') {
      el.className = String(value);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value as Record<string, string>);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'for' && el instanceof HTMLLabelElement) {
      el.htmlFor = String(value);
    } else if (typeof value === 'boolean') {
      if (value) el.setAttribute(key, '');
      else el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function appendChildren(el: HTMLElement, children: Children): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

export function clear(el: HTMLElement): void {
  el.replaceChildren();
}

export function mount(container: HTMLElement, ...children: Children): void {
  clear(container);
  appendChildren(container, children);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function hs<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
  ...children: (SVGElement | null | undefined | false)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child) el.appendChild(child);
  }
  return el;
}

export function icon(name: keyof typeof ICON_BUILDERS): SVGSVGElement {
  return ICON_BUILDERS[name]();
}

const strokeProps = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function svgWrap(...children: SVGElement[]): SVGSVGElement {
  const svg = hs('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', class: 'icon' }, ...children);
  return svg;
}

const ICON_BUILDERS = {
  plus: () => svgWrap(hs('line', { ...strokeProps, x1: 12, y1: 5, x2: 12, y2: 19 }), hs('line', { ...strokeProps, x1: 5, y1: 12, x2: 19, y2: 12 })),
  trash: () =>
    svgWrap(
      hs('polyline', { ...strokeProps, points: '3,6 5,6 21,6' }),
      hs('path', { ...strokeProps, d: 'M19,6 L18,20 a2,2 0 0 1 -2,2 H8 a2,2 0 0 1 -2,-2 L5,6' }),
      hs('line', { ...strokeProps, x1: 10, y1: 11, x2: 10, y2: 17 }),
      hs('line', { ...strokeProps, x1: 14, y1: 11, x2: 14, y2: 17 })
    ),
  back: () => svgWrap(hs('polyline', { ...strokeProps, points: '15,18 9,12 15,6' })),
  camera: () =>
    svgWrap(
      hs('path', { ...strokeProps, d: 'M4 8 h3 l2 -3 h6 l2 3 h3 a1 1 0 0 1 1 1 v10 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V9 a1 1 0 0 1 1 -1 z' }),
      hs('circle', { ...strokeProps, cx: 12, cy: 13, r: 4 })
    ),
  gear: () =>
    svgWrap(
      hs('circle', { ...strokeProps, cx: 12, cy: 12, r: 3 }),
      hs('path', {
        ...strokeProps,
        d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
      })
    ),
  chart: () =>
    svgWrap(
      hs('line', { ...strokeProps, x1: 4, y1: 20, x2: 20, y2: 20 }),
      hs('line', { ...strokeProps, x1: 7, y1: 20, x2: 7, y2: 12 }),
      hs('line', { ...strokeProps, x1: 12, y1: 20, x2: 12, y2: 6 }),
      hs('line', { ...strokeProps, x1: 17, y1: 20, x2: 17, y2: 15 })
    ),
  cards: () =>
    svgWrap(
      hs('rect', { ...strokeProps, x: 3, y: 6, width: 14, height: 14, rx: 2 }),
      hs('path', { ...strokeProps, d: 'M7 6 V4 a2 2 0 0 1 2 -2 h10 a2 2 0 0 1 2 2 v10 a2 2 0 0 1 -2 2 h-2' })
    ),
  graduate: () =>
    svgWrap(
      hs('path', { ...strokeProps, d: 'M2 9 L12 4 L22 9 L12 14 Z' }),
      hs('path', { ...strokeProps, d: 'M6 11.5 V17 c0 1.5 3 3 6 3 s6 -1.5 6 -3 v-5.5' }),
      hs('line', { ...strokeProps, x1: 22, y1: 9, x2: 22, y2: 15 })
    ),
  share: () =>
    svgWrap(
      hs('circle', { ...strokeProps, cx: 18, cy: 5, r: 2.5 }),
      hs('circle', { ...strokeProps, cx: 6, cy: 12, r: 2.5 }),
      hs('circle', { ...strokeProps, cx: 18, cy: 19, r: 2.5 }),
      hs('line', { ...strokeProps, x1: 8.3, y1: 10.7, x2: 15.8, y2: 6.3 }),
      hs('line', { ...strokeProps, x1: 8.3, y1: 13.3, x2: 15.8, y2: 17.7 })
    ),
  speaker: () =>
    svgWrap(
      hs('path', { ...strokeProps, d: 'M4 9 h4 l5 -4 v14 l-5 -4 H4 z' }),
      hs('path', { ...strokeProps, d: 'M16 9 a4 4 0 0 1 0 6' }),
      hs('path', { ...strokeProps, d: 'M18.5 6.5 a8 8 0 0 1 0 11' })
    ),
  check: () => svgWrap(hs('polyline', { ...strokeProps, points: '4,13 9,18 20,6' })),
  close: () => svgWrap(hs('line', { ...strokeProps, x1: 6, y1: 6, x2: 18, y2: 18 }), hs('line', { ...strokeProps, x1: 18, y1: 6, x2: 6, y2: 18 })),
  edit: () =>
    svgWrap(
      hs('path', { ...strokeProps, d: 'M4 20 l0.8 -4 L16 4.8 a2 2 0 0 1 3 0 l0.2 0.2 a2 2 0 0 1 0 3 L8 19.2 Z' })
    ),
  sun: () =>
    svgWrap(
      hs('circle', { ...strokeProps, cx: 12, cy: 12, r: 4 }),
      hs('line', { ...strokeProps, x1: 12, y1: 2, x2: 12, y2: 4 }),
      hs('line', { ...strokeProps, x1: 12, y1: 20, x2: 12, y2: 22 }),
      hs('line', { ...strokeProps, x1: 4.2, y1: 4.2, x2: 5.6, y2: 5.6 }),
      hs('line', { ...strokeProps, x1: 18.4, y1: 18.4, x2: 19.8, y2: 19.8 }),
      hs('line', { ...strokeProps, x1: 2, y1: 12, x2: 4, y2: 12 }),
      hs('line', { ...strokeProps, x1: 20, y1: 12, x2: 22, y2: 12 }),
      hs('line', { ...strokeProps, x1: 4.2, y1: 19.8, x2: 5.6, y2: 18.4 }),
      hs('line', { ...strokeProps, x1: 18.4, y1: 5.6, x2: 19.8, y2: 4.2 })
    ),
  moon: () => svgWrap(hs('path', { ...strokeProps, d: 'M20 14.5 A8.5 8.5 0 1 1 9.5 4 a7 7 0 0 0 10.5 10.5 z' })),
  qr: () =>
    svgWrap(
      hs('rect', { ...strokeProps, x: 3, y: 3, width: 6, height: 6 }),
      hs('rect', { ...strokeProps, x: 15, y: 3, width: 6, height: 6 }),
      hs('rect', { ...strokeProps, x: 3, y: 15, width: 6, height: 6 }),
      hs('line', { ...strokeProps, x1: 15, y1: 15, x2: 15, y2: 21 }),
      hs('line', { ...strokeProps, x1: 21, y1: 15, x2: 21, y2: 21 }),
      hs('line', { ...strokeProps, x1: 18, y1: 15, x2: 18, y2: 18 }),
      hs('line', { ...strokeProps, x1: 15, y1: 18, x2: 18, y2: 18 })
    ),
  upload: () =>
    svgWrap(
      hs('path', { ...strokeProps, d: 'M12 16 V4' }),
      hs('polyline', { ...strokeProps, points: '7,9 12,4 17,9' }),
      hs('path', { ...strokeProps, d: 'M4 16 v3 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 v-3' })
    ),
  image: () =>
    svgWrap(
      hs('rect', { ...strokeProps, x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      hs('circle', { ...strokeProps, cx: 9, cy: 10, r: 2 }),
      hs('path', { ...strokeProps, d: 'M21 16 l-5.5 -5.5 a1.5 1.5 0 0 0 -2 0 L4 19' })
    )
};
