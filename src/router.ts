export type RouteParams = Record<string, string>;
export type RouteHandler = (params: RouteParams) => void;

interface Route {
  segments: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];
let importHandler: ((hash: string) => void) | null = null;
let notFoundHandler: RouteHandler = () => navigate('/decks');
let currentPath = '';

export function registerRoute(pattern: string, handler: RouteHandler): void {
  routes.push({ segments: pattern.split('/').filter(Boolean), handler });
}

export function registerImportHandler(handler: (hash: string) => void): void {
  importHandler = handler;
}

export function registerNotFound(handler: RouteHandler): void {
  notFoundHandler = handler;
}

export function navigate(path: string): void {
  if (window.location.hash.slice(1) === path) {
    handleHashChange();
    return;
  }
  window.location.hash = path;
}

export function getCurrentPath(): string {
  return currentPath;
}

function matchRoute(path: string): { handler: RouteHandler; params: RouteParams } | null {
  const pathSegments = path.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.segments.length !== pathSegments.length) continue;
    const params: RouteParams = {};
    let matched = true;
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(pathSegments[i]);
      } else if (seg !== pathSegments[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler: route.handler, params };
  }
  return null;
}

function handleHashChange(): void {
  const raw = window.location.hash.slice(1);
  if (raw.startsWith('share=')) {
    importHandler?.(raw);
    return;
  }
  const path = raw.startsWith('/') ? raw : '/decks';
  currentPath = path;
  const match = matchRoute(path);
  if (match) {
    match.handler(match.params);
  } else {
    notFoundHandler({});
  }
  window.scrollTo(0, 0);
}

export function initRouter(): void {
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}
