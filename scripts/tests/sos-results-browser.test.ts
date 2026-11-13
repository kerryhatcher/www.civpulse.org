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
        : rpc === "get_sos_results_mappings"
          ? { status: "ok", mappings: [] }
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
          .waitFor({ state: "attached" });
        await page.locator("[data-sos-content] summary").click();
        const table = page.locator("[data-sos-content] table");
        expect(await table.innerText()).toContain("125");
        expect(await table.innerText()).toContain("Not available");
        expect(await table.locator("a").count()).toBe(0);
        await page.locator("[data-sos-search]").fill("Alpha");
        revision = "2";
        votes = 100;
        await page.locator("[data-sos-refresh]").evaluate(node => (node as HTMLButtonElement).click());
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
        // Clearing and reselecting a scope in the same revision must restore its table.
        await page.locator("[data-sos-jurisdiction]").selectOption("", { force: true });
        await page
          .locator("[data-sos-status]")
          .filter({ hasText: "Choose an SOS reporting area" })
          .waitFor({ state: "attached" });
        expect(await page.locator("[data-sos-content] table").count()).toBe(0);
        await page.locator("[data-sos-search]").fill("Synthetic");
        expect(await page.locator("[data-sos-content] table").count()).toBe(0);
        await page.locator("[data-sos-jurisdiction]").selectOption("011", { force: true });
        await page
          .locator("[data-sos-status]")
          .filter({ hasText: "Current published" })
          .waitFor({ state: "attached" });
        expect(await table.innerText()).toContain("100");
        await page.locator("[data-sos-search]").fill("Alpha");
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
        await page.locator("[data-sos-refresh]").evaluate(node => (node as HTMLButtonElement).click());
        await page
          .locator("[data-sos-status]")
          .filter({ hasText: "update delayed" })
          .waitFor({ state: "attached" });
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
        .waitFor({ state: "attached" });
      expect(requests.filter((u) => u.endsWith("/013.json"))).toHaveLength(0);
      await page.evaluate(() => { sessionStorage.setItem("civicpulse.county", "all"); window.dispatchEvent(new Event("countychange")); });
      await page.locator("[data-sos-jurisdiction] option[value=\"013\"]").waitFor({ state: "attached" });
      await page.locator("[data-sos-jurisdiction]").selectOption("013", { force: true });
      await page.waitForFunction(() =>
        document
          .querySelector("[data-sos-status]")
          ?.textContent?.includes("Updating"),
      );
      revision = "2";
      await page.locator("[data-sos-jurisdiction]").selectOption("011", { force: true });
      await page
        .locator("[data-sos-status]")
        .filter({ hasText: "Current published" })
        .waitFor({ state: "attached" });
      release();
      expect(
        await page
          .locator('#ballot [data-sos-source-contest="source-race-011"]')
          .innerText(),
      ).toContain("99");
      expect(
        await page
          .locator('#ballot [data-sos-source-contest="source-race-011"]')
          .innerText(),
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

test.skipIf(!base)(
  "clearing an election or failing its admission removes prior SOS evidence",
  async () => {
    const page = await browser.newPage();
    const unavailableId = "18700000-0000-4000-8000-000000000099";
    let sosRequests = 0;
    await fixture(page, (args) => {
      sosRequests++;
      return rpcResult(args);
    });
    await page.route("**/rest/v1/rpc/get_election", async (route) => {
      const requested = route.request().postDataJSON().p_id;
      await route.fulfill({
        json:
          requested === unavailableId
            ? { status: "missing" }
            : {
                status: "ok",
                election: {
                  id,
                  name: "Synthetic live SOS QA",
                  visibility: "public",
                },
                contests: [],
                ballot_questions: [],
              },
      });
    });
    try {
      await page.goto(`${base}/elections/results/?id=${id}`);
      await page
        .locator("[data-sos-status]")
        .filter({ hasText: "Current published" })
        .waitFor({ state: "attached" });
      await page.locator("#result-election").selectOption("", { force: true });
      await page
        .locator("#result-status")
        .filter({ hasText: "Choose an election" })
        .waitFor({ state: "attached" });
      expect(await page.locator("[data-sos-results]").isHidden()).toBe(true);
      expect(await page.locator("[data-sos-content] table").count()).toBe(0);
      expect(await page.locator("[data-sos-times]").textContent()).toBe("");
      expect(
        await page.locator("[data-sos-status]").textContent(),
      ).not.toContain("Current");
      await page.locator("#result-election").selectOption(id);
      await page
        .locator("[data-sos-status]")
        .filter({ hasText: "Current published" })
        .waitFor({ state: "attached" });
      await page.locator("#result-election").evaluate((node, value) => {
        (node as HTMLSelectElement).add(
          new Option("Unavailable synthetic election", value),
        );
      }, unavailableId);
      const before = sosRequests;
      await page.locator("#result-election").selectOption(unavailableId);
      await page
        .locator("#result-status")
        .filter({ hasText: "Could not load election reports" })
        .waitFor({ state: "attached" });
      expect(await page.locator("[data-sos-results]").isHidden()).toBe(true);
      expect(await page.locator("[data-sos-content] table").count()).toBe(0);
      expect(
        await page.locator("[data-sos-status]").textContent(),
      ).not.toContain("Current");
      expect(sosRequests).toBe(before);
    } finally {
      await page.close();
    }
  },
  60000,
);

for (const width of [1280, 390]) {
  test.skipIf(!base || !publicPath)(
    `public ballot keeps mapped profiles and updates inline SOS votes at ${width}px`,
    async () => {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        colorScheme: width === 390 ? "dark" : "light",
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      let revision = "1";
      const contestId = "18700000-0000-4000-8000-000000000101",
        alexId = "18700000-0000-4000-8000-000000000111",
        blairId = "18700000-0000-4000-8000-000000000112";
      await fixture(page, () => ({ status: "empty" }));
      await page.route("**/rest/v1/rpc/get_sos_results_mappings", (route) =>
        route.fulfill({
          json: {
            status: "ok",
            mappings: [
              {
                jurisdiction_id: "011",
                source_contest_id: "source-race-011",
                contest_id: contestId,
                question_id: null,
                choices: [
                  { source_choice_id: "first", person_id: alexId },
                  { source_choice_id: "second", person_id: blairId },
                ],
              },
            ],
          },
        }),
      );
      await page.route(
        "https://files.civpulse.org/elections/**",
        async (route) => {
          if (route.request().url().endsWith("/latest.json")) {
            const value = pointer(revision);
            value.jurisdictions.forEach((j) => {
              j.item_count = 2;
            });
            return route.fulfill({ json: value });
          }
          const value = scope(revision, "011", revision === "1" ? 125 : 100);
          if (revision !== "1")
            value.items[0].data.ballotOptions =
              value.items[0].data.ballotOptions.filter(
                (c) => c.id !== "second",
              );
          value.items.push({
            ...scope(revision).items[0],
            item_index: 1,
            data: {
              ...scope(revision).items[0].data,
              id: "unmapped-source-race",
              name: "Unmapped synthetic source race",
            },
          });
          await route.fulfill({ json: value });
        },
      );
      try {
        await page.goto(`${base}${publicPath}`);
        await page
          .locator("[data-sos-status]")
          .filter({ hasText: "Current published" })
          .waitFor({ state: "attached" });
        const card = page.locator(`#contest-${contestId}`),
          alex = card.locator(`[data-candidate-id="${alexId}"]`),
          blair = card.locator(`[data-candidate-id="${blairId}"]`);
        const href = await alex.getAttribute("href"),
          party = await alex.locator(".candidate-meta").innerText();
        expect(
          await page.locator("#results-and-turnout [data-sos-results]").count(),
        ).toBe(0);
        expect(await page.locator("#ballot [data-sos-results]").count()).toBe(
          1,
        );
        expect(
          await alex.locator(".vote-metrics:visible").innerText(),
        ).toContain("Votes 125");
        expect(
          await blair.locator(".vote-metrics:visible").innerText(),
        ).toContain("Votes 0");
        const unmapped = page.locator(
          '#ballot [data-sos-source-contest="unmapped-source-race"]',
        );
        expect((await unmapped.innerText()).toLowerCase()).toContain(
          "georgia sos source race",
        );
        expect(await unmapped.locator("a").count()).toBe(0);
        expect(await alex.locator('.vote-share-fill').count()).toBe(1);
        expect(await alex.locator('.vote-metrics').innerText()).toContain('Vote share Not available');
        expect(await unmapped.locator('.vote-share-track').count()).toBe(3);
        await page.locator('[data-sos-jurisdiction]').selectOption('', { force: true });
        expect(await alex.locator('.vote-metrics').innerText()).toContain('Votes Not available');
        expect(await alex.locator('.vote-metrics').innerText()).not.toContain('SOS, Bibb');
        await page.locator('[data-sos-jurisdiction]').selectOption('011', { force: true });
        await page.locator('[data-sos-status]').filter({ hasText: 'Current published' }).waitFor({ state: "attached" });

        expect(await page.locator("[data-sos-content] table").count()).toBe(0);
        await alex.focus();
        revision = "2";
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await page.waitForFunction(
          ({ c, p }) =>
            document
              .querySelector(
                `#contest-${c} [data-candidate-id="${p}"]  .vote-metrics`,
              )
              ?.textContent?.includes("Votes 100"),
          { c: contestId, p: alexId },
        );
        expect(
          await alex.evaluate((node) => node === document.activeElement),
        ).toBe(true);
        expect(await alex.getAttribute("href")).toBe(href);
        expect(await alex.locator(".candidate-meta").innerText()).toBe(party);
        expect(await blair.isVisible()).toBe(true);
        expect(
          await blair.locator(".vote-metrics:visible").innerText(),
        ).toContain("Not available");
        expect(await card.locator(".candidate-list").isVisible()).toBe(true);
        expect(
          await page
            .locator("body")
            .evaluate((node) => node.scrollWidth <= innerWidth),
        ).toBe(true);
        expect(errors).toEqual([]);
        await page.addStyleTag({
          content: "astro-dev-toolbar{display:none !important}",
        });
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
        await page.screenshot({
          path: `/tmp/issue187-inline-ballot-${width}.png`,
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
  "public page snapshot places SOS counts inside candidate cards without JavaScript",
  async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    try {
      await page.goto(`${base}${publicPath}`);
      const card = page.locator(
        "#ballot #contest-18700000-0000-4000-8000-000000000101",
      );
      expect(
        await card
          .locator(
            '[data-candidate-id="18700000-0000-4000-8000-000000000111"] .vote-metrics',
          )
          .innerText(),
      ).toContain("Votes 125");
      expect(
        await card
          .locator(
            '[data-candidate-id="18700000-0000-4000-8000-000000000112"] .vote-metrics',
          )
          .innerText(),
      ).toContain("Votes 100");
      expect(await card.locator("a[data-candidate-id]").count()).toBe(2);
      expect(await card.locator('.vote-metrics').first().innerText()).toContain('55.56%');
      expect(await card.locator('.vote-share-track').count()).toBe(2);
      expect(
        await page.locator("#results-and-turnout [data-sos-results]").count(),
      ).toBe(0);
    } finally {
      await page.close();
    }
  },
);

test.skipIf(!base)("result sound rings only after applied semantic changes and remembers mute", async () => {
  const page = await browser.newPage();
  let revision = '1', votes: number | null = 125, fail = false;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__tones = 0;
    class FakeAudioContext {
      state = 'suspended'; currentTime = 0; destination = {};
      resume() { this.state = 'running'; return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect() {}, disconnect() {}, start() { (window as any).__tones++; }, stop() {}, onended: null };
      }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    }
    window.AudioContext = FakeAudioContext as any;
  });
  await fixture(page, args => fail ? { status: 'missing' } : rpcResult(args, revision, votes));
  const tones = () => page.evaluate(() => (window as any).__tones);
  const refresh = async () => {
    await page.locator('[data-sos-refresh]').click();
    await page.locator('[data-sos-refresh]:not([disabled])').waitFor({ state: "attached" });
  };
  try {
    await page.goto(`${base}/elections/results/?id=${id}`);
    await page.locator('[data-sos-status]').filter({ hasText: 'Current published' }).waitFor({ state: "attached" });
    expect(await tones()).toBe(0);
    revision = '2'; votes = 124;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.locator('[data-sos-refresh]:not([disabled])').waitFor({ state: "attached" });
    expect(await tones()).toBe(0); // Changed data before any trusted gesture stays silent.
    await refresh(); // Trusted interaction unlocks without playing a preview.
    expect(await tones()).toBe(0);
    revision = '3'; await refresh(); // New snapshot with unchanged counts.
    expect(await tones()).toBe(0);
    votes = 100; revision = '4'; await refresh();
    expect(await tones()).toBe(2); // Two partials, one soft bell.
    await page.locator('[data-sos-search]').fill('Alpha');
    expect(await tones()).toBe(2);
    await page.evaluate(() => { sessionStorage.setItem('civicpulse.county', 'all'); window.dispatchEvent(new Event('countychange')); });
    await page.locator('[data-sos-jurisdiction] option[value=\"013\"]').waitFor({ state: 'attached' });
    await page.locator('[data-sos-jurisdiction]').selectOption('013');
    await page.locator('[data-sos-refresh]:not([disabled])').waitFor({ state: "attached" });
    expect(await tones()).toBe(2);
    fail = true; revision = '5'; votes = 99; await refresh();
    expect(await tones()).toBe(2);
    fail = false; await refresh();
    expect(await tones()).toBe(4);
    await page.locator('[data-sos-sound]').click();
    expect(await page.locator('[data-sos-sound]').getAttribute('aria-pressed')).toBe('false');
    revision = '6'; votes = 98; await refresh();
    expect(await tones()).toBe(4);
    await page.evaluate(() => sessionStorage.setItem('civicpulse.county', '13021'));
    await page.reload();
    await page.locator('[data-sos-status]').filter({ hasText: 'Current published' }).waitFor({ state: "attached" });
    expect(await page.locator('[data-sos-sound]').getAttribute('aria-pressed')).toBe('false');
    expect(await tones()).toBe(0);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
}, 60000);

for (const width of [1280, 390]) test.skipIf(!base)(`UUID ballot question retains unavailable metrics then updates known shares at ${width}px`, async () => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const questionId = '18700000-0000-4000-8000-000000000201';
  let available = false;
  await fixture(page, args => {
    if (!available) return { status: 'empty' };
    const value = rpcResult(args);
    value.items = args.p_jurisdiction_index === undefined ? [] : [{ jurisdiction_index: 0, item_index: 0, data: {
      id: 'question-source', name: 'Synthetic question', ballotOptions: [
        { id: 'yes', name: 'Yes', voteCount: 75 }, { id: 'no', name: 'No', voteCount: 25 },
      ],
    } }] as any;
    return value;
  });
  await page.route('**/rest/v1/rpc/get_election', route => route.fulfill({ json: {
    status: 'ok', election: { id, name: 'Synthetic ballot metrics', election_date: '2026-11-03', kind: 'general', visibility: 'public' }, contests: [], dates: [],
    ballot_questions: [{ id: questionId, title: 'Synthetic question', question_text: 'Synthetic question wording', jurisdiction: 'Bibb', choices: ['Yes', 'No', 'Other'] }],
  } }));
  await page.route('**/rest/v1/rpc/get_sos_results_mappings', route => route.fulfill({ json: { status: 'ok', mappings: [{ jurisdiction_id: '011', source_contest_id: 'question-source', question_id: questionId, choices: [{ source_choice_id: 'yes', choice_label: 'Yes' }, { source_choice_id: 'no', choice_label: 'No' }] }] } }));
  try {
    await page.goto(`${base}/elections/view/?id=${id}`);
    const question = page.locator(`#question-${questionId}`);
    await question.waitFor({ state: "attached" });
    expect(await question.locator('.vote-share-track').count()).toBe(3);
    expect(await question.locator('[data-sos-choice-label="Yes"] .vote-metrics').innerText()).toContain('Votes Not available');
    await question.screenshot({ path: `/tmp/vote-question-${width}-empty.png` });
    available = true;
    await page.locator('[data-sos-refresh]').evaluate(node => (node as HTMLButtonElement).click());
    await page.waitForFunction(id => document.querySelector(`#question-${id}`)?.textContent?.includes('75.00%'), questionId);
    expect(await question.locator('[data-sos-choice-label="No"] .vote-metrics').innerText()).toContain('25.00%');
    expect(await question.locator('[data-sos-choice-label="Other"] .vote-metrics').innerText()).toContain('Votes Not available');
    expect(await question.locator('[data-sos-choice-label="Yes"] .vote-share-fill').evaluate(node => (node as HTMLElement).style.width)).toBe('75%');
    await question.screenshot({ path: `/tmp/vote-question-${width}-known.png` });
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
  } finally { await page.close(); }
}, 60000);

test.skipIf(!base)('SOS reporting areas cannot override the header county', async () => {
  const page = await browser.newPage();
  await fixture(page, args => rpcResult(args));
  try {
    await page.goto(`${base}/elections/results/?id=${id}`);
    await page.locator('[data-sos-status]').filter({ hasText: 'Current published' }).waitFor({ state: 'attached' });
    expect(await page.locator('[data-sos-jurisdiction] option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))).toEqual(['', '011']);
    await page.evaluate(() => { sessionStorage.setItem('civicpulse.county', '13121'); window.dispatchEvent(new Event('countychange')); });
    await page.waitForFunction(() => document.querySelectorAll('[data-sos-jurisdiction] option').length === 1);
    expect(await page.locator('[data-sos-content] table').count()).toBe(0);
    await page.evaluate(() => { sessionStorage.setItem('civicpulse.county', 'all'); window.dispatchEvent(new Event('countychange')); });
    await page.locator('[data-sos-jurisdiction] option[value=\"013\"]').waitFor({ state: 'attached' });
    await page.locator('[data-sos-jurisdiction]').selectOption('013');
    await page.locator('[data-sos-content] table').waitFor({ state: 'attached' });
    expect(await page.locator('[data-sos-content]').innerText()).toContain('Synthetic source race');
  } finally { await page.close(); }
}, 30000);
