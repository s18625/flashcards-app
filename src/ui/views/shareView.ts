import { cardRepo, deckRepo } from '../../db';
import { navigate } from '../../router';
import { generateQrDataUrl } from '../../share/qrcode';
import { buildShareFile, buildShareUrl, QR_SAFE_LENGTH, encodeSharePayload, serializeDeckForSharing, ShareValidationError } from '../../share/share';
import { shareOrDownloadFile } from '../../share/webshare';
import { h, icon, mount } from '../dom';
import { setTopbar } from '../shell';
import { showToast } from '../toast';

export async function renderShareView(container: HTMLElement, deckId: string): Promise<void> {
  const deck = await deckRepo.getDeck(deckId);
  if (!deck) {
    showToast('Nie znaleziono talii.', 'error');
    navigate('/decks');
    return;
  }

  const deckName = deck.name;
  setTopbar({ title: `Udostępnij: ${deckName}`, backPath: `/decks/${deckId}` });
  mount(container, h('div', { class: 'spinner' }));

  const cards = await cardRepo.listCardsByDeck(deckId);
  const payload = serializeDeckForSharing(deck, cards);

  if (cards.length === 0) {
    mount(container, h('div', { class: 'empty-state' }, h('p', null, 'Ta talia nie ma jeszcze żadnych fiszek do udostępnienia.')));
    return;
  }

  let compressedLength = 0;
  let linkError: string | null = null;
  try {
    compressedLength = encodeSharePayload(payload).length;
  } catch (err) {
    linkError = err instanceof ShareValidationError ? err.message : 'Nie udało się przygotować linku.';
  }

  const sections: HTMLElement[] = [
    h(
      'div',
      { class: 'card-surface' },
      h(
        'p',
        null,
        '⚠️ Udostępniane są wyłącznie słowa, tłumaczenia, przykładowe zdania i notatki. Link, plik i kod QR zawierają całą zawartość talii w postaci jawnej — każdy, kto je otrzyma, może je odczytać. Nie są udostępniane Twoje postępy w nauce, statystyki ani klucze API.'
      )
    )
  ];

  sections.push(
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Link'),
      linkError
        ? h('p', { class: 'muted' }, linkError, ' Użyj eksportu do pliku poniżej.')
        : h(
            'div',
            null,
            h('p', { class: 'muted' }, `Rozmiar danych: ~${compressedLength} znaków w adresie URL.`),
            h(
              'div',
              { class: 'row row-wrap' },
              h('button', { class: 'btn btn-primary', onclick: () => copyLink() }, 'Kopiuj link'),
              h('button', { class: 'btn btn-outline', onclick: () => shareLink() }, icon('share'), 'Udostępnij link')
            )
          )
    )
  );

  sections.push(
    h(
      'div',
      { class: 'card-surface' },
      h('h2', null, 'Plik .json'),
      h('p', { class: 'muted' }, 'Plik zawiera pole wersji formatu i można go zaimportować w innym urządzeniu.'),
      h('button', { class: 'btn btn-outline btn-block', onclick: () => shareFile() }, 'Udostępnij / pobierz plik')
    )
  );

  if (!linkError && compressedLength <= QR_SAFE_LENGTH) {
    const qrContainer = h('div', { class: 'text-center' }, h('p', { class: 'muted' }, 'Generowanie kodu QR…'));
    sections.push(h('div', { class: 'card-surface' }, h('h2', null, 'Kod QR'), qrContainer));
    void generateQrDataUrl(buildShareUrl(payload)).then((dataUrl) => {
      mount(qrContainer, h('img', { class: 'qr-image', src: dataUrl, alt: `Kod QR talii ${deckName}` }), h('p', { class: 'hint text-center' }, 'Zeskanuj aparatem telefonu, aby otworzyć talię do importu.'));
    });
  } else if (!linkError) {
    sections.push(h('div', { class: 'card-surface' }, h('h2', null, 'Kod QR'), h('p', { class: 'muted' }, 'Ta talia jest zbyt duża, aby zmieściła się w wygodnie skanowalnym kodzie QR. Użyj linku lub pliku.')));
  }

  mount(container, ...sections);

  async function copyLink(): Promise<void> {
    try {
      const url = buildShareUrl(payload);
      await navigator.clipboard.writeText(url);
      showToast('Link skopiowany do schowka.');
    } catch {
      showToast('Nie udało się skopiować linku.', 'error');
    }
  }

  async function shareLink(): Promise<void> {
    const url = buildShareUrl(payload);
    const nav = navigator as Navigator & { share?: (data: { title?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: `Talia: ${deckName}`, url });
        return;
      } catch {
        // użytkownik anulował albo API nie zadziałało – spróbujemy skopiować
      }
    }
    await copyLink();
  }

  async function shareFile(): Promise<void> {
    const { filename, blob } = buildShareFile(payload);
    const result = await shareOrDownloadFile(filename, blob, `Talia: ${deckName}`);
    if (result === 'shared') showToast('Plik udostępniony.');
    else if (result === 'downloaded') showToast('Plik pobrany.');
  }
}
