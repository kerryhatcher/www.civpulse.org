import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { prepare } from "./feed";
import { runJob } from "./collector";
import type { Store } from "./storage";

const [file, date, mode] = Bun.argv.slice(2);
if (!file || !date) throw Error("Usage: bun run src/measure.ts <local-source.json> <YYYY-MM-DD>");
const directory = await mkdtemp(`${tmpdir()}/results-measure-`), started = performance.now();
let peakRss = process.memoryUsage().rss;
const timer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 10);
try {
  const rawHash = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(file).stream()) rawHash.update(chunk);
  const result = await prepare(file, directory, date);
  let simulatedPipelineMs: number | undefined, stagedBatches = 0, stagedBytes = 0;
  if (mode === "--pipeline") {
    const beginning = performance.now(), election = "00000000-0000-4000-8000-000000000001", snapshot = "00000000-0000-4000-8000-000000000002";
    const metadata = new Map<string, { etag: string; headers: Record<string,string> }>();
    const store: Store = {
      url: key => `https://files.civpulse.org/${key}`,
      get: async key => metadata.has(key) ? new Response(Bun.file(`${directory}/objects/${key}`), { headers: { ...metadata.get(key)!.headers, etag: metadata.get(key)!.etag } }) : new Response(null, { status: 404 }),
      put: async (key, body, headers) => {
        if (metadata.has(key) && headers["If-None-Match"] === "*") return new Response(null, { status: 412 });
        if (headers["If-Match"] && metadata.get(key)?.etag !== headers["If-Match"]) return new Response(null, { status: 412 });
        const path = `${directory}/objects/${key}`;
        await mkdir(path.slice(0,path.lastIndexOf("/")), { recursive: true });
        await Bun.write(path, body); metadata.set(key, { etag: `"${metadata.size+1}"`, headers });
        return new Response(null, { status: 200 });
      },
    };
    await runJob({ job_id: "benchmark", lease_id: "lease", election_id: election, election_date: date, source_url: "https://results.sos.ga.gov/cdn/results/Georgia/export-Benchmark.json", phase: "import" }, async (name,args) => {
      if (name === "renew_sos_results_job") return true;
      if (name === "begin_sos_results_job") return { snapshot_id: snapshot, receipt: args!.p_receipt, published: false };
      if (name === "stage_sos_results_job") { stagedBatches++; stagedBytes += new TextEncoder().encode(JSON.stringify(args)).length; }
      if (name === "confirm_sos_results_pointer") return { revision: "1", snapshot_id: snapshot, manifest_key: `elections/${election}/revisions/${snapshot}/manifest.json`, published_at: new Date().toISOString() };
    }, store, (async () => new Response(Bun.file(file))) as unknown as typeof fetch);
    simulatedPipelineMs = Math.round(performance.now() - beginning);
  }
  console.log(JSON.stringify({ runtime: Bun.version, source_bytes: Bun.file(file).size, raw_sha256: rawHash.digest("hex"), jurisdictions: result.jurisdictions.length, items: result.itemCount, semantic_sha256: result.fingerprint, duration_ms: Math.round(performance.now() - started), simulated_pipeline_ms: simulatedPipelineMs, staged_batches: stagedBatches || undefined, staged_bytes: stagedBytes || undefined, peak_rss_bytes: Math.max(peakRss, process.memoryUsage().rss), max_rss_bytes: process.resourceUsage().maxRSS }, null, 2));
} finally { clearInterval(timer); await rm(directory, { recursive: true, force: true }); }
