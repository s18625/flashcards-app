import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { settingsRepo } from './db';
import { showToast } from './ui/toast';
import { initRouter, navigate, registerImportHandler, registerNotFound, registerRoute } from './router';
import { buildShell, getViewContainer } from './ui/shell';
import { applyTheme } from './ui/theme';

async function bootstrap(): Promise<void> {
  const settings = await settingsRepo.getSettings();
  applyTheme(settings.theme);

  const root = document.getElementById('app');
  if (!root) throw new Error('Brak elementu #app w index.html');
  buildShell(root);

  // Trasy ładują swoje widoki przez dynamiczny import, dzięki czemu ciężkie
  // zależności (np. tesseract.js używane tylko w skanowaniu zdjęć) trafiają
  // do osobnych fragmentów kodu wczytywanych dopiero, gdy są potrzebne.
  registerRoute('/decks', () => void import('./ui/views/decksView').then((m) => m.renderDecksView(getViewContainer())));
  registerRoute('/search', () => void import('./ui/views/searchView').then((m) => m.renderSearchView(getViewContainer())));
  registerRoute('/decks/new', () => void import('./ui/views/deckFormView').then((m) => m.renderDeckFormView(getViewContainer())));
  registerRoute('/decks/import', () => void import('./ui/views/importView').then((m) => m.renderImportPickerView(getViewContainer())));
  registerRoute('/decks/import-preview', () => void import('./ui/views/importView').then((m) => m.renderImportPreviewView(getViewContainer())));
  registerRoute('/decks/:id/edit', (p) => void import('./ui/views/deckFormView').then((m) => m.renderDeckFormView(getViewContainer(), p.id)));
  registerRoute('/decks/:id/scan', (p) => void import('./ui/views/scanView').then((m) => m.renderScanView(getViewContainer(), p.id)));
  registerRoute('/decks/:id/share', (p) => void import('./ui/views/shareView').then((m) => m.renderShareView(getViewContainer(), p.id)));
  registerRoute('/decks/:id/study', (p) => void import('./ui/views/studySessionView').then((m) => m.renderStudySessionView(getViewContainer(), p.id)));
  registerRoute('/decks/:id/cards/new', (p) => void import('./ui/views/cardFormView').then((m) => m.renderCardFormView(getViewContainer(), p.id)));
  registerRoute('/decks/:id/cards/bulk', (p) => void import('./ui/views/bulkAddView').then((m) => m.renderBulkAddView(getViewContainer(), p.id)));
  registerRoute('/decks/:id/cards/:cardId/edit', (p) =>
    void import('./ui/views/cardFormView').then((m) => m.renderCardFormView(getViewContainer(), p.id, p.cardId))
  );
  registerRoute('/decks/:id', (p) => void import('./ui/views/deckDetailView').then((m) => m.renderDeckDetailView(getViewContainer(), p.id)));

  registerRoute('/study', () => void import('./ui/views/studyPickerView').then((m) => m.renderStudyPickerView(getViewContainer())));
  registerRoute('/study/:scope', (p) => void import('./ui/views/studySessionView').then((m) => m.renderStudySessionView(getViewContainer(), p.scope)));

  registerRoute('/stats', () => void import('./ui/views/statsView').then((m) => m.renderStatsView(getViewContainer())));
  registerRoute('/settings', () => void import('./ui/views/settingsView').then((m) => m.renderSettingsView(getViewContainer())));

  registerImportHandler((hash) => {
    void import('./ui/views/importView').then((m) => m.handleShareHash(hash));
  });
  registerNotFound(() => navigate('/decks'));

  initRouter();

  registerSW({
    immediate: true,
    onNeedRefresh() {
      showToast('Dostępna jest nowa wersja aplikacji. Odśwież stronę, aby zaktualizować.');
    },
    onOfflineReady() {
      showToast('Aplikacja jest gotowa do pracy offline.');
    }
  });
}

void bootstrap();
