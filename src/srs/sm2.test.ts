import { describe, expect, it } from 'vitest';
import { gradeToQuality, isDue, isNewCard, MIN_EASE_FACTOR, nextSrsState } from './sm2';
import type { SrsState } from '../types';

function freshState(now: number): SrsState {
  return { repetitions: 0, easeFactor: 2.5, intervalDays: 0, dueDate: now, lastReviewedAt: null };
}

describe('gradeToQuality', () => {
  it('maps the four UI grades to SM-2 quality values', () => {
    expect(gradeToQuality('again')).toBe(0);
    expect(gradeToQuality('hard')).toBe(3);
    expect(gradeToQuality('good')).toBe(4);
    expect(gradeToQuality('easy')).toBe(5);
  });
});

describe('nextSrsState', () => {
  const now = 1_700_000_000_000;

  it('schedules first "good" review for the next day with repetitions=1', () => {
    const next = nextSrsState(freshState(now), 'good', now);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.dueDate).toBe(now + 24 * 60 * 60 * 1000);
    expect(next.lastReviewedAt).toBe(now);
  });

  it('schedules the second consecutive "good" review 6 days later', () => {
    const first = nextSrsState(freshState(now), 'good', now);
    const second = nextSrsState(first, 'good', now + 1000);
    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(6);
  });

  it('grows the interval by the ease factor from the third repetition onward', () => {
    let state = freshState(now);
    state = nextSrsState(state, 'good', now);
    state = nextSrsState(state, 'good', now);
    const before = state;
    state = nextSrsState(state, 'good', now);
    expect(state.repetitions).toBe(3);
    expect(state.intervalDays).toBe(Math.round(before.intervalDays * state.easeFactor));
  });

  it('resets repetitions and interval on "again", but keeps the card due soon (same-day relearn)', () => {
    let state = freshState(now);
    state = nextSrsState(state, 'good', now);
    state = nextSrsState(state, 'good', now);
    const beforeAgain = state;
    state = nextSrsState(state, 'again', now);
    expect(state.repetitions).toBe(0);
    expect(state.intervalDays).toBe(0);
    expect(state.dueDate).toBe(now + 10 * 60 * 1000);
    expect(state.easeFactor).toBeLessThan(beforeAgain.easeFactor);
  });

  it('never lets the ease factor drop below the SM-2 floor of 1.3', () => {
    let state = freshState(now);
    for (let i = 0; i < 20; i++) {
      state = nextSrsState(state, 'again', now);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR);
  });

  it('increases the ease factor on repeated "easy" grades', () => {
    let state = freshState(now);
    const initialEase = state.easeFactor;
    state = nextSrsState(state, 'easy', now);
    expect(state.easeFactor).toBeGreaterThan(initialEase);
  });

  it('keeps the ease factor unchanged for a "good" grade (quality 4 has zero delta in SM-2)', () => {
    const state = freshState(now);
    const next = nextSrsState(state, 'good', now);
    expect(next.easeFactor).toBe(state.easeFactor);
  });

  it('does not mutate the input state', () => {
    const state = freshState(now);
    const snapshot = { ...state };
    nextSrsState(state, 'good', now);
    expect(state).toEqual(snapshot);
  });

  it('throws for an unknown grade value', () => {
    expect(() => gradeToQuality('bogus' as never)).toThrow();
  });
});

describe('isDue / isNewCard', () => {
  it('reports a card as due when dueDate has passed', () => {
    const state = freshState(1000);
    expect(isDue(state, 1000)).toBe(true);
    expect(isDue(state, 999)).toBe(false);
  });

  it('reports a freshly created card as new', () => {
    expect(isNewCard(freshState(1000))).toBe(true);
  });

  it('reports a reviewed card as no longer new', () => {
    const state = nextSrsState(freshState(1000), 'good', 1000);
    expect(isNewCard(state)).toBe(false);
  });
});
