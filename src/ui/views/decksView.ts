import { cardRepo, deckRepo, folderRepo } from '../../db';
import { navigate } from '../../router';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';
import type { Deck, Folder } from '../../types';

export async function renderDecksView(container: HTMLElement): Promise<void> {
  setTopbar({
    title: 'Fiszki – Talie',
    actions: [
      h('button', { class: 'icon-button', 'aria-label': 'Importuj talię', onclick: () => navigate('/decks/import') }, icon('upload'))
    ]
  });

  mount(container, h('div', { class: 'spinner' }));

  const [decks, folders] = await Promise.all([deckRepo.listDecks(), folderRepo.listFolders()]);
  const counts = await Promise.all(decks.map((d) => cardRepo.countCardsByDeck(d.id)));
  const countByDeckId = new Map(decks.map((d, i) => [d.id, counts[i]]));

  if (decks.length === 0 && folders.length === 0) {
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

  const sections: HTMLElement[] = [renderFolderManager(folders, () => void renderDecksView(container))];

  const decksByFolder = new Map<string | null, Deck[]>();
  for (const deck of decks) {
    const key = deck.folderId;
    const list = decksByFolder.get(key) ?? [];
    list.push(deck);
    decksByFolder.set(key, list);
  }

  if (folders.length === 0) {
    // Nikt nie używa folderów - pokaż zwykłą płaską listę bez nagłówków.
    if (decks.length > 0) {
      sections.push(h('div', { class: 'list' }, ...decks.map((d) => deckListItem(d, countByDeckId.get(d.id) ?? 0))));
    }
  } else {
    for (const folder of folders) {
      const folderDecks = decksByFolder.get(folder.id) ?? [];
      if (folderDecks.length === 0) continue;
      sections.push(
        h('h2', null, folder.name),
        h('div', { class: 'list mb-16' }, ...folderDecks.map((d) => deckListItem(d, countByDeckId.get(d.id) ?? 0)))
      );
    }
    const unfiled = decksByFolder.get(null) ?? [];
    if (unfiled.length > 0) {
      sections.push(
        h('h2', null, 'Bez folderu'),
        h('div', { class: 'list mb-16' }, ...unfiled.map((d) => deckListItem(d, countByDeckId.get(d.id) ?? 0)))
      );
    }
  }

  if (decks.length === 0) {
    sections.push(h('p', { class: 'muted text-center mt-16' }, 'Nie masz jeszcze żadnej talii.'));
  }

  mount(container, ...sections, fab());
}

function renderFolderManager(folders: Folder[], onChange: () => void): HTMLElement {
  let editingId: string | null = null;
  const body = h('div');

  function renderBody(): void {
    const rows = folders.map((folder) => {
      if (editingId === folder.id) {
        const input = h('input', { type: 'text', value: folder.name, 'aria-label': 'Nowa nazwa folderu' }) as HTMLInputElement;
        return h(
          'div',
          { class: 'row mb-16' },
          input,
          h(
            'button',
            {
              class: 'btn btn-sm btn-primary',
              onclick: async () => {
                const name = input.value.trim();
                if (!name) return;
                await folderRepo.renameFolder(folder.id, name);
                editingId = null;
                onChange();
              }
            },
            'Zapisz'
          ),
          h('button', { class: 'btn btn-sm btn-outline', onclick: () => { editingId = null; renderBody(); } }, 'Anuluj')
        );
      }
      return h(
        'div',
        { class: 'row space-between mb-16' },
        h('span', null, folder.name),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            { class: 'icon-button', 'aria-label': `Zmień nazwę folderu ${folder.name}`, onclick: () => { editingId = folder.id; renderBody(); } },
            icon('edit')
          ),
          h(
            'button',
            {
              class: 'icon-button',
              'aria-label': `Usuń folder ${folder.name}`,
              onclick: async () => {
                if (!window.confirm(`Usunąć folder "${folder.name}"? Talie z tego folderu zostaną, ale przestaną być przypisane.`)) return;
                await folderRepo.deleteFolder(folder.id);
                onChange();
              }
            },
            icon('trash')
          )
        )
      );
    });

    const newFolderInput = h('input', { type: 'text', placeholder: 'Nazwa nowego folderu', 'aria-label': 'Nazwa nowego folderu' }) as HTMLInputElement;
    const addForm = h(
      'form',
      {
        class: 'row',
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const name = newFolderInput.value.trim();
          if (!name) return;
          await folderRepo.createFolder(name);
          onChange();
        }
      },
      newFolderInput,
      h('button', { type: 'submit', class: 'btn btn-sm btn-primary' }, 'Dodaj')
    );

    mount(body, ...rows, addForm);
  }

  renderBody();
  return h('details', { class: 'card-surface' }, h('summary', null, 'Zarządzaj folderami'), h('div', { class: 'mt-16' }, body));
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
