import { expect, test } from "bun:test";
import {
  createPublicSosReader,
  readRpcSos,
  sourceCount,
  sourceStatus,
  validatePointer,
  validateScope,
} from "../../apps/web/src/lib/sos-results-reader";
const id = "11111111-1111-4111-8111-111111111111";
function pointer(revision = "1", snapshot = "snapshot-1") {
  return {
    schema_version: 1 as const,
    election_id: id,
    snapshot_id: snapshot,
    revision,
    source_url:
      "https://results.sos.ga.gov/cdn/results/Georgia/export-Example.json",
    source_created_at: "2026-11-03T23:00:00Z",
    published_at: "2026-11-03T23:01:00Z",
    jurisdictions: [
      {
        id: "011",
        name: "Bibb",
        item_count: 1,
        url: `https://files.civpulse.org/elections/${id}/revisions/${snapshot}/counties/011.json`,
      },
    ],
  };
}
function scope(snapshot = "snapshot-1", votes: number | null = 0) {
  return {
    schema_version: 1 as const,
    election_id: id,
    snapshot_id: snapshot,
    jurisdiction: { id: "011", name: "Bibb", reportingStatuses: null },
    items: [
      {
        jurisdiction_index: 1,
        item_index: 0,
        data: {
          id: "local-only-contest",
          name: "Synthetic race",
          ballotOptions: [
            { id: "local-choice", name: "Synthetic choice", voteCount: votes },
          ],
        },
      },
    ],
  };
}
test("zero/null and unavailable reporting status remain distinct; no inferred totals or identities", () => {
  expect(sourceCount(0)).toBe("0");
  expect(sourceCount(null)).toBe("Not reported");
  expect(sourceStatus(null)).toBe("Source reporting status unavailable");
  expect(sourceStatus("Not Reported")).toBe("Not Reported");
  expect(validateScope(scope(), pointer(), "011").items[0].data.id).toBe(
    "local-only-contest",
  );
  expect(() => validateScope(scope("different"), pointer(), "011")).toThrow(
    "mismatch",
  );
  expect(() => validateScope(scope(), pointer(), "013")).toThrow("mismatch");
});
test("public reader pins selected scope and skips immutable downloads for unchanged revisions", async () => {
  const calls: string[] = [];
  let revision = "9007199254740993",
    snapshot = "one";
  const read = createPublicSosReader((async (url: string) => {
    calls.push(url);
    return Response.json(
      url.endsWith("/latest.json")
        ? pointer(revision, snapshot)
        : scope(snapshot),
    );
  }) as typeof fetch);
  const first = await read(id, "011");
  await read(id, "011");
  expect(calls.filter((u) => u.endsWith("/latest.json"))).toHaveLength(2);
  expect(calls.filter((u) => !u.endsWith("/latest.json"))).toHaveLength(1);
  revision = "9007199254740992";
  snapshot = "stale";
  expect((await read(id, "011")).scope).toBe(first.scope);
  revision = "9007199254740994";
  snapshot = "new";
  expect((await read(id, "011")).scope?.snapshot_id).toBe("new");
});
test("external assets, conflicting publications and mismatched scopes fail closed", async () => {
  const evil = pointer();
  evil.jurisdictions[0].url = "https://example.com/raw.json";
  expect(() => validatePointer(evil, id)).toThrow("asset URL");
  let latest = pointer(),
    payload = scope();
  const read = createPublicSosReader((async (url: string) =>
    Response.json(
      url.endsWith("/latest.json") ? latest : payload,
    )) as typeof fetch);
  await read(id, "011");
  latest = pointer("1", "conflict");
  await expect(read(id, "011")).rejects.toThrow("Conflicting");
  latest = pointer("2", "two");
  await expect(read(id, "011")).rejects.toThrow("mismatch");
});
test("restricted RPC reader pins every page, preserves corrections, and rechecks visibility before cache reuse", async () => {
  const calls: any[] = [];
  let accessible = true;
  const rpc = async (args: any) => {
    calls.push(args);
    if (!accessible) return { status: "missing" };
    return {
      status: "ok",
      snapshot_id: "snapshot-1",
      header: { createdAt: pointer().source_created_at },
      source_url: pointer().source_url,
      published_at: pointer().published_at,
      jurisdictions: pointer().jurisdictions,
      items: scope("snapshot-1", 2).items,
    };
  };
  const first = await readRpcSos(rpc, id, "011");
  expect(first.scope?.items[0].data.ballotOptions).toEqual([
    { id: "local-choice", name: "Synthetic choice", voteCount: 2 },
  ]);
  expect(calls[1]).toMatchObject({
    p_snapshot_id: "snapshot-1",
    p_jurisdiction_index: 0,
  });
  await readRpcSos(rpc, id, "011", 10000, {
    pointer: first.pointer!,
    scope: first.scope!,
  });
  expect(calls).toHaveLength(3);
  accessible = false;
  await expect(
    readRpcSos(rpc, id, "011", 10000, {
      pointer: first.pointer!,
      scope: first.scope!,
    }),
  ).rejects.toThrow("restricted");
});
test("bounded build fallback ends after twenty pinned source items", async () => {
  const calls: any[] = [];
  const result = await readRpcSos(
    async (args) => {
      calls.push(args);
      return {
        status: "ok",
        snapshot_id: "snapshot-1",
        header: { createdAt: pointer().source_created_at },
        source_url: pointer().source_url,
        published_at: pointer().published_at,
        jurisdictions: [{ ...pointer().jurisdictions[0], item_count: 100 }],
        items:
          args.p_jurisdiction_index === undefined
            ? []
            : Array.from({ length: 10 }, (_, n) => ({
                ...scope().items[0],
                item_index: Number(args.p_offset) + n,
                data: {
                  ...scope().items[0].data,
                  id: `contest-${Number(args.p_offset) + n}`,
                },
              })),
      };
    },
    id,
    "011",
    20,
  );
  expect(result.scope?.items).toHaveLength(20);
  expect(result.truncated).toBe(true);
  expect(calls).toHaveLength(3);
});
