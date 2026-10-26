import { getSupabase } from "../lib/supabase";
import {
  legislativeResources,
  recordLabel,
  type LegislativeRow,
} from "../lib/legislation";
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
  const { data, error } = await getSupabase().rpc("browse_legislation", {
    p_table: table,
    ...args,
  });
  if (error) throw error;
  return data as { rows: LegislativeRow[]; total: number };
}
export function legislativeCard(
  table: string,
  row: LegislativeRow,
  heading: "h1" | "h3" = "h3",
) {
  const card = node("article");
  card.className = "org-card";
  const title = node(heading);
  const label = recordLabel(row);
  title.append(
    paths[table] && heading !== "h1"
      ? link(label, `/legislation/${paths[table]}/?id=${row.id}`)
      : document.createTextNode(label),
  );
  card.append(title);
  for (const field of legislativeResources[table].fields) {
    const value = row[field.name];
    if (
      value == null ||
      value === "" ||
      [
        "title",
        "name",
        "question",
        "source_system",
        "source_id",
        "retrieved_at",
        "visibility",
        "numbering_context",
      ].includes(field.name)
    )
      continue;
    const p = node("p");
    if (field.reference) {
      const label = row.labels?.[field.name];
      if (!label) continue;
      const path = paths[field.reference];
      const url =
        row.links?.[field.name] ??
        (field.reference === "events"
          ? `/calendar/view/?id=${value}`
          : field.reference === "people"
            ? `/people/view/?id=${value}`
            : undefined);
      p.append(
        node("strong", `${field.label}: `),
        path
          ? link(label, `/legislation/${path}/?id=${value}`)
          : url
            ? link(label, url)
            : document.createTextNode(label),
      );
    } else if (field.name.endsWith("url")) {
      p.append(
        link(
          field.name === "text_url" ? "Read official text" : "Official source",
          String(value),
        ),
      );
    } else
      p.textContent = `${field.label}: ${String(value).replaceAll("_", " ")}`;
    card.append(p);
  }
  card.append(historyLink(table, row.id));
  return card;
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
    await getSupabase().auth.getSession();
    const select = form.elements.namedItem("term_id") as HTMLSelectElement;
    for (let offset = 0; ; offset += 100) {
      const terms = await browse("legislative_terms", {
        p_limit: 100,
        p_offset: offset,
      });
      for (const row of terms.rows)
        select.add(new Option(recordLabel(row), row.id));
      if (offset + 100 >= terms.total) break;
    }
    async function load(reset = false) {
      const request = ++generation;
      if (reset) {
        offset = 0;
        list.replaceChildren();
      }
      status.textContent = "Loading…";
      more.disabled = true;
      try {
        const data = await browse(table, {
          p_query: (form.elements.namedItem("query") as HTMLInputElement).value,
          p_filters: select.value ? { term_id: select.value } : {},
          p_offset: offset,
        });
        if (request !== generation) return;
        list.append(...data.rows.map((row) => legislativeCard(table, row)));
        offset += data.rows.length;
        more.hidden = offset >= data.total;
        status.textContent = `${data.total} ${table === "bills" ? "bills and resolutions" : "sessions"}.`;
      } catch (error) {
        status.textContent = `Could not load records: ${(error as Error).message}`;
      } finally {
        more.disabled = false;
      }
    }
    form.onsubmit = (event) => {
      event.preventDefault();
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
  group.append(node("h2", legislativeResources[table].label));
  const status = node("p", "Loading…");
  status.setAttribute("role", "status");
  const list = node("div");
  list.className = "org-list";
  const more = node("button", "Load more");
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
      list.append(...data.rows.map((row) => legislativeCard(table, row)));
      offset += data.rows.length;
      status.textContent = data.total
        ? `${data.total} records`
        : "None recorded.";
      more.hidden = offset >= data.total;
    } catch (error) {
      status.textContent = `Could not load records: ${(error as Error).message}`;
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
    detail.append(legislativeCard(table, row, "h1"));
    if (table === "bills") {
      for (const child of [
        "bill_sponsorships",
        "bill_positions",
        "bill_versions",
        "bill_amendments",
        "bill_actions",
        "legislative_vote_bills",
        "article_bills",
        "bill_relationships",
      ])
        await section(detail, child, { bill_id: id }, { p_bill_id: id });
    } else if (table === "legislative_votes") {
      detail.append(
        node(
          "p",
          "Choices describe the exact question above. Missing choices are unknown, not absences. Official totals may differ from the visible or imported member records.",
        ),
      );
      const { data: totals, error } = await getSupabase().rpc(
        "get_legislative_vote_totals",
        { p_vote_id: id },
      );
      if (error) throw error;
      if (totals) {
        detail.append(
          node(
            "p",
            `Visible recorded choices: ${totals.recorded.yes} yes, ${totals.recorded.no} no, ${totals.recorded.other} other.`,
          ),
        );
        if (totals.matches_reported === false)
          detail.append(
            node(
              "p",
              "Recorded choices differ from official totals. The import may be incomplete or some member records may not be public.",
            ),
          );
      }
      await section(
        detail,
        "legislative_vote_bills",
        { vote_id: id },
        { p_vote_id: id },
      );
      await section(
        detail,
        "legislative_vote_choices",
        { vote_id: id },
        { p_vote_id: id },
      );
    } else {
      await section(detail, "bills", { session_id: id });
      await section(detail, "legislative_votes", { session_id: id });
      await section(detail, "bill_actions", { session_id: id });
      await section(detail, "legislative_event_links", { session_id: id });
    }
  } catch (error) {
    status.textContent = `Could not load record: ${(error as Error).message}`;
  }
}
export async function loadPersonLegislation(personId: string) {
  const root = document.querySelector<HTMLElement>("[data-person-legislation]");
  if (!root) return;
  root.hidden = false;
  root.replaceChildren(node("h2", "Legislative record"));
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
  root.append(controls);
  const status = node("p", "Loading…");
  status.setAttribute("role", "status");
  const list = node("div");
  list.className = "org-list";
  const more = node("button", "Load more");
  root.append(status, list, more);
  let offset = 0;
  let generation = 0;
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
    async function load(reset = false) {
      const request = ++generation;
      if (reset) {
        offset = 0;
        list.replaceChildren();
      }
      more.disabled = true;
      try {
        const { data, error } = await getSupabase().rpc(
          "get_person_legislative_record",
          {
            p_person_id: personId,
            p_term_id: selects.term_id.value || null,
            p_bill_query: billQuery.value.trim() || null,
            p_session_id: selects.session_id.value || null,
            p_body_id: selects.body_id.value || null,
            p_category: category.value.trim() || null,
            p_offset: offset,
          },
        );
        if (error) throw error;
        if (request !== generation) return;
        for (const row of data.rows) {
          const card = node("article");
          card.className = "org-card";
          card.append(
            link(row.question, `/legislation/vote/?id=${row.vote_id}`),
            node(
              "p",
              `${row.occurred_on} · ${row.office_name} ${row.district} · ${row.choice} (${row.source_choice}) · ${row.outcome}`,
            ),
            node("p", `Record coverage: ${row.coverage}`),
          );
          for (const bill of row.bills)
            card.append(
              link(
                `${bill.identifier} — ${bill.title}`,
                `/legislation/view/?id=${bill.id}`,
              ),
            );
          list.append(card);
        }
        offset += data.rows.length;
        status.textContent = `${data.total} recorded choices. Missing records do not indicate absence or opposition.`;
        more.hidden = offset >= data.total;
      } catch (error) {
        status.textContent = `Could not load votes: ${(error as Error).message}`;
      } finally {
        more.disabled = false;
      }
    }
    controls.onsubmit = (event) => {
      event.preventDefault();
      void load(true);
    };
    more.onclick = () => void load();
    await load(true);
    // Service links are read through their existing visibility gate.
    const { data: terms, error } = await getSupabase().rpc("get_office_terms", {
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
    status.textContent = `Could not load legislative history: ${(error as Error).message}`;
  }
}
