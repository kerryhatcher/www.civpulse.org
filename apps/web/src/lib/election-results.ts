import bibbPrecinctNames from "../data/bibb-precinct-names.json";
export type Counts = {
  ballots?: number | null;
  voters?: number | null;
  registered?: number | null;
  precincts_reported?: number | null;
  precincts_total?: number | null;
};
export type ContestResult = Counts & {
  contest_id?: string;
  question_id?: string;
  choices: Array<{ label: string; votes: number }>;
  total_votes?: number | null;
  unresolved_write_ins?: number | null;
  undervotes?: number | null;
  overvotes?: number | null;
};
export type ResultReport = {
  id: string;
  scope: {
    county: string;
    unit_type: string;
    unit: string;
    counting_group: string;
    ballot_style: string;
  };
  observed_at: string;
  supersedes: string | null;
  snapshot: {
    status: string;
    note?: string;
    turnout: Counts;
    contests: ContestResult[];
  };
};
export const methodLabels: Record<string, string> = {
  all: "All voting methods",
  election_day: "Election Day",
  advance: "Advance voting",
  absentee_mail: "Absentee by mail",
  provisional: "Provisional",
};
export const areaKey = (r: ResultReport) =>
  JSON.stringify([r.scope.county, r.scope.unit_type, r.scope.unit]);
export const areaLabel = (r: ResultReport) =>
  r.scope.unit_type === "county"
    ? `${r.scope.county} County overview`
    : `${r.scope.county} · ${r.scope.unit_type === "precinct" ? "Precinct" : "Tabulator"} ${r.scope.unit}${r.scope.county === "Bibb" && r.scope.unit_type === "precinct" && (bibbPrecinctNames as Record<string, string>)[r.scope.unit] ? ` — ${(bibbPrecinctNames as Record<string, string>)[r.scope.unit]}` : ""}`;
export function selectReports(
  rows: ResultReport[],
  area: string,
  method: string,
  style: string,
) {
  return rows
    .filter(
      (r) =>
        areaKey(r) === area &&
        r.scope.counting_group === method &&
        r.scope.ballot_style === style,
    )
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
}
export function matchingContests(
  contests: ContestResult[],
  titles: Map<string, string>,
  query: string,
) {
  const q = query.trim().toLocaleLowerCase();
  return contests.filter(
    (c) =>
      !q ||
      [
        titles.get(c.contest_id ?? c.question_id ?? ""),
        ...c.choices.map((v) => v.label),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
  );
}
