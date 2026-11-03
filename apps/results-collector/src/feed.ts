import { SOS_URL, itemBatches, type SourceItem } from "../../../scripts/sos-results";
import { mkdir } from "node:fs/promises";

export const MAX_DOWNLOAD = 512 * 1024 * 1024;
const MAX_SCOPE = 64 * 1024 * 1024;
export type Obj = Record<string, any>;
export function object(value: unknown): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected source object");
  return value as Obj;
}
export function canonical(value: unknown, field = ""): string {
  if (Array.isArray(value)) {
    const identity = ["ballotItems", "ballotOptions", "precinctResults"].includes(field) ? "id" : field === "groupResults" ? "groupName" : null;
    let values = value;
    if (identity && value.every(x => x && typeof x === "object" && typeof x[identity] === "string") && new Set(value.map(x => x[identity])).size === value.length) {
      values = [...value].sort((a,b) => a[identity].localeCompare(b[identity]));
    }
    return `[${values.map(x => canonical(x)).join(",")}]`;
  }
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Obj)[k],k)}`).join(",")}}`;
  return JSON.stringify(value);
}
export class SourceHttpError extends Error {
  constructor(public status: number, public retryAfter: number) { super(`SOS HTTP ${status}`); }
}
export function retrySeconds(value: string | null, now = Date.now()): number {
  if (!value) return 60;
  const n = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(n) ? Math.max(1, Math.min(n, 3600)) : 60;
}
export async function download(url: string, path: string, validators: { etag?: string | null; last_modified?: string | null }, fetcher: typeof fetch = fetch, authorizationSignal?: AbortSignal) {
  const signal = AbortSignal.any([AbortSignal.timeout(180_000), ...(authorizationSignal ? [authorizationSignal] : [])]);
  signal.throwIfAborted();
  if (!SOS_URL.test(url)) throw Error("Invalid SOS source URL");
  const headers = new Headers({ "Accept": "application/json", "Accept-Encoding": "identity" });
  if (validators.etag) headers.set("If-None-Match", validators.etag);
  else if (validators.last_modified) headers.set("If-Modified-Since", validators.last_modified);
  const response = await fetcher(url, { headers, redirect: "error", cache: "no-store", signal });
  signal.throwIfAborted();
  const receipt = { etag: response.headers.get("etag"), last_modified: response.headers.get("last-modified"), retrieved_at: new Date().toISOString() };
  if (response.status === 304) return { unchanged: true as const, ...receipt };
  if (!response.ok) throw new SourceHttpError(response.status, retrySeconds(response.headers.get("retry-after")));
  if (!response.body || Number(response.headers.get("content-length")) > MAX_DOWNLOAD) throw Error("Empty or oversized SOS download");
  await Bun.write(path, new Uint8Array());
  const writer = Bun.file(path).writer();
  const hash = new Bun.CryptoHasher("sha256");
  let bytes = 0;
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value: chunk } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > MAX_DOWNLOAD) throw Error("SOS download exceeds 512 MiB");
      hash.update(chunk); writer.write(chunk);
      await writer.flush();
    }
    const length = response.headers.get("content-length");
    if (length && !response.headers.get("content-encoding") && bytes !== Number(length)) throw Error("Truncated SOS download");
    if (!bytes) throw Error("Empty SOS download");
  } finally { signal.removeEventListener("abort", cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); await writer.end(); }
  return { unchanged: false as const, ...receipt, bytes, sha256: hash.digest("hex") };
}

