import { cardRepo, settingsRepo } from '../../db';
import { navigate } from '../../router';
import { enrichWord } from '../../translate/translate';
import type { PartOfSpeech } from '../../types';
import { fileToResizedDataUrl } from '../../utils/image';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

const POS_OPTIONS: { value: PartOfSpeech | ''; label: string }[] = [
  { value: '', label: '— nie wybrano —' },
  { value: 'noun', label: 'rzeczownik' },
  { value: 'verb', label: 'czasownik' },
  { value: 'adjective', label: 'przymiotnik' },
  { value: 'adverb', label: 'przysłówek' },
  { value: 'phrase', label: 'zwrot' },
  { value: 'other', label: 'inne' }
];

export async function renderCardFormView(container: HTMLElement, deckId: string, cardId?: string): Promise<void> {
  const editing = Boolean(cardId);
  const existing = cardId ? await cardRepo.getCard(cardId) : undefined;
  if (cardId && !existing) {
    showToast('Nie znaleziono fiszki.', 'error');
    navigate(`/decks/${deckId}`);
    return;
  }

  setTopbar({ title: editing ? 'Edytuj fiszkę' : 'Nowa fiszka', backPath: `/decks/${deckId}` });

  const settings = await settingsRepo.getSettings();

  const wordInput = h('input', {
    type: 'text',
    id: 'card-word',
    required: true,
    maxlength: 200,
    value: existing?.word ?? '',
    placeholder: 'np. spoon',
    autocapitalize: 'off',
    autocomplete: 'off'
  }) as HTMLInputElement;

  const translationInput = h('input', {
    type: 'text',
    id: 'card-translation',
    maxlength: 200,
    value: existing?.translation ?? '',
    placeholder: 'np. łyżka'
  }) as HTMLInputElement;

  const suggestionHint = h('div', { class: 'hint' }) as HTMLDivElement;

  const exampleInput = h('textarea', {
    id: 'card-example',
    maxlength: 300,
    placeholder: 'np. Pass me the spoon, please.'
  }) as HTMLTextAreaElement;
  exampleInput.value = existing?.example ?? '';

  const posSelect = h(
    'select',
    { id: 'card-pos' },
    ...POS_OPTIONS.map((o) => h('option', { value: o.value, selected: existing?.partOfSpeech === o.value }, o.label))
  ) as HTMLSelectElement;

  const noteInput = h('textarea', { id: 'card-note', maxlength: 300, placeholder: 'Prywatna notatka (opcjonalnie)' }) as HTMLTextAreaElement;
  noteInput.value = existing?.note ?? '';

  let imageDataUrl: string | null = existing?.image ?? null;
  const imageFieldContainer = h('div', { class: 'field' }) as HTMLDivElement;

  function renderImageField(): void {
    const fileInput = h('input', { type: 'file', id: 'card-image', accept: 'image/*' }) as HTMLInputElement;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        imageDataUrl = await fileToResizedDataUrl(file);
      } catch {
        showToast('Nie udało się wczytać obrazka. Spróbuj innego pliku.', 'error');
        return;
      } finally {
        renderImageField();
      }
    });

    const removeButton = imageDataUrl
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm btn-outline mt-8',
            onclick: () => {
              imageDataUrl = null;
              renderImageField();
            }
          },
          icon('trash'),
          'Usuń zdjęcie'
        )
      : null;

    mount(
      imageFieldContainer,
      h('label', { for: 'card-image' }, 'Zdjęcie / obrazek (opcjonalnie, wizualna mnemotechnika)'),
      imageDataUrl ? h('img', { class: 'card-image-preview', src: imageDataUrl, alt: '' }) : null,
      fileInput,
      removeButton
    );
  }
  renderImageField();

  let debounceTimer: number | undefined;
  wordInput.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    if (editing || translationInput.value.trim()) return; // nie nadpisujemy ręcznej edycji
    const word = wordInput.value.trim();
    if (word.length < 2) {
      mount(suggestionHint);
      return;
    }
    debounceTimer = window.setTimeout(async () => {
      mount(suggestionHint, 'Szukam podpowiedzi tłumaczenia…');
      // enrichWord korzysta z modelu AI (jeśli skonfigurowano klucz w Ustawieniach) –
      // znacznie trafniej niż MyMemory radzi sobie z wyrażeniami wieloczłonowymi
      // i idiomami (np. "take after sb", "put up with sth").
      const enrichment = await enrichWord(word, settings);
      if (!enrichment.translation || wordInput.value.trim() !== word) {
        mount(suggestionHint);
        return;
      }
      mount(
        suggestionHint,
        `Podpowiedź: ${enrichment.translation} `,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm btn-outline',
            onclick: () => {
              translationInput.value = enrichment.translation;
              if (!exampleInput.value.trim() && enrichment.example) {
                exampleInput.value = enrichment.example;
              }
              mount(suggestionHint);
            }
          },
          'Użyj'
        )
      );
    }, 500);
  });

  const deleteButton = editing
    ? h(
        'button',
        {
          type: 'button',
          class: 'btn btn-danger btn-block mt-16',
          onclick: async () => {
            if (!window.confirm(`Usunąć fiszkę "${existing!.word}"?`)) return;
            await cardRepo.deleteCard(cardId!);
            showToast('Fiszka usunięta.');
            navigate(`/decks/${deckId}`);
          }
        },
        icon('trash'),
        'Usuń fiszkę'
      )
    : null;

  const form = h(
    'form',
    {
      class: 'card-surface',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const word = wordInput.value.trim();
        if (!word) {
          showToast('Podaj słowo angielskie.', 'error');
          wordInput.focus();
          return;
        }
        const payload = {
          word,
          translation: translationInput.value.trim(),
          example: exampleInput.value.trim(),
          partOfSpeech: posSelect.value as PartOfSpeech | '',
          note: noteInput.value.trim(),
          image: imageDataUrl
        };
        if (editing && cardId) {
          await cardRepo.updateCard(cardId, payload);
          showToast('Fiszka zapisana.');
        } else {
          await cardRepo.createCard({ deckId, ...payload });
          showToast('Fiszka dodana.');
        }
        navigate(`/decks/${deckId}`);
      }
    },
    h('div', { class: 'field' }, h('label', { for: 'card-word' }, 'Słowo angielskie'), wordInput),
    h('div', { class: 'field' }, h('label', { for: 'card-translation' }, 'Tłumaczenie polskie'), translationInput, suggestionHint),
    h('div', { class: 'field' }, h('label', { for: 'card-example' }, 'Przykładowe zdanie (opcjonalnie)'), exampleInput),
    h('div', { class: 'field' }, h('label', { for: 'card-pos' }, 'Część mowy (opcjonalnie)'), posSelect),
    h('div', { class: 'field' }, h('label', { for: 'card-note' }, 'Notatka (opcjonalnie)'), noteInput),
    imageFieldContainer,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, editing ? 'Zapisz zmiany' : 'Dodaj fiszkę'),
    deleteButton
  );

  mount(container, form);
  wordInput.focus();
}
