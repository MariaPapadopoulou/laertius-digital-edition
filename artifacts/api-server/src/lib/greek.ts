export function normalizeGreek(text: string): string {
  let t = text.toLowerCase().normalize("NFD");
  t = t.replace(/[\u0300-\u036f\u0342-\u0345]/g, "");
  t = t.normalize("NFC").replace(/ς/g, "σ");
  return t;
}

export function tokenize(text: string): string[] {
  const matches = normalizeGreek(text).match(/[\p{L}\p{N}_]+/gu);
  return matches ?? [];
}

/**
 * Function words dropped from *queries* only (the index keeps every token).
 * Forms are stored normalized (lowercase, accents stripped, final sigma
 * folded), matching tokenize() output. Covers Greek question phrasing
 * ("ποιοι ειναι οι ...") and the equivalent English question words.
 */
const QUERY_STOPWORDS = new Set(
  [
    // Greek articles, pronouns, question words, common particles
    "ο", "η", "το", "οι", "τα", "του", "τησ", "των", "τον", "την", "τουσ",
    "τισ", "ενασ", "μια", "ενα", "και", "να", "με", "σε", "απο", "για",
    "στο", "στη", "στην", "στον", "στουσ", "στισ", "στα", "δεν", "οτι",
    "ειναι", "ηταν", "ειχε", "εχει", "εχουν",
    "τι", "πωσ", "γιατι", "ποτε", "πού", "που",
    "ποιοσ", "ποια", "ποιο", "ποιοι", "ποιεσ", "ποιων", "ποιον", "ποιουσ",
    // English question and function words
    "who", "what", "when", "where", "why", "how", "which", "whom",
    "is", "are", "was", "were", "be", "been", "do", "does", "did",
    "the", "a", "an", "of", "in", "on", "and", "or", "to", "for", "about",
  ].map((w) => normalizeGreek(w)),
);

/**
 * Query-side tokenization: like tokenize() but with question/function
 * words removed, so "ποιοι ειναι οι κυνικοι" searches for "κυνικοι".
 * If every token is a stopword, the original tokens are kept so the
 * query never becomes empty.
 */
export function tokenizeQuery(text: string): string[] {
  const tokens = tokenize(text);
  const filtered = tokens.filter((t) => !QUERY_STOPWORDS.has(t));
  return filtered.length > 0 ? filtered : tokens;
}
