/** Czysta logika decyzyjna dla przypomnień o codziennej nauce (bez dostępu do DOM/przeglądarki). */

/** Klucz dnia w formacie YYYY-MM-DD w lokalnej strefie czasowej, do porównań "czy to już dzisiaj". */
export function getDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Czy pokazać baner "nie uczyłeś się dziś" – wyłącznie gdy funkcja jest włączona i naprawdę nie było dziś żadnej powtórki. */
export function shouldShowReminderBanner(remindersEnabled: boolean, reviewsToday: number): boolean {
  return remindersEnabled && reviewsToday === 0;
}

export interface NotificationDecisionInput {
  remindersNotificationEnabled: boolean;
  reviewsToday: number;
  permissionGranted: boolean;
  /** Klucz dnia (getDateKey) ostatniego wysłanego powiadomienia, albo null jeśli jeszcze żadnego nie wysłano. */
  lastNotifiedDateKey: string | null;
  todayDateKey: string;
}

/**
 * Czy wysłać powiadomienie przeglądarki teraz: tylko gdy użytkownik jawnie
 * włączył tę opcję, przeglądarka ma udzieloną zgodę, faktycznie nie było
 * dziś żadnej powtórki, i jeszcze dzisiaj takiego powiadomienia nie
 * wysłano (żeby nie spamować przy każdym odświeżeniu/wejściu do apki).
 */
export function shouldSendReminderNotification(input: NotificationDecisionInput): boolean {
  return (
    input.remindersNotificationEnabled &&
    input.permissionGranted &&
    input.reviewsToday === 0 &&
    input.lastNotifiedDateKey !== input.todayDateKey
  );
}
