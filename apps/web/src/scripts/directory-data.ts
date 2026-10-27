import type { DirectoryKind, DirectorySnapshot } from '../lib/directories';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { filterCounty } from './county-filter';

/** Signed-in callers retain live RPC discovery and its existing access rules. */
export async function readDirectory<K extends DirectoryKind>(kind: K): Promise<DirectorySnapshot<K> | null> {
  const url = document.querySelector<HTMLElement>('[data-directory-snapshot]')?.dataset.directorySnapshot;
  if (url && !url.startsWith(`/directory-data/${kind}-`)) throw new Error('Incorrect directory snapshot');
  const snapshot = await loadPublicDirectorySnapshot<K>(url, getSupabase());
  if (!snapshot) return null;
  const kindName = { people: 'person', organizations: 'organization', elections: 'election' }[kind];
  const allowed = new Set((await filterCounty(snapshot.map(entry => entry.record), kindName)).map(row => row.id));
  return snapshot.filter(entry => allowed.has(entry.record.id));
}
export async function loadPublicDirectorySnapshot<K extends DirectoryKind>(url: string | undefined, client: SupabaseClient): Promise<DirectorySnapshot<K> | null> {
  const {data:{session},error} = await client.auth.getSession();
  if (error) throw error;
  if (session) return null;
  if (!url) throw new Error('Missing public directory snapshot');
  return loadDirectoryAsset<K>(url);
}

const cache = new Map<string,Promise<DirectorySnapshot<DirectoryKind>>>();
export async function loadDirectoryAsset<K extends DirectoryKind>(url: string): Promise<DirectorySnapshot<K>> {
  let request = cache.get(url);
  if (!request) {
    request = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Public directory unavailable (${response.status}). Reload to try again.`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid public directory snapshot');
      return data;
    })();
    cache.set(url,request);
    request.catch(() => { if (cache.get(url) === request) cache.delete(url); });
  }
  return request as Promise<DirectorySnapshot<K>>;
}
