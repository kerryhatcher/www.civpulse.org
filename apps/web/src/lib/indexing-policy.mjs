// @ts-check

/** Shared by static HTML and sitemap generation. These shells depend on a
 * session, a query, or an explicit record ID; public record URLs stay indexable.
 * @param {string} pathname
 */
export function shouldNoIndex(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return /^\/404(?:\.html)?$/.test(path) ||
    ['/admin', '/oauth'].some(prefix => path === prefix || path.startsWith(`${prefix}/`)) ||
    [
      '/signin', '/signup', '/account', '/search', '/history',
      '/requests/view', '/legislation/view', '/legislation/vote',
      '/legislation/session', '/maps/view', '/calendar/view',
      '/people/view', '/elections/view',
    ].includes(path);
}
