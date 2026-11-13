import { expect, test } from "bun:test";
import {
  ballotResultReports,
  ballotChoiceTotal,
  precinctReporting,
  choicePercent,
} from "../../apps/web/src/lib/ballot-results";
import type { ResultReport } from "../../apps/web/src/lib/election-results";
const report = (
  id: string,
  scope: Partial<ResultReport["scope"]> = {},
  date = "2026-06-05T12:00:00Z",
): ResultReport => ({
  id,
  observed_at: date,
  supersedes: null,
  scope: {
    county: "Bibb",
    unit_type: "county",
    unit: "all",
    counting_group: "all",
    ballot_style: "all",
    ...scope,
  },
  snapshot: { status: "official", turnout: {}, contests: [] },
});
test("ballot results select current county/style snapshots without combining overlapping units or methods", () => {
  const a = report("a"),
    newer = report("b", {}, "2026-06-06T12:00:00Z"),
    rep = report("r", { ballot_style: "Rep" }),
    other = report("m", { county: "Monroe County" });
  const rows = [
    a,
    newer,
    rep,
    other,
    report("p", { unit_type: "precinct", unit: "HA2" }),
    report("advance", { counting_group: "advance" }),
  ];
  expect(
    ballotResultReports(rows, "13021")
      .map((r) => r.id)
      .sort(),
  ).toEqual(["b", "r"]);
  expect(ballotResultReports(rows, "13159")).toEqual([]);
  expect(ballotResultReports(rows, "13207").map((r) => r.id)).toEqual(["m"]);
  expect(ballotResultReports(rows, "all")).toHaveLength(3);
  expect(
    ballotResultReports(
      [a, report("alias", { county: "Bibb County" }, "2026-06-06T12:00:00Z")],
      "13021",
    ).map((r) => r.id),
  ).toEqual(["alias"]);
});
test("reporting percentages retain missing/zero data and respect contest denominators", () => {
  expect(
    precinctReporting({ precincts_reported: 31, precincts_total: 31 }),
  ).toBe("31 of 31 precincts reporting (100%)");
  expect(
    precinctReporting({ precincts_reported: 0, precincts_total: 10 }),
  ).toBe("0 of 10 precincts reporting (0%)");
  expect(
    precinctReporting({ precincts_reported: 2, precincts_total: 3 }),
  ).toContain("66.7%");
  expect(precinctReporting({})).toBe("Precincts reporting: not reported");
  expect(
    precinctReporting({ precincts_reported: 2, precincts_total: 0 }),
  ).not.toContain("%");
  expect(
    precinctReporting({ precincts_reported: 10, precincts_total: 5 }),
  ).not.toContain("%");
  expect(choicePercent(0, 10)).toBe("0.00%");
  expect(choicePercent(5, 10)).toBe("50.00%");
  expect(choicePercent(0, 0)).toBe("Not reported");
  expect(choicePercent(1, null)).toBe("Not reported");
});

test("choice sums require complete curated coverage but explicit source totals remain authoritative", () => {
  const partial = { choices: [{ person_id: "alex", label: "Alex", votes: 60 }] };
  const expected = { personIds: ["alex", "blair"] };
  expect(ballotChoiceTotal(partial, expected)).toBeNull();
  expect(ballotChoiceTotal({ ...partial, total_votes: 100 }, expected)).toBe(100);
  expect(ballotChoiceTotal({ ...partial, total_votes: 0 }, expected)).toBe(0);
  expect(ballotChoiceTotal({ ...partial, choices: [...partial.choices, { person_id: "blair", label: "Blair", votes: 40 }] }, expected)).toBe(100);
  const question = { choices: [{ label: "Yes", votes: 0 }] };
  expect(ballotChoiceTotal(question, { choiceLabels: ["Yes", "No"] })).toBeNull();
  expect(ballotChoiceTotal({ choices: [...question.choices, { label: "No", votes: 0 }] }, { choiceLabels: ["Yes", "No"] })).toBe(0);
  expect(ballotChoiceTotal(question, { choiceLabels: ["yes"] })).toBeNull();
  expect(ballotChoiceTotal(partial, {})).toBeNull();
  for (const votes of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(ballotChoiceTotal({ choices: [{ label: "Yes", votes }] }, { choiceLabels: ["Yes"] })).toBeNull();
    expect(ballotChoiceTotal({ ...partial, total_votes: votes }, expected)).toBeNull();
  }
  expect(ballotChoiceTotal({ choices: [{ label: "Yes", votes: Number.MAX_SAFE_INTEGER }, { label: "No", votes: 1 }] }, { choiceLabels: ["Yes", "No"] })).toBeNull();
});
