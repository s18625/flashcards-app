import type { AppSettings } from '../types';
import { TesseractOcrEngine } from './tesseractEngine';
import { VisionApiOcrEngine } from './visionEngine';
import type { OcrEngine } from './types';

export * from './types';
export * from './textProcessing';
export { TesseractOcrEngine } from './tesseractEngine';
export { VisionApiOcrEngine } from './visionEngine';

export function createOcrEngine(settings: AppSettings): OcrEngine {
  if (settings.ocrMethod === 'vision-api') {
    return new VisionApiOcrEngine(settings);
  }
  return new TesseractOcrEngine();
}
