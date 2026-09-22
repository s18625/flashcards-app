import { describe, expect, it } from 'vitest';
import { buildQuizOptions } from './quiz';

const noShuffleRng = () => 0;

describe('buildQuizOptions', () => {
  it('returns an empty array when the correct answer is blank', () => {
    expect(buildQuizOptions('', ['a', 'b', 'c'])).toEqual([]);
    expect(buildQuizOptions('   ', ['a', 'b', 'c'])).toEqual([]);
  });

  it('returns an empty array when the pool has no usable distractors', () => {
    expect(buildQuizOptions('kot', [], 4, noShuffleRng)).toEqual([]);
    expect(buildQuizOptions('kot', ['', '  '], 4, noShuffleRng)).toEqual([]);
  });

  it('excludes the correct answer itself (case-insensitively) from the distractor pool', () => {
    const options = buildQuizOptions('kot', ['Kot', 'KOT', 'pies'], 4, noShuffleRng);
    expect(options).toContain('kot');
    expect(options.filter((o) => o.toLowerCase() === 'kot')).toHaveLength(1);
    expect(options).toContain('pies');
  });

  it('deduplicates distractors that only differ by case', () => {
    const options = buildQuizOptions('kot', ['pies', 'Pies', 'PIES', 'ryba'], 4, noShuffleRng);
    const lower = options.map((o) => o.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('caps distractors at maxOptions - 1', () => {
    const options = buildQuizOptions('kot', ['pies', 'ryba', 'koń', 'mysz', 'wąż'], 4, noShuffleRng);
    expect(options).toHaveLength(4);
    expect(options).toContain('kot');
  });

  it('returns fewer options when the pool has fewer valid distractors than requested', () => {
    const options = buildQuizOptions('kot', ['pies'], 4, noShuffleRng);
    expect(options).toHaveLength(2);
    expect(options.sort()).toEqual(['kot', 'pies'].sort());
  });

  it('always includes the trimmed correct answer among the options', () => {
    const options = buildQuizOptions('  kot  ', ['pies', 'ryba'], 4, noShuffleRng);
    expect(options).toContain('kot');
  });
});
