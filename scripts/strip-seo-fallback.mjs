const SEO_FALLBACK = /\s*<main class="seo-page seo-fallback">[\s\S]*?<\/main>\s*/g;

export function stripSeoFallback(html) {
  const matches = html.match(SEO_FALLBACK) ?? [];
  if (matches.length !== 1) throw new Error(`Expected one SEO fallback block in index.html, found ${matches.length}`);
  return html.replace(SEO_FALLBACK, '');
}
