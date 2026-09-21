/**
 * Lista bardzo popularnych angielskich słów pomijanych przy ekstrakcji
 * kandydatów do nauki (zaimki, przedimki, spójniki, czasowniki posiłkowe itp.).
 * Celowo szeroka, ale nie wyczerpująca – użytkownik i tak może ręcznie
 * dodać/odznaczyć słowa na liście kandydatów.
 */
export const ENGLISH_STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'done',
  'have', 'has', 'had', 'having',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'i', 'me', 'my', 'mine', 'myself',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those',
  'who', 'whom', 'whose', 'which', 'what',
  'here', 'there', 'where', 'when', 'why', 'how',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'in', 'on', 'at', 'by', 'to', 'of', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'further', 'once', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'from', 'with', 'without',
  'if', 'because', 'as', 'until', 'while', 'then',
  'ok', 'okay', 'yes', 'oh', 'hi', 'hello',
  'im', 'ive', 'dont', 'doesnt', 'didnt', 'isnt', 'arent', 'wasnt', 'werent',
  'cant', 'cannot', 'couldnt', 'wouldnt', 'shouldnt', 'wont', 'lets',
  'et', 'al', 'etc'
]);

export function isStopword(word: string): boolean {
  return ENGLISH_STOPWORDS.has(word.toLowerCase());
}
