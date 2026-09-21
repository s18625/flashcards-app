import { cardRepo, deckRepo } from '../../db';
import { navigate } from '../../router';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';
import type { Deck } from '../../types';

export async function renderDecksView(container: HTMLElement): Promise<void> {
  setTopbar({
    title: 'Fiszki – Talie',
    actions: [
      h('button', { class: 'icon-button', 'aria-label': 'Importuj talię', onclick: () => navigate('/decks/import') }, icon('upload'))
    ]
  });

  mount(container, h('div', { class: 'spinner' }));

  const decks = await deckRepo.listDecks();
  const counts = await Promise.all(decks.map((d) => cardRepo.countCardsByDeck(d.id)));

  if (decks.length === 0) {
    mount(
      container,
      h(
        'div',
        { class: 'empty-state' },
        icon('cards'),
        h('h2', null, 'Brak talii'),
        h('p', null, 'Utwórz pierwszą talię, aby zacząć dodawać słówka.'),
        h('button', { class: 'btn btn-primary', onclick: () => navigate('/decks/new') }, icon('plus'), 'Nowa talia')
      ),
      fab()
    );
    return;
  }

  const items = decks.map((deck, i) => deckListItem(deck, counts[i]));
  mount(container, h('div', { class: 'list' }, ...items), fab());
}

function fab(): HTMLElement {
  return h('button', { class: 'fab', 'aria-label': 'Nowa talia', onclick: () => navigate('/decks/new') }, icon('plus'));
}

function deckListItem(deck: Deck, cardCount: number): HTMLElement {
  return h(
    'a',
    {
      class: 'list-item',
      href: `#/decks/${deck.id}`,
      onclick: (e: Event) => {
        e.preventDefault();
        navigate(`/decks/${deck.id}`);
      }
    },
    h(
      'div',
      { class: 'list-item-main' },
      h('div', { class: 'list-item-title' }, deck.name),
      h('div', { class: 'list-item-sub' }, `${cardCount} ${cardWord(cardCount)}`)
    ),
    h(
      'div',
      { class: 'list-item-actions' },
      h(
        'button',
        {
          class: 'icon-button',
          'aria-label': `Edytuj talię ${deck.name}`,
          onclick: (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(`/decks/${deck.id}/edit`);
          }
        },
        icon('edit')
      ),
      h(
        'button',
        {
          class: 'icon-button',
          'aria-label': `Usuń talię ${deck.name}`,
          onclick: async (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.confirm(`Usunąć talię "${deck.name}" wraz ze wszystkimi fiszkami? Tej operacji nie można cofnąć.`)) return;
            await deckRepo.deleteDeck(deck.id);
            showToast('Talia usunięta.');
            navigate('/decks');
            void renderDecksView(document.getElementById('view')!);
          }
        },
        icon('trash')
      )
    )
  );
}

function cardWord(count: number): string {
  if (count === 1) return 'fiszka';
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'fiszki';
  return 'fiszek';
}
