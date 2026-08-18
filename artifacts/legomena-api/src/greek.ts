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
