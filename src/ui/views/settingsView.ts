import { cardRepo, deckRepo, settingsRepo } from '../../db';
import { navigate } from '../../router';
import { cardsToCsv, parseCsvToCards } from '../../share/csv';
import { buildShareFile, parseJsonPayload, serializeDeckForSharing, ShareValidationError, validateSharePayload } from '../../share/share';
import { downloadBlob } from '../../share/webshare';
import type { AppSettings, OcrMethod } from '../../types';
import { h, mount } from '../dom';
import { setPendingImport } from '../pendingImport';
import { applyTheme } from '../theme';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

export async function renderSettingsView(container: HTMLElement): Promise<void> {
  setTopbar({ title: 'Ustawienia' });
  mount(container, h('div', { class: 'spinner' }));

  const settings = await settingsRepo.getSettings();
  const decks = await deckRepo.listDecks();

  async function persist(patch: Partial<AppSettings>): Promise<void> {
    const updated = await settingsRepo.saveSettings(patch);
    Object.assign(settings, updated);
    if (patch.theme) applyTheme(updated.theme);
  }

  const themeSelect = h(
    'select',
    {
      id: 'settings-theme',
      onchange: (e: Event) => persist({ theme: (e.target as HTMLSelectElement).value as AppSettings['theme'] })
    },
    h('option', { value: 'system', selected: settings.theme === 'system' }, 'Systemowy'),
    h('option', { value: 'light', selected: settings.theme === 'light' }, 'Jasny'),
    h('option', { value: 'dark', selected: settings.theme === 'dark' }, 'Ciemny')
  );

  const ocrSelect = h(
    'select',
    {
      id: 'settings-ocr',
      onchange: (e: Event) => {
        void persist({ ocrMethod: (e.target as HTMLSelectElement).value as OcrMethod });
        renderApiKeySection();
      }
    },
    h('option', { value: 'tesseract', selected: settings.ocrMethod === 'tesseract' }, 'Tesseract.js (offline, domyślnie)'),
    h('option', { value: 'vision-api', selected: settings.ocrMethod === 'vision-api' }, 'Model wizyjny (API, wymaga klucza)')
  );

  const apiKeySection = h('div');
  function renderApiKeySection(): void {
    if (settings.ocrMethod !== 'vision-api') {
      mount(apiKeySection);
      return;
    }
    const keyInput = h('input', {
      type: 'password',
      id: 'settings-api-key',
      value: settings.visionApiKey,
      placeholder: 'sk-ant-...',
      autocomplete: 'off'
    }) as HTMLInputElement;
    keyInput.addEventListener('change', () => void persist({ visionApiKey: keyInput.value.trim() }));

    mount(
      apiKeySection,
      h(
        'div',
        { class: 'field' },
        h('label', { for: 'settings-api-key' }, 'Klucz API modelu wizyjnego'),
        keyInput,
        h('div', { class: 'hint' }, 'Klucz jest przechowywany wyłącznie lokalnie w tym urządzeniu (IndexedDB) i nigdy nie jest wysyłany nigdzie poza wywołaniem API rozpoznawania tekstu, które sam włączysz.')
      )
    );
  }
  renderApiKeySection();

  const newCardsInput = h('input', {
    type: 'number',
    min: '0',
    max: '500',
    value: String(settings.dailyNewCardsLimit)
  }) as HTMLInputElement;
  newCardsInput.addEventListener('change', () => {
    const v = Math.max(0, Math.min(500, Number(newCardsInput.value) || 0));
    newCardsInput.value = String(v);
    void persist({ dailyNewCardsLimit: v });
  });

  const reviewLimitInput = h('input', {
    type: 'number',
    min: '0',
    max: '2000',
    value: String(settings.dailyReviewLimit)
  }) as HTMLInputElement;
  reviewLimitInput.addEventListener('change', () => {
    const v = Math.max(0, Math.min(2000, Number(reviewLimitInput.value) || 0));
    reviewLimitInput.value = String(v);
    void persist({ dailyReviewLimit: v });
  });

  const ttsLangSelect = h(
    'select',
    { onchange: (e: Event) => persist({ ttsVoiceLang: (e.target as HTMLSelectElement).value as AppSettings['ttsVoiceLang'] }) },
    h('option', { value: 'en-US', selected: settings.ttsVoiceLang === 'en-US' }, 'Angielski (US)'),
    h('option', { value: 'en-GB', selected: settings.ttsVoiceLang === 'en-GB' }, 'Angielski (UK)')
  );

  const deckSelectForData = h(
    'select',
    null,
    ...decks.map((d) => h('option', { value: d.id }, d.name))
  ) as HTMLSelectElement;

  const importFileInput = h('input', {
    type: 'file',
    accept: '.json,.csv,application/json,text/csv',
    style: 'display:none',
    onchange: async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const payload = file.name.toLowerCase().endsWith('.csv')
          ? validateSharePayload({ formatVersion: 1, deckName: file.name.replace(/\.csv$/i, ''), cards: parseCsvToCards(text) })
          : parseJsonPayload(text);
        setPendingImport(payload);
        navigate('/decks/import-preview');
      } catch (err) {
        showToast(err instanceof ShareValidationError ? err.message : 'Nie udało się wczytać pliku.', 'error');
      }
    }
  }) as HTMLInputElement;

  const dataSection =
    decks.length === 0
      ? h('p', { class: 'muted' }, 'Dodaj talię, aby móc eksportować lub importować dane.')
      : h(
          'div',
          null,
          h('div', { class: 'field' }, h('label', null, 'Talia do eksportu'), deckSelectForData),
          h(
            'div',
            { class: 'row row-wrap' },
            h('button', { class: 'btn btn-outline', onclick: () => exportDeck(deckSelectForData.value, 'json') }, 'Eksportuj JSON'),
            h('button', { class: 'btn btn-outline', onclick: () => exportDeck(deckSelectForData.value, 'csv') }, 'Eksportuj CSV')
          ),
          h('button', { class: 'btn btn-outline btn-block mt-16', onclick: () => importFileInput.click() }, 'Importuj z pliku JSON/CSV'),
          importFileInput
        );

  async function exportDeck(deckId: string, format: 'json' | 'csv'): Promise<void> {
    const deck = await deckRepo.getDeck(deckId);
    if (!deck) return;
    const cards = await cardRepo.listCardsByDeck(deckId);
    const payload = serializeDeckForSharing(deck, cards);
    if (format === 'json') {
      const { filename, blob } = buildShareFile(payload);
      downloadBlob(filename, blob);
    } else {
      const csv = cardsToCsv(payload.cards);
      downloadBlob(`talia-${deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, new Blob([csv], { type: 'text/csv' }));
    }
    showToast('Plik pobrany.');
  }

  mount(
    container,
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Wygląd'),
      h('div', { class: 'field' }, h('label', { for: 'settings-theme' }, 'Motyw'), themeSelect)
    ),
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Rozpoznawanie tekstu (OCR)'),
      h('div', { class: 'field' }, h('label', { for: 'settings-ocr' }, 'Metoda OCR'), ocrSelect),
      apiKeySection,
      h(
        'p',
        { class: 'hint' },
        'Tesseract.js działa lokalnie w przeglądarce i nie wysyła zdjęć nigdzie. Model wizyjny wymaga internetu i klucza API — zdjęcie jest wtedy wysyłane do zewnętrznego serwisu tylko za Twoją zgodą.'
      )
    ),
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Nauka'),
      h('div', { class: 'field' }, h('label', null, 'Dzienny limit nowych kart'), newCardsInput),
      h('div', { class: 'field' }, h('label', null, 'Dzienny limit powtórek'), reviewLimitInput),
      h('div', { class: 'field' }, h('label', null, 'Głos wymowy (Web Speech API)'), ttsLangSelect)
    ),
    h('div', { class: 'card-surface' }, h('h2', null, 'Eksport i import danych'), dataSection)
  );
}
