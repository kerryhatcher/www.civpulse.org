import { getSupabase } from "../lib/supabase";
import { selectedCounty } from './county-filter';
import { GEORGIA_COUNTIES } from '../lib/county-scope';
import {
  areaKey,
  areaLabel,
  methodLabels,
  matchingContests,
  selectReports,
  type Counts,
  type ResultReport,
  type ContestResult,
} from "../lib/election-results";
const n = (v: number | null | undefined) =>
  v == null ? "Not reported" : v.toLocaleString("en-US");
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const stamp = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
function metric(list: HTMLElement, label: string, value: string) {
  const item = el("div");
  item.append(el("dt", label), el("dd", value));
  list.append(item);
}
function metrics(c: Counts) {
  if (Object.values(c).every((v) => v == null))
    return el(
      "p",
      "Turnout is not reported for this scope. Any available contest ballot counts appear in Reporting details.",
      "result-time",
    );
  const list = el("dl", undefined, "result-metrics");
  metric(list, "Ballots cast", n(c.ballots));
  const numerator = c.voters ?? c.ballots;
  metric(
    list,
    `Turnout (${c.voters != null ? "voters" : "ballots"} / registered)`,
    numerator != null && c.registered != null && c.registered > 0
      ? `${((100 * numerator) / c.registered).toFixed(2)}%`
      : "Not reported",
  );
  metric(list, "Registered voters", n(c.registered));
  metric(
    list,
    "Precincts reporting",
    `${n(c.precincts_reported)} / ${n(c.precincts_total)}`,
  );
  return list;
}
function contest(c: ContestResult, title: string, open: boolean) {
  const details = el("details", undefined, "result-contest");
  details.open = open;
  const summary = el("summary");
  summary.append(
    el("span", title),
    el("span", `${n(c.total_votes)} votes`, "result-vote-total"),
  );
  details.append(summary);
  const table = el("table");
  table.append(el("caption", `${title} — reported votes`));
  const head = el("thead"),
    tr = el("tr");
  for (const label of ["Candidate / choice", "Votes", "Share"]) {
    const th = el("th", label);
    th.scope = "col";
    tr.append(th);
  }
  head.append(tr);
  table.append(head);
  const body = el("tbody");
  for (const choice of [...c.choices].sort(
    (a, b) => b.votes - a.votes || a.label.localeCompare(b.label),
  )) {
    const row = el("tr"),
      name = el("th", choice.label);
    name.scope = "row";
    row.append(
      name,
      el("td", n(choice.votes)),
      el(
        "td",
        c.total_votes != null && c.total_votes > 0
          ? `${((100 * choice.votes) / c.total_votes).toFixed(1)}%`
          : "—",
      ),
    );
    body.append(row);
  }
  table.append(body);
  details.append(table);
  const meta = el("details", undefined, "result-audit");
  meta.append(el("summary", "Reporting details"));
  meta.append(
    el(
      "p",
      `Printed total votes: ${n(c.total_votes)}. Unresolved write-ins (separate): ${n(c.unresolved_write_ins)}. Undervotes: ${n(c.undervotes)}. Overvotes: ${n(c.overvotes)}.`,
    ),
  );
  meta.append(
    el(
      "p",
      `Contest ballots: ${n(c.ballots)}. Contest registered voters: ${n(c.registered)}. Contest precincts: ${n(c.precincts_reported)} / ${n(c.precincts_total)}.`,
    ),
  );
  if (c.ballots != null && c.registered != null && c.registered > 0)
    meta.append(
      el(
        "p",
        `Contest participation: ${((100 * c.ballots) / c.registered).toFixed(2)}%.`,
      ),
    );
  details.append(meta);
  return details;
}
export async function initElectionResults() {
  const select = document.querySelector<HTMLSelectElement>("#result-election")!,
    status = document.querySelector<HTMLElement>("#result-status")!,
    reports = document.querySelector<HTMLElement>("#result-reports")!,
    history = document.querySelector<HTMLInputElement>("#result-history")!,
    area = document.querySelector<HTMLSelectElement>("#result-area")!,
    method = document.querySelector<HTMLSelectElement>("#result-method")!,
    style = document.querySelector<HTMLSelectElement>("#result-style")!,
    search = document.querySelector<HTMLInputElement>("#result-search")!,
    filters = document.querySelector<HTMLFieldSetElement>("#result-filters")!,
    retry = document.querySelector<HTMLButtonElement>("#result-retry")!;
  let rows: ResultReport[] = [],
    generation = 0;
  const titles = new Map<string, string>();
  const option = (s: HTMLSelectElement, value: string, label: string) => {
    const o = el("option", label);
    o.value = value;
    s.append(o);
  };
  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set("id", select.value);
    for (const [key, value] of [
      ["area", area.value],
      ["method", method.value],
      ["style", style.value],
      ["q", search.value],
      ["history", history.checked ? "1" : ""],
    ]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }
  function render() {
    reports.replaceChildren();
    updateUrl();
    if (!rows.length) {
      status.textContent =
        "No reports yet. Results have not been reported; vote counts are not zero.";
      return;
    }
    const selected = selectReports(rows, area.value, method.value, style.value);
    let shown = 0;
    for (const [index, r] of selected.entries()) {
      const article = el("article", undefined, "result-report");
      article.append(el("h2", areaLabel(r)));
      article.append(
        el(
          "p",
          `${methodLabels[r.scope.counting_group] ?? r.scope.counting_group} · ${r.scope.ballot_style === "all" ? "All ballot styles" : r.scope.ballot_style} · ${r.snapshot.status[0].toUpperCase() + r.snapshot.status.slice(1)}`,
          "result-report-label",
        ),
      );
      article.append(
        el(
          "p",
          `${index === 0 ? "Latest report" : "Earlier report"} · ${stamp(r.observed_at)}`,
          "result-time",
        ),
      );
      article.append(metrics(r.snapshot.turnout));
      const provenance = el("details", undefined, "result-audit");
      provenance.append(el("summary", "Source and report details"));
      if (r.snapshot.note) provenance.append(el("p", r.snapshot.note));
      provenance.append(
        el("p", `Voters: ${n(r.snapshot.turnout.voters)}. Report ID: ${r.id}.`),
      );
      if (r.supersedes)
        provenance.append(
          el(
            "p",
            "Replaces an earlier report. These are cumulative totals, not additional votes.",
          ),
        );
      article.append(provenance);
      const matches = matchingContests(
        r.snapshot.contests,
        titles,
        search.value,
      );
      shown += matches.length;
      article.append(
        el(
          "h3",
          `${matches.length} ${matches.length === 1 ? "contest or question" : "contests and questions"}`,
          "result-contest-count",
        ),
      );
      if (!matches.length)
        article.append(
          el(
            "p",
            r.snapshot.contests.length
              ? "No matching contests or candidates. Clear the search to see all results."
              : "This report contains turnout only. Contest votes have not been reported.",
          ),
        );
      for (const c of matches)
        article.append(
          contest(
            c,
            titles.get(c.contest_id ?? c.question_id ?? "") ?? "Contest",
            search.value.trim().length > 0,
          ),
        );
      reports.append(article);
    }
    status.textContent = selected.length
      ? `${selected.length === 1 ? "Showing one report" : `Showing ${selected.length} snapshots for this scope`}. ${shown} matching contests and questions. Reports are never added together.`
      : "No report for this combination of area, voting method and ballot style. Try another selection; missing results are not zero.";
  }
  function methods() {
    const old = method.value;
    method.replaceChildren();
    const values = new Set(
      rows
        .filter((r) => areaKey(r) === area.value)
        .map((r) => r.scope.counting_group),
    );
    for (const [key, label] of Object.entries(methodLabels))
      if (values.has(key)) option(method, key, label);
    for (const key of values) if (!methodLabels[key]) option(method, key, key);
    method.disabled = values.size < 2;
    method.value = values.has(old)
      ? old
      : values.has("all")
        ? "all"
        : (method.options[0]?.value ?? "");
    styles();
  }
  function styles() {
    const old = style.value;
    style.replaceChildren();
    const values = [
      ...new Set(
        rows
          .filter(
            (r) =>
              areaKey(r) === area.value &&
              r.scope.counting_group === method.value,
          )
          .map((r) => r.scope.ballot_style),
      ),
    ].sort();
    for (const v of values)
      option(style, v, v === "all" ? "All ballot styles" : v);
    document.querySelector<HTMLElement>("#result-style-field")!.hidden =
      values.length < 2;
    style.value = values.includes(old)
      ? old
      : values.includes("all")
        ? "all"
        : (values[0] ?? "");
    render();
  }
  async function choose() {
    const request = ++generation;
    rows = [];
    reports.replaceChildren();
    filters.disabled = true;
    retry.hidden = true;
    status.textContent = "Loading reports…";
    if (!select.value) {
      status.textContent = "Choose an election to view reports.";
      return;
    }
    try {
      const db = getSupabase();
      const { data: e, error: ee } = await db.rpc("get_election", {
        p_id: select.value,
      });
      if (request !== generation) return;
      if (ee) throw ee;
      if (e?.status !== "ok")
        throw Error("Election unavailable or access restricted.");
      titles.clear();
      for (const c of e.contests ?? [])
        titles.set(
          c.id,
          [c.office, c.district, c.seat].filter(Boolean).join(" · "),
        );
      for (const q of e.ballot_questions ?? []) titles.set(q.id, q.title);
      const loaded: ResultReport[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await db.rpc("get_election_results", {
          p_election_id: select.value,
          p_history: history.checked,
          p_offset: offset,
          p_limit: 100,
        });
        if (request !== generation) return;
        if (error) throw error;
        if (data?.status !== "ok")
          throw Error("Election unavailable or access restricted.");
        loaded.push(...data.reports);
        if (data.reports.length < 100) break;
        offset += data.reports.length;
        status.textContent = `Loading reports… ${loaded.length} received.`;
      }
      const county = GEORGIA_COUNTIES.find(item => item.fips === selectedCounty());
      rows = county ? loaded.filter(row => row.scope.county.toLowerCase() === county.name.toLowerCase()) : loaded;
      const old = area.value;
      area.replaceChildren();
      const areas = [
        ...new Map(rows.map((r) => [areaKey(r), r])).values(),
      ].sort(
        (a, b) =>
          (a.scope.unit_type === "county" ? 0 : 1) -
            (b.scope.unit_type === "county" ? 0 : 1) ||
          areaLabel(a).localeCompare(areaLabel(b), undefined, {
            numeric: true,
          }),
      );
      for (const r of areas) option(area, areaKey(r), areaLabel(r));
      area.value = areas.some((r) => areaKey(r) === old)
        ? old
        : areas[0]
          ? areaKey(areas[0])
          : "";
      filters.disabled = !rows.length;
      methods();
    } catch {
      if (request === generation) {
        status.textContent =
          "Could not load election reports. Check your connection and try again.";
        retry.hidden = false;
      }
    }
  }
  area.addEventListener("change", methods);
  window.addEventListener('countychange', () => void choose());
  method.addEventListener("change", styles);
  style.addEventListener("change", render);
  search.addEventListener("input", render);
  history.addEventListener("change", () => void choose());
  select.addEventListener("change", () => {
    area.replaceChildren();
    method.replaceChildren();
    style.replaceChildren();
    search.value = "";
    void choose();
  });
  retry.addEventListener("click", () => void choose());
  document
    .querySelector("#result-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      void choose();
    });
  try {
    const db = getSupabase();
    await db.auth.getSession();
    const { data, error } = await db.rpc("search_elections", {
      p_query: "",
      p_limit: 100,
    });
    if (error) throw error;
    for (const e of data ?? [])
      option(select, e.id, `${e.election_date} — ${e.name}`);
    const params = new URL(location.href).searchParams,
      id = params.get("id");
    if (id && /^[a-f0-9-]{36}$/i.test(id)) {
      if (!Array.from(select.options).some((o) => o.value === id)) {
        const { data } = await db.rpc("get_election", { p_id: id });
        if (data?.status === "ok") option(select, id, data.election.name);
      }
      select.value = id;
    } else {
      const example = (data ?? []).find(
        (e: { election_date: string }) => e.election_date === "2026-11-03",
      );
      if (example) select.value = example.id;
    }
    for (const [key, s] of [
      ["area", area],
      ["method", method],
      ["style", style],
    ] as const) {
      const v = params.get(key);
      if (v) {
        option(s, v, v);
        s.value = v;
      }
    }
    search.value = params.get("q") ?? "";
    history.checked = params.get("history") === "1";
    await choose();
  } catch {
    status.textContent =
      "Could not load elections. Reload this page to try again.";
  }
}
