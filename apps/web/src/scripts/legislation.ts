import { readLegislationDirectory, readStaticBills } from "./legislation-directory-data";
import { browseStaticSessions } from "../lib/legislation-directory";
import { getPublicProfileSnapshot, readProfileVoteGroups } from "../lib/profile-section-data";
import { browseProfileLegislation } from "../lib/profile-sections";
import { getSupabase } from "../lib/supabase";
import {
  legislativeResources,
  recordLabel,
  type LegislativeRow,
} from "../lib/legislation";
import {
  humanize,
  legislativeDate,
  legislativeTitle,
  relationLabel,
  coverageLabel,
} from "../lib/legislation-display";
import { historyLink } from "../lib/history";
const paths: Record<string, string> = {
  bills: "view",
  legislative_votes: "vote",
  legislative_sessions: "session",
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  return n;
};
function link(text: string, url: string) {
  const a = node("a", text);
  a.href = url;
  return a;
}
async function browse(table: string, args: Record<string, unknown> = {}) {
  const snapshot = await getPublicProfileSnapshot();
  if (snapshot) return browseProfileLegislation(snapshot, table, args);
  const { data, error } = await getSupabase().rpc("browse_legislation", {
    p_table: table,
    ...args,
  });
  if (error) throw error;
  return data as { rows: LegislativeRow[]; total: number };
}
function reference(row: LegislativeRow, field: string, text?: string) {
  const definition = Object.values(legislativeResources)
    .flatMap((resource) => resource.fields)
    .find((item) => item.name === field && item.reference);
  const path = definition?.reference && paths[definition.reference];
  const url =
    row.links?.[field] ??
    (path
      ? `/legislation/${path}/?id=${row[field]}`
      : field === "event_id"
        ? `/calendar/view/?id=${row[field]}`
        : undefined);
  const label = text ?? relationLabel(row, field);
  return url ? link(label, url) : document.createTextNode(label);
}
function badge(value: unknown, className = "") {
  const span = node("span", humanize(value));
  span.className = `legislation-badge ${className}`;
  return span;
}
export function legislativeCard(
  table: string,
  row: LegislativeRow,
  heading: "h1" | "h3" = "h3",
  omit: string[] = [],
) {
  const card = node("article");
  card.className =
    heading === "h1" ? "legislation-heading" : "org-card legislation-record";
  const label = legislativeTitle(table, row, omit);
  const title = node(heading);
  const primary: Record<string, string> = {
    bill_sponsorships: omit.includes("office_term_id")
      ? "bill_id"
      : "office_term_id",
    legislative_vote_choices: "office_term_id",
    bill_positions: "person_id",
    article_bills: "article_id",
    legislative_vote_bills: omit.includes("vote_id") ? "bill_id" : "vote_id",
    bill_relationships: "related_bill_id",
    legislative_body_memberships: "office_term_id",
    legislative_event_links: "event_id",
  };
  const titleField = primary[table];
  title.append(
    paths[table] && heading !== "h1"
      ? link(label, `/legislation/${paths[table]}/?id=${row.id}`)
      : titleField
        ? reference(row, titleField, label)
        : document.createTextNode(label),
  );
  card.append(title);
  const states = node("div");
  states.className = "legislation-states";
  if (table === "bills" && row.jurisdiction) {
    states.append(badge(row.jurisdiction === "state" ? `${row.state_name} · State` :
      row.jurisdiction === "federal" ? "Federal" : "Jurisdiction not yet classified"));
  }
  for (const field of ["status", "outcome", "role", "position", "choice"]) {
    if (!row[field]) continue;
    const text =
      field === "choice"
        ? `Voted ${row.source_choice || humanize(row.choice)}`
        : field === "outcome"
          ? `Result: ${humanize(row.outcome).toLowerCase()}`
          : humanize(row[field]);
    const state = badge(text, field === "choice" ? "legislation-choice" : "");
    states.append(state);
  }
  if (states.childElementCount) card.append(states);
  if (row.summary) card.append(node("p", String(row.summary)));
  if (row.source_status) {
    const status = node("p", String(row.source_status));
    status.className = "legislation-status";
    card.append(status);
  }
  if (row.description && table !== "bill_actions")
    card.append(node("p", String(row.description)));
  if (table === "legislative_votes" && row.category === "cloture") {
    card.append(
      node(
        "p",
        "Cloture is a vote to limit debate on the stated question. It is not final passage of the bill.",
      ),
    );
  }
  const metadata = node("dl");
  metadata.className = "legislation-meta";
  const secondary = node("dl");
  secondary.className = "legislation-meta";
  const hidden = new Set([
    ...omit,
    titleField,
    "title",
    "name",
    "question",
    "summary",
    "description",
    "source_status",
    "source_url",
    "text_url",
    "source_id",
    "source_system",
    "retrieved_at",
    "visibility",
    "numbering_context",
    "sequence",
    "status",
    "outcome",
    "role",
    "position",
    "choice",
    "coverage",
    "reported_yes",
    "reported_no",
    "reported_other",
    "membership_review_note",
    ...(row.occurred_at ? ["occurred_on"] : []),
    ...(table === "legislative_votes" ? ["threshold"] : []),
    ...(table === "bills" ||
    table === "bill_versions" ||
    table === "legislative_sessions"
      ? ["identifier"]
      : []),
    ...(row.choice ? ["source_choice"] : []),
  ]);
  const labels: Record<string, string> = {
    occurred_on: "Date",
    occurred_at: "Date & time",
    introduced_on: "Introduced",
    published_on: "Published",
    starts_on: "From",
    ends_on: "Through",
    body_id: "Chamber or committee",
    term_id: "Legislative term",
    office_term_id: "Office service",
    source_role: "Role in source",
    threshold: "Required to pass",
    identifier: table === "legislative_votes" ? "Vote number" : "Identifier",
  };
  for (const field of legislativeResources[table].fields) {
    const value = row[field.name];
    if (hidden.has(field.name) || value == null || value === "") continue;
    if (field.reference && !relationLabel(row, field.name)) continue;
    const pair = node("div");
    pair.append(node("dt", labels[field.name] ?? humanize(field.label)));
    const dd = node("dd");
    dd.append(
      field.reference
        ? reference(row, field.name)
        : document.createTextNode(
            field.type === "date" || field.type === "timestamptz"
              ? legislativeDate(value, field.type === "timestamptz")
              : humanize(value),
          ),
    );
    pair.append(dd);
    (table === "legislative_votes" &&
    heading === "h1" &&
    !["body_id", "identifier", "occurred_on", "occurred_at"].includes(
      field.name,
    )
      ? secondary
      : metadata
    ).append(pair);
  }
  // A member heading uses only the name; retain the exact historical office service below it.
  if (titleField === "office_term_id") {
    const service = relationLabel(row, "office_term_id")
      .split(" · ")
      .slice(1)
      .map((part) =>
        /^\d{4}-\d{2}-\d{2}$/.test(part)
          ? "From " + legislativeDate(part)
          : part,
      )
      .join(" · ");
    if (service) {
      const pair = node("div");
      pair.append(node("dt", "Office service"), node("dd", service));
      metadata.prepend(pair);
    }
  }
  if (metadata.childElementCount) card.append(metadata);
  if (secondary.childElementCount) {
    const details = node("details");
    details.className = "legislation-extra";
    details.append(node("summary", "More vote details"), secondary);
    card.append(details);
  }
  if (row.coverage && heading !== "h1")
    card.append(node("p", coverageLabel(row.coverage)));
  const footer = node("div");
  footer.className = "legislation-links";
  if (row.text_url) footer.append(link("Read bill text", String(row.text_url)));
  if (
    row.source_url &&
    row.source_url !== row.text_url &&
    row.source_url !== (titleField ? row.links?.[titleField] : undefined)
  )
    footer.append(link("View source", String(row.source_url)));
  footer.append(historyLink(table, row.id));
  card.append(footer);
  return card;
}