/** Incremental JSON reader: only one jurisdiction is materialized, never the full feed. */
class JsonReader {
  private buffer = "";
  private ended = false;
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private stream: AsyncIterator<Uint8Array>;
  constructor(file: string) { this.stream = Bun.file(file).stream()[Symbol.asyncIterator](); }
  async fill() {
    const next = await this.stream.next();
    if (next.done) { this.buffer += this.decoder.decode(); this.ended = true; }
    else this.buffer += this.decoder.decode(next.value, { stream: true });
  }
  async peek(): Promise<string> {
    while (true) {
      this.buffer = this.buffer.replace(/^[\s\uFEFF]+/, "");
      if (this.buffer.length || this.ended) return this.buffer[0] ?? "";
      await this.fill();
    }
  }
  async token(expected: string) {
    if (await this.peek() !== expected) throw Error(`Invalid JSON: expected ${expected}`);
    this.buffer = this.buffer.slice(1);
  }
  async value(): Promise<unknown> {
    await this.peek();
    let index = 0, depth = 0, inString = false, escaped = false;
    const structured = this.buffer[0] === "{" || this.buffer[0] === "[";
    const string = this.buffer[0] === '"';
    while (true) {
      for (; index < this.buffer.length; index++) {
        const ch = this.buffer[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') { inString = false; if (string && depth === 0) return this.take(index + 1); }
        } else if (ch === '"') inString = true;
        else if (ch === "{" || ch === "[") depth++;
        else if (ch === "}" || ch === "]") {
          if (!structured && depth === 0) return this.take(index);
          depth--; if (depth === 0) return this.take(index + 1);
        } else if (!structured && !string && /[\s,:]/.test(ch)) return this.take(index);
      }
      if (this.buffer.length > MAX_SCOPE) throw Error("Jurisdiction exceeds 64 MiB; review schema");
      if (this.ended) { if (!inString && !structured && index) return this.take(index); throw Error("Truncated JSON value"); }
      await this.fill();
    }
  }
  private take(n: number) { if (n > MAX_SCOPE) throw Error("Jurisdiction exceeds 64 MiB; review schema"); const text = this.buffer.slice(0, n); this.buffer = this.buffer.slice(n); return JSON.parse(text); }
}
export async function* readFeed(file: string): AsyncGenerator<{ key: string; value: unknown }> {
  const reader = new JsonReader(file), keys = new Set<string>();
  await reader.token("{");
  while (await reader.peek() !== "}") {
    const key = await reader.value();
    if (typeof key !== "string" || keys.has(key)) throw Error("Invalid/duplicate feed key");
    keys.add(key); await reader.token(":");
    if (key === "localResults") {
      await reader.token("[");
      let count = 0;
      while (await reader.peek() !== "]") {
        if (++count > 159) throw Error("Too many counties");
        yield { key: "county", value: await reader.value() };
        if (await reader.peek() === "]") break;
        await reader.token(",");
        if (await reader.peek() === "]") throw Error("Trailing array comma");
      }
      await reader.token("]");
    } else yield { key, value: await reader.value() };
    if (await reader.peek() === "}") break;
    await reader.token(",");
    if (await reader.peek() === "}") throw Error("Trailing object comma");
  }
  await reader.token("}");
  if (await reader.peek()) throw Error("Trailing JSON data");
  if (!keys.has("results") || !keys.has("localResults")) throw Error("Missing jurisdictions");
}
function validateCounts(value: unknown, depth = 0) {
  if (depth > 40) throw Error("Source nesting exceeds limit");
  if (Array.isArray(value)) { for (const child of value) validateCounts(child, depth + 1); }
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    if (/^(voteCount|precinctsParticipating|precinctsReporting|registeredVoters|ballotsCast|voteFor)$/.test(key) && child !== null && (!Number.isSafeInteger(child) || (child as number) < 0)) throw Error(`Invalid source count ${key}`);
    validateCounts(child, depth + 1);
  }
}
export function validateScope(value: unknown): Obj {
  const scope = object(value);
  if (typeof scope.id !== "string" || !scope.id || typeof scope.name !== "string" || !scope.name || !(scope.reportingStatuses === null || Array.isArray(scope.reportingStatuses)) || !Array.isArray(scope.ballotItems) || scope.ballotItems.length > 99999) throw Error("Invalid jurisdiction");
  const ids = new Set();
  for (const raw of scope.ballotItems) {
    const item = object(raw);
    if (typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.name !== "string" || !item.name || !Array.isArray(item.ballotOptions)) throw Error("Invalid/duplicate ballot item");
    ids.add(item.id);
    const choices = new Set();
    for (const rawOption of item.ballotOptions) {
      const option = object(rawOption);
      if (typeof option.id !== "string" || !option.id || choices.has(option.id)) throw Error("Invalid/duplicate ballot choice");
      choices.add(option.id);
      for (const key of ["groupResults", "precinctResults"]) if (option[key] !== undefined && option[key] !== null && !Array.isArray(option[key])) throw Error(`Invalid ${key}`);
    }
    validateCounts(item);
  }
  return scope;
}
export async function prepare(file: string, directory: string, electionDate: string) {
  if (Bun.file(file).size > MAX_DOWNLOAD) throw Error("Feed exceeds 512 MiB");
  await mkdir(directory, { recursive: true });
  const header: Obj = {}, jurisdictions: Obj[] = [], scopeFiles: string[] = [], ids = new Set();
  const scopeHashes: { id: string; hash: string }[] = [];
  let stateSeen = false, itemCount = 0;
  for await (const entry of readFeed(file)) {
    if (entry.key !== "results" && entry.key !== "county") {
      header[entry.key] = entry.value;
      if (new TextEncoder().encode(JSON.stringify(header)).length > 1024 * 1024) throw Error("Feed header exceeds 1 MiB; review schema");
      continue;
    }
    if (entry.key === "results") { if (stateSeen) throw Error("Duplicate state"); stateSeen = true; }
    const scope = validateScope(entry.value);
    if (ids.has(scope.id)) throw Error("Duplicate jurisdiction ID");
    ids.add(scope.id);
    const index = entry.key === "results" ? 0 : jurisdictions.filter(x => x !== undefined).length + (stateSeen ? 0 : 1);
    if (jurisdictions[index]) throw Error("Invalid jurisdiction ordering");
    const { ballotItems, ...metadata } = scope;
    if (new TextEncoder().encode(JSON.stringify(metadata)).length > 128 * 1024) throw Error("Jurisdiction metadata exceeds 128 KiB; review schema");
    jurisdictions[index] = { ...metadata, item_count: ballotItems.length };
    itemCount += ballotItems.length;
    const path = `${directory}/scope-${index}.json`;
    await Bun.write(path, JSON.stringify(scope)); scopeFiles[index] = path;
    // Validate bounded RPC batches before any database staging is begun.
    for (const _ of itemBatches(ballotItems.map((data: Obj, item_index: number) => ({ jurisdiction_index: index, item_index, data })))) { /* validation only */ }
    scopeHashes.push({ id: scope.id, hash: new Bun.CryptoHasher("sha256").update(canonical(scope)).digest("hex") });
    // Long-lived containers should release completed jurisdiction strings rather
    // than retain a full import's allocation high-water mark until automatic GC.
    if (scopeHashes.length % 8 === 0) Bun.gc(false);
  }
  if (!stateSeen || !jurisdictions[0] || header.electionDate !== electionDate || typeof header.electionName !== "string" || !header.electionName || typeof header.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(header.createdAt) || !Number.isFinite(Date.parse(header.createdAt)) || Date.parse(header.createdAt) > Date.now() + 300_000) throw Error("Invalid feed identity/date");
  const { createdAt, ...meaningfulHeader } = header;
  const fingerprint = new Bun.CryptoHasher("sha256").update(canonical({ header: meaningfulHeader, scopes: scopeHashes.sort((a,b) => a.id.localeCompare(b.id)) })).digest("hex");
  return { header, jurisdictions, scopeFiles, fingerprint, itemCount };
}
export function sourceItems(scope: Obj, jurisdiction_index: number): SourceItem[] {
  return scope.ballotItems.map((data: Obj, item_index: number) => ({ jurisdiction_index, item_index, data }));
}
