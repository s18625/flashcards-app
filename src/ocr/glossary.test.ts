import { describe, expect, it } from 'vitest';
import { extractGlossaryEntries, parseGlossaryLine } from './glossary';

describe('parseGlossaryLine', () => {
  it('parses a simple "term /pron/ translation" line', () => {
    expect(parseGlossaryLine('cut down on sth /kʌt daʊn ɒn ˈsʌmθɪŋ/ ograniczyć spożycie czegoś')).toEqual({
      term: 'cut down on sth',
      translation: 'ograniczyć spożycie czegoś'
    });
  });

  it('keeps multi-word idioms with sb/sth intact instead of splitting them', () => {
    expect(parseGlossaryLine('take after sb /teɪk ˈɑːftə ˈsʌmbədi/ być podobnym do kogoś, odziedziczyć po kimś wygląd')).toEqual({
      term: 'take after sb',
      translation: 'być podobnym do kogoś, odziedziczyć po kimś wygląd'
    });
  });

  it('handles a term containing its own "/" alternation without confusing it for the pronunciation delimiter', () => {
    const result = parseGlossaryLine('similar to sb / sth /ˈsɪmɪlə tə ˈsʌmbədi, ˈsʌmθɪŋ/ podobny do kogoś/czegoś');
    expect(result).not.toBeNull();
    expect(result?.term).toBe('similar to sb / sth');
    expect(result?.translation).toBe('podobny do kogoś/czegoś');
  });

  it('handles a translation containing its own "/" alternation', () => {
    const result = parseGlossaryLine('remind sb of sb /rɪˈmaɪnd ˈsʌmbədi əv ˈsʌmbədi/ przypominać kogoś/coś komuś');
    expect(result?.term).toBe('remind sb of sb');
    expect(result?.translation).toBe('przypominać kogoś/coś komuś');
  });

  it('strips leading bullet/numbering noise from OCR before the term', () => {
    expect(parseGlossaryLine('- go on a diet /gəʊ ɒn ə ˈdaɪət/ przejść na dietę')?.term).toBe('go on a diet');
  });

  it('returns null for lines without a pronunciation delimiter', () => {
    expect(parseGlossaryLine('VOCABULARY')).toBeNull();
    expect(parseGlossaryLine('Personal data / Dane osobowe')).toBeNull();
    expect(parseGlossaryLine('')).toBeNull();
  });

  it('returns null for a lone slash pair with no real content', () => {
    expect(parseGlossaryLine('word // ')).toBeNull();
  });

  it('returns null when the term has no letters at all', () => {
    expect(parseGlossaryLine('123 /abc/ liczba')).toBeNull();
  });
});

describe('extractGlossaryEntries', () => {
  const textbookPage = [
    'VOCABULARY',
    'Personal data / Dane osobowe',
    'recommend sth to sb /rekəˈmend ˈsʌmθɪŋ tə ˈsʌmbədi/ polecić coś komuś',
    'remind sb of sb /rɪˈmaɪnd ˈsʌmbədi əv ˈsʌmbədi/ przypominać kogoś z wyglądu',
    'similar to sb / sth /ˈsɪmɪlə tə ˈsʌmbədi, ˈsʌmθɪŋ/ podobny do kogoś/czegoś',
    'take after sb /teɪk ˈɑːftə ˈsʌmbədi/ być podobnym do kogoś, odziedziczyć po kimś wygląd',
    'get into sth /get ˈɪntə ˈsʌmθɪŋ/ zmieścić się w... (o ubraniu)',
    'go on a diet /gəʊ ɒn ə ˈdaɪət/ przejść na dietę',
    'go out with sb /gəʊ aʊt wɪð ˈsʌmbədi/ umawiać się z kimś'
  ].join('\n');

  it('recognizes a textbook glossary page and extracts full multi-word terms with their translations', () => {
    const entries = extractGlossaryEntries(textbookPage);
    expect(entries).not.toBeNull();
    const terms = entries!.map((e) => e.term);
    expect(terms).toContain('recommend sth to sb');
    expect(terms).toContain('take after sb');
    expect(terms).toContain('similar to sb / sth');
    // Section headers and non-glossary lines never produce an entry.
    expect(terms).not.toContain('VOCABULARY');
    expect(entries!.find((e) => e.term === 'take after sb')?.translation).toBe(
      'być podobnym do kogoś, odziedziczyć po kimś wygląd'
    );
  });

  it('deduplicates repeated terms (case-insensitive)', () => {
    const withDup = textbookPage + '\nTake After sb /teɪk ˈɑːftə ˈsʌmbədi/ duplikat';
    const entries = extractGlossaryEntries(withDup);
    const count = entries!.filter((e) => e.term.toLowerCase() === 'take after sb').length;
    expect(count).toBe(1);
  });

  it('returns null for ordinary prose text that is not a glossary', () => {
    expect(extractGlossaryEntries('The quick brown fox jumps over the lazy dog near the river bank.')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(extractGlossaryEntries('')).toBeNull();
  });

  it('returns null when only a couple of lines happen to match, below the minimum threshold', () => {
    const mostlyProse = [
      'This is just a regular paragraph of text from a book or a sign.',
      'It has multiple sentences and no glossary formatting whatsoever.',
      'cut down on sth /kʌt daʊn ɒn ˈsʌmθɪŋ/ ograniczyć',
      'More regular prose continues here for several more lines.',
      'And even more unrelated sentences follow after that one.'
    ].join('\n');
    expect(extractGlossaryEntries(mostlyProse)).toBeNull();
  });
});
