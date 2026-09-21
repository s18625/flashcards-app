import { cardRepo, reviewRepo, settingsRepo } from '../../db';
import { navigate } from '../../router';
import { nextSrsState } from '../../srs/sm2';
import type { Card, ReviewGrade } from '../../types';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { studyPrefs } from '../studyPrefs';
import { isTtsSupported, speak } from '../tts';

const GRADE_BUTTONS: { grade: ReviewGrade; label: string; className: string }[] = [
  { grade: 'again', label: 'Nie pamiętam', className: 'grade-again' },
  { grade: 'hard', label: 'Trudne', className: 'grade-hard' },
  { grade: 'good', label: 'Dobrze', className: 'grade-good' },
  { grade: 'easy', label: 'Łatwo', className: 'grade-easy' }
];

export async function renderStudySessionView(container: HTMLElement, scope: string): Promise<void> {
  const backPath = scope === 'all' ? '/study' : `/decks/${scope}`;
  setTopbar({ title: 'Sesja nauki', backPath });
  mount(container, h('div', { class: 'spinner' }));

  const settings = await settingsRepo.getSettings();
  const deckIds = scope === 'all' ? null : [scope];

  const newDoneToday = await reviewRepo.countNewCardsStudiedToday();
  const totalDoneToday = await reviewRepo.countReviewsToday();
  const reviewDoneToday = Math.max(0, totalDoneToday - newDoneToday);
  const newRemaining = Math.max(0, settings.dailyNewCardsLimit - newDoneToday);
  const reviewRemaining = Math.max(0, settings.dailyReviewLimit - reviewDoneToday);

  const queue = await cardRepo.getSessionQueue(deckIds, newRemaining, reviewRemaining);

  if (queue.length === 0) {
    mount(
      container,
      h(
        'div',
        { class: 'empty-state' },
        icon('graduate'),
        h('h2', null, 'Brak kart do powtórki'),
        h('p', null, 'Wszystko powtórzone albo osiągnięto dzienny limit. Zajrzyj później lub zmień limity w Ustawieniach.'),
        h('button', { class: 'btn btn-primary', onclick: () => navigate(backPath) }, 'Wróć')
      )
    );
    return;
  }

  const total = queue.length;
  let index = 0;
  let correctCount = 0;

  renderCurrentCard();

  function renderCurrentCard(): void {
    if (index >= queue.length) {
      renderSummary();
      return;
    }
    const card = queue[index];
    const progressPct = Math.round((index / total) * 100);
    const progress = h(
      'div',
      { class: 'progress-bar' },
      h('div', { class: 'progress-bar-fill', style: `width:${progressPct}%` })
    );
    const counter = h('p', { class: 'muted text-center' }, `Karta ${index + 1} z ${total}`);

    mount(container, progress, counter, studyPrefs.mode === 'type' ? renderTypeCard(card) : renderFlipCard(card));
  }

  function renderFlipCard(card: Card): HTMLElement {
    const isEnPl = studyPrefs.direction === 'en-pl';
    const frontText = isEnPl ? card.word : card.translation || '(brak tłumaczenia)';
    const frontSpeakable = isEnPl ? card.word : null;
    const backMain = isEnPl ? card.translation || '(brak tłumaczenia)' : card.word;
    const backSpeakable = isEnPl ? card.example || null : card.word;

    const flipEl = h('div', { class: 'flip-card', role: 'button', tabindex: '0', 'aria-label': 'Odwróć fiszkę' });
    const inner = h(
      'div',
      { class: 'flip-card-inner' },
      h(
        'div',
        { class: 'flip-face' },
        frontSpeakable ? speakerButton(frontSpeakable) : null,
        h('div', { class: 'flip-word' }, frontText),
        h('div', { class: 'flip-hint' }, 'Dotknij, aby odwrócić')
      ),
      h(
        'div',
        { class: 'flip-face flip-face-back' },
        backSpeakable ? speakerButton(backSpeakable) : null,
        h('div', { class: 'flip-word' }, backMain),
        card.example ? h('div', { class: 'flip-sub' }, card.example) : null,
        card.partOfSpeech ? h('div', { class: 'badge' }, card.partOfSpeech) : null
      )
    );
    flipEl.appendChild(inner);

    let flipped = false;
    const toggle = () => {
      flipped = !flipped;
      flipEl.classList.toggle('flipped', flipped);
    };
    flipEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.icon-button')) return;
      toggle();
    });
    flipEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    const scene = h('div', { class: 'flip-scene' }, flipEl);
    const grades = h(
      'div',
      { class: 'grade-row' },
      ...GRADE_BUTTONS.map((g) =>
        h(
          'button',
          {
            class: `grade-btn ${g.className}`,
            onclick: () => submitGrade(card, g.grade)
          },
          g.label
        )
      )
    );

    return h('div', null, scene, grades);
  }

  function renderTypeCard(card: Card): HTMLElement {
    const isEnPl = studyPrefs.direction === 'en-pl';
    const promptText = isEnPl ? card.word : card.translation || '(brak tłumaczenia)';
    const promptSpeakable = isEnPl ? card.word : null;
    const expectedAnswer = isEnPl ? card.translation : card.word;

    const answerInput = h('input', {
      type: 'text',
      autocapitalize: 'off',
      autocomplete: 'off',
      placeholder: isEnPl ? 'Wpisz tłumaczenie po polsku…' : 'Wpisz słowo po angielsku…',
      'aria-label': 'Twoja odpowiedź'
    }) as HTMLInputElement;

    const resultBox = h('div', { class: 'mt-16' });
    const gradesContainer = h('div');

    const promptCard = h(
      'div',
      { class: 'card-surface text-center', style: 'position:relative' },
      promptSpeakable ? speakerButton(promptSpeakable) : null,
      h('div', { class: 'flip-word' }, promptText)
    );

    const form = h(
      'form',
      {
        class: 'mt-16',
        onsubmit: (e: Event) => {
          e.preventDefault();
          checkAnswer();
        }
      },
      h('div', { class: 'field' }, answerInput),
      h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Sprawdź')
    );

    function checkAnswer(): void {
      const given = answerInput.value.trim().toLowerCase();
      const expected = (expectedAnswer || '').trim().toLowerCase();
      const isCorrect = given.length > 0 && expected.length > 0 && given === expected;
      answerInput.disabled = true;
      mount(
        resultBox,
        h(
          'div',
          { class: 'card-surface' },
          h('p', { class: isCorrect ? '' : 'muted' }, isCorrect ? '✓ Poprawnie!' : `Poprawna odpowiedź: ${expectedAnswer || '(brak danych)'}`),
          card.example ? h('p', { class: 'muted' }, card.example) : null
        )
      );
      mount(
        gradesContainer,
        h(
          'div',
          { class: 'grade-row' },
          ...GRADE_BUTTONS.map((g) =>
            h('button', { class: `grade-btn ${g.className}`, onclick: () => submitGrade(card, g.grade) }, g.label)
          )
        )
      );
    }

    return h('div', null, promptCard, form, resultBox, gradesContainer);
  }

  function speakerButton(text: string): HTMLElement | null {
    if (!isTtsSupported()) return null;
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-button',
        style: 'position:absolute; top:8px; right:8px',
        'aria-label': 'Odsłuchaj wymowę',
        onclick: (e: Event) => {
          e.stopPropagation();
          speak(text, settings.ttsVoiceLang);
        }
      },
      icon('speaker')
    );
  }

  async function submitGrade(card: Card, grade: ReviewGrade): Promise<void> {
    const nextSrs = nextSrsState(card.srs, grade);
    await cardRepo.updateCardSrs(card.id, nextSrs);
    await reviewRepo.logReview(card.id, card.deckId, grade, studyPrefs.direction);
    if (grade !== 'again') correctCount += 1;
    index += 1;
    renderCurrentCard();
  }

  function renderSummary(): void {
    const pct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    mount(
      container,
      h(
        'div',
        { class: 'empty-state' },
        icon('check'),
        h('h2', null, 'Sesja ukończona!'),
        h('p', null, `Powtórzono ${total} ${total === 1 ? 'kartę' : 'kart'}. Poprawnie: ${pct}%.`),
        h('button', { class: 'btn btn-primary', onclick: () => navigate(backPath) }, 'Zakończ')
      )
    );
  }
}
