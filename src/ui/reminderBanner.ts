import { reviewRepo, settingsRepo } from '../db';
import { navigate } from '../router';
import { getDateKey, shouldSendReminderNotification, shouldShowReminderBanner } from '../reminders/reminders';
import type { AppSettings } from '../types';
import { h, icon } from './dom';

const NOTIFIED_STORAGE_KEY = 'flashcards-last-reminder-notified';

// Trwałe tylko na czas życia karty/zakładki (resetuje się przy pełnym
// przeładowaniu) - zamknięcie banera nie chowa go na stałe, tylko na
// bieżącą sesję, żeby nie trzeba było nic dodatkowo persystować w bazie.
let dismissedForDateKey: string | null = null;

/**
 * Zwraca gotowy do zamontowania baner "nie uczyłeś się dziś", albo null,
 * gdy nie powinien się pokazać (wyłączone w Ustawieniach, dzisiejsza
 * powtórka już była, albo baner już zamknięty w tej sesji). Przy okazji,
 * best-effort, próbuje też wysłać powiadomienie przeglądarki – patrz
 * ASSUMPTIONS.md co do ograniczeń tego mechanizmu bez backendu.
 */
export async function renderReminderBanner(): Promise<HTMLElement | null> {
  const settings = await settingsRepo.getSettings();
  const reviewsToday = await reviewRepo.countReviewsToday();
  const todayKey = getDateKey();

  maybeSendNotification(settings, reviewsToday, todayKey);

  if (!shouldShowReminderBanner(settings.remindersEnabled, reviewsToday)) return null;
  if (dismissedForDateKey === todayKey) return null;

  const banner = h(
    'div',
    { class: 'reminder-banner' },
    icon('graduate'),
    h('div', { class: 'reminder-banner-text' }, h('strong', null, 'Nie uczyłeś się dziś.'), ' Poświęć chwilę na powtórkę.'),
    h('button', { class: 'btn btn-sm btn-primary', onclick: () => navigate('/study') }, 'Ucz się teraz'),
    h(
      'button',
      {
        class: 'icon-button',
        'aria-label': 'Zamknij przypomnienie',
        onclick: () => {
          dismissedForDateKey = todayKey;
          banner.remove();
        }
      },
      icon('close')
    )
  );
  return banner;
}

function maybeSendNotification(settings: AppSettings, reviewsToday: number, todayKey: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  let lastNotified: string | null = null;
  try {
    lastNotified = window.localStorage.getItem(NOTIFIED_STORAGE_KEY);
  } catch {
    // localStorage niedostępny (np. tryb prywatny) - potraktuj jak "jeszcze nie powiadamiano".
  }

  const shouldSend = shouldSendReminderNotification({
    remindersNotificationEnabled: settings.remindersNotificationEnabled,
    reviewsToday,
    permissionGranted: Notification.permission === 'granted',
    lastNotifiedDateKey: lastNotified,
    todayDateKey: todayKey
  });
  if (!shouldSend) return;

  try {
    new Notification('Fiszki', { body: 'Nie uczyłeś się dziś — zrób szybką powtórkę!' });
    window.localStorage.setItem(NOTIFIED_STORAGE_KEY, todayKey);
  } catch {
    // Best-effort: przeglądarka/kontekst mogły odrzucić (np. karta bez fokusu na niektórych platformach).
  }
}
