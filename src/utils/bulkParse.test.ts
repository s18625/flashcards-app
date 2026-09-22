import { describe, expect, it } from 'vitest';
import { parseBulkEntries, parseBulkLine } from './bulkParse';

describe('parseBulkLine', () => {
  it('splits a "word, translation" line on the comma', () => {
    expect(parseBulkLine('talkative, rozmowny')).toEqual({ word: 'talkative', translation: 'rozmowny' });
  });

  it('trims surrounding whitespace from both fields', () => {
    expect(parseBulkLine('  shy ,   nieśmiały  ')).toEqual({ word: 'shy', translation: 'nieśmiały' });
  });

  it('keeps a multi-sense translation with its own commas intact (splits only on the first comma)', () => {
    expect(parseBulkLine('talkative, gadatliwy, rozmowny')).toEqual({
      word: 'talkative',
      translation: 'gadatliwy, rozmowny'
    });
  });

  it('falls back to a tab separator when there is no comma (pasted from a spreadsheet)', () => {
    expect(parseBulkLine('stubborn\tuparty')).toEqual({ word: 'stubborn', translation: 'uparty' });
  });

  it('falls back to " - " (space-dash-space) when there is no comma or tab', () => {
    expect(parseBulkLine('stupid - głupi')).toEqual({ word: 'stupid', translation: 'głupi' });
  });

  it('does not treat a hyphen with no surrounding spaces as a separator', () => {
    expect(parseBulkLine('well-known')).toEqual({ word: 'well-known', translation: '' });
  });

  it('returns a word-only entry with empty translation when there is no separator at all', () => {
    expect(parseBulkLine('gender')).toEqual({ word: 'gender', translation: '' });
  });

  it('returns null for an empty or whitespace-only line', () => {
    expect(parseBulkLine('')).toBeNull();
    expect(parseBulkLine('   ')).toBeNull();
  });

  it('returns null when the line is just a separator with no word', () => {
    expect(parseBulkLine(', rozmowny')).toBeNull();
  });
});

describe('parseBulkEntries', () => {
  it('parses a multi-line pasted list, one entry per line', () => {
    const text = ['talkative, rozmowny', 'stubborn, uparty', 'shy, nieśmiały'].join('\n');
    expect(parseBulkEntries(text)).toEqual([
      { word: 'talkative', translation: 'rozmowny' },
      { word: 'stubborn', translation: 'uparty' },
      { word: 'shy', translation: 'nieśmiały' }
    ]);
  });

  it('skips blank lines between entries', () => {
    const text = 'talkative, rozmowny\n\n\nstubborn, uparty\n';
    expect(parseBulkEntries(text)).toEqual([
      { word: 'talkative', translation: 'rozmowny' },
      { word: 'stubborn', translation: 'uparty' }
    ]);
  });

  it('handles Windows-style CRLF line endings', () => {
    const text = 'talkative, rozmowny\r\nstubborn, uparty\r\n';
    expect(parseBulkEntries(text)).toEqual([
      { word: 'talkative', translation: 'rozmowny' },
      { word: 'stubborn', translation: 'uparty' }
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseBulkEntries('')).toEqual([]);
    expect(parseBulkEntries('   \n  \n')).toEqual([]);
  });

  it('supports a mix of word-only and word+translation lines in the same paste', () => {
    const text = 'gender\nmarital status, stan cywilny\nmiddle name';
    expect(parseBulkEntries(text)).toEqual([
      { word: 'gender', translation: '' },
      { word: 'marital status', translation: 'stan cywilny' },
      { word: 'middle name', translation: '' }
    ]);
  });
});
