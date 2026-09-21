import { deckRepo, folderRepo } from '../../db';
import { navigate } from '../../router';
import { h, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';
import type { Folder } from '../../types';

const NEW_FOLDER_VALUE = '__new__';

export async function renderDeckFormView(container: HTMLElement, deckId?: string): Promise<void> {
  const editing = Boolean(deckId);
  const existing = deckId ? await deckRepo.getDeck(deckId) : undefined;
  if (deckId && !existing) {
    showToast('Nie znaleziono talii.', 'error');
    navigate('/decks');
    return;
  }

  setTopbar({ title: editing ? 'Edytuj talię' : 'Nowa talia', backPath: editing ? `/decks/${deckId}` : '/decks' });

  let folders = await folderRepo.listFolders();
  let selectedFolderId: string | null = existing?.folderId ?? null;

  const nameInput = h('input', {
    type: 'text',
    id: 'deck-name',
    required: true,
    maxlength: 80,
    value: existing?.name ?? '',
    placeholder: 'np. Słówka z podróży'
  }) as HTMLInputElement;

  const descInput = h('textarea', {
    id: 'deck-desc',
    maxlength: 300,
    placeholder: 'Opcjonalny opis talii'
  }) as HTMLTextAreaElement;
  descInput.value = existing?.description ?? '';

  const folderFieldContainer = h('div', { class: 'field' }) as HTMLDivElement;

  function renderFolderField(): void {
    const select = h(
      'select',
      {
        id: 'deck-folder',
        onchange: async (e: Event) => {
          const value = (e.target as HTMLSelectElement).value;
          if (value === NEW_FOLDER_VALUE) {
            const name = window.prompt('Nazwa nowego folderu:');
            if (name && name.trim()) {
              const folder = await folderRepo.createFolder(name.trim());
              folders = await folderRepo.listFolders();
              selectedFolderId = folder.id;
            } else {
              selectedFolderId = existing?.folderId ?? null;
            }
          } else {
            selectedFolderId = value || null;
          }
          renderFolderField();
        }
      },
      h('option', { value: '', selected: selectedFolderId === null }, '— bez folderu —'),
      ...folders.map((f: Folder) => h('option', { value: f.id, selected: f.id === selectedFolderId }, f.name)),
      h('option', { value: NEW_FOLDER_VALUE }, '+ Nowy folder…')
    );
    mount(folderFieldContainer, h('label', { for: 'deck-folder' }, 'Folder (opcjonalnie)'), select);
  }
  renderFolderField();

  const form = h(
    'form',
    {
      class: 'card-surface',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
          showToast('Podaj nazwę talii.', 'error');
          nameInput.focus();
          return;
        }
        if (editing && deckId) {
          await deckRepo.updateDeck(deckId, { name, description: descInput.value.trim(), folderId: selectedFolderId });
          showToast('Talia zapisana.');
          navigate(`/decks/${deckId}`);
        } else {
          const deck = await deckRepo.createDeck(name, descInput.value.trim(), selectedFolderId);
          showToast('Talia utworzona.');
          navigate(`/decks/${deck.id}`);
        }
      }
    },
    h('div', { class: 'field' }, h('label', { for: 'deck-name' }, 'Nazwa talii'), nameInput),
    h('div', { class: 'field' }, h('label', { for: 'deck-desc' }, 'Opis (opcjonalnie)'), descInput),
    folderFieldContainer,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, editing ? 'Zapisz zmiany' : 'Utwórz talię')
  );

  mount(container, form);
  nameInput.focus();
}
