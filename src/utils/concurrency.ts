/** Uruchamia zadania z ograniczoną równoległością, wołając onProgress po każdym ukończonym elemencie. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let done = 0;

  async function runNext(): Promise<void> {
    const current = nextIndex++;
    if (current >= items.length) return;
    results[current] = await worker(items[current], current);
    done += 1;
    onProgress?.(done, items.length);
    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}
