import { expect, test } from "bun:test";
import { createElectionReportReader } from "../../apps/web/src/lib/election-report-reader";
test("a stale rejected load cannot evict its successful replacement", async () => {
  let rejectOld!: (reason: Error) => void;
  let calls = 0;
  const old = new Promise<never>((_, reject) => {
    rejectOld = reject;
  });
  const read = createElectionReportReader(async () => {
    calls++;
    return calls === 1 ? old : { status: "ok", reports: [] };
  });
  const first = read("election");
  const rejected = first.catch((error) => error);
  const fresh = read("election", true);
  await fresh;
  rejectOld(Error("old failure"));
  expect((await rejected).message).toBe("old failure");
  expect(read("election")).toBe(fresh);
  expect(calls).toBe(2);
});
test("readers share in-flight pages and a forced refresh gets current data", async () => {
  let calls = 0;
  const read = createElectionReportReader(async () => {
    calls++;
    return { status: "ok", reports: [] };
  });
  const first = read("election");
  expect(read("election")).toBe(first);
  await first;
  expect(calls).toBe(1);
  const fresh = read("election", true);
  expect(fresh).not.toBe(first);
  await fresh;
  expect(calls).toBe(2);
});
