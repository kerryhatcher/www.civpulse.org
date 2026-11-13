import { readElectionReports } from "../lib/election-report-reader";
import {
  ballotResultReports,
  ballotChoiceTotal,
  choicePercent,
  precinctReporting,
} from "../lib/ballot-results";
import type { ResultReport, ContestResult } from "../lib/election-results";
import { selectedCounty } from "./county-filter";
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
const number = (v: number) => v.toLocaleString("en-US");
const timestamp = (v: string) =>
  new Date(v).toLocaleString("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

let stopPolling: (() => void) | undefined;
export async function initBallotResults(electionId: string): Promise<void> {
  stopPolling?.();
  const root = document.querySelector<HTMLElement>("[data-ballot-results]");
  if (!root) return;
  const summary = root.querySelector<HTMLElement>(
    "[data-ballot-results-summary]",
  )!;
  const refresh = root.querySelector<HTMLButtonElement>(
    "[data-ballot-results-refresh]",
  )!;
  const errorStatus = document.querySelector<HTMLElement>("[data-ballot-results-error]");
  refresh.hidden = false;
  const cards = [
    ...document.querySelectorAll<HTMLElement>(".contest-card[id]"),
  ];
  let reports: ResultReport[] = [];
  let stopped = false, generation = 0;
  let fingerprint: string | undefined;
  const originals = new Map<HTMLElement, boolean>();
  for (const card of cards)
    for (const list of card.querySelectorAll<HTMLElement>(
      ".candidate-list, .ballot-question-choices, [data-ballot-choice-label]",
    ))
      originals.set(list, list.hidden);
  function reset() {
    for (const card of cards)
      card.querySelector("[data-inline-results]")?.remove();
    for (const [list, hidden] of originals) list.hidden = hidden;
  }
  function resultTrack(percent?: string) {
    const track = el("span", undefined, "result-track");
    track.setAttribute("aria-hidden", "true");
    const fill = el("span", undefined, "result-fill");
    fill.style.width = percent ?? "0%";
    track.append(fill);
    return track;
  }
  function resultBlock(
    card: HTMLElement,
    report: ResultReport,
    result: ContestResult,
  ) {
    const block = el("section", undefined, "ballot-result-scope");
    block.append(
      el(
        "h4",
        `${report.scope.county.replace(/ County$/i, "")} County${report.scope.ballot_style === "all" ? "" : ` · ${report.scope.ballot_style} ballot`}`,
      ),
    );
    const statuses: Record<string, string> = {
      official: "Official results",
      unofficial: "Unofficial results",
      certified: "Certified results",
    };
    block.append(
      el(
        "p",
        `${statuses[report.snapshot.status] ?? "Reported results"} · ${timestamp(report.observed_at)}`,
        "ballot-result-source",
      ),
    );
    if (report.snapshot.note)
      block.append(el("p", report.snapshot.note, "body-note"));
    block.append(el("p", precinctReporting(result), "body-note"));
    const table = el("table");
    const race =
      card.querySelector("h3")?.textContent?.trim() ?? "Ballot choices";
    table.append(
      el("caption", `${race} · ${report.scope.county} · All voting methods`),
    );
    const thead = el("thead"),
      head = el("tr");
    for (const title of ["Candidate / choice", "Votes", "Percent"]) {
      const th = el("th", title);
      th.scope = "col";
      head.append(th);
    }
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    // Missing curated choices prevent an inferred complete-contest denominator.
    const total = ballotChoiceTotal(result, {
      personIds: [...card.querySelectorAll<HTMLElement>("a[data-candidate-id]")].map(profile => profile.dataset.candidateId!),
      choiceLabels: [...card.querySelectorAll<HTMLElement>("[data-sos-choice-label]")].map(choice => choice.dataset.sosChoiceLabel!),
    });
    for (const choice of [...result.choices].sort(
      (a, b) => b.votes - a.votes || a.label.localeCompare(b.label),
    )) {
      const row = el("tr"),
        name = el("th");
      name.scope = "row";
      const profile = choice.person_id
        ? card.querySelector<HTMLAnchorElement>(
            `a[data-candidate-id="${choice.person_id}"]`,
          )
        : null;
      if (profile) {
        row.dataset.partyTone = profile.dataset.partyTone ?? "neutral";
        const link = el("a", choice.label, "result-name");
        link.href = profile.href;
        name.append(link);
      } else name.append(el("span", choice.label, "result-name"));
      const metadata = profile
        ?.querySelector(".candidate-meta")
        ?.textContent?.trim();
      const writeIn = profile
        ?.querySelector(".candidate-write-in")
        ?.textContent?.trim();
      if (metadata || writeIn)
        name.append(
          el(
            "span",
            [metadata, writeIn].filter(Boolean).join(" · "),
            "result-candidate-meta",
          ),
        );
      const percent = choice.votes === 0 && total === 0 ? "0.00%" : choicePercent(choice.votes, total);
      name.append(resultTrack(percent === "Not reported" ? undefined : percent));
      row.append(name, el("td", number(choice.votes)), el("td", percent === "Not reported" ? "Not available" : percent));
      body.append(row);
    }
    // A partial source must not remove ballot candidates whose votes are unavailable.
    for (const profile of card.querySelectorAll<HTMLAnchorElement>(
      "a[data-candidate-id]",
    )) {
      if (
        result.choices.some((c) => c.person_id === profile.dataset.candidateId)
      )
        continue;
      const row = el("tr"),
        name = el("th");
      name.scope = "row";
      const link = el(
        "a",
        profile.querySelector(".candidate-name")?.textContent ?? "Candidate",
      );
      link.href = profile.href;
      name.append(link, resultTrack());
      row.append(name, el("td", "Not available"), el("td", "Not available"));
      body.append(row);
    }
    for (const item of card.querySelectorAll(".ballot-question-choices li")) {
      const label =
        (item as HTMLElement).dataset.sosChoiceLabel ??
        item.textContent?.trim() ??
        "";
      if (result.choices.some((c) => c.label === label)) continue;
      const row = el("tr"),
        name = el("th");
      name.scope = "row";
      name.append(el("span", label, "result-name"), resultTrack());
      row.append(name, el("td", "Not available"), el("td", "Not available"));
      body.append(row);
    }
    table.append(body);
    block.append(table);
    block.append(
      el(
        "p",
        `${total === null ? "Total choice votes: Not available." : `${number(total)} recorded choice votes.`} Percentages describe votes for these choices, not voter turnout.`,
        "body-note",
      ),
    );
    if (result.unresolved_write_ins != null)
      block.append(
        el(
          "p",
          `${number(result.unresolved_write_ins)} unresolved write-ins, reported separately.`,
          "body-note",
        ),
      );
    const link = el("a", "Source reports and history");
    link.href = `/elections/results/?id=${encodeURIComponent(electionId)}`;
    block.append(link);
    return block;
  }
  function render() {
    if (stopped) return;
    reset();
    const selected = ballotResultReports(reports, selectedCounty());
    let races = 0;
    for (const card of cards) {
      if (card.hidden) continue;
      // Reviewed SOS coverage keeps the original profile cards and their live counts.
      // Photo/PDF evidence remains available independently on the reports page.
      if (card.querySelector("[data-sos-inline-scope]:not([hidden])")) continue;
      const id = card.id.replace(/^(contest|question)-/, "");
      const matches = selected.flatMap((report) =>
        report.snapshot.contests
          .filter((c) => (c.contest_id ?? c.question_id) === id)
          .map((result) => ({ report, result })),
      );
      if (!matches.length) continue;
      const wrapper = el("div", undefined, "ballot-results");
      wrapper.dataset.inlineResults = "";
      for (const { report, result } of matches)
        wrapper.append(resultBlock(card, report, result));
      for (const list of card.querySelectorAll<HTMLElement>(
        ".candidate-list, .ballot-question-choices, [data-ballot-choice-label]",
      ))
        list.hidden = true;
      card.append(wrapper);
      races++;
    }
    summary.textContent = races
      ? `Photo/PDF results are shown alongside ${races} ballot races and questions for the selected county view. Each county and ballot style is reported separately.`
      : "No additional photo/PDF county overview results are displayed for this county view. Any available SOS votes appear with the ballot below.";
  }
  async function load(force = false) {
    if (stopped) return;
    const request = ++generation;
    refresh.disabled = true;
    summary.textContent = "Loading available results…";
    root!.setAttribute("aria-busy", "true");
    try {
      const incoming = await readElectionReports(electionId, force);
      if (stopped || request !== generation) return;
      const nextFingerprint = JSON.stringify(incoming);
      const changed = nextFingerprint !== fingerprint;
      if (errorStatus) errorStatus.hidden = true;
      reports = incoming;
      fingerprint = nextFingerprint;
      if (changed) render();
      if (force && changed)
        window.dispatchEvent(
          new CustomEvent("electionreportschange", { detail: { electionId } }),
        );
    } catch {
      if (stopped || request !== generation) return;
      if (fingerprint === undefined) reset();
      if (errorStatus) {
        errorStatus.textContent = fingerprint === undefined
          ? "Photo/PDF results are temporarily unavailable. The ballot remains available; updates retry automatically."
          : "Photo/PDF result updates are temporarily unavailable. Showing the last loaded reports; updates retry automatically.";
        errorStatus.hidden = false;
      }
      summary.textContent =
        "Results could not be loaded. The ballot is still available. Select Refresh results to try again.";
    } finally {
      if (!stopped && request === generation) {
        refresh.disabled = false;
        root!.removeAttribute("aria-busy");
      }
    }
  }
  refresh.onclick = () => {
    void load(true);
  };
  window.addEventListener("ballotscopechange", render);
  window.addEventListener("countychange", render);
  window.addEventListener("sosballotchange", render);
  const timer = setInterval(() => {
    if (!stopped && !document.hidden && navigator.onLine && !refresh.disabled) void load(true);
  }, 30000);
  stopPolling = () => {
    stopped = true;
    generation++;
    clearInterval(timer);
    refresh.onclick = null;
    refresh.disabled = false;
    root.removeAttribute("aria-busy");
    reset();
    window.removeEventListener("ballotscopechange", render);
    window.removeEventListener("countychange", render);
    window.removeEventListener("sosballotchange", render);
  };
  await load();
}
