import { describe, expect, it } from 'vitest';
import { extractCandidates, lemmatize, tokenize } from './textProcessing';

describe('tokenize', () => {
  it('splits plain text into lowercase-agnostic word tokens', () => {
    expect(tokenize('The quick brown fox jumps!')).toEqual(['The', 'quick', 'brown', 'fox', 'jumps']);
  });

  it('drops numbers and standalone punctuation', () => {
    expect(tokenize('Room 42: price $19.99, 3x table.')).toEqual(['Room', 'price', 'table']);
  });

  it('keeps internal apostrophes and hyphens but trims them from edges', () => {
    expect(tokenize("don't stop -- well-known -- 'quoted'")).toEqual(["don't", 'stop', 'well-known', 'quoted']);
  });

  it('drops tokens shorter than two letters', () => {
    expect(tokenize('a I go to a b c')).toEqual(['go', 'to']);
  });

  it('returns an empty array for text with no words', () => {
    expect(tokenize('123 456 !!! ...')).toEqual([]);
  });
});

describe('lemmatize', () => {
  it('reduces regular plural nouns to singular', () => {
    expect(lemmatize('cats')).toBe('cat');
    expect(lemmatize('boxes')).toBe('box');
  });

  it('reduces common verb forms to the base form', () => {
    expect(lemmatize('running')).toBe('run');
    expect(lemmatize('jumped')).toBe('jump');
  });

  it('returns the original word when no rule applies', () => {
    expect(lemmatize('table')).toBe('table');
  });
});

describe('extractCandidates', () => {
  it('filters out stopwords, numbers and punctuation', () => {
    const candidates = extractCandidates('The cat is on the table. It has 3 legs!');
    const lemmas = candidates.map((c) => c.lemma).sort();
    expect(lemmas).not.toContain('the');
    expect(lemmas).not.toContain('is');
    expect(lemmas).not.toContain('on');
    expect(lemmas).not.toContain('it');
    expect(lemmas).not.toContain('has');
    expect(lemmas).toContain('cat');
    expect(lemmas).toContain('table');
    expect(lemmas).toContain('leg');
  });

  it('deduplicates repeated words via lemma and counts occurrences', () => {
    const candidates = extractCandidates('dog dogs dog running run runs');
    const dog = candidates.find((c) => c.lemma === 'dog');
    const run = candidates.find((c) => c.lemma === 'run');
    expect(dog?.count).toBe(3);
    expect(run?.count).toBe(3);
  });

  it('handles empty or non-alphabetic input gracefully', () => {
    expect(extractCandidates('')).toEqual([]);
    expect(extractCandidates('123 456 !@# $%^')).toEqual([]);
  });

  it('handles garbled OCR noise without throwing', () => {
    expect(() => extractCandidates('�$#@!! xX99 \n\t\n  ---')).not.toThrow();
  });

  it('respects the limit option', () => {
    const candidates = extractCandidates('apple banana cherry date elderberry fig grape', { limit: 3 });
    expect(candidates.length).toBe(3);
  });

  it('can skip stopword filtering when requested', () => {
    const withStopwords = extractCandidates('the the the cat', { skipStopwords: true });
    const theEntry = withStopwords.find((c) => c.lemma === 'the');
    expect(theEntry?.count).toBe(3);
  });
});
