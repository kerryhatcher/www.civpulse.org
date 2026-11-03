import { expect, test } from "bun:test";
import { SQL } from "bun";
import { runJob, type Job } from "../../apps/results-collector/src/collector";
import { databaseRpc } from "../../apps/results-collector/src/main";
import type { Store } from "../../apps/results-collector/src/storage";
import { createPublicSosReader } from "../../apps/web/src/lib/sos-results-reader";

const statusPath = process.env.SOS_RESULTS_LOCAL_STATUS;
const source =
  "https://results.sos.ga.gov/cdn/results/Georgia/export-SyntheticIntegration187.json";
class LocalObjectStore implements Store {
  objects = new Map<
    string,
    { bytes: Uint8Array; etag: string; headers: Record<string, string> }
  >();
  next = 0;
  failNextPointer = false;
  async get(key: string) {
    const value = this.objects.get(key);
    return value
      ? new Response(value.bytes, {
          headers: { ...value.headers, etag: value.etag },
        })
      : new Response(null, { status: 404 });
  }
  async put(key: string, body: Blob | string, headers: Record<string, string>) {
    if (this.failNextPointer && key.endsWith("/latest.json")) {
      this.failNextPointer = false;
      return new Response(null, { status: 503 });
    }
    const old = this.objects.get(key);
    if (
      (headers["If-None-Match"] === "*" && old) ||
      (headers["If-Match"] && old?.etag !== headers["If-Match"])
    )
      return new Response(null, { status: 412 });
    const bytes =
      typeof body === "string"
        ? new TextEncoder().encode(body)
        : new Uint8Array(await body.arrayBuffer());
    this.objects.set(key, {
      bytes,
      etag: `"integration-${++this.next}"`,
      headers,
    });
    return new Response(null, { status: 200 });
  }
  url(key: string) {
    return `https://files.civpulse.org/${key}`;
  }
  async json(key: string) {
    return (await this.get(key)).json();
  }
}
function feed(votes: number, second: number) {
  const race = {
    id: "source-county-race",
    name: "Synthetic integration race",
    reportingStatus: "Not Reported",
    ballotOptions: [
      {
        id: "a",
        name: "Synthetic Alpha",
        voteCount: votes,
        precinctResults: [
          {
            id: "p",
            name: "Synthetic precinct",
            voteCount: 0,
            reportingStatus: "Not Reported",
          },
        ],
      },
      { id: "b", name: "Synthetic Beta", voteCount: 0 },
      { id: "c", name: "Synthetic Unknown", voteCount: null },
    ],
  };
  return {
    electionDate: "2026-11-03",
    electionName: "Synthetic collector HTTP integration",
    createdAt: `2026-11-03T00:00:0${second}Z`,
    results: {
      id: "state",
      name: "Georgia",
      reportingStatuses: null,
      ballotItems: [{ ...race, id: "different-state-race" }],
    },
    localResults: [
      { id: "011", name: "Bibb", reportingStatuses: null, ballotItems: [race] },
    ],
  };
}

