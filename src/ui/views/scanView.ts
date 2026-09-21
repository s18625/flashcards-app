import { cardRepo, deckRepo, settingsRepo } from '../../db';
import { createOcrEngine, extractVocabularyCandidates, OcrError, type VocabularyCandidate } from '../../ocr';
import { navigate } from '../../router';
import { enrichWord } from '../../translate/translate';
import type { Deck, PartOfSpeech } from '../../types';
import { mapWithConcurrency } from '../../utils/concurrency';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

interface CandidateRow {
  id: string;
  selected: boolean;
  word: string;
  translation: string;
  example: string;
  enriching: boolean;
  /** 'glossary' = tłumaczenie wzięte wprost z rozpoznanej linii podręcznika (nie z API). */
  source: 'glossary' | 'lemma';
}

export async function renderScanView(container: HTMLElement, deckId: string): Promise<void> {
  const deck = await deckRepo.getDeck(deckId);
  if (!deck) {
    showToast('Nie znaleziono talii.', 'error');
    navigate('/decks');
    return;
  }

  setTopbar({ title: 'Dodaj słówka ze zdjęcia', backPath: `/decks/${deckId}` });

  const settings = await settingsRepo.getSettings();
  const allDecks = await deckRepo.listDecks();

  const body = h('div');
  mount(container, body);

  renderPickStep();

  function renderPickStep(): void {
    const cameraInput = h('input', {
      type: 'file',
      accept: 'image/*',
      capture: 'environment',
      id: 'scan-camera-input',
      style: 'display:none',
      onchange: (e: Event) => handleFile((e.target as HTMLInputElement).files?.[0])
    }) as HTMLInputElement;

    const galleryInput = h('input', {
      type: 'file',
      accept: 'image/*',
      id: 'scan-gallery-input',
      style: 'display:none',
      onchange: (e: Event) => handleFile((e.target as HTMLInputElement).files?.[0])
    }) as HTMLInputElement;

    const methodNote =
      settings.ocrMethod === 'vision-api'
        ? h(
            'p',
            { class: 'hint' },
            'Aktualna metoda OCR: model wizyjny (API). Zdjęcie zostanie wysłane do zewnętrznego serwisu — zapytamy o potwierdzenie przed wysyłką. Metodę zmienisz w Ustawieniach.'
          )
        : h('p', { class: 'hint' }, 'Aktualna metoda OCR: Tesseract.js – działa lokalnie w przeglądarce, bez wysyłania zdjęcia na zewnątrz.');

    mount(
      body,
      h(
        'div',
        { class: 'card-surface text-center' },
        icon('image'),
        h('h2', null, 'Zrób zdjęcie lub wybierz z galerii'),
        h('p', { class: 'muted' }, 'Sfotografuj fragment książki, menu, tablicy lub innego tekstu po angielsku.'),
        h(
          'div',
          { class: 'row row-wrap', style: 'justify-content:center; margin-top:16px' },
          h('button', { class: 'btn btn-primary', onclick: () => cameraInput.click() }, icon('camera'), 'Zrób zdjęcie'),
          h('button', { class: 'btn btn-outline', onclick: () => galleryInput.click() }, icon('image'), 'Wybierz z galerii')
        ),
        methodNote,
        cameraInput,
        galleryInput
      ),
      manualTextFallback()
    );
  }

  function manualTextFallback(): HTMLElement {
    const textarea = h('textarea', { placeholder: 'Wklej lub wpisz tekst angielski, z którego chcesz wyodrębnić słówka…' }) as HTMLTextAreaElement;
    return h(
      'details',
      { class: 'card-surface' },
      h('summary', null, 'Nie masz zdjęcia? Wpisz tekst ręcznie'),
      h('div', { class: 'field mt-16' }, textarea),
      h(
        'button',
        {
          class: 'btn btn-outline btn-block',
          onclick: () => {
            const text = textarea.value.trim();
            if (!text) {
              showToast('Wpisz jakiś tekst.', 'error');
              return;
            }
            void processRecognizedText(text);
          }
        },
        'Wyodrębnij słówka z tekstu'
      )
    );
  }

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;

    const engine = createOcrEngine(settings);
    if (engine.sendsImageExternally) {
      const ok = window.confirm(
        'Ta metoda OCR wyśle zrobione zdjęcie do zewnętrznego API modelu wizyjnego. Czy chcesz kontynuować?'
      );
      if (!ok) return;
    }

    const previewUrl = URL.createObjectURL(file);
    let progress = 0;
    const progressBar = h('div', { class: 'progress-bar' }, h('div', { class: 'progress-bar-fill', style: 'width:0%' }));

    mount(
      body,
      h(
        'div',
        { class: 'card-surface text-center' },
        h('img', { src: previewUrl, alt: 'Podgląd zdjęcia', style: 'max-width:100%; border-radius:12px; margin-bottom:16px' }),
        h('div', { class: 'spinner' }),
        h('p', { class: 'muted mt-16' }, 'Rozpoznawanie tekstu…'),
        progressBar
      )
    );

    try {
      const result = await engine.recognize(file, {
        onProgress: (p) => {
          progress = Math.round(p * 100);
          const fill = progressBar.firstElementChild as HTMLElement;
          if (fill) fill.style.width = `${progress}%`;
        }
      });
      await processRecognizedText(result.text);
    } catch (err) {
      const message = err instanceof OcrError ? err.message : 'Wystąpił nieoczekiwany błąd podczas rozpoznawania tekstu.';
      showToast(message, 'error');
      renderPickStep();
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  }

  async function processRecognizedText(text: string): Promise<void> {
    const found = extractVocabularyCandidates(text, { limit: 60 });
    if (found.length === 0) {
      showToast('Nie znaleziono żadnych nowych słówek w rozpoznanym tekście.', 'error');
      renderPickStep();
      return;
    }
    const isGlossary = found[0].source === 'glossary';
    const rows: CandidateRow[] = found.map((c: VocabularyCandidate, i) => ({
      id: `${i}-${c.word}`,
      selected: true,
      word: c.word,
      translation: c.translation,
      example: '',
      // Wpisy ze słowniczka mają tłumaczenie już gotowe z podręcznika – nie
      // trzeba dopytywać zewnętrznego API o tłumaczenie.
      enriching: c.source === 'lemma',
      source: c.source
    }));
    if (isGlossary) {
      showToast('Wykryto listę słownictwa – wyciągnięto całe wyrażenia razem z tłumaczeniami z podręcznika.');
    }
    renderCandidates(rows, deckId, isGlossary);

    const toEnrich = rows.filter((r) => r.source === 'lemma');
    if (toEnrich.length === 0) return;

    if (!navigator.onLine) {
      toEnrich.forEach((r) => (r.enriching = false));
      renderCandidates(rows, deckId, isGlossary);
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
      () => renderCandidates(rows, deckId, isGlossary)
    );
    renderCandidates(rows, deckId, isGlossary);
  }

  function renderCandidates(rows: CandidateRow[], targetDeckId: string, isGlossary: boolean): void {
    const deckSelect = h(
      'select',
      { id: 'scan-target-deck', onchange: (e: Event) => (currentTargetDeckId = (e.target as HTMLSelectElement).value) },
      ...allDecks.map((d: Deck) => h('option', { value: d.id, selected: d.id === targetDeckId }, d.name))
    ) as HTMLSelectElement;
    let currentTargetDeckId = targetDeckId;

    const items = rows.map((row) => candidateItem(row, () => renderCandidates(rows, currentTargetDeckId, isGlossary)));

    const selectedCount = rows.filter((r) => r.selected).length;
    const stillEnriching = rows.some((r) => r.enriching);

    mount(
      body,
      h(
        'div',
        { class: 'card-surface' },
        h('div', { class: 'field' }, h('label', { for: 'scan-target-deck' }, 'Talia docelowa'), deckSelect),
        isGlossary
          ? h('p', { class: 'hint' }, 'Rozpoznano format listy słownictwa – tłumaczenia pochodzą z podręcznika, nie z automatycznego API.')
          : null,
        stillEnriching ? h('p', { class: 'hint' }, 'Pobieranie tłumaczeń i przykładowych zdań…') : null
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

  function candidateItem(row: CandidateRow, onChange: () => void): HTMLElement {
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
