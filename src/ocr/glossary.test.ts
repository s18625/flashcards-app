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

  it('strips a stray leading "=" left by OCR noise', () => {
    expect(parseGlossaryLine('= first name /ˈfɜːst neɪm/ imię')?.term).toBe('first name');
  });

  it('clears (not rejects) a translation contaminated with a leftover phonetic fragment from a neighboring column', () => {
    // Real failure observed on a photographed 3-column textbook page: Tesseract
    // merges text from an adjacent column into the same OCR line, leaving a
    // stray "/pronunciation/" fragment from a *different* entry inside what
    // would otherwise be read as the translation.
    const result = parseGlossaryLine("gender /ˈdʒendə/ pec a ona diet /gao on 3 'dait/ przejicra");
    expect(result).not.toBeNull();
    expect(result?.term).toBe('gender');
    expect(result?.translation).toBe('');
  });

  it('rejects the whole entry when even the term itself is contaminated with leftover slash fragments', () => {
    expect(parseGlossaryLine('a/b c/d real term /ˈriəl tɜːm/ tłumaczenie')).toBeNull();
  });

  it('never lets a slash/IPA fragment leak into the translation field shown to the user', () => {
    const result = parseGlossaryLine(
      "marital status /ˈmærɪtəl ˈsteɪtəs/ stan cywilny. go out with sb /gəʊ aʊt wɪð ˈsʌmbədi/ umawiać się"
    );
    expect(result?.translation).not.toContain('/');
  });

  it('rejects a term containing a bare (non-space-padded) slash left over from a mangled transcription', () => {
    // Real failure observed on a photo of a single-column "Personal data" page:
    // a badly OCR'd "family name / last name / surname /.../nazwisko" line
    // ended up with a stray slash glued mid-term instead of clean " / " alternation.
    expect(parseGlossaryLine("nem; la:st nem; 's3:neim/ nazwisko /ˈsɜːneɪm/ dalej")).toBeNull();
  });

  it('rejects a term written in Polish (with Polish diacritics) instead of English', () => {
    // Real failure: OCR duplicated/garbled text so the "term" field ended up
    // being Polish words, not an English phrase at all. Detectable whenever
    // Polish-specific diacritics slip through (not a full language detector).
    expect(parseGlossaryLine('kraj zamieszkania błąd /gao on 3 dait/ blady nas Cl elie a funkdin')).toBeNull();
  });

  it('accepts a clean space-padded "/" alternation inside the term without flagging it as a bare slash', () => {
    const result = parseGlossaryLine(
      'family name / last name / surname /ˈfæməli neɪm; lɑːst neɪm; ˈsɜːneɪm/ nazwisko'
    );
    expect(result).toEqual({ term: 'family name / last name / surname', translation: 'nazwisko' });
  });

  it('strips a stray trailing semicolon left by OCR noise from the translation', () => {
    expect(parseGlossaryLine('date of birth /deɪt əv bɜːθ/ data urodzenia;')?.translation).toBe('data urodzenia');
  });

  it('truncates a translation contaminated with a bled-in section header (capitalized "X / Y")', () => {
    // Real failure: "stubborn /ˈstʌbən/ uparty" ran into the next section's
    // header "Interests / Zainteresowania" plus a fragment of the next entry.
    const result = parseGlossaryLine("stubborn /ˈstʌbən/ uparty bi Interests / Zainteresowania =");
    expect(result?.term).toBe('stubborn');
    expect(result?.translation).not.toContain('Interests');
    expect(result?.translation).not.toContain('Zainteresowania');
    expect(result?.translation.startsWith('uparty')).toBe(true);
  });

  it('does not truncate a legitimate lowercase translation that happens to contain a slash', () => {
    const result = parseGlossaryLine('similar to sb / sth /ˈsɪmɪlə tə ˈsʌmbədi, ˈsʌmθɪŋ/ podobny do kogoś/czegoś');
    expect(result?.translation).toBe('podobny do kogoś/czegoś');
  });

  it('strips an identical stray leading word glued onto both the term and the translation', () => {
    // Real failure observed near handwritten annotations on the photographed
    // page: an OCR noise token ("g") ended up duplicated as a prefix on both
    // sides of "talkative /ˈtɔːkətɪv/ rozmowny".
    const result = parseGlossaryLine('g talkative /ˈtɔːkətɪv/ g rozmowny');
    expect(result).toEqual({ term: 'talkative', translation: 'rozmowny' });
  });

  it('clears a translation that starts with an uppercase letter (substituted, unrelated content)', () => {
    // Real failure: "(in)tolerant /.../ (nie)tolerancyjny" came back as
    // "Brak tolerancji" - plausible-looking but entirely wrong Polish text.
    // Every legitimate translation in this glossary is lowercase, so a
    // capitalized translation is a reliable signal of substituted content.
    const result = parseGlossaryLine('(intolerant /(ɪn)ˈtɒlərənt/ Brak tolerancji');
    expect(result?.term).toBe('(intolerant');
    expect(result?.translation).toBe('');
  });

  it('clears another real example of capitalized substituted content', () => {
    const result = parseGlossaryLine('big-head /ˈbɪɡhed/ Choroba Recklinghausena kości');
    expect(result?.translation).toBe('');
  });

  it('truncates a translation at stray OCR noise characters like [ ] { } = < > | ~', () => {
    // Real failure: "ambitious /.../ ambitny" gained trailing garbage with
    // bracket/brace/equals characters that never appear in a real translation.
    const result = parseGlossaryLine('ambitious /æmˈbɪʃəs/ ambitny i [i{=REIEZEROS y ec es');
    expect(result?.translation).toBe('ambitny i');
    expect(result?.translation).not.toMatch(/[[\]{}=<>|~]/);
  });

  it('truncates a translation at a lone leftover stress-mark fragment even without a full slash pair', () => {
    // Real failure: "blunt /.../ obcesowy, bezpośredni" gained a trailing
    // mangled pronunciation fragment ending in a single unpaired slash -
    // too few slashes (1) to trip the "full pair" check, but the stray
    // apostrophe-before-letter is still a reliable contamination signal.
    const result = parseGlossaryLine("blunt /blʌnt/ obeesowy, bezposredni a'bavt 'sxmin/");
    expect(result?.translation).toBe('obeesowy, bezposredni a');
    expect(result?.translation).not.toContain('/');
  });

  it('does not clear a legitimate lowercase translation just because it contains an apostrophe-free normal word', () => {
    const result = parseGlossaryLine('stupid /ˈstjuːpɪd/ głupi');
    expect(result?.translation).toBe('głupi');
  });

  it('leaves term and translation alone when they do not share a leading word', () => {
    const result = parseGlossaryLine('stupid /ˈstjuːpɪd/ głupi');
    expect(result).toEqual({ term: 'stupid', translation: 'głupi' });
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