test.skipIf(!statusPath)(
  "real local service RPC collector publishes corrections, recovers pointer failures and preserves access gates",
  async () => {
    const status = await Bun.file(statusPath!).json();
    const origin = new URL(status.API_URL),
      dbOrigin = new URL(status.DB_URL);
    if (
      !["127.0.0.1", "localhost"].includes(origin.hostname) ||
      !["54321", "54341"].includes(origin.port) ||
      !["127.0.0.1", "localhost"].includes(dbOrigin.hostname) ||
      !["54322", "54342"].includes(dbOrigin.port)
    )
      throw Error(
        "Collector integration requires an explicitly local disposable Supabase",
      );
    const db = new SQL(status.DB_URL),
      id = crypto.randomUUID(),
      store = new LocalObjectStore();
    const users: string[] = [];
    const rpc = databaseRpc({
      SUPABASE_URL: origin.href,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    });
    async function request(
      path: string,
      body: unknown,
      token: string,
      service = false,
    ) {
      const response = await fetch(new URL(path, origin), {
        method: "POST",
        headers: {
          apikey: service ? status.SERVICE_ROLE_KEY : status.ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          `Local integration request ${path.split("?")[0]} HTTP ${response.status}`,
        );
      return data;
    }
    const read = (name: string, args: unknown = {}, token = status.ANON_KEY) =>
      request(`/rest/v1/rpc/${name}`, args, token);
    async function user(admin: boolean) {
      const email = `sos187-${crypto.randomUUID()}@example.test`,
        password = "Synthetic-collector-integration-187!";
      const created = await request(
        "/auth/v1/admin/users",
        { email, password, email_confirm: true },
        status.SERVICE_ROLE_KEY,
        true,
      );
      users.push(created.id);
      if (admin)
        await db`insert into public.admins(user_id) values(${created.id})`;
      const login = await request(
        "/auth/v1/token?grant_type=password",
        {
          email,
          password,
          gotrue_meta_security: { captcha_token: "XXXX.DUMMY.TOKEN.XXXX" },
        },
        status.ANON_KEY,
      );
      return login.access_token as string;
    }
    async function claim(): Promise<Job> {
      // Advance only this owned fixture; no waiting and no unrelated queue mutation.
      await db`update public.sos_automation_feeds set last_attempt_at=null where election_id=${id}`;
      const poll = await rpc("claim_sos_results_poll");
      expect(poll.election_id).toBe(id);
      await rpc("finish_sos_results_poll", {
        p_election_id: id,
        p_lease_id: poll.lease_id,
        p_changed: true,
        p_error: null,
      });
      const job = await rpc("claim_sos_results_job");
      expect(job.election_id).toBe(id);
      return job;
    }
    let upstreamCalls = 0;
    const upstream = (votes: number, second: number, unchanged = false) =>
      (async (url: RequestInfo | URL, options?: RequestInit) => {
        upstreamCalls++;
        expect(String(url)).toBe(source);
        if (unchanged) {
          expect(new Headers(options?.headers).get("If-None-Match")).toBe(
            '"synthetic-2"',
          );
          return new Response(null, {
            status: 304,
            headers: { etag: '"synthetic-2"' },
          });
        }
        const bytes = new TextEncoder().encode(
          "\uFEFF" + JSON.stringify(feed(votes, second)),
        );
        return new Response(bytes, {
          headers: {
            etag: `"synthetic-${second}"`,
            "content-length": String(bytes.length),
          },
        });
      }) as typeof fetch;
    try {
      const other =
        await db`select count(*)::int n from public.sos_automation_feeds where enabled`;
      if (other[0].n)
        throw Error(
          "Local collector integration requires no unrelated enabled collection feeds",
        );
      await db`insert into public.elections(id,slug,name,election_date,visibility,results_json_url) values(${id},${`sos187-integration-${id}`},'Synthetic collector HTTP integration','2026-11-03','public',${source})`;
      await db`insert into public.sos_automation_feeds(election_id,source_url,enabled) values(${id},${source},true)`;
      const pointerKey = `elections/${id}/latest.json`;
      const first = await runJob(await claim(), rpc, store, upstream(125, 1));
      expect(first).toMatchObject({ status: "published", revision: "1" });
      const firstPointer = await store.json(pointerKey);
      expect(firstPointer.election_id).toBe(id);
      expect(firstPointer.revision).toBe("1");
      const raw = store.objects.get(
        `elections/${id}/raw/${firstPointer.source_sha256}.json`,
      )!;
      expect(raw.bytes).toEqual(
        new TextEncoder().encode("\uFEFF" + JSON.stringify(feed(125, 1))),
      );
      expect(
        new Bun.CryptoHasher("sha256").update(raw.bytes).digest("hex"),
      ).toBe(firstPointer.source_sha256);
      const publicReader = createPublicSosReader((async (url) =>
        store.get(new URL(String(url)).pathname.slice(1))) as typeof fetch);
      const initial = await publicReader(id, "011");
      expect(initial.scope?.items[0].data.ballotOptions).toEqual([
        { id: "a", name: "Synthetic Alpha", voteCount: 125 },
        { id: "b", name: "Synthetic Beta", voteCount: 0 },
        { id: "c", name: "Synthetic Unknown", voteCount: null },
      ]);
      expect(initial.scope?.jurisdiction.reportingStatuses).toBeNull();
      const browserRead = await read("get_sos_results", {
        p_election_id: id,
        p_jurisdiction_index: 1,
      });
      expect(browserRead.snapshot_id).toBe(firstPointer.snapshot_id);
      expect(browserRead.items[0].data.id).toBe("source-county-race");

      // The database commit survives a failed pointer write; the public pointer stays on revision one.
      store.failNextPointer = true;
      await expect(
        runJob(await claim(), rpc, store, upstream(100, 2)),
      ).rejects.toThrow("pointer PUT HTTP 503");
      expect((await store.json(pointerKey)).revision).toBe("1");
      const committed = (
        await db`select current_revision::text revision,current_snapshot_id from public.sos_automation_feeds where election_id=${id}`
      )[0];
      expect(committed.revision).toBe("2");
      const failed = (
        await db`select id,state,lease_id,last_error from public.sos_automation_jobs where election_id=${id} and state<>'done'`
      )[0];
      expect(failed.state).toBe("pointer");
      expect(failed.lease_id).toBeNull();
      expect(failed.last_error).toContain("503");
      await db`update public.sos_automation_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=${failed.id} and election_id=${id}`;
      const recovery = await rpc("claim_sos_results_job");
      expect(recovery.phase).toBe("pointer");
      const beforeRecovery = upstreamCalls;
      expect(
        await runJob(recovery, rpc, store, (async () => {
          throw Error("Pointer recovery must not redownload upstream");
        }) as typeof fetch),
      ).toMatchObject({ status: "published", revision: "2" });
      expect(upstreamCalls).toBe(beforeRecovery);
      const corrected = await publicReader(id, "011");
      expect(corrected.pointer?.revision).toBe("2");
      expect(
        (corrected.scope?.items[0].data.ballotOptions as any[])[0].voteCount,
      ).toBe(100);
      const snapshotCount = (
        await db`select count(*)::int n from public.sos_result_snapshots where election_id=${id}`
      )[0].n;
      const dirty = (
        await db`select revision::text revision from public.frontend_rebuild_state where id`
      )[0].revision;
      const pointerEtag = store.objects.get(pointerKey)!.etag;
      expect(
        await runJob(await claim(), rpc, store, upstream(100, 2, true)),
      ).toEqual({ status: "unchanged" });
      expect(
        (
          await db`select current_revision::text revision from public.sos_automation_feeds where election_id=${id}`
        )[0].revision,
      ).toBe("2");
      expect(
        (
          await db`select count(*)::int n from public.sos_result_snapshots where election_id=${id}`
        )[0].n,
      ).toBe(snapshotCount);
      expect(
        (
          await db`select revision::text revision from public.frontend_rebuild_state where id`
        )[0].revision,
      ).toBe(dirty);
      expect(store.objects.get(pointerKey)!.etag).toBe(pointerEtag);
      expect(
        (await read("get_sos_results_health", { p_election_id: id }))
          .current_revision,
      ).toBe("2");

      const ordinary = await user(false),
        admin = await user(true);
      for (const token of [status.ANON_KEY, ordinary, admin])
        expect(
          (await read("get_sos_results", { p_election_id: id }, token)).status,
        ).toBe("ok");
      await db`update public.elections set visibility='unlisted' where id=${id}`;
      expect(
        (await read("get_sos_results", { p_election_id: id })).status,
      ).toBe("ok");
      expect(
        (await read("get_sos_results_health", { p_election_id: id })).status,
      ).toBe("missing");
      await db`update public.elections set visibility='private' where id=${id}`;
      for (const token of [status.ANON_KEY, ordinary]) {
        expect(
          (await read("get_sos_results", { p_election_id: id }, token)).status,
        ).toBe("missing");
        expect(
          (await read("get_sos_results_health", { p_election_id: id }, token))
            .status,
        ).toBe("missing");
      }
      expect(
        (await read("get_sos_results", { p_election_id: id }, admin)).status,
      ).toBe("ok");
    } finally {
      await db`delete from public.sos_automation_jobs where election_id=${id}`;
      await db`delete from public.sos_automation_feeds where election_id=${id}`;
      await db`delete from public.elections where id=${id}`;
      for (const userId of users) {
        const response = await fetch(
          new URL(`/auth/v1/admin/users/${userId}`, origin),
          {
            method: "DELETE",
            headers: {
              apikey: status.SERVICE_ROLE_KEY,
              Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
            },
          },
        );
        if (!response.ok)
          throw Error(`Local integration user cleanup HTTP ${response.status}`);
        await response.body?.cancel();
      }
      await db.close();
    }
  },
  60000,
);
