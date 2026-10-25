import type { PublicDocument } from './documents';

export interface DocumentMatch { document: PublicDocument; passages: string[] }

/** Catalog pagination is independent of the ranked content matches. */
export async function searchDocuments(api: string, query: string, offset = 0, append = false) {
  async function read(path: string) {
    const response = await fetch(`${api}/${path}`, { signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not search the archive.');
    return data;
  }
  const params = new URLSearchParams({ q: query, offset: String(offset) });
  const includeContents = !!query && !append;
  const [catalog, contents] = await Promise.allSettled([
    read(`documents?${params}`),
    includeContents ? read(`search?${new URLSearchParams({ q: query })}`) : Promise.resolve(null),
  ]);
  if (catalog.status === 'rejected' && (contents.status === 'rejected' || !includeContents)) {
    throw new Error('Could not search the archive. Please try again later.');
  }
  const documents: PublicDocument[] = catalog.status === 'fulfilled' ? catalog.value.documents : [];
  const rows: DocumentMatch[] = documents.map(document => ({ document, passages: [] }));
  if (contents.status === 'fulfilled' && contents.value) rows.push(...contents.value.results);
  const warning = catalog.status === 'rejected' ? 'Title and filename search is temporarily unavailable; showing content matches.'
    : contents.status === 'rejected' ? 'Content search is temporarily unavailable; showing title and filename matches.' : '';
  return { rows, nextOffset: offset + documents.length, hasMore: documents.length === 20, warning };
}

export function mergeDocumentMatches(previous: DocumentMatch[], incoming: DocumentMatch[]): DocumentMatch[] {
  const combined = new Map<string, DocumentMatch>();
  for (const row of [...previous, ...incoming]) {
    const existing = combined.get(row.document.id);
    combined.set(row.document.id, {
      document: row.document,
      passages: [...new Set([...(existing?.passages ?? []), ...row.passages])].slice(0, 3),
    });
  }
  return [...combined.values()];
}
