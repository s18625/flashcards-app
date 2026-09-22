import { describe, expect, it } from 'vitest';
import { getDateKey, shouldSendReminderNotification, shouldShowReminderBanner } from './reminders';

describe('getDateKey', () => {
  it('formats a date as YYYY-MM-DD with zero-padded month/day', () => {
    expect(getDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(getDateKey(new Date(2026, 10, 23))).toBe('2026-11-23');
  });

  it('ignores the time-of-day component', () => {
    expect(getDateKey(new Date(2026, 5, 15, 23, 59, 59))).toBe('2026-06-15');
    expect(getDateKey(new Date(2026, 5, 15, 0, 0, 1))).toBe('2026-06-15');
  });
});

describe('shouldShowReminderBanner', () => {
  it('shows the banner when reminders are enabled and no review happened today', () => {
    expect(shouldShowReminderBanner(true, 0)).toBe(true);
  });

  it('hides the banner when reminders are disabled, even with zero reviews today', () => {
    expect(shouldShowReminderBanner(false, 0)).toBe(false);
  });

  it('hides the banner once at least one review happened today', () => {
    expect(shouldShowReminderBanner(true, 1)).toBe(false);
    expect(shouldShowReminderBanner(true, 5)).toBe(false);
  });
});

describe('shouldSendReminderNotification', () => {
  const baseInput = {
    remindersNotificationEnabled: true,
    reviewsToday: 0,
    permissionGranted: true,
    lastNotifiedDateKey: null,
    todayDateKey: '2026-01-05'
  };

  it('sends when every condition is met and it has never notified before', () => {
    expect(shouldSendReminderNotification(baseInput)).toBe(true);
  });

  it('does not send when the user has not opted in', () => {
    expect(shouldSendReminderNotification({ ...baseInput, remindersNotificationEnabled: false })).toBe(false);
  });

  it('does not send without browser notification permission', () => {
    expect(shouldSendReminderNotification({ ...baseInput, permissionGranted: false })).toBe(false);
  });

  it('does not send once a review already happened today', () => {
    expect(shouldSendReminderNotification({ ...baseInput, reviewsToday: 3 })).toBe(false);
  });

  it('does not send twice on the same day', () => {
    expect(shouldSendReminderNotification({ ...baseInput, lastNotifiedDateKey: '2026-01-05' })).toBe(false);
  });

  it('sends again on a new day even if it already notified yesterday', () => {
    expect(shouldSendReminderNotification({ ...baseInput, lastNotifiedDateKey: '2026-01-04' })).toBe(true);
  });
});
