export const LANGUAGE_TAGS: Record<string, string> = {
  Assamese: "as",
  Bengali: "bn",
  English: "en",
  Gujarati: "gu",
  Hindi: "hi",
  Kannada: "kn",
  Malayalam: "ml",
  Marathi: "mr",
  Odia: "or",
  Punjabi: "pa",
  Tamil: "ta",
  Telugu: "te",
};

export function languageTag(language: string): string {
  const normalizedLanguage = language.trim().toLocaleLowerCase("en");
  const canonicalLanguage = Object.keys(LANGUAGE_TAGS).find(
    (candidate) =>
      candidate.toLocaleLowerCase("en") === normalizedLanguage
  );

  return canonicalLanguage ? LANGUAGE_TAGS[canonicalLanguage] : "und";
}
