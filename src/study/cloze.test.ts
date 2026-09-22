import { describe, expect, it } from 'vitest';
import { findClozeBlank } from './cloze';

describe('findClozeBlank', () => {
  it('finds a simple single word and splits around it', () => {
    const result = findClozeBlank('She is very ambitious about her career.', 'ambitious');
    expect(result).toEqual({ before: 'She is very ', match: 'ambitious', after: ' about her career.' });
  });

  it('matches case-insensitively but returns the original casing from the sentence', () => {
    const result = findClozeBlank('Ambitious people work hard.', 'ambitious');
    expect(result?.match).toBe('Ambitious');
    expect(result?.before).toBe('');
    expect(result?.after).toBe(' people work hard.');
  });

  it('matches a multi-word phrase as a whole', () => {
    const result = findClozeBlank('You should go on a diet soon.', 'go on a diet');
    expect(result).toEqual({ before: 'You should ', match: 'go on a diet', after: ' soon.' });
  });

  it('does not match a word that is only a substring of a longer word', () => {
    expect(findClozeBlank('The cats are sleeping.', 'cat')).toBeNull();
  });

  it('returns null when the word is not present in the sentence at all', () => {
    expect(findClozeBlank('This sentence has nothing to do with it.', 'ambitious')).toBeNull();
  });

  it('returns null for an empty example sentence', () => {
    expect(findClozeBlank('', 'ambitious')).toBeNull();
  });

  it('returns null for an empty target word', () => {
    expect(findClozeBlank('Some sentence.', '')).toBeNull();
  });

  it('does not crash on a target word containing regex special characters', () => {
    expect(() => findClozeBlank('Cost is $5 (approx).', '$5')).not.toThrow();
  });
});
