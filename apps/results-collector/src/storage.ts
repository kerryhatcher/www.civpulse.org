import { S3Client } from "bun";

export interface Store {
  get(key: string): Promise<Response>;
  put(key: string, body: Blob | string, headers: Record<string, string>): Promise<Response>;
  url(key: string): string;
}
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
export const POINTER_CACHE = "public, max-age=15, s-maxage=15, must-revalidate";
export function r2Store(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch): Store {
  for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) if (!env[name]) throw Error(`Missing ${name}`);
  if (!/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(env.R2_ENDPOINT!)) throw Error("Invalid R2 endpoint");
  const s3 = new S3Client({ endpoint: env.R2_ENDPOINT, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: "civpulse-files", region: "auto" });
  function keyChecked(key: string) {
    if (!/^elections\/[0-9a-f-]{36}\/[A-Za-z0-9_./-]+$/.test(key) || key.includes("..")) throw Error("Invalid results archive key");
    return key;
  }
  return {
    get: key => fetcher(s3.presign(keyChecked(key), { method: "GET", expiresIn: 300 }), { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(120_000) }),
    put: (key, body, headers) => fetcher(s3.presign(keyChecked(key), { method: "PUT", expiresIn: 300 }), { method: "PUT", headers, body, redirect: "error", signal: AbortSignal.timeout(180_000) }),
    url: key => `https://files.civpulse.org/${keyChecked(key)}`,
  };
}
export async function hashBody(body: ReadableStream<Uint8Array> | null): Promise<{ hash: string; bytes: number }> {
  if (!body) throw Error("Missing stored object body");
  const hash = new Bun.CryptoHasher("sha256"); let bytes = 0;
  for await (const chunk of body) { hash.update(chunk); bytes += chunk.length; }
  return { hash: hash.digest("hex"), bytes };
}
export async function immutable(store: Store, key: string, body: Blob | string, hash: string) {
  const response = await store.put(key, body, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": IMMUTABLE_CACHE, "If-None-Match": "*" });
  if (!response.ok && response.status !== 412) throw Error(`R2 immutable PUT HTTP ${response.status}`);
  await response.body?.cancel();
  const readback = await store.get(key);
  if (!readback.ok) throw Error(`R2 readback HTTP ${readback.status}`);
  const actual = await hashBody(readback.body);
  const bytes = typeof body === "string" ? new TextEncoder().encode(body).length : body.size;
  if (actual.hash !== hash || actual.bytes !== bytes) throw Error("R2 immutable checksum mismatch");
}
export interface Pointer { schema_version: 1; election_id: string; revision: string; snapshot_id: string; [key: string]: unknown }
/** R2 conditional writes are atomic. Checking the stored revision before CAS makes
 * a delayed process unable to replace a newer pointer, even after lease expiry. */
export async function publishPointer(store: Store, pointer: Pointer, confirm: () => Promise<boolean>) {
  if (!/^\d+$/.test(pointer.revision)) throw Error("Invalid publication revision");
  const key = `elections/${pointer.election_id}/latest.json`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await store.get(key);
    let etag: string | null = null;
    if (previous.ok) {
      etag = previous.headers.get("etag");
      const prior = await previous.json() as Pointer;
      if (!etag || prior.election_id !== pointer.election_id || !/^\d+$/.test(String(prior.revision))) throw Error("Invalid existing results pointer");
      if (BigInt(prior.revision) > BigInt(pointer.revision)) return "superseded";
      if (BigInt(prior.revision) === BigInt(pointer.revision)) {
        if (prior.snapshot_id !== pointer.snapshot_id) throw Error("Conflicting pointer revision");
        return "current";
      }
    } else if (previous.status !== 404) throw Error(`R2 pointer GET HTTP ${previous.status}`);
    else await previous.body?.cancel();
    if (!await confirm()) return "superseded";
    const written = await store.put(key, JSON.stringify(pointer), {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": POINTER_CACHE,
      ...(etag ? { "If-Match": etag } : { "If-None-Match": "*" }),
    });
    await written.body?.cancel();
    if (written.status === 412) continue;
    if (!written.ok) throw Error(`R2 pointer PUT HTTP ${written.status}`);
    // Verify through the consistent S3 API, not the public CDN cache.
    const readback = await store.get(key);
    if (!readback.ok) throw Error("Results pointer readback failed");
    const actual = await readback.json() as Pointer;
    if (BigInt(actual.revision) < BigInt(pointer.revision)) throw Error("Results pointer readback regressed");
    return BigInt(actual.revision) === BigInt(pointer.revision) ? "published" : "superseded";
  }
  throw Error("Results pointer CAS contention; durable retry required");
}
