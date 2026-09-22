import { cardRepo, deckRepo } from '../../db';
import { navigate } from '../../router';
import { searchCards } from '../../search/search';
import type { Card } from '../../types';
import { h, mount } from '../dom';
import { setTopbar } from '../shell';

const RESULTS_LIMIT = 100;

export async function renderSearchView(container: HTMLElement): Promise<void> {
  setTopbar({ title: 'Szukaj fiszek', backPath: '/decks' });
  mount(container, h('div', { class: 'spinner' }));

  const [decks, cards] = await Promise.all([deckRepo.listDecks(), cardRepo.getAllCards()]);
  const deckNameById = new Map(decks.map((d) => [d.id, d.name]));

  const input = h('input', {
    type: 'search',
    placeholder: 'Szukaj po słowie, tłumaczeniu, przykładzie albo notatce…',
    'aria-label': 'Szukaj fiszek',
    autocomplete: 'off'
  }) as HTMLInputElement;

  const hintEl = h('p', { class: 'muted text-center mt-16' });
  const resultsEl = h('div', { class: 'list mt-16' });

  function renderResults(): void {
    const query = input.value;
    if (!query.trim()) {
      mount(resultsEl);
      hintEl.textContent = 'Wpisz szukane słowo, tłumaczenie, przykład albo notatkę.';
      return;
    }
    const matches = searchCards(cards, query);
    if (matches.length === 0) {
      mount(resultsEl);
      hintEl.textContent = `Brak wyników dla „${query.trim()}”.`;
      return;
    }
    hintEl.textContent = '';
    const shown = matches.slice(0, RESULTS_LIMIT);
    mount(
      resultsEl,
      ...shown.map((c) => resultItem(c, deckNameById.get(c.deckId) ?? '')),
      matches.length > RESULTS_LIMIT
        ? h('p', { class: 'muted text-center mt-16' }, `Pokazano pierwsze ${RESULTS_LIMIT} z ${matches.length} wyników. Doprecyzuj wyszukiwanie.`)
        : null
    );
  }

  input.addEventListener('input', renderResults);

  mount(container, h('div', { class: 'field' }, input), hintEl, resultsEl);
  renderResults();
  input.focus();
}

function resultItem(card: Card, deckName: string): HTMLElement {
  return h(
    'a',
    {
      class: 'list-item',
      href: `#/decks/${card.deckId}/cards/${card.id}/edit`,
      onclick: (e: Event) => {
        e.preventDefault();
        navigate(`/decks/${card.deckId}/cards/${card.id}/edit`);
      }
    },
    h(
      'div',
      { class: 'list-item-main' },
      h('div', { class: 'list-item-title' }, `${card.word} — ${card.translation || '(brak tłumaczenia)'}`),
      h('div', { class: 'list-item-sub' }, deckName)
    )
  );
}
