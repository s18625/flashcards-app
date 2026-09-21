import type { AppSettings } from '../types';

export interface WordEnrichment {
  translation: string;
  example: string;
}

export class TranslateError extends Error {}

/**
 * Szybka podpowiedź tłumaczenia PL dla pojedynczego słowa (np. w formularzu
 * ręcznego dodawania fiszki). Używa darmowego MyMemory API – bez klucza,
 * ale z limitami zapytań, więc wołane z debounce po stronie UI.
 */
export async function suggestTranslation(word: string, signal?: AbortSignal): Promise<string | null> {
  const trimmed = word.trim();
  if (!trimmed || !navigator.onLine) return null;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|pl`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json: MyMemoryResponse = await res.json();
    const text = json.responseData?.translatedText?.trim();
    if (!text || /invalid|no translation|mymemory warning/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

interface MyMemoryResponse {
  responseData?: { translatedText?: string };
}

interface AnthropicTextResponse {
  content?: Array<{ type: string; text?: string }>;
}

/**
 * Dociąga tłumaczenie PL i przykładowe zdanie dla słowa znalezionego na
 * zdjęciu. Jeśli użytkownik skonfigurował klucz API (ta sama sekcja
 * Ustawień co OCR modelem wizyjnym), korzystamy z modelu językowego dla
 * lepszej jakości; w przeciwnym razie tylko tłumaczenie z MyMemory, a
 * przykładowe zdanie użytkownik może dopisać ręcznie. Nigdy nie rzuca
 * wyjątku przy braku internetu – zwraca puste pola, żeby dało się zapisać
 * samo słowo.
 */
export async function enrichWord(
  word: string,
  settings: Pick<AppSettings, 'visionApiKey' | 'visionApiEndpoint' | 'visionApiModel'>,
  signal?: AbortSignal
): Promise<WordEnrichment> {
  if (!navigator.onLine) {
    return { translation: '', example: '' };
  }

  if (settings.visionApiKey.trim()) {
    const viaAi = await enrichWithAi(word, settings, signal);
    if (viaAi) return viaAi;
  }

  const translation = (await suggestTranslation(word, signal)) ?? '';
  return { translation, example: '' };
}

async function enrichWithAi(
  word: string,
  settings: Pick<AppSettings, 'visionApiKey' | 'visionApiEndpoint' | 'visionApiModel'>,
  signal?: AbortSignal
): Promise<WordEnrichment | null> {
  try {
    const response = await fetch(settings.visionApiEndpoint, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.visionApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: settings.visionApiModel,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  `Podaj krótkie polskie tłumaczenie angielskiego słowa "${word}" ` +
                  'oraz jedno proste przykładowe angielskie zdanie z tym słowem. ' +
                  'Odpowiedz wyłącznie w formacie JSON: {"translation": "...", "example": "..."}, bez markdown.'
              }
            ]
          }
        ]
      })
    });
    if (!response.ok) return null;
    const json: AnthropicTextResponse = await response.json();
    const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
    const parsed = extractJson(text);
    if (!parsed) return null;
    return {
      translation: typeof parsed.translation === 'string' ? parsed.translation.trim() : '',
      example: typeof parsed.example === 'string' ? parsed.example.trim() : ''
    };
  } catch {
    return null;
  }
}

function extractJson(text: string): { translation?: unknown; example?: unknown } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
