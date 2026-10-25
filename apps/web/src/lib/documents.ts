export interface PublicDocument {
  id: string; title: string; file_name: string; url: string; source_url: string;
  document_kind: string; text_origin: string; status: string; size_bytes: number;
  indexing?: {eligible: boolean; reason: string};
  meetings: {id: string; title: string; starts_at: string}[];
}

/** A configured API is required: unreleased builds never contact production. */
export function documentApi(): string | null {
  const configured = import.meta.env.PUBLIC_KB_API_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.username || url.password || (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) return null;
    return url.origin;
  } catch { return null; }
}

export function publicDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
