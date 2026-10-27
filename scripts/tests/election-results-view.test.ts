import { describe, expect, test } from "bun:test";
import {
  areaKey,
  selectReports,
  matchingContests,
  type ResultReport,
} from "../../apps/web/src/lib/election-results";
const row = (
  unit_type = "county",
  unit = "all",
  counting_group = "all",
  ballot_style = "all",
  observed_at = "2026-06-05",
): ResultReport => ({
  id: Math.random().toString(),
  scope: { county: "Bibb", unit_type, unit, counting_group, ballot_style },
  observed_at,
  supersedes: null,
  snapshot: { status: "official", turnout: { ballots: 10 }, contests: [] },
});
describe("independent result scopes", () => {
  test("county overview excludes precincts, methods and separate ballots", () => {
    const total = row();
    const rows = [
      total,
      row("precinct", "EM1"),
      row("county", "all", "advance"),
      row("county", "all", "all", "Rep"),
    ];
    expect(selectReports(rows, areaKey(total), "all", "all")).toEqual([total]);
  });
  test("history stays scoped and newest first without summing", () => {
    const older = row("precinct", "EM1", "all", "all", "2026-05-19");
    const newer = row("precinct", "EM1");
    expect(
      selectReports(
        [older, row(), newer, row("precinct", "EM2")],
        areaKey(newer),
        "all",
        "all",
      ),
    ).toEqual([newer, older]);
  });
  test("missing method intersection stays empty, not a county fallback", () => {
    const p = row("precinct", "EM1");
    expect(
      selectReports(
        [p, row("county", "all", "advance")],
        areaKey(p),
        "advance",
        "all",
      ),
    ).toEqual([]);
  });
  test("search finds candidate or contest without changing vote totals", () => {
    const c = {
      contest_id: "a",
      choices: [{ label: "Example Candidate", votes: 0 }],
      total_votes: 0,
    };
    expect(
      matchingContests([c], new Map([["a", "Governor"]]), "candidate"),
    ).toEqual([c]);
    expect(
      matchingContests([c], new Map([["a", "Governor"]]), "governor"),
    ).toEqual([c]);
    expect(matchingContests([c], new Map(), "missing")).toEqual([]);
  });
});
