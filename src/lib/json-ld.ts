/**
 * Serialize a structured-data object for embedding inside an inline
 * `<script type="application/ld+json">` tag.
 *
 * `JSON.stringify` does not escape `<`, `>` or `&`, so CMS-controlled values
 * (a provider name, description or website) containing `</script>` would end the
 * script element early and let arbitrary markup execute on a public page. The
 * escaped forms below are valid JSON string escapes, so the emitted structured
 * data still parses to exactly the same values for search engines.
 *
 * U+2028/U+2029 are also escaped: they are legal in JSON but are line
 * terminators in JavaScript source.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
