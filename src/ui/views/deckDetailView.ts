import { cardRepo, deckRepo } from '../../db';
import { navigate } from '../../router';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';
import type { Card } from '../../types';

const POS_LABELS: Record<string, string> = {
  noun: 'rzeczownik',
  verb: 'czasownik',
  adjective: 'przymiotnik',
  adverb: 'przysłówek',
  phrase: 'zwrot',
  other: 'inne'
};

export async function renderDeckDetailView(container: HTMLElement, deckId: string): Promise<void> {
  const deck = await deckRepo.getDeck(deckId);
  if (!deck) {
    showToast('Nie znaleziono talii.', 'error');
    navigate('/decks');
    return;
  }

  setTopbar({
    title: deck.name,
    backPath: '/decks',
    actions: [
      h('button', { class: 'icon-button', 'aria-label': 'Udostępnij talię', onclick: () => navigate(`/decks/${deckId}/share`) }, icon('share'))
    ]
  });

  mount(container, h('div', { class: 'spinner' }));

  const cards = await cardRepo.listCardsByDeck(deckId);

  const actions = h(
    'div',
    { class: 'row row-wrap mb-16' },
    h('button', { class: 'btn btn-primary', onclick: () => navigate(`/decks/${deckId}/study`) }, icon('graduate'), 'Ucz się'),
    h('button', { class: 'btn btn-outline', onclick: () => navigate(`/decks/${deckId}/scan`) }, icon('camera'), 'Dodaj ze zdjęcia'),
    h('button', { class: 'btn btn-outline', onclick: () => navigate(`/decks/${deckId}/cards/new`) }, icon('plus'), 'Dodaj ręcznie'),
    h('button', { class: 'btn btn-outline', onclick: () => navigate(`/decks/${deckId}/cards/bulk`) }, icon('upload'), 'Dodaj wiele naraz')
  );

  if (deck.description) {
    mount(container, actions, h('p', { class: 'muted mb-16' }, deck.description));
  } else {
    mount(container, actions);
  }

  if (cards.length === 0) {
    container.appendChild(
      h(
        'div',
        { class: 'empty-state' },
        h('p', null, 'Ta talia nie ma jeszcze żadnych fiszek.'),
        h(
          'div',
          { class: 'row row-wrap', style: 'justify-content:center' },
          h('button', { class: 'btn btn-primary', onclick: () => navigate(`/decks/${deckId}/cards/new`) }, 'Dodaj pierwszą fiszkę'),
          h('button', { class: 'btn btn-outline', onclick: () => navigate(`/decks/${deckId}/cards/bulk`) }, 'Dodaj wiele naraz')
        )
      )
    );
    return;
  }

  const list = h('div', { class: 'list' }, ...cards.map((c) => cardListItem(deckId, c)));
  container.appendChild(list);
}

function cardListItem(deckId: string, card: Card): HTMLElement {
  const dueSoon = card.srs.dueDate <= Date.now();
  return h(
    'a',
    {
      class: 'list-item',
      href: `#/decks/${deckId}/cards/${card.id}/edit`,
      onclick: (e: Event) => {
        e.preventDefault();
        navigate(`/decks/${deckId}/cards/${card.id}/edit`);
      }
    },
    h(
      'div',
      { class: 'list-item-main' },
      h(
        'div',
        { class: 'list-item-title' },
        card.word,
        card.partOfSpeech ? h('span', { class: 'muted' }, ` (${POS_LABELS[card.partOfSpeech] ?? card.partOfSpeech})`) : null
      ),
      h('div', { class: 'list-item-sub' }, card.translation || '— brak tłumaczenia —')
    ),
    h('div', { class: 'list-item-actions' }, dueSoon ? h('span', { class: 'badge' }, 'do powtórki') : null)
  );
}