function voteSummary(row: LegislativeRow) {
  const summary = node("section");
  summary.className = "legislation-tally";
  summary.append(node("h2", "Official result"));
  const totals = node("dl");
  totals.className = "legislation-totals";
  for (const [field, label] of [
    ["reported_yes", "Yes"],
    ["reported_no", "No"],
    ["reported_other", "Other"],
  ]) {
    const pair = node("div");
    pair.append(
      node("dt", label),
      node("dd", row[field] == null ? "Not reported" : String(row[field])),
    );
    totals.append(pair);
  }
  summary.append(totals);
  if (row.threshold)
    summary.append(node("p", `Required to pass: ${row.threshold}`));
  const coverage = node("div");
  coverage.className = "legislation-coverage";
  coverage.append(
    node("strong", coverageLabel(row.coverage)),
    node(
      "p",
      "Official totals describe the full vote. The member records below show only the choices available here. Missing choices are unknown, not absences.",
    ),
  );
  summary.append(coverage);
  return summary;
}

export async function initLegislationBrowse() {
  const root = document.querySelector<HTMLElement>(
    "[data-legislation-browser]",
  )!;
  const table = root.dataset.legislationBrowser || "bills";
  const form = root.querySelector<HTMLFormElement>("[data-search]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const list = root.querySelector<HTMLElement>("[data-results]")!;
  const more = root.querySelector<HTMLButtonElement>("[data-more]")!;
  let offset = 0;
  let generation = 0;
  try {
    const directory = await readLegislationDirectory(root.dataset.legislationDirectory, getSupabase());
    const select = form.elements.namedItem("term_id") as HTMLSelectElement;
    const jurisdiction = form.elements.namedItem("jurisdiction") as HTMLSelectElement | null;
    const state = form.elements.namedItem("state") as HTMLSelectElement | null;
    const sort = form.elements.namedItem("sort") as HTMLSelectElement | null;
    const allTerms: LegislativeRow[] = directory?.terms ?? [];
    for (let offset = 0; !directory; offset += 100) {
      const terms = await browse("legislative_terms", {
        p_limit: 100,
        p_offset: offset,
      });
      allTerms.push(...terms.rows);
      if (offset + 100 >= terms.total) break;
    }
    for (const name of [...new Set(allTerms.filter((term) => term.jurisdiction === "state")
      .map((term) => String(term.state_name)))].sort()) state?.add(new Option(name, name));
    function updateTerms() {
      const previous = select.value;
      select.replaceChildren(new Option("All terms", ""));
      for (const term of allTerms) {
        if (jurisdiction?.value && term.jurisdiction !== jurisdiction.value) continue;
        if (state?.value && term.state_name !== state.value) continue;
        select.add(new Option(recordLabel(term), term.id));
      }
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
      if (state) state.disabled = jurisdiction?.value === "federal" || jurisdiction?.value === "unspecified";
    }
    updateTerms();
    async function load(reset = false) {
      const request = ++generation;
      if (reset) {
        offset = 0;
        list.replaceChildren();
        more.hidden = true;
      }
      status.textContent = "Loading…";
      more.disabled = true;
      try {
        const args = {
          p_query: (form.elements.namedItem("query") as HTMLInputElement).value,
          p_filters: select.value ? { term_id: select.value } : {},
          p_offset: offset,
        };
        const data = directory ? table === "bills" ? await readStaticBills(directory, {query:args.p_query,term:select.value,jurisdiction:jurisdiction?.value,state:state?.value,sort:sort?.value,offset}) : browseStaticSessions(directory.sessions,args.p_query,select.value,offset) : table === "bills" ? await (async () => {
          const { data, error } = await getSupabase().rpc("browse_bills", {
            p_query: args.p_query, p_term_id: select.value || null,
            p_jurisdiction: jurisdiction?.value || "", p_state: state?.value || "",
            p_sort: sort?.value || "newest", p_offset: offset,
          });
          if (error) throw error;
          return data as { rows: LegislativeRow[]; total: number };
        })() : await browse(table, args);
        if (request !== generation) return;
        list.append(...data.rows.map((row) => legislativeCard(table, row)));
        offset += data.rows.length;
        more.hidden = offset >= data.total;
        status.textContent = data.total === 0 ? "No records match these filters. Try another jurisdiction or term." :
          `${data.total} ${table === "bills" ? "bills and resolutions" : "sessions"}.`;
      } catch (error) {
        if (request !== generation) return;
        status.textContent = `Could not load records: ${(error as Error).message}`;
      } finally {
        if (request === generation) more.disabled = false;
      }
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      void load(true);
    };
    form.onchange = (event) => {
      if (!(event.target instanceof HTMLSelectElement)) return;
      if (event.target === jurisdiction && state) state.value = "";
      updateTerms();
      void load(true);
    };
    more.onclick = () => void load();
    await load(true);
  } catch (error) {
    status.textContent = `Could not load records: ${(error as Error).message}`;
  }
}
async function section(
  root: HTMLElement,
  table: string,
  filters: Record<string, string>,
  context: Record<string, unknown> = {},
) {
  const group = node("section");
  group.className = "legislation-section";
  group.id = filters.office_term_id
    ? `${table}-${filters.office_term_id}`
    : table;
  const heading = node(
    "h2",
    table === "legislative_vote_bills" && filters.bill_id
      ? "Votes on this bill"
      : legislativeResources[table].label,
  );
  group.append(heading);
  const status = node("p", "Loading…");
  status.setAttribute("role", "status");
  const list = node("div");
  list.className = "org-list";
  const more = node("button", "Load more");
  more.hidden = true;
  group.append(status, list, more);
  root.append(group);
  let offset = 0;
  async function load() {
    more.disabled = true;
    try {
      const data = await browse(table, {
        p_filters: filters,
        p_offset: offset,
        ...context,
      });
      list.append(
        ...data.rows.map((row) =>
          legislativeCard(table, row, "h3", Object.keys(filters)),
        ),
      );
      offset += data.rows.length;
      status.textContent = data.total
        ? ""
        : "No records added here yet. This does not establish that none exist.";
      group.classList.toggle("legislation-empty", data.total === 0);
      heading.textContent =
        (table === "legislative_vote_bills" && filters.bill_id
          ? "Votes on this bill"
          : legislativeResources[table].label) +
        (data.total ? " (" + data.total + ")" : "");
      more.hidden = offset >= data.total;
      more.textContent = "Load more";
    } catch (error) {
      status.textContent = "These records could not be loaded. Try again.";
      more.textContent = "Try again";
      more.hidden = false;
    } finally {
      more.disabled = false;
    }
  }
  more.onclick = () => void load();
  await load();
}
export async function initLegislationView() {
  const root = document.querySelector<HTMLElement>("[data-legislation-view]")!;
  const table = root.dataset.legislationView!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const detail = root.querySelector<HTMLElement>("[data-detail]")!;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    status.textContent = "No record selected.";
    return;
  }
  try {
    await getSupabase().auth.getSession();
    const data = await browse(table, { p_id: id });
    const row = data.rows[0];
    if (!row) {
      status.textContent = "Record unavailable.";
      return;
    }
    status.textContent = "";
    document.title = legislativeTitle(table, row) + " · Civic Pulse";
    detail.append(legislativeCard(table, row, "h1"));
    const navigation = node("nav");
    navigation.className = "legislation-navigation";
    navigation.setAttribute("aria-label", "On this record");
    const addSections = async (
      children: string[],
      filters: Record<string, string>,
      context: Record<string, unknown> = {},
    ) => {
      for (const child of children)
        navigation.append(
          link(
            child === "legislative_vote_bills" && table === "bills"
              ? "Votes"
              : legislativeResources[child].label,
            "#" + child,
          ),
        );
      detail.append(navigation);
      await Promise.all(
        children.map((child) => section(detail, child, filters, context)),
      );
    };
    if (table === "bills") {
      await addSections(
        [
          "bill_actions",
          "legislative_vote_bills",
          "bill_sponsorships",
          "bill_versions",
          "article_bills",
          "bill_positions",
          "bill_amendments",
          "bill_relationships",
        ],
        { bill_id: id },
        { p_bill_id: id },
      );
    } else if (table === "legislative_votes") {
      const summary = voteSummary(row);
      detail.append(summary);
      const imported = node("p", "Loading member record count…");
      imported.setAttribute("role", "status");
      summary.querySelector(".legislation-coverage")!.append(imported);
      const totalsTask = async () => {
        const { data: totals, error } = await getSupabase().rpc(
          "get_legislative_vote_totals",
          { p_vote_id: id },
        );
        if (error) {
          imported.textContent =
            "Member totals unavailable. Reload to try again.";
          return;
        }
        if (!totals) {
          imported.textContent = "Member totals unavailable.";
          return;
        }
        imported.textContent =
          totals.recorded.total +
          " member " +
          (totals.recorded.total === 1 ? "choice" : "choices") +
          " available: " +
          totals.recorded.yes +
          " yes, " +
          totals.recorded.no +
          " no, " +
          totals.recorded.other +
          " other.";
        if (totals.matches_reported === false)
          imported.append(
            document.createTextNode(
              " These records differ from the official totals; some records may be missing or not public.",
            ),
          );
      };
      await Promise.all([
        totalsTask(),
        addSections(
          ["legislative_vote_choices", "legislative_vote_bills"],
          { vote_id: id },
          { p_vote_id: id },
        ),
      ]);
    } else {
      await addSections(
        [
          "bills",
          "legislative_votes",
          "bill_actions",
          "legislative_event_links",
        ],
        { session_id: id },
      );
    }
  } catch (error) {
    status.textContent = `Could not load record: ${(error as Error).message}`;
  }
}
export async function loadPersonLegislation(personId: string) {
  const root = document.querySelector<HTMLElement>("[data-person-legislation]");
  if (!root) return;
  root.hidden = false;
  root.classList.add("legislation-profile");
  root.replaceChildren(node("h2", "Legislative record"));
  root.append(
    node(
      "p",
      "Recorded legislative votes and sponsorships during this person’s service in office.",
    ),
  );
  const controls = node("form");
  controls.className = "org-form";
  const selects: Record<string, HTMLSelectElement> = {};
  for (const [name, title] of [
    ["term_id", "Legislative term"],
    ["session_id", "Session"],
    ["body_id", "Chamber or committee"],
  ]) {
    const label = node("label");
    label.className = "field";
    const select = node("select");
    select.add(new Option("All", ""));
    selects[name] = select;
    label.append(node("span", title), select);
    controls.append(label);
  }
  const billQuery = node("input");
  billQuery.maxLength = 500;
  const billLabel = node("label");
  billLabel.className = "field";
  billLabel.append(node("span", "Bill title or identifier"), billQuery);
  controls.append(billLabel);
  const category = node("input");
  category.placeholder = "e.g. passage";
  const categoryLabel = node("label");
  categoryLabel.className = "field";
  categoryLabel.append(node("span", "Vote category"), category);
  controls.append(categoryLabel, node("button", "Filter votes"));
  const filters = node("details");
  filters.className = "legislation-filters";
  filters.append(node("summary", "Filter legislative votes"), controls);
  const reset = node("button", "Clear filters");
  reset.type = "reset";
  controls.append(reset);
  root.append(filters);
  const status = node("p", "Loading…");
  status.setAttribute("role", "status");
  const list = node("div");
  list.className = "org-list";
  const previousPage = node("button", "Previous votes");
  const retry = node("button", "Retry legislative history");
  retry.hidden = true;
  const nextPage = node("button", "Next votes");
  const pageLabel = node("span");
  const pagination = node("nav");
  pagination.className = "org-form-actions";
  pagination.setAttribute("aria-label", "Legislative vote pages");
  pagination.append(previousPage, pageLabel, nextPage);
  pagination.hidden = true;
  root.append(status, retry, list, pagination);
  const pageSize = 20;
  let offset = 0;
  let generation = 0;
  let displayedTotal = 0;
  let pageLoaded = false;
  const restoreNavigation = () => {
    previousPage.disabled = !pageLoaded || offset === 0;
    nextPage.disabled = !pageLoaded || offset + pageSize >= displayedTotal;
  };
  try {
    for (const [name, table] of [
      ["term_id", "legislative_terms"],
      ["session_id", "legislative_sessions"],
      ["body_id", "legislative_bodies"],
    ])
      for (let start = 0; ; start += 100) {
        const data = await browse(table, { p_offset: start, p_limit: 100 });
        for (const row of data.rows)
          selects[name].add(new Option(recordLabel(row), row.id));
        if (start + 100 >= data.total) break;
      }
    async function load(reset = false, requestedOffset = offset) {
      const request = ++generation;
      if (reset) {
        requestedOffset = 0;
      }
      previousPage.disabled = true;
      nextPage.disabled = true;
      retry.hidden = true;
      try {
        const args = {
            p_person_id: personId,
            p_term_id: selects.term_id.value || null,
            p_bill_query: billQuery.value.trim() || null,
            p_session_id: selects.session_id.value || null,
            p_body_id: selects.body_id.value || null,
            p_category: category.value.trim() || null,
            p_offset: requestedOffset,
            p_limit: pageSize,
          };
        const snapshot = await getPublicProfileSnapshot();
        const { data, error } = snapshot ? {data: await readProfileVoteGroups(snapshot,args),error:null} : await getSupabase().rpc("get_person_legislative_bill_groups",args);
        if (error) throw error;
        if (request !== generation) return;
        list.replaceChildren();
        for (const row of data.rows) {
          const card = node("article");
          card.className = "org-card legislation-record";
          const title = node("h3");
          title.append(
            link(
              row.bill_id
                ? `${row.bill_identifier} — ${row.bill_title}`
                : row.question,
              row.bill_id
                ? `/legislation/view/?id=${row.bill_id}`
                : `/legislation/vote/?id=${row.vote_id}`,
            ),
          );
          const question = node("p");
          question.append(
            "Latest matching vote: ",
            link(row.question, `/legislation/vote/?id=${row.vote_id}`),
          );
          card.append(
            title,
            ...(row.bill_id ? [question] : []),
            badge(
              "Voted " + (row.source_choice || humanize(row.choice)),
              "legislation-choice",
            ),
          );
          card.append(
            node(
              "p",
              [legislativeDate(row.occurred_on), row.office_name, row.district]
                .filter(Boolean)
                .join(" · "),
            ),
          );
          card.append(
            node(
              "p",
              "Vote result: " +
                humanize(row.outcome).toLowerCase() +
                " · " +
                coverageLabel(row.coverage),
            ),
          );
          if (row.bill_id) {
            const additional = row.vote_count - 1;
            card.append(
              node(
                "p",
                `${additional} other matching ${additional === 1 ? "vote" : "votes"} on this bill or resolution.`,
              ),
              link(
                "View bill details and vote history",
                `/legislation/view/?id=${row.bill_id}#legislative_vote_bills`,
              ),
            );
          }
          list.append(card);
        }
        offset = requestedOffset;
        displayedTotal = data.total;
        pageLoaded = true;
        status.textContent = `${data.total} ${data.total === 1 ? "entry" : "entries"}, grouped by bill or resolution. Latest matching vote shown; counts follow the selected filters. Attendance roll calls are excluded. Votes without a linked bill are listed separately. Missing records do not indicate absence or opposition.`;
        pageLabel.textContent = `Page ${Math.floor(offset / pageSize) + 1} of ${Math.max(1, Math.ceil(data.total / pageSize))}`;
        pagination.hidden = data.total <= pageSize;
        restoreNavigation();
      } catch (error) {
        if (request !== generation) return;
        status.textContent = "Could not load votes. Please try again.";
        restoreNavigation();
        retry.hidden = false;
        retry.onclick = () => void load(reset, requestedOffset);
      }
    }
    controls.onreset = (event) => {
      event.preventDefault();
      for (const select of Object.values(selects)) select.value = "";
      billQuery.value = "";
      category.value = "";
      void load(true);
    };
    controls.onsubmit = (event) => {
      event.preventDefault();
      void load(true);
    };
    previousPage.onclick = () => void load(false, Math.max(0, offset - pageSize));
    nextPage.onclick = () => void load(false, offset + pageSize);
    await load(true);
    // Service links are read through their existing visibility gate.
    const snapshot = await getPublicProfileSnapshot();
    const { data: terms, error } = snapshot ? {data:snapshot.officeTerms,error:null} : await getSupabase().rpc("get_office_terms", {
      p_person_id: personId,
    });
    if (error) throw error;
    for (const term of terms ?? [])
      await section(
        root,
        "bill_sponsorships",
        { office_term_id: term.id },
        { p_person_id: personId },
      );
  } catch (error) {
    status.textContent = "Could not load legislative history. Please try again.";
    retry.hidden = false;
    retry.onclick = () => void loadPersonLegislation(personId);
  }
}
