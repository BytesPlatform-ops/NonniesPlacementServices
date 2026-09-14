/**
 * Which navigation item a path belongs to.
 *
 * Extracted from the sidebar so the rule can be tested directly: it is the
 * piece most likely to be quietly wrong, and being wrong means two items light
 * up at once or none does.
 */
export interface NavHref {
  href: string;
}

/**
 * The single active href for a path — the longest item that matches.
 *
 * Longest wins because navigation hrefs nest: `/operations` is a prefix of
 * `/operations/marketplace`, so a plain prefix test lights both. The most
 * specific match is the one the reader is actually looking at.
 *
 * `/provider` is the provider portal's root and is matched exactly, so it does
 * not stay lit across every page beneath it.
 */
export function activeNavHref(items: NavHref[], pathname: string): string | null {
  const matches = items
    .filter((item) =>
      item.href === "/provider"
        ? pathname === "/provider"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}
