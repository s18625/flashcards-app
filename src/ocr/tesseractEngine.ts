import { createWorker } from 'tesseract.js';
import { OcrError, type OcrEngine, type OcrRecognizeOptions, type OcrResult } from './types';

/**
 * Silnik OCR działający w przeglądarce przez Tesseract.js. Domyślna metoda:
 * darmowa i offline po pierwszym pobraniu danych językowych (cache'owanych
 * przez service worker, patrz vite.config.ts / runtimeCaching).
 */
export class TesseractOcrEngine implements OcrEngine {
  readonly id = 'tesseract' as const;
  readonly label = 'Tesseract.js (lokalnie, offline)';
  readonly requiresNetwork = false;
  readonly sendsImageExternally = false;

  async recognize(image: Blob, options: OcrRecognizeOptions = {}): Promise<OcrResult> {
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            options.onProgress?.(m.progress);
          }
        }
      });
      if (options.signal?.aborted) {
        throw new OcrError('Anulowano rozpoznawanie tekstu.');
      }
      const { data } = await worker.recognize(image);
      const text = data.text.trim();
      if (!text) {
        throw new OcrError('Nie udało się rozpoznać żadnego tekstu na zdjęciu. Spróbuj zrobić wyraźniejsze zdjęcie.');
      }
      return { text, confidence: data.confidence ?? null };
    } catch (err) {
      if (err instanceof OcrError) throw err;
      throw new OcrError('Błąd rozpoznawania tekstu (Tesseract.js). Spróbuj ponownie lub zmień zdjęcie.', err);
    } finally {
      await worker?.terminate();
    }
  }
}
