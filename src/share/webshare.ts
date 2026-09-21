/** Współdzieli plik przez Web Share API, z fallbackiem do pobrania pliku. */
export async function shareOrDownloadFile(filename: string, blob: Blob, shareTitle: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // spadamy do pobrania pliku, jeśli udostępnianie się nie powiodło
    }
  }

  downloadBlob(filename, blob);
  return 'downloaded';
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
