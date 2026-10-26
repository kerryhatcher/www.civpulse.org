// Only these visibility-aware reads are safe to repeat after a transport failure.
const profileReads = new Set([
  'browse_legislation', 'get_person_legislative_record', 'get_person_legislative_bill_groups', 'get_office_terms',
  'get_person_articles', 'get_organization_articles', 'get_person_votes',
  'get_person_candidacies', 'get_person',
]);

/** Preserve the caller's credentials; never retry auth requests or mutations. */
export function createProfileFetch(
  apiUrl: string,
  transport: typeof fetch = fetch,
  pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
): typeof fetch {
  const base = new URL(apiUrl);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const rpc = url.pathname.slice('/rest/v1/rpc/'.length);
    const retryable = url.origin === base.origin && url.pathname.startsWith('/rest/v1/rpc/')
      && method === 'POST' && profileReads.has(rpc);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await transport(input instanceof Request ? input.clone() : input, init);
        if (!retryable || attempt >= 2 || ![502, 503, 504].includes(response.status) || signal?.aborted) return response;
        await response.body?.cancel();
      } catch (error) {
        if (!retryable || attempt >= 2 || signal?.aborted || !(error instanceof TypeError)) throw error;
      }
      await pause(250 * (attempt + 1));
      signal?.throwIfAborted();
    }
  };
}
