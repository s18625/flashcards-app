import type { OcrMethod } from '../types';

export interface OcrResult {
  text: string;
  /** 0-100 jeśli silnik potrafi ją oszacować, inaczej null. */
  confidence: number | null;
}

export class OcrError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

export interface OcrRecognizeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface OcrEngine {
  readonly id: OcrMethod;
  readonly label: string;
  /** Czy silnik wymaga połączenia z internetem, aby działać. */
  readonly requiresNetwork: boolean;
  /** Czy silnik wysyła zdjęcie do zewnętrznego serwisu (informacja dla UI/zgody). */
  readonly sendsImageExternally: boolean;
  recognize(image: Blob, options?: OcrRecognizeOptions): Promise<OcrResult>;
}
