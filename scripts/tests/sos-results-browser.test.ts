import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
const base = process.env.SOS_RESULTS_TEST_URL;
const publicPath = process.env.SOS_RESULTS_PUBLIC_PATH;
const id = "18700000-0000-4000-8000-000000000001";
let browser: Browser;
beforeAll(async () => {
  if (base)
    browser = await chromium.launch({ channel: "chrome", headless: true });
});
afterAll(async () => {
  await browser?.close();
});
function pointer(revision = "1") {
  return {
    schema_version: 1,
    election_id: id,
    snapshot_id: `snapshot-${revision}`,
    revision,
    published_at: "2026-11-03T23:01:00Z",
    source_created_at: "2026-11-03T23:00:00Z",
    source_url:
      "https://results.sos.ga.gov/cdn/results/Georgia/export-Example.json",
    jurisdictions: ["011", "013"].map((j, i) => ({
      id: j,
      name: i ? "Synthetic second county" : "Bibb",
      item_count: 1,
      url: `https://files.civpulse.org/elections/${id}/revisions/snapshot-${revision}/counties/${j}.json`,
    })),
  };
}
function scope(
  revision = "1",
  jurisdiction = "011",
  votes: number | null = 125,
) {
  return {
    schema_version: 1,
    election_id: id,
    snapshot_id: `snapshot-${revision}`,
    jurisdiction: {
      id: jurisdiction,
      name: jurisdiction === "011" ? "Bibb" : "Synthetic second county",
      reportingStatuses: null,
    },
    items: [
      {
        jurisdiction_index: 0,
        item_index: 0,
        data: {
          id: `source-race-${jurisdiction}`,
          name: "Synthetic source race",
          ballotOptions: [
            { id: "first", name: "Synthetic choice Alpha", voteCount: votes },
            { id: "second", name: "Synthetic choice Beta", voteCount: 0 },
            {
              id: "unknown",
              name: "Synthetic choice Unknown",
              voteCount: null,
            },
          ],
        },
      },
    ],
  };
}
async function fixture(page: Page, read: (args: any) => any) {
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    const data =
      rpc === "get_sos_results"
        ? await read(route.request().postDataJSON())
        : rpc === "get_sos_results_health"
          ? {
              status: "healthy",
              current_revision: "1",
              last_success_at: "2026-11-03T23:02:00Z",
            }
          : rpc === "search_elections"
            ? [
                {
                  id,
                  name: "Synthetic live SOS QA",
                  election_date: "2026-11-03",
                },
              ]
            : rpc === "get_election"
              ? {
                  status: "ok",
                  election: {
                    id,
                    name: "Synthetic live SOS QA",
                    visibility: "public",
                  },
                  contests: [],
                  ballot_questions: [],
                }
              : rpc === "get_election_results"
                ? { status: "ok", reports: [] }
                : rpc === "get_structured_turnout"
                  ? { status: "empty" }
                  : false;
    await route.fulfill({ json: data });
  });
}
function rpcResult(args: any, revision = "1", votes: number | null = 125) {
  return {
    status: "ok",
    snapshot_id: `snapshot-${revision}`,
    revision,
    source_url: pointer().source_url,
    published_at: pointer().published_at,
    header: { createdAt: pointer().source_created_at },
    jurisdictions: pointer().jurisdictions,
    items:
      args.p_jurisdiction_index === undefined
        ? []
        : scope(revision, args.p_jurisdiction_index ? "013" : "011", votes)
            .items,
  };
}
for (const width of [1280, 390]) {
  test.skipIf(!base)(
    `gated SOS reader preserves focus, filters, zero/null and last good revision at ${width}px`,
    async () => {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        colorScheme: width === 390 ? "dark" : "light",
      });
      await page.clock.install();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      let revision = "1",
        votes: number | null = 125,
        fail = false;
      await fixture(page, (args) =>
        fail ? { status: "missing" } : rpcResult(args, revision, votes),
      );
      try {
        await page.goto(`${base}/elections/results/?id=${id}`);
        await page
          .locator("[data-sos-status]")
          .filter({ hasText: "Current published" })
          .waitFor();
        await page.locator("[data-sos-content] summary").click();
        const table = page.locator("[data-sos-content] table");
        expect(await table.innerText()).toContain("125");
        expect(await table.innerText()).toContain("Not reported");
        expect(await table.locator("a").count()).toBe(0);
        await page.locator("[data-sos-search]").fill("Alpha");
        revision = "2";
        votes = 100;
        await page.locator("[data-sos-refresh]").click();
        await page.waitForFunction(() =>
          document
            .querySelector("[data-sos-content] table")
            ?.textContent?.includes("100"),
        );
        expect(await page.locator("[data-sos-search]").inputValue()).toBe(
          "Alpha",
        );
        expect(
          await page.locator("[data-sos-content] details").getAttribute("open"),
        ).not.toBeNull();
        expect(await page.locator("[data-sos-jurisdiction]").inputValue()).toBe(
          "011",
        );
        revision = "3";
        votes = 99;
        await page.locator("[data-sos-content] summary").focus();
        await page.clock.fastForward(34000);
        await page.waitForFunction(() =>
          document
            .querySelector("[data-sos-content] table")
            ?.textContent?.includes("99"),
        );
        expect(
          await page
            .locator("[data-sos-content] summary")
            .evaluate((n) => n === document.activeElement),
        ).toBe(true);
        fail = true;
        await page.locator("[data-sos-refresh]").click();
        await page
          .locator("[data-sos-status]")
          .filter({ hasText: "update delayed" })
          .waitFor();
        expect(await table.innerText()).toContain("99");
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));
        expect(await page.locator("[data-sos-status]").innerText()).toContain(
          "Offline",
        );
        expect(
          await page
            .locator("body")
            .evaluate((n) => n.scrollWidth <= innerWidth),
        ).toBe(true);
        expect(errors).toEqual([]);
        await page.addStyleTag({
          content: "astro-dev-toolbar { display:none !important; }",
        });
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
        await page.screenshot({
          path: `/tmp/issue187-sos-${width}.png`,
          fullPage: true,
        });
      } finally {
        await page.close();
      }
    },
    60000,
  );
}
test.skipIf(!base || !publicPath)(
  "public slug uses only selected immutable scopes; late responses cannot replace newer selection",
  async () => {
    const page = await browser.newPage();
    let rpcResultCalls = 0,
      revision = "1";
    await fixture(page, () => {
      rpcResultCalls++;
      return { status: "missing" };
    });
    const requests: string[] = [];
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      "https://files.civpulse.org/elections/**",
      async (route) => {
        const url = route.request().url();
        requests.push(url);
        if (url.endsWith("/latest.json"))
          return route.fulfill({ json: pointer(revision) });
        const j = url.endsWith("/013.json") ? "013" : "011";
        const r = url.includes("snapshot-2") ? "2" : "1";
        if (j === "013") await delayed;
        await route.fulfill({ json: scope(r, j, r === "2" ? 99 : 125) });
      },
    );
    try {
      await page.goto(`${base}${publicPath}`);
      await page
        .locator("[data-sos-status]")
        .filter({ hasText: "Current published" })
        .waitFor();
      expect(requests.filter((u) => u.endsWith("/013.json"))).toHaveLength(0);
      await page.locator("[data-sos-jurisdiction]").selectOption("013");
      await page.waitForFunction(() =>
        document
          .querySelector("[data-sos-status]")
          ?.textContent?.includes("Updating"),
      );
      revision = "2";
      await page.locator("[data-sos-jurisdiction]").selectOption("011");
      await page
        .locator("[data-sos-status]")
        .filter({ hasText: "Current published" })
        .waitFor();
      release();
      await page.locator("[data-sos-content] summary").click();
      expect(await page.locator("[data-sos-content]").innerText()).toContain(
        "99",
      );
      expect(
        await page.locator("[data-sos-content]").innerText(),
      ).not.toContain("Synthetic second county");
      expect(await page.locator("[data-sos-jurisdiction]").inputValue()).toBe(
        "011",
      );
      expect(rpcResultCalls).toBe(0);
      expect(requests.every((u) => !u.includes("/raw/"))).toBe(true);
    } finally {
      release();
      await page.close();
    }
  },
  60000,
);
