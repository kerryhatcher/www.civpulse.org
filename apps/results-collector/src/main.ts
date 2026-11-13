import { r2Store } from "./storage";
import { runJob, safeError, type Rpc } from "./collector";

export function databaseRpc(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch): Rpc {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const origin = new URL(env.SUPABASE_URL);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) throw Error("Supabase URL requires HTTPS");
  return async (name, body = {}) => {
    if (!/^[a-z_]+$/.test(name)) throw Error("Invalid RPC name");
    const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, origin), {
      method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      // PostgreSQL errors can include source content: keep them out of daemon logs.
      await response.body?.cancel();
      throw Error(`Results RPC ${name} HTTP ${response.status}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}
if (import.meta.main) {
  const command = Bun.argv[2] ?? "run";
  if (!["run", "once", "health"].includes(command)) throw Error("Usage: bun run src/main.ts [run|once|health]");
  const rpc = databaseRpc(process.env);
  if (command === "health") {
    // Service-only operational state contains no credentials or raw source payloads.
    console.log(JSON.stringify(await rpc("get_sos_collection_health"), null, 2));
  } else {
    if (process.env.SOS_COLLECTOR_ENABLED !== "true") throw Error("Collector disabled: set SOS_COLLECTOR_ENABLED=true only after controlled deployment validation");
    const store = r2Store(process.env);
    let stopping = false;
    process.on("SIGTERM", () => { stopping = true; });
    process.on("SIGINT", () => { stopping = true; });
    do {
      try {
        const job = await rpc("claim_sos_results_job");
        if (job) {
          const start = performance.now();
          const result = await runJob(job, rpc, store);
          console.log(JSON.stringify({ event: "results_job", job_id: job.job_id, ...result, duration_ms: Math.round(performance.now() - start), rss_bytes: process.memoryUsage().rss }));
          if (command === "once") break;
          continue;
        }
      } catch (error) {
        console.error(JSON.stringify({ event: "results_failure", message: safeError(error) }));
        if (command === "once") { process.exitCode = 1; break; }
      }
      if (command === "once") break;
      // Database next_attempt_at controls durable retry/backoff. Sleep only polls
      // the queue; no work is held solely in a process timer.
      for (let i = 0; i < 15 && !stopping; i++) await Bun.sleep(1000);
    } while (!stopping);
  }
}
