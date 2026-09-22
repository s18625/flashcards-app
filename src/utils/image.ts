const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.8;

/**
 * Wczytuje plik obrazu, skaluje go (zachowując proporcje) do maks.
 * `maxDimension` px po dłuższym boku i koduje jako skompresowany JPEG
 * data URL, żeby zdjęcia z aparatu (często kilka MB) nie rozdymały
 * IndexedDB. Przeglądarkowe API canvas – nie da się tego sensownie
 * przetestować jednostkowo bez jsdom-canvas, więc zostaje bez testów,
 * podobnie jak reszta cienkich wrapperów nad Web API w tym projekcie
 * (np. src/ui/tts.ts).
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D niedostępny w tej przeglądarce.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
