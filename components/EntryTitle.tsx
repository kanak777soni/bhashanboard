import type { CorpusStatement } from "@/lib/corpus";
import { languageTag } from "@/lib/language";

/**
 * Renders an entry's headline, and is the single place that decides
 * whether quotation marks are allowed.
 *
 * Where the research established the exact wording, the entry is shown in
 * quotation marks, verbatim. Where it did not, the corpus carries a
 * neutral title instead, and it is shown WITHOUT quotation marks and
 * marked as a subject line. Putting a paraphrase inside quote marks would
 * manufacture a quotation, which is the one thing this project can never
 * do (docs/01-concept.md §1.2).
 */
export default function EntryTitle({
  statement,
  className,
}: {
  statement: Pick<CorpusStatement, "quote" | "hasVerbatimQuote" | "language">;
  className?: string;
}) {
  if (statement.hasVerbatimQuote) {
    const quoteClassName =
      [className, statement.language !== "English" ? "original-language" : ""]
        .filter(Boolean)
        .join(" ") || undefined;
    return (
      <span className={quoteClassName} lang={languageTag(statement.language)}>
        &ldquo;{statement.quote}&rdquo;
      </span>
    );
  }
  return (
    <span className={className}>
      {statement.quote}
      <span className="unquoted" title="Exact wording not yet established — this is a neutral subject line, not a quotation">
        {" "}
        &mdash; wording not established
      </span>
    </span>
  );
}
