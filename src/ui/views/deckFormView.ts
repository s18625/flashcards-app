import { deckRepo } from '../../db';
import { navigate } from '../../router';
import { h, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

export async function renderDeckFormView(container: HTMLElement, deckId?: string): Promise<void> {
  const editing = Boolean(deckId);
  const existing = deckId ? await deckRepo.getDeck(deckId) : undefined;
  if (deckId && !existing) {
    showToast('Nie znaleziono talii.', 'error');
    navigate('/decks');
    return;
  }

  setTopbar({ title: editing ? 'Edytuj talię' : 'Nowa talia', backPath: editing ? `/decks/${deckId}` : '/decks' });

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
          await deckRepo.updateDeck(deckId, { name, description: descInput.value.trim() });
          showToast('Talia zapisana.');
          navigate(`/decks/${deckId}`);
        } else {
          const deck = await deckRepo.createDeck(name, descInput.value.trim());
          showToast('Talia utworzona.');
          navigate(`/decks/${deck.id}`);
        }
      }
    },
    h('div', { class: 'field' }, h('label', { for: 'deck-name' }, 'Nazwa talii'), nameInput),
    h('div', { class: 'field' }, h('label', { for: 'deck-desc' }, 'Opis (opcjonalnie)'), descInput),
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, editing ? 'Zapisz zmiany' : 'Utwórz talię')
  );

  mount(container, form);
  nameInput.focus();
}
