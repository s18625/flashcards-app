import { cardRepo, deckRepo, settingsRepo } from '../../db';
import { navigate } from '../../router';
import { enrichWord } from '../../translate/translate';
import type { Deck, PartOfSpeech } from '../../types';
import { parseBulkEntries } from '../../utils/bulkParse';
import { mapWithConcurrency } from '../../utils/concurrency';
import { h, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

interface BulkRow {
  id: string;
  selected: boolean;
  word: string;
  translation: string;
  example: string;
  enriching: boolean;
}

export async function renderBulkAddView(container: HTMLElement, deckId: string): Promise<void> {
  const deck = await deckRepo.getDeck(deckId);
  if (!deck) {
    showToast('Nie znaleziono talii.', 'error');
    navigate('/decks');
    return;
  }

  setTopbar({ title: 'Dodaj wiele fiszek naraz', backPath: `/decks/${deckId}` });

  const settings = await settingsRepo.getSettings();
  const allDecks = await deckRepo.listDecks();

  const body = h('div');
  mount(container, body);

  renderPasteStep();

  function renderPasteStep(): void {
    const textarea = h('textarea', {
      rows: '10',
      placeholder: 'jedna fiszka na linię, np.:\ntalkative, rozmowny\nstubborn, uparty\nshy'
    }) as HTMLTextAreaElement;

    mount(
      body,
      h(
        'div',
        { class: 'card-surface' },
        h('h2', null, 'Wklej listę słówek'),
        h(
          'p',
          { class: 'muted' },
          'Jedna fiszka na linię, w formacie „słowo, tłumaczenie”. Tłumaczenie możesz pominąć – dociągniemy je automatycznie. Rozdzielaczem może być też tabulator (wklejanie z arkusza) albo „ - ”.'
        ),
        h('div', { class: 'field mt-16' }, textarea),
        h(
          'button',
          {
            class: 'btn btn-primary btn-block',
            onclick: () => {
              const entries = parseBulkEntries(textarea.value);
              if (entries.length === 0) {
                showToast('Nie znaleziono żadnych słówek. Wpisz przynajmniej jedną linię.', 'error');
                return;
              }
              void processEntries(entries);
            }
          },
          'Dalej'
        )
      )
    );
  }

  async function processEntries(entries: { word: string; translation: string }[]): Promise<void> {
    const rows: BulkRow[] = entries.map((e, i) => ({
      id: `${i}-${e.word}`,
      selected: true,
      word: e.word,
      translation: e.translation,
      example: '',
      enriching: e.translation.trim().length === 0
    }));
    renderRows(rows, deckId);

    const toEnrich = rows.filter((r) => r.enriching);
    if (toEnrich.length === 0) return;

    if (!navigator.onLine) {
      toEnrich.forEach((r) => (r.enriching = false));
      renderRows(rows, deckId);
      showToast('Brak internetu – możesz zapisać same słowa i uzupełnić tłumaczenia później.', 'info');
      return;
    }

    await mapWithConcurrency(
      toEnrich,
      3,
      async (row) => {
        const enrichment = await enrichWord(row.word, settings);
        row.translation = enrichment.translation;
        row.example = enrichment.example;
        row.enriching = false;
        return null;
      },
      () => renderRows(rows, deckId)
    );
    renderRows(rows, deckId);
  }

  function renderRows(rows: BulkRow[], targetDeckId: string): void {
    const deckSelect = h(
      'select',
      { id: 'bulk-target-deck', onchange: (e: Event) => (currentTargetDeckId = (e.target as HTMLSelectElement).value) },
      ...allDecks.map((d: Deck) => h('option', { value: d.id, selected: d.id === targetDeckId }, d.name))
    ) as HTMLSelectElement;
    let currentTargetDeckId = targetDeckId;

    const items = rows.map((row) => rowItem(row, () => renderRows(rows, currentTargetDeckId)));

    const selectedCount = rows.filter((r) => r.selected).length;
    const stillEnriching = rows.some((r) => r.enriching);

    mount(
      body,
      h(
        'div',
        { class: 'card-surface' },
        h('div', { class: 'field' }, h('label', { for: 'bulk-target-deck' }, 'Talia docelowa'), deckSelect),
        h('button', { type: 'button', class: 'btn btn-sm btn-outline', onclick: renderPasteStep }, 'Wróć do wklejania'),
        stillEnriching ? h('p', { class: 'hint mt-16' }, 'Pobieranie brakujących tłumaczeń…') : null
      ),
      h('div', { class: 'candidate-list mb-16' }, ...items),
      h(
        'button',
        {
          class: 'btn btn-primary btn-block',
          disabled: selectedCount === 0,
          onclick: async () => {
            const toSave = rows.filter((r) => r.selected && r.word.trim());
            if (toSave.length === 0) return;
            await cardRepo.createCards(
              toSave.map((r) => ({
                deckId: currentTargetDeckId,
                word: r.word.trim(),
                translation: r.translation.trim(),
                example: r.example.trim(),
                partOfSpeech: '' as PartOfSpeech | ''
              }))
            );
            showToast(`Dodano ${toSave.length} fiszek.`);
            navigate(`/decks/${currentTargetDeckId}`);
          }
        },
        `Zapisz zaznaczone (${selectedCount})`
      )
    );
  }

  function rowItem(row: BulkRow, onChange: () => void): HTMLElement {
    const checkbox = h('input', {
      type: 'checkbox',
      checked: row.selected,
      'aria-label': `Zaznacz słowo ${row.word}`,
      onchange: (e: Event) => {
        row.selected = (e.target as HTMLInputElement).checked;
        onChange();
      }
    }) as HTMLInputElement;

    const wordInput = h('input', {
      type: 'text',
      value: row.word,
      'aria-label': 'Słowo angielskie',
      oninput: (e: Event) => (row.word = (e.target as HTMLInputElement).value)
    }) as HTMLInputElement;

    const translationInput = h('input', {
      type: 'text',
      value: row.translation,
      placeholder: row.enriching ? 'Szukam tłumaczenia…' : 'Tłumaczenie polskie',
      'aria-label': 'Tłumaczenie polskie',
      oninput: (e: Event) => (row.translation = (e.target as HTMLInputElement).value)
    }) as HTMLInputElement;

    return h(
      'div',
      { class: row.selected ? 'candidate-item' : 'candidate-item deselected' },
      h('div', { class: 'row' }, checkbox, wordInput),
      h('div', { class: 'field', style: 'margin:8px 0 0 34px' }, translationInput)
    );
  }
}
