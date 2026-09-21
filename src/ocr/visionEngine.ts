import type { AppSettings } from '../types';
import { OcrError, type OcrEngine, type OcrRecognizeOptions, type OcrResult } from './types';

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const PROMPT =
  'Przepisz dokładnie cały czytelny tekst widoczny na tym zdjęciu (może być po angielsku lub w innym języku). ' +
  'Zwróć wyłącznie sam przepisany tekst, bez komentarzy, bez tłumaczenia, bez formatowania markdown.';

/**
 * Silnik OCR oparty o zewnętrzne API modelu wizyjnego (domyślnie Anthropic
 * Messages API). Klucz API podawany jest przez użytkownika w Ustawieniach
 * i przechowywany wyłącznie lokalnie (IndexedDB) – zdjęcie jest wysyłane do
 * zewnętrznego serwisu tylko gdy ta metoda jest wybrana świadomie.
 */
export class VisionApiOcrEngine implements OcrEngine {
  readonly id = 'vision-api' as const;
  readonly label = 'Model wizyjny (API, wymaga internetu i klucza)';
  readonly requiresNetwork = true;
  readonly sendsImageExternally = true;

  constructor(private readonly settings: Pick<AppSettings, 'visionApiKey' | 'visionApiEndpoint' | 'visionApiModel'>) {}

  async recognize(image: Blob, options: OcrRecognizeOptions = {}): Promise<OcrResult> {
    const { visionApiKey, visionApiEndpoint, visionApiModel } = this.settings;
    if (!visionApiKey.trim()) {
      throw new OcrError('Brak klucza API modelu wizyjnego. Ustaw go w Ustawieniach, aby użyć tej metody.');
    }
    if (!navigator.onLine) {
      throw new OcrError('Brak połączenia z internetem – ta metoda OCR wymaga sieci. Przełącz się na Tesseract.js lub spróbuj później.');
    }

    let base64: string;
    try {
      base64 = await blobToBase64(image);
    } catch (err) {
      throw new OcrError('Nie udało się przygotować zdjęcia do wysłania.', err);
    }

    const mediaType = image.type || 'image/jpeg';

    let response: Response;
    try {
      response = await fetch(visionApiEndpoint, {
        method: 'POST',
        signal: options.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': visionApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: visionApiModel,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                { type: 'text', text: PROMPT }
              ]
            }
          ]
        })
      });
    } catch (err) {
      throw new OcrError('Nie udało się połączyć z API modelu wizyjnego. Sprawdź internet lub spróbuj później.', err);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new OcrError('Klucz API modelu wizyjnego jest nieprawidłowy lub brak uprawnień.');
      }
      throw new OcrError(`API modelu wizyjnego zwróciło błąd (${response.status}). ${detail.slice(0, 200)}`);
    }

    const json: { content?: Array<{ type: string; text?: string }> } = await response.json();
    const text = json.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();

    if (!text) {
      throw new OcrError('Model wizyjny nie znalazł żadnego tekstu na zdjęciu.');
    }
    return { text, confidence: null };
  }
}
