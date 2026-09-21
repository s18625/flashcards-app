import { cardRepo, deckRepo } from '../../db';
import { isNewCard } from '../../srs/sm2';
import { navigate } from '../../router';
import { studyPrefs } from '../studyPrefs';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';

export async function renderStudyPickerView(container: HTMLElement): Promise<void> {
  setTopbar({ title: 'Nauka' });

  mount(container, h('div', { class: 'spinner' }));

  const decks = await deckRepo.listDecks();
  const allCards = await cardRepo.getAllCards();
  const now = Date.now();

  const directionGroup = radioGroup(
    'Kierunek',
    'study-direction',
    [
      { value: 'en-pl', label: 'Angielski → Polski' },
      { value: 'pl-en', label: 'Polski → Angielski' }
    ],
    studyPrefs.direction,
    (v) => (studyPrefs.direction = v as typeof studyPrefs.direction)
  );

  const modeGroup = radioGroup(
    'Tryb',
    'study-mode',
    [
      { value: 'flip', label: 'Odwracanie fiszki' },
      { value: 'type', label: 'Wpisywanie odpowiedzi' }
    ],
    studyPrefs.mode,
    (v) => (studyPrefs.mode = v as typeof studyPrefs.mode)
  );

  if (decks.length === 0) {
    mount(
      container,
      h('div', { class: 'empty-state' }, h('p', null, 'Utwórz talię i dodaj fiszki, aby zacząć naukę.'), h('button', { class: 'btn btn-primary', onclick: () => navigate('/decks/new') }, 'Nowa talia'))
    );
    return;
  }

  let totalDue = 0;
  let totalNew = 0;
  const deckRows = decks.map((deck) => {
    const deckCards = allCards.filter((c) => c.deckId === deck.id);
    const due = deckCards.filter((c) => c.srs.dueDate <= now && !isNewCard(c.srs)).length;
    const fresh = deckCards.filter((c) => isNewCard(c.srs)).length;
    totalDue += due;
    totalNew += fresh;
    return h(
      'div',
      { class: 'list-item' },
      h(
        'div',
        { class: 'list-item-main' },
        h('div', { class: 'list-item-title' }, deck.name),
        h('div', { class: 'list-item-sub' }, `${due} do powtórki · ${fresh} nowych`)
      ),
      h(
        'button',
        {
          class: 'btn btn-sm btn-primary',
          disabled: due + fresh === 0,
          onclick: () => navigate(`/study/${deck.id}`)
        },
        'Ucz się'
      )
    );
  });

  mount(
    container,
    h(
      'div',
      { class: 'card-surface' },
      directionGroup,
      modeGroup,
      h(
        'button',
        {
          class: 'btn btn-primary btn-block mt-16',
          disabled: totalDue + totalNew === 0,
          onclick: () => navigate('/study/all')
        },
        icon('graduate'),
        `Ucz się ze wszystkich talii (${totalDue + totalNew})`
      )
    ),
    h('h2', null, 'Talie'),
    h('div', { class: 'list' }, ...deckRows)
  );
}

function radioGroup(
  legend: string,
  name: string,
  options: { value: string; label: string }[],
  selected: string,
  onSelect: (value: string) => void
): HTMLElement {
  return h(
    'fieldset',
    { class: 'field', style: 'border:none; padding:0; margin:0 0 16px' },
    h('legend', { style: 'font-weight:600; margin-bottom:8px' }, legend),
    ...options.map((opt) =>
      h(
        'label',
        { class: 'checkbox-row' },
        h('input', {
          type: 'radio',
          name,
          value: opt.value,
          checked: opt.value === selected,
          onchange: () => onSelect(opt.value)
        }),
        opt.label
      )
    )
  );
}
