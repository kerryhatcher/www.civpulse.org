import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { download, prepare, retrySeconds, MAX_DOWNLOAD, readFeed, canonical } from "../src/feed";
import { freshDownload, runJob, writeAssets, type Job } from "../src/collector";
import { immutable, publishPointer, POINTER_CACHE, type Pointer, type Store } from "../src/storage";

const election = "00000000-0000-4000-8000-000000000001", snapshot = "00000000-0000-4000-8000-000000000002";
const sourceUrl = "https://results.sos.ga.gov/cdn/results/Georgia/export-Example.json";
const job: Job = { job_id: "job", lease_id: "lease", election_id: election, election_date: "2026-11-03", source_url: sourceUrl, phase: "download" };
const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function directory() { const path = await mkdtemp(`${tmpdir()}/collector-test-`); directories.push(path); return path; }
function fixture() {
  return { electionDate: "2026-11-03", electionName: "Example", createdAt: "2026-11-03T10:00:00Z", results: { id: "state", name: "Georgia", reportingStatuses: null, ballotItems: [{ id: "race", name: "Race", precinctsReporting: null, ballotOptions: [{ id: "1", name: "Alex", voteCount: 0, groupResults: [{ groupName: "Advance Voting", voteCount: 0 }], precinctResults: [{ id: "p1", name: "P1", voteCount: null, reportingStatus: "Not Reported" }] }] }] }, localResults: [] };
}
function fetcher(response: () => Response) { return (async () => response()) as unknown as typeof fetch; }
class MemoryStore implements Store {
  objects = new Map<string, { body: string; etag: string; headers: Record<string, string> }>();
  counter = 0;
  beforePut?: (key: string) => Promise<void>;
  async get(key: string) {
    const value = this.objects.get(key);
    return value ? new Response(value.body, { headers: { etag: value.etag, ...value.headers } }) : new Response("", { status: 404 });
  }
  async put(key: string, body: Blob | string, headers: Record<string, string>) {
    if (this.beforePut) await this.beforePut(key);
    const value = this.objects.get(key);
    if ((headers["If-None-Match"] === "*" && value) || (headers["If-Match"] && value?.etag !== headers["If-Match"])) return new Response("", { status: 412 });
    this.objects.set(key, { body: typeof body === "string" ? body : await body.text(), etag: `"${++this.counter}"`, headers });
    return new Response("", { status: 200 });
  }
  url(key: string) { return `https://files.civpulse.org/${key}`; }
}
function pointer(revision: string): Pointer { return { schema_version: 1, election_id: election, snapshot_id: `snapshot-${revision}`, revision }; }
test("disk parser preserves null/zero/source scope and semantic fingerprint ignores only createdAt and formatting", async () => {
  const dir = await directory(), file = `${dir}/raw.json`;
  const source = fixture(); await Bun.write(file, JSON.stringify(source));
  const a = await prepare(file, `${dir}/a`, job.election_date);
  expect(a.jurisdictions[0].reportingStatuses).toBeNull(); expect(a.itemCount).toBe(1);
  source.createdAt = "2026-11-03T10:01:00Z"; await Bun.write(file, JSON.stringify(source, null, 2));
  expect((await prepare(file, `${dir}/b`, job.election_date)).fingerprint).toBe(a.fingerprint);
  source.results.ballotItems[0].ballotOptions[0].voteCount = 1;
  await Bun.write(file, JSON.stringify(source));
  expect((await prepare(file, `${dir}/c`, job.election_date)).fingerprint).not.toBe(a.fingerprint);
  source.results.ballotItems[0].ballotOptions[0].voteCount = -1; await Bun.write(file, JSON.stringify(source));
  await expect(prepare(file, `${dir}/d`, job.election_date)).rejects.toThrow("count");
});
test("semantic arrays normalize stable source IDs but retain labels, status, ballot order and downward corrections", () => {
  const a = { ballotOptions: [{ id: "2", name: "Beta", voteCount: 10, ballotOrder: 2 }, { id: "1", name: "Alpha", voteCount: 0, ballotOrder: 1 }], groupResults: [{ groupName: "Mail", voteCount: 1 }, { groupName: "Election Day", voteCount: 2 }], reportingStatuses: null };
  const b = structuredClone(a); b.ballotOptions.reverse(); b.groupResults.reverse();
  expect(canonical(a)).toBe(canonical(b));
  b.ballotOptions[1].voteCount = 9; expect(canonical(a)).not.toBe(canonical(b));
  b.ballotOptions[1].voteCount = 10; b.ballotOptions[1].ballotOrder = 3; expect(canonical(a)).not.toBe(canonical(b));
  expect(canonical(a)).not.toBe(canonical({ ...a, reportingStatuses: [] }));
});
test("stream JSON rejects truncated, trailing, duplicated root keys and invalid schema before staging", async () => {
  const dir = await directory(), file = `${dir}/raw.json`;
  for (const text of [JSON.stringify(fixture()).slice(0, -3), JSON.stringify(fixture()) + "true", '{"results":{},"results":{}}', '{"results":{},}', '{"results":{},"localResults":[{},]}']) {
    await Bun.write(file, text);
    await expect(async () => { for await (const _ of readFeed(file)) {} }).toThrow();
  }
  const source = fixture(); source.results.ballotItems[0].ballotOptions.push(source.results.ballotItems[0].ballotOptions[0]);
  await Bun.write(file, JSON.stringify(source)); await expect(prepare(file, `${dir}/bad`, job.election_date)).rejects.toThrow("duplicate ballot choice");
});
test("byte-exact download hashes BOM, conditionals, 304, HTTP errors, Retry-After and truncation", async () => {
  const dir = await directory(), file = `${dir}/raw.json`, bytes = new TextEncoder().encode("\uFEFF" + JSON.stringify(fixture()));
  let opts: RequestInit | undefined;
  const actual = await download(sourceUrl, file, { etag: '"source"' }, (async (_url: unknown, options: RequestInit) => { opts = options; return new Response(bytes, { headers: { etag: '"next"' } }); }) as unknown as typeof fetch);
  expect(opts?.redirect).toBe("error"); expect(new Headers(opts?.headers).get("If-None-Match")).toBe('"source"');
  expect(actual).toMatchObject({ sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  expect(new Uint8Array(await Bun.file(file).arrayBuffer())).toEqual(bytes);
  expect((await download(sourceUrl, file, {}, fetcher(() => new Response(null, { status: 304 })))).unchanged).toBe(true);
  for (const status of [429, 500, 503]) await expect(download(sourceUrl, file, {}, fetcher(() => new Response("", { status, headers: { "Retry-After": "120" } })))).rejects.toMatchObject({ status, retryAfter: 120 });
  await expect(download(sourceUrl, file, {}, fetcher(() => new Response("short", { headers: { "content-length": "20" } })))).rejects.toThrow("Truncated");
  await expect(download(sourceUrl, file, {}, fetcher(() => new Response("", { headers: { "content-length": String(MAX_DOWNLOAD + 1) } })))).rejects.toThrow("oversized");
  await expect(download("https://example.com/feed", file, {})).rejects.toThrow("URL");
  expect(retrySeconds("Tue, 03 Nov 2026 10:02:00 GMT", Date.parse("2026-11-03T10:00:00Z"))).toBe(120);
  expect(retrySeconds("9999999")).toBe(3600);
});
test("compact assets preserve zeros and null reporting but require detail fetch for precinct and method data", async () => {
  const dir = await directory(), file = `${dir}/raw.json`; await Bun.write(file, JSON.stringify(fixture()));
  const prepared = await prepare(file, `${dir}/scopes`, job.election_date), store = new MemoryStore();
  const { manifest } = await writeAssets(store, election, snapshot, prepared, { source_url: sourceUrl });
  const summary = JSON.parse(store.objects.get(`elections/${election}/revisions/${snapshot}/state.json`)!.body);
  expect(summary.jurisdiction.reportingStatuses).toBeNull();
  expect(summary.items[0].data.ballotOptions[0]).toEqual({ id: "1", name: "Alex", voteCount: 0 });
  expect(summary.items[0].detail_url).toContain("state-detail.json");
  expect(manifest.jurisdictions).toHaveLength(1);
  expect(store.objects.get(`elections/${election}/revisions/${snapshot}/state-detail.json`)!.body).toContain("Not Reported");
});
test("immutable upload verifies collisions instead of accepting existing bytes", async () => {
  const store = new MemoryStore();
  await immutable(store, "key", "{}", new Bun.CryptoHasher("sha256").update("{}").digest("hex"));
  await expect(immutable(store, "key", "[]", new Bun.CryptoHasher("sha256").update("[]").digest("hex"))).rejects.toThrow("checksum");
});
test("pointer never regresses across expired worker, stale CAS and publication crash after PUT", async () => {
  const store = new MemoryStore(), key = `elections/${election}/latest.json`;
  expect(await publishPointer(store, pointer("1"), async () => true)).toBe("published");
  expect(store.objects.get(key)!.headers["Cache-Control"]).toBe(POINTER_CACHE);
  let interrupted = false;
  store.beforePut = async () => {
    if (interrupted) return;
    interrupted = true; store.beforePut = undefined;
    await publishPointer(store, pointer("3"), async () => true);
  };
  expect(await publishPointer(store, pointer("2"), async () => true)).toBe("superseded");
  expect(JSON.parse(store.objects.get(key)!.body).revision).toBe("3");
  expect(await publishPointer(store, pointer("3"), async () => { throw Error("shouldn't need live lease after successful PUT"); })).toBe("current");
  expect(await publishPointer(store, pointer("4"), async () => false)).toBe("superseded");
  expect(JSON.parse(store.objects.get(key)!.body).revision).toBe("3");
});
test("failed asset upload never commits DB snapshot and 304 only updates health", async () => {
  const calls: string[] = [], store = new MemoryStore();
  const rpc = async (name: string) => { calls.push(name); if (name === "authorize_sos_results_download") return authorization(); if (name === "renew_sos_results_job") return true; if (name === "begin_sos_results_job") return { snapshot_id: snapshot, receipt: {} }; return null; };
  await runJob(job, rpc, store, fetcher(() => new Response(null, { status: 304 })));
  expect(calls).toEqual(["authorize_sos_results_download", "renew_sos_results_job", "unchanged_sos_results_job"]);
  calls.length = 0; store.put = async () => new Response("", { status: 503 });
  await expect(runJob(job, rpc, store, fetcher(() => new Response(JSON.stringify(fixture()))))).rejects.toThrow("PUT");
  expect(calls).not.toContain("publish_sos_results_job"); expect(calls).toContain("fail_sos_results_job");
});
test("crash after DB commit retries outbox without source re-download or staging", async () => {
  const store = new MemoryStore(), manifestKey = `elections/${election}/revisions/${snapshot}/manifest.json`;
  await store.put(manifestKey, JSON.stringify({ schema_version: 1, election_id: election, snapshot_id: snapshot, jurisdictions: [] }), {});
  const calls: string[] = [];
  const rpc = async (name: string) => { calls.push(name); if (name === "authorize_sos_results_download") return authorization(); if (name === "renew_sos_results_job") return true; if (name === "confirm_sos_results_pointer") return { revision: "9007199254740993", snapshot_id: snapshot, manifest_key: manifestKey, published_at: "2026-11-03T10:05:00Z" }; return null; };
  const result = await runJob({ ...job, phase: "pointer" }, rpc, store, fetcher(() => { throw Error("must not download"); }));
  expect(result.revision).toBe("9007199254740993"); expect(calls).toContain("complete_sos_results_pointer"); expect(calls).not.toContain("begin_sos_results_job"); expect(calls).not.toContain("authorize_sos_results_download");
});
test("complete pipeline recovers an acknowledgement crash without reimport or pointer regression", async () => {
  const store = new MemoryStore(), calls: string[] = [];
  let phase = "import", receipt: any, failAck = true;
  const rpc = async (name: string, args: any = {}) => {
    calls.push(name);
    if (name === "authorize_sos_results_download") return authorization(); if (name === "renew_sos_results_job") return true;
    if (name === "begin_sos_results_job") { receipt ??= args.p_receipt; return { snapshot_id: snapshot, receipt, published: false }; }
    if (name === "publish_sos_results_job") { phase = "pointer"; return "1"; }
    if (name === "confirm_sos_results_pointer") return { snapshot_id: snapshot, revision: "1", manifest_key: `elections/${election}/revisions/${snapshot}/manifest.json`, published_at: "2026-11-03T10:02:00Z" };
    if (name === "complete_sos_results_pointer" && failAck) throw Error("ack interrupted");
  };
  await expect(runJob(job, rpc, store, fetcher(() => new Response(JSON.stringify(fixture()))))).rejects.toThrow("ack interrupted");
  expect(phase).toBe("pointer");
  const pointerKey = `elections/${election}/latest.json`, firstEtag = store.objects.get(pointerKey)!.etag;
  calls.length = 0; failAck = false;
  expect((await runJob({ ...job, phase }, rpc, store, fetcher(() => { throw Error("must resume outbox"); }))).status).toBe("current");
  expect(calls).not.toContain("stage_sos_results_job");
  expect(store.objects.get(pointerKey)!.etag).toBe(firstEtag);
});
test("staging resumes from archived bytes when upstream changes and retains original receipt", async () => {
  const store = new MemoryStore(), source = JSON.stringify(fixture()), sha256 = new Bun.CryptoHasher("sha256").update(source).digest("hex");
  const rawKey = `elections/${election}/raw/${sha256}.json`;
  const receipt = { sha256, bytes: source.length, raw_key: rawKey, raw_url: store.url(rawKey), retrieved_at: "2026-11-03T10:01:00Z", source_url: sourceUrl, etag: '"old"', last_modified: null };
  await store.put(rawKey, source, {});
  let first = true, usedReceipt: any;
  const rpc = async (name: string, args: any = {}) => {
    if (name === "authorize_sos_results_download") return authorization(); if (name === "renew_sos_results_job") return true;
    if (name === "begin_sos_results_job") { usedReceipt = args.p_receipt; return { snapshot_id: snapshot, receipt, published: false }; }
    if (name === "authorize_sos_results_download") throw Error("archive must not authorize fresh source");
    if (name === "stage_sos_results_job" && first) { first = false; throw Error("staging crash"); }
    if (name === "confirm_sos_results_pointer") return { snapshot_id: snapshot, revision: "1", manifest_key: `elections/${election}/revisions/${snapshot}/manifest.json`, published_at: "2026-11-03T10:02:00Z" };
  };
  const resumed = { ...job, snapshot_id: snapshot, receipt };
  const noUpstream = fetcher(() => { throw Error("source changed; do not fetch it"); });
  await expect(runJob(resumed, rpc, store, noUpstream)).rejects.toThrow("staging crash");
  expect((await runJob(resumed, rpc, store, noUpstream)).status).toBe("published");
  expect(usedReceipt.retrieved_at).toBe(receipt.retrieved_at);
  const manifest = JSON.parse(store.objects.get(`elections/${election}/revisions/${snapshot}/manifest.json`)!.body);
  expect(manifest.retrieved_at).toBe(receipt.retrieved_at); expect(manifest.source_sha256).toBe(sha256);
});
test("already published bytes skip staging/assets and do not query a completed lease", async () => {
  const calls: string[] = [], store = new MemoryStore();
  const rpc = async (name: string, args: any = {}) => { calls.push(name); if (name === "authorize_sos_results_download") return authorization(); if (name === "renew_sos_results_job") return true; if (name === "begin_sos_results_job") return { snapshot_id: snapshot, receipt: args.p_receipt, published: true }; if (name === "confirm_sos_results_pointer") throw Error("lease is done"); };
  expect((await runJob(job, rpc, store, fetcher(() => new Response(JSON.stringify(fixture()))))).status).toBe("unchanged_published");
  expect(calls).not.toContain("stage_sos_results_job"); expect(calls).not.toContain("confirm_sos_results_pointer");
});

function authorization(end: string | null = null) { return { schema_version: 1, job_id: job.job_id, election_id: job.election_id, source_url: job.source_url, server_now: "2026-11-03T10:00:00Z", ends_at: end }; }
test("closed or invalid download authorization never starts a fresh GET", async () => {
  let calls = 0;
  const get = fetcher(() => { calls++; return new Response("must not fetch"); });
  const file = (await directory()) + "/raw.json";
  await expect(freshDownload(job, async () => { throw Error("Source collection window closed"); }, file, get)).rejects.toThrow("window closed");
  for (const invalid of [null, {}, { ...authorization(), schema_version: 2 }, { ...authorization(), job_id: "other" }, { ...authorization(), election_id: "other" }, { ...authorization(), source_url: "https://other.invalid" }, { ...authorization(), server_now: "invalid" }, { ...authorization(), ends_at: undefined }, authorization("2026-11-03T10:00:00Z")]) {
    await expect(freshDownload(job, async () => invalid, file, get)).rejects.toThrow();
  }
  expect(calls).toBe(0);
});
test("whole RPC elapsed is subtracted before GET; legacy null end keeps normal bound", async () => {
  let calls = 0;
  const file = (await directory()) + "/raw.json", get = fetcher(() => { calls++; return new Response(null, { status: 304 }); });
  await expect(freshDownload(job, async () => { await Bun.sleep(30); return authorization("2026-11-03T10:00:00.010Z"); }, file, get)).rejects.toThrow("window closed");
  expect(calls).toBe(0);
  expect((await freshDownload(job, async () => authorization(), file, get)).unchanged).toBe(true);
  expect(calls).toBe(1);
});
test("finite database deadline cancels an in-flight response body", async () => {
  let cancelled = false, signal: AbortSignal | undefined;
  const file = (await directory()) + "/raw.json";
  const get = (async (_url: unknown, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); }, cancel() { cancelled = true; } }));
  }) as unknown as typeof fetch;
  await expect(freshDownload(job, async () => authorization("2026-11-03T10:00:00.050Z"), file, get)).rejects.toThrow();
  expect(signal?.aborted).toBe(true); expect(cancelled).toBe(true);
});
