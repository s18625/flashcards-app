import { cardRepo, reviewRepo } from '../../db';
import { h, mount } from '../dom';
import { setTopbar } from '../shell';

export async function renderStatsView(container: HTMLElement): Promise<void> {
  setTopbar({ title: 'Statystyki' });
  mount(container, h('div', { class: 'spinner' }));

  const [allCards, reviewsToday, streak, allReviews] = await Promise.all([
    cardRepo.getAllCards(),
    reviewRepo.countReviewsToday(),
    reviewRepo.computeStreak(),
    reviewRepo.getAllReviews()
  ]);

  const correctCount = allReviews.filter((r) => r.correct).length;
  const accuracy = allReviews.length === 0 ? null : Math.round((correctCount / allReviews.length) * 100);

  mount(
    container,
    h(
      'div',
      { class: 'stat-grid' },
      statTile(String(allCards.length), 'Fiszek łącznie'),
      statTile(String(reviewsToday), 'Powtórek dzisiaj'),
      statTile(String(streak), streak === 1 ? 'Dzień z rzędu' : 'Dni z rzędu'),
      statTile(accuracy === null ? '—' : `${accuracy}%`, 'Poprawnych odpowiedzi')
    ),
    h(
      'div',
      { class: 'card-surface mt-16' },
      h('h2', null, 'Historia'),
      h('p', { class: 'muted' }, `Łączna liczba wykonanych powtórek: ${allReviews.length}.`)
    )
  );
}

function statTile(value: string, label: string): HTMLElement {
  return h('div', { class: 'stat-tile' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label));
}
