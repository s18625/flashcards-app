import { cardRepo, deckRepo } from '../../db';
import { navigate } from '../../router';
import { parseCsvToCards } from '../../share/csv';
import {
  dedupeAgainstExisting,
  decodePayloadFromCompressed,
  extractShareHashFromUrl,
  parseJsonPayload,
  ShareValidationError,
  validateSharePayload
} from '../../share/share';
import type { SharePayload } from '../../types';
import { h, mount } from '../dom';
import { clearPendingImport, getPendingImport, setPendingImport } from '../pendingImport';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

export function handleShareHash(hash: string): void {
  try {
    const payload = decodePayloadFromCompressed(hash);
    setPendingImport(payload);
    navigate('/decks/import-preview');
  } catch (err) {
    showToast(err instanceof ShareValidationError ? err.message : 'Nieprawidłowy link importu talii.', 'error');
    navigate('/decks');
  }
}

export async function renderImportPickerView(container: HTMLElement): Promise<void> {
  setTopbar({ title: 'Importuj talię', backPath: '/decks' });

  const linkInput = h('input', { type: 'text', placeholder: 'Wklej link lub skopiowany kod udostępniania…' }) as HTMLInputElement;
  const fileInput = h('input', {
    type: 'file',
    accept: '.json,.csv,application/json,text/csv',
    onchange: async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
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

  mount(
    container,
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Z pliku'),
      h('p', { class: 'muted' }, 'Wybierz plik .json lub .csv otrzymany od innej osoby.'),
      h('div', { class: 'field' }, fileInput)
    ),
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Z linku'),
      h('p', { class: 'muted' }, 'Kliknięcie w link udostępniania otwiera import automatycznie. Możesz też wkleić go tutaj.'),
      h('div', { class: 'field' }, linkInput),
      h(
        'button',
        {
          class: 'btn btn-primary btn-block',
          onclick: () => {
            const raw = linkInput.value.trim();
            if (!raw) return;
            const hash = extractShareHashFromUrl(raw) ?? (raw.startsWith('share=') ? raw.slice(6) : raw);
            try {
              const payload = decodePayloadFromCompressed(hash);
              setPendingImport(payload);
              navigate('/decks/import-preview');
            } catch (err) {
              showToast(err instanceof ShareValidationError ? err.message : 'Nie udało się odczytać linku.', 'error');
            }
          }
        },
        'Wczytaj link'
      )
    ),
    h('p', { class: 'hint' }, 'Kod QR: zeskanuj go dowolną aplikacją aparatu — otworzy się link importu w tej aplikacji.')
  );
}

export async function renderImportPreviewView(container: HTMLElement): Promise<void> {
  const payload = getPendingImport();
  setTopbar({ title: 'Podgląd importu', backPath: '/decks' });

  if (!payload) {
    mount(
      container,
      h('div', { class: 'empty-state' }, h('p', null, 'Brak danych do zaimportowania.'), h('button', { class: 'btn btn-primary', onclick: () => navigate('/decks/import') }, 'Wybierz plik'))
    );
    return;
  }

  const decks = await deckRepo.listDecks();
  const nameMatch = decks.find((d) => d.name.trim().toLowerCase() === payload.deckName.trim().toLowerCase());

  const examples = payload.cards.slice(0, 5);

  const mergeSelect = h(
    'select',
    null,
    ...decks.map((d) => h('option', { value: d.id, selected: nameMatch?.id === d.id }, d.name))
  ) as HTMLSelectElement;

  mount(
    container,
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, payload.deckName),
      payload.deckDescription ? h('p', { class: 'muted' }, payload.deckDescription) : null,
      h('p', null, `${payload.cards.length} ${payload.cards.length === 1 ? 'fiszka' : 'fiszek'} do zaimportowania.`),
      h(
        'p',
        { class: 'hint' },
        '⚠️ Ta talia pochodzi z zewnętrznego źródła. Dane zostały zweryfikowane i oczyszczone, ale sprawdź zawartość przed dodaniem.'
      )
    ),
    h(
      'div',
      { class: 'card-surface' },
      h('h3', null, 'Przykładowe fiszki'),
      h(
        'div',
        { class: 'list' },
        ...examples.map((c) =>
          h(
            'div',
            { class: 'list-item' },
            h('div', { class: 'list-item-main' }, h('div', { class: 'list-item-title' }, c.word), h('div', { class: 'list-item-sub' }, c.translation || '—'))
          )
        )
      )
    ),
    h(
      'div',
      { class: 'card-surface' },
      h('h3', null, 'Dodaj do moich talii?'),
      h(
        'button',
        {
          class: 'btn btn-primary btn-block mt-16',
          onclick: () => importAsNewDeck(payload)
        },
        'Dodaj jako nową talię'
      ),
      decks.length > 0
        ? h(
            'div',
            { class: 'mt-16' },
            h('div', { class: 'field' }, h('label', null, 'Scal z istniejącą talią'), mergeSelect),
            h('button', { class: 'btn btn-outline btn-block', onclick: () => importMerge(payload, mergeSelect.value) }, 'Scal (pomiń duplikaty słów)')
          )
        : null,
      h(
        'button',
        {
          class: 'btn btn-outline btn-block mt-16',
          onclick: () => {
            clearPendingImport();
            navigate('/decks');
          }
        },
        'Anuluj'
      )
    )
  );
}

async function importAsNewDeck(payload: SharePayload): Promise<void> {
  const deck = await deckRepo.createDeck(payload.deckName, payload.deckDescription);
  await cardRepo.createCards(payload.cards.map((c) => ({ deckId: deck.id, ...c })));
  clearPendingImport();
  showToast(`Zaimportowano talię "${deck.name}" (${payload.cards.length} fiszek).`);
  navigate(`/decks/${deck.id}`);
}

async function importMerge(payload: SharePayload, targetDeckId: string): Promise<void> {
  const existingCards = await cardRepo.listCardsByDeck(targetDeckId);
  const toAdd = dedupeAgainstExisting(
    payload.cards,
    existingCards.map((c) => c.word)
  );
  if (toAdd.length === 0) {
    showToast('Wszystkie słowa z importu już istnieją w tej talii — nic nie dodano.');
    clearPendingImport();
    navigate(`/decks/${targetDeckId}`);
    return;
  }
  await cardRepo.createCards(toAdd.map((c) => ({ deckId: targetDeckId, ...c })));
  clearPendingImport();
  showToast(`Dodano ${toAdd.length} nowych fiszek (pominięto ${payload.cards.length - toAdd.length} duplikatów).`);
  navigate(`/decks/${targetDeckId}`);
}
