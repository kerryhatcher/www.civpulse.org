import { buildVoteMetrics } from "./vote-metrics";
import {
  mappedSosItem,
  mappedSosChoice,
  type SosContestMapping,
} from "../lib/sos-ballot";
import {
  sourceStatus,
  type SosObject,
  type SosView,
} from "../lib/sos-results-reader";
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
export function clearInlineSos() {
  document
    .querySelectorAll("[data-sos-inline-runtime]")
    .forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>("[data-sos-metrics-slot]").forEach(slot => {
    slot.replaceChildren(buildVoteMetrics());
  });
  document
    .querySelectorAll<HTMLElement>("[data-sos-ballot-fallback]")
    .forEach((node) => {
      node.hidden = true;
    });
  const empty = document.querySelector<HTMLElement>(
    "[data-sos-ballot-list] > .empty-state",
  );
  if (empty) empty.hidden = false;
}
export function renderInlineSos(
  view: SosView,
  mappings: SosContestMapping[],
  query: string,
) {
  const list = document.querySelector<HTMLElement>("[data-sos-ballot-list]");
  if (!list) return;
  const scroll = window.scrollY;
  const covered = new Set<string>();
  const operations: Array<() => void> = [];
  const stamp = new Date(view.pointer.source_created_at).toLocaleString(
    "en-US",
    { timeZone: "America/New_York", timeZoneName: "short" },
  );
  const evidence = (item: SosObject) => {
    const note = el(
      "p",
      `Georgia SOS · ${view.scope.jurisdiction.name} · Source reported ${stamp} · ${sourceStatus(item.reportingStatus ?? view.scope.jurisdiction.reportingStatuses)}.`,
    );
    note.className = "body-note";
    note.dataset.sosInlineRuntime = "";
    note.dataset.sosInlineScope = "";
    return note;
  };
  const count = (choice: SosObject | undefined, choices: SosObject[]) => {
    const node = buildVoteMetrics(choice?.voteCount, choices.map(option => option.voteCount), `SOS, ${view.scope.jurisdiction.name}`);
    return node;
  };
  const table = (choices: SosObject[], extra = false, allChoices = choices) => {
    const table = el("table");
    table.className = "sos-source-choices";
    table.dataset.sosInlineRuntime = "";
    table.append(
      el(
        "caption",
        `${extra ? "Additional SOS choices without a reviewed candidate mapping" : "Georgia SOS source choices"} · ${view.scope.jurisdiction.name}`,
      ),
    );
    const head = el("thead"),
      header = el("tr");
    for (const label of ["Candidate / choice", "Vote share / votes"]) {
      const cell = el("th", label);
      cell.scope = "col";
      header.append(cell);
    }
    head.append(header);
    table.append(head);
    const body = el("tbody");
    for (const choice of choices) {
      const row = el("tr"),
        name = el(
          "th",
          typeof choice.name === "string"
            ? choice.name
            : "Unnamed source choice",
        );
      name.scope = "row";
      const metrics = el("td"); metrics.append(count(choice, allChoices));
      row.append(name, metrics);
      body.append(row);
    }
    table.append(body);
    return table;
  };
  for (const card of list.querySelectorAll<HTMLElement>(".contest-card[id]")) {
    const kind = card.id.startsWith("contest-")
      ? "contest"
      : card.id.startsWith("question-")
        ? "question"
        : null;
    if (!kind) continue;
    const match = mappedSosItem(
      view,
      mappings,
      kind,
      card.id.replace(/^(contest|question)-/, ""),
    );
    if (!match) continue;
    covered.add(String(match.item.data.id));
    if (kind === "contest") {
      for (const profile of card.querySelectorAll<HTMLElement>(
        "[data-candidate-id]",
      )) {
        const choice = mappedSosChoice(
          match.item,
          match.mapping,
          profile.dataset.candidateId,
        );
        const target =
          profile.querySelector<HTMLElement>(".candidate-text") ?? profile;
        operations.push(() => {
          let slot = target.querySelector<HTMLElement>("[data-sos-metrics-slot]");
          if (!slot) { slot = el("span"); slot.dataset.sosMetricsSlot = ""; target.append(slot); }
          slot.replaceChildren(count(choice, match.item.data.ballotOptions as SosObject[]));
        });
      }
    } else {
      for (const label of card.querySelectorAll<HTMLElement>(
        "[data-sos-choice-label]",
      )) {
        const choice = mappedSosChoice(
          match.item,
          match.mapping,
          undefined,
          label.dataset.sosChoiceLabel,
        );
        operations.push(() => {
          let slot = label.querySelector<HTMLElement>("[data-sos-metrics-slot]");
          if (!slot) { slot = el("span"); slot.dataset.sosMetricsSlot = ""; label.append(slot); }
          slot.replaceChildren(count(choice, match.item.data.ballotOptions as SosObject[]));
        });
      }
    }
    const extra = (match.item.data.ballotOptions as SosObject[]).filter(
      (choice) =>
        !match.mapping.choices.some((c) => c.source_choice_id === choice.id),
    );
    operations.push(() => {
      card.append(evidence(match.item.data));
      if (extra.length) card.append(table(extra, true, match.item.data.ballotOptions as SosObject[]));
    });
  }
  const sourceCards = document.createDocumentFragment();
  for (const item of view.scope.items) {
    if (covered.has(String(item.data.id))) continue;
    const choices = item.data.ballotOptions as SosObject[];
    if (
      query &&
      ![item.data.name, ...choices.map((choice) => choice.name)].some(
        (value) =>
          typeof value === "string" &&
          value.toLocaleLowerCase().includes(query),
      )
    )
      continue;
    const card = el("article");
    card.className = "contest-card";
    card.dataset.sosInlineRuntime = "";
    card.dataset.sosSourceContest = String(item.data.id);
    const header = el("header");
    header.className = "contest-heading";
    header.append(el("h3", String(item.data.name)));
    const label = el(
      "span",
      `Georgia SOS source race · ${view.scope.jurisdiction.name}`,
    );
    label.className = "contest-meta";
    header.append(label);
    card.append(header);
    const note = el(
      "p",
      "This source race has no reviewed link to the curated ballot. Source choices are shown without guessed profile links.",
    );
    note.className = "body-note";
    card.append(note, evidence(item.data), table(choices));
    sourceCards.append(card);
  }
  // Candidate anchors and metadata stay in place. Only complete result annotations swap.
  const sourceCardCount = sourceCards.childElementCount;
  clearInlineSos();
  for (const operation of operations) operation();
  list.append(sourceCards);
  const empty = list.querySelector<HTMLElement>(":scope > .empty-state");
  if (empty) empty.hidden = sourceCardCount > 0;
  window.dispatchEvent(new Event("sosballotchange"));
  window.scrollTo({ top: scroll, behavior: "instant" });
}
