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
  return LANGUAGE_TAGS[language] ?? "und";
}
