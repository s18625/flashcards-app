import QRCode from 'qrcode';

/** Generuje kod QR (data URL PNG) dla skompresowanego ciągu talii. */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6
  });
}
