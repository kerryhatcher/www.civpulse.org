import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { itemBatches } from "../../../scripts/sos-results";
import { download, prepare, sourceItems, SourceHttpError, MAX_DOWNLOAD, type Obj } from "./feed";
import { immutable, publishPointer, type Pointer, type Store } from "./storage";

export type Rpc = (name: string, args?: Obj) => Promise<any>;
export function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : "Collection failure").replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]").slice(0, 500);
}
export interface Job { job_id: string; lease_id: string; election_id: string; election_date: string; source_url: string; etag?: string | null; last_modified?: string | null; snapshot_id?: string | null; phase: string; revision?: string; manifest_key?: string; receipt?: Obj }
function jsonHash(text: string) { return new Bun.CryptoHasher("sha256").update(text).digest("hex"); }
export async function writeAssets(store: Store, electionId: string, snapshotId: string, prepared: Awaited<ReturnType<typeof prepare>>, receipt: Obj) {
  const prefix = `elections/${electionId}/revisions/${snapshotId}`;
  const jurisdictions: Obj[] = [];
  for (const [index, path] of prepared.scopeFiles.entries()) {
    const scope = await Bun.file(path).json();
    const slug = encodeURIComponent(scope.id);
    // Source IDs are never used as unchecked object paths.
    if (!/^[A-Za-z0-9_-]+$/.test(slug)) throw Error("Unsupported jurisdiction path ID");
    const scopePath = index === 0 ? "state" : `counties/${slug}`;
    const detailsKey = `${prefix}/${scopePath}-detail.json`;
    const detail = JSON.stringify({ schema_version: 1, election_id: electionId, snapshot_id: snapshotId, jurisdiction: prepared.jurisdictions[index], items: sourceItems(scope, index) });
    await immutable(store, detailsKey, detail, jsonHash(detail));
    const items = sourceItems(scope, index).map(item => {
      const { rankedChoiceResults, ...data } = item.data;
      return { ...item, data: { ...data, ballotOptions: (data.ballotOptions as Obj[]).map((option: Obj) => { const { precinctResults, groupResults, ...small } = option; return small; }) }, detail_url: store.url(detailsKey) };
    });
    const summary = JSON.stringify({ schema_version: 1, election_id: electionId, snapshot_id: snapshotId, jurisdiction: prepared.jurisdictions[index], items });
    if (new TextEncoder().encode(summary).length > 4 * 1024 * 1024) throw Error("Compact scope exceeds 4 MiB");
    const key = `${prefix}/${scopePath}.json`, hash = jsonHash(summary);
    await immutable(store, key, summary, hash);
    jurisdictions.push({ id: scope.id, name: scope.name, item_count: scope.ballotItems.length, url: store.url(key), sha256: hash, detail_url: store.url(detailsKey) });
  }
  const manifest = {
    schema_version: 1, election_id: electionId, snapshot_id: snapshotId,
    source_url: receipt.source_url, source_created_at: prepared.header.createdAt,
    source_sha256: receipt.sha256, source_bytes: receipt.bytes, raw_url: receipt.raw_url,
    retrieved_at: receipt.retrieved_at, etag: receipt.etag, last_modified: receipt.last_modified,
    fingerprint: prepared.fingerprint, jurisdictions,
  };
  const key = `${prefix}/manifest.json`, text = JSON.stringify(manifest);
  await immutable(store, key, text, jsonHash(text));
  return { key, manifest };
}
export async function runJob(job: Job, rpc: Rpc, store: Store, fetcher: typeof fetch = fetch) {
  const args = { p_job_id: job.job_id, p_lease_id: job.lease_id };
  let leaseLost = false, renewal: Promise<unknown> = Promise.resolve();
  const renew = async () => {
    if (leaseLost || !await rpc("renew_sos_results_job", args)) { leaseLost = true; throw Error("Collection lease lost"); }
  };
  // Renewal runs independently during network download/readback; every mutation
  // is also checked by the database using the same fenced lease identity.
  const timer = setInterval(() => { renewal = renewal.then(renew).catch(() => { leaseLost = true; }); }, 30_000);
  let directory: string | undefined;
  try {
    if (job.phase !== "pointer") {
      directory = await mkdtemp(`${tmpdir()}/civpulse-results-`);
      const path = `${directory}/source.json`;
      let downloaded;
      if (job.snapshot_id && job.receipt) {
        // Resume the exact archived source that owns the durable staging rows.
        // A fresh upstream export must never strand or silently replace this job.
        const source = await store.get(job.receipt.raw_key);
        if (!source.ok || !source.body) throw Error("Archived source unavailable for resume");
        const writer = Bun.file(path).writer(), hash = new Bun.CryptoHasher("sha256");
        let bytes = 0;
        try {
          for await (const chunk of source.body) {
            bytes += chunk.byteLength;
            if (bytes > MAX_DOWNLOAD) throw Error("Archived source exceeds download limit");
            hash.update(chunk); writer.write(chunk); await writer.flush();
          }
        } finally { await writer.end(); }
        if (hash.digest("hex") !== job.receipt.sha256 || bytes !== job.receipt.bytes) throw Error("Archived source checksum mismatch");
        downloaded = { ...job.receipt, unchanged: false as const, sha256: job.receipt.sha256 as string, bytes, etag: job.receipt.etag as string | null, last_modified: job.receipt.last_modified as string | null, retrieved_at: job.receipt.retrieved_at as string };
      } else downloaded = await download(job.source_url, path, job, fetcher);
      await renew();
      if (downloaded.unchanged) {
        await rpc("unchanged_sos_results_job", { ...args, p_etag: downloaded.etag ?? job.etag ?? null, p_last_modified: downloaded.last_modified ?? job.last_modified ?? null });
        return { status: "unchanged" };
      }
      const prepared = await prepare(path, `${directory}/scopes`, job.election_date);
      await renew();
      const rawKey = `elections/${job.election_id}/raw/${downloaded.sha256}.json`;
      await immutable(store, rawKey, Bun.file(path), downloaded.sha256);
      const receipt = { ...downloaded, source_url: job.source_url, raw_key: rawKey, raw_url: store.url(rawKey) };
      const begun = await rpc("begin_sos_results_job", { ...args, p_sha256: downloaded.sha256, p_header: prepared.header, p_jurisdictions: prepared.jurisdictions, p_receipt: receipt });
      const snapshot = begun.snapshot_id;
      let manifestKey = `elections/${job.election_id}/revisions/${snapshot}/manifest.json`;
      if (!begun.published) {
        for (const [index, file] of prepared.scopeFiles.entries()) {
          const scope = await Bun.file(file).json();
          for (const items of itemBatches(sourceItems(scope, index))) {
            if (leaseLost) throw Error("Collection lease lost");
            await rpc("stage_sos_results_job", { ...args, p_snapshot_id: snapshot, p_items: items });
          }
        }
        const assets = await writeAssets(store, job.election_id, snapshot, prepared, begun.receipt);
        manifestKey = assets.key;
      }
      await renew();
      await rpc("publish_sos_results_job", { ...args, p_snapshot_id: snapshot, p_fingerprint: prepared.fingerprint, p_manifest_key: manifestKey });
      if (begun.published) return { status: "unchanged_published" };
    }
    const publication = await rpc("confirm_sos_results_pointer", args);
    if (!publication) return { status: "superseded" };
    const response = await store.get(publication.manifest_key);
    if (!response.ok) throw Error("Committed results manifest unavailable");
    const manifest = await response.json();
    if (manifest.election_id !== job.election_id || manifest.snapshot_id !== publication.snapshot_id) throw Error("Committed results manifest mismatch");
    const pointer: Pointer = { ...manifest, schema_version: 1, revision: String(publication.revision), published_at: publication.published_at };
    const status = await publishPointer(store, pointer, async () => {
      const current = await rpc("confirm_sos_results_pointer", args);
      return current && String(current.revision) === pointer.revision && current.snapshot_id === pointer.snapshot_id;
    });
    await rpc("complete_sos_results_pointer", { ...args, p_revision: pointer.revision });
    return { status, revision: pointer.revision };
  } catch (error) {
    // Record only a bounded message, never a request URL with presigned credentials.
    await rpc("fail_sos_results_job", { ...args, p_error: safeError(error), p_retry_after: error instanceof SourceHttpError ? error.retryAfter : null }).catch(() => {});
    throw error;
  } finally {
    clearInterval(timer); await renewal;
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
