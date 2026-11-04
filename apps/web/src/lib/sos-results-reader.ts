/** SOS source identities are scoped to one election and jurisdiction. No name matching. */
export type SosObject = Record<string, unknown>;
export interface SosJurisdiction {
  id: string;
  name: string;
  url?: string;
  reportingStatuses?: unknown;
  item_count?: number;
}
export interface SosItem {
  jurisdiction_index: number;
  item_index: number;
  data: SosObject;
}
export interface SosPointer {
  schema_version: 1;
  election_id: string;
  snapshot_id: string;
  revision: string;
  published_at: string;
  source_created_at: string;
  source_url: string;
  jurisdictions: SosJurisdiction[];
}
export interface SosScope {
  schema_version: 1;
  election_id: string;
  snapshot_id: string;
  jurisdiction: SosJurisdiction;
  items: SosItem[];
}
export interface SosView {
  pointer: SosPointer;
  scope: SosScope;
  truncated?: boolean;
}
export type SosRpc = (args: Record<string, unknown>) => Promise<any>;
/** Build-time public asset routing. Never accept arbitrary origins or URL decorations. */
export function resultsFilesOrigin(value?: string): string {
  const origin = value ?? "https://files.civpulse.org";
  if (!["https://files.civpulse.org", "https://files-dev.civpulse.org", "https://files-test.civpulse.org"].includes(origin))
    throw Error("Invalid public results files origin");
  return origin;
}
const FILES = resultsFilesOrigin(import.meta.env?.PUBLIC_RESULTS_FILES_ORIGIN);
const object = (v: unknown): v is SosObject =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
export function sourceCount(value: unknown): string {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString("en-US")
    : "Not reported";
}
export function sourceStatus(value: unknown): string {
  if (text(value)) return value;
  if (Array.isArray(value) && value.length) {
    const labels = value
      .map((v) =>
        text(v)
          ? v
          : object(v)
            ? [v.name, v.status].filter(text).join(": ")
            : "",
      )
      .filter(Boolean);
    if (labels.length) return labels.join(" · ");
  }
  return "Source reporting status unavailable";
}
export function validatePointer(
  value: unknown,
  electionId: string,
): SosPointer {
  if (
    !object(value) ||
    value.schema_version !== 1 ||
    value.election_id !== electionId ||
    !text(value.snapshot_id) ||
    !text(value.revision) ||
    !/^\d+$/.test(value.revision) ||
    !text(value.source_url) ||
    !Array.isArray(value.jurisdictions) ||
    value.jurisdictions.length > 160 ||
    ![value.published_at, value.source_created_at].every(
      (v) => text(v) && Number.isFinite(Date.parse(v)),
    )
  )
    throw Error("Invalid SOS pointer");
  const ids = new Set();
  for (const j of value.jurisdictions) {
    if (
      !object(j) ||
      !text(j.id) ||
      !/^[A-Za-z0-9_-]+$/.test(j.id) ||
      !text(j.name) ||
      !text(j.url) ||
      ids.has(j.id) ||
      !Number.isSafeInteger(j.item_count) ||
      Number(j.item_count) < 0 ||
      Number(j.item_count) > 10000
    )
      throw Error("Invalid SOS jurisdiction");
    const url = new URL(j.url, FILES);
    const prefix = `/elections/${electionId}/revisions/${value.snapshot_id}/`;
    if (
      url.origin !== FILES ||
      ![`${prefix}state.json`, `${prefix}counties/${j.id}.json`].includes(
        url.pathname,
      ) ||
      url.search ||
      url.hash
    )
      throw Error("Invalid SOS asset URL");
    ids.add(j.id);
  }
  return value as unknown as SosPointer;
}
export function validateScope(
  value: unknown,
  pointer: SosPointer,
  jurisdictionId: string,
): SosScope {
  if (
    !object(value) ||
    value.schema_version !== 1 ||
    value.election_id !== pointer.election_id ||
    value.snapshot_id !== pointer.snapshot_id ||
    !object(value.jurisdiction) ||
    value.jurisdiction.id !== jurisdictionId ||
    !text(value.jurisdiction.name) ||
    !Array.isArray(value.items) ||
    value.items.length > 10000
  )
    throw Error("SOS snapshot mismatch");
  const expected = pointer.jurisdictions.find(
    (j) => j.id === jurisdictionId,
  )?.item_count;
  if (expected !== undefined && expected !== value.items.length)
    throw Error("Incomplete SOS scope");
  const ids = new Set();
  for (const item of value.items) {
    if (
      !object(item) ||
      !object(item.data) ||
      !text(item.data.id) ||
      !text(item.data.name) ||
      !Array.isArray(item.data.ballotOptions) ||
      ids.has(item.data.id)
    )
      throw Error("Invalid SOS item");
    ids.add(item.data.id);
    const choices = new Set();
    for (const choice of item.data.ballotOptions) {
      if (
        !object(choice) ||
        !text(choice.id) ||
        choices.has(choice.id) ||
        (choice.voteCount != null &&
          (typeof choice.voteCount !== "number" ||
            !Number.isSafeInteger(choice.voteCount) ||
            choice.voteCount < 0))
      )
        throw Error("Invalid SOS choice");
      choices.add(choice.id);
    }
  }
  return value as unknown as SosScope;
}
export async function fetchSosJson(url: string, fetcher: typeof fetch, cache: RequestCache) {
  const response = await fetcher(url, {
    cache,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw Error("SOS assets unavailable");
  if (Number(response.headers.get("content-length")) > 8 * 1024 * 1024)
    throw Error("SOS asset exceeds limit");
  // Enforce a cap even for chunked responses; the raw statewide feed is never a UI input.
  if (!response.body) throw Error("Empty SOS asset");
  const reader = response.body.getReader();
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) throw Error("SOS asset exceeds limit");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
/** Cache selected scopes only, always pinned to the pointer's snapshot. */
export function createPublicSosReader(fetcher: typeof fetch = fetch) {
  const scopes = new Map<string, SosScope>();
  let latest: SosPointer | undefined;
  return async (
    electionId: string,
    jurisdictionId: string,
    forceScope = false,
  ): Promise<{ pointer: SosPointer | null; scope: SosScope | null }> => {
    const data = await fetchSosJson(
      `${FILES}/elections/${electionId}/latest.json`,
      fetcher,
      "no-store",
    );
    if (!data) return { pointer: null, scope: null };
    const candidate = validatePointer(data, electionId);
    if (
      latest?.election_id === electionId &&
      candidate.revision === latest.revision &&
      candidate.snapshot_id !== latest.snapshot_id
    )
      throw Error("Conflicting SOS revision");
    // A stale CDN response cannot replace a newer publication already observed.
    if (
      !latest ||
      latest.election_id !== electionId ||
      BigInt(candidate.revision) >= BigInt(latest.revision)
    )
      latest = candidate;
    const pointer = latest;
    const jurisdiction = pointer.jurisdictions.find(
      (j) => j.id === jurisdictionId,
    );
    if (!jurisdiction) return { pointer, scope: null };
    const key = `${electionId}:${pointer.snapshot_id}:${jurisdictionId}`;
    let scope = forceScope ? undefined : scopes.get(key);
    if (!scope) {
      scope = validateScope(
        await fetchSosJson(
          new URL(jurisdiction.url!, FILES).href,
          fetcher,
          "force-cache",
        ),
        pointer,
        jurisdictionId,
      );
      scopes.clear();
      scopes.set(key, scope);
    }
    return { pointer, scope };
  };
}
/**
 * Read a visibility-gated election scope, pinning pages of at most ten items to
 * the snapshot returned by the metadata request. The default 10,000-item bound
 * retains declared scope-count validation, so incomplete or oversized scopes
 * fail instead of supplying partial ballot counts. An explicit lower limit
 * permits a partial preview and reports whether the result is truncated.
 * Metadata is always refetched; a previous complete scope may be reused only
 * when its snapshot and jurisdiction still match.
 */
export async function readRpcSos(
  rpc: SosRpc,
  electionId: string,
  jurisdictionId: string,
  limit = 10000,
  previous?: SosView,
): Promise<{
  pointer: SosPointer | null;
  scope: SosScope | null;
  truncated?: boolean;
}> {
  const meta = await rpc({ p_election_id: electionId });
  if (meta?.status === "empty") return { pointer: null, scope: null };
  if (meta?.status !== "ok" || !Array.isArray(meta.jurisdictions))
    throw Error("Election unavailable or access restricted");
  const pointer: SosPointer = {
    schema_version: 1,
    election_id: electionId,
    snapshot_id: meta.snapshot_id,
    revision: String(meta.revision ?? "0"),
    published_at: meta.published_at,
    source_created_at: meta.header?.createdAt,
    source_url: meta.source_url,
    jurisdictions: meta.jurisdictions,
  };
  const index = pointer.jurisdictions.findIndex((j) => j.id === jurisdictionId);
  if (index < 0) return { pointer, scope: null };
  if (
    previous?.pointer.snapshot_id === pointer.snapshot_id &&
    previous.scope.jurisdiction.id === jurisdictionId &&
    !previous.truncated
  )
    return { pointer, scope: previous.scope };
  const items: SosItem[] = [];
  for (let offset = 0; offset < limit; offset += 10) {
    const page = await rpc({
      p_election_id: electionId,
      p_snapshot_id: pointer.snapshot_id,
      p_jurisdiction_index: index,
      p_offset: offset,
      p_limit: Math.min(10, limit - offset),
    });
    if (
      page?.status !== "ok" ||
      page.snapshot_id !== pointer.snapshot_id ||
      !Array.isArray(page.items)
    )
      throw Error("SOS snapshot changed");
    items.push(...page.items);
    if (page.items.length < Math.min(10, limit - offset)) break;
    if (
      offset + page.items.length >=
      (pointer.jurisdictions[index].item_count ?? Infinity)
    )
      break;
  }
  // Explicit preview reads may be partial; complete runtime/static ballot reads retain scope-count validation.
  const validationPointer =
    limit < 10000
      ? {
          ...pointer,
          jurisdictions: pointer.jurisdictions.map((j) => ({
            ...j,
            item_count: undefined,
          })),
        }
      : pointer;
  const scope = validateScope(
    {
      schema_version: 1,
      election_id: electionId,
      snapshot_id: pointer.snapshot_id,
      jurisdiction: pointer.jurisdictions[index],
      items,
    },
    validationPointer,
    jurisdictionId,
  );
  return {
    pointer,
    scope,
    truncated: (scope.jurisdiction.item_count ?? items.length) > items.length,
  };
}
