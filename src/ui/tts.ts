export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang: 'en-US' | 'en-GB'): void {
  if (!isTtsSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}
