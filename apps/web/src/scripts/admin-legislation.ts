import {
  legislativeResources,
  recordLabel,
  type LegislativeRow,
} from "../lib/legislation";
import {
  humanize,
  legislativeTitle,
  legislativeDate,
} from "../lib/legislation-display";
import { getSupabase } from "../lib/supabase";
import { initLegislativeImport } from "./legislative-import";

export async function initLegislationAdmin() {
  const panel = document.querySelector<HTMLElement>("[data-admin-panel]")!;
  const resource =
    document.querySelector<HTMLSelectElement>("[data-resource]")!;
  const form = document.querySelector<HTMLFormElement>(
    "[data-legislation-form]",
  )!;
  const fields = document.querySelector<HTMLElement>("[data-fields]")!;
  const message = document.querySelector<HTMLElement>("[data-message]")!;
  const list = document.querySelector<HTMLElement>("[data-records]")!;
  const previous =
    document.querySelector<HTMLButtonElement>("[data-previous]")!;
  const next = document.querySelector<HTMLButtonElement>("[data-next]")!;
  const supabase = getSupabase();
  const editor = document.querySelector<HTMLDetailsElement>("[data-editor]")!;
  const search = document.querySelector<HTMLFormElement>(
    "[data-record-search]",
  )!;
  const searchInput = search.elements.namedItem("query") as HTMLInputElement;
  const cancel = document.querySelector<HTMLButtonElement>("[data-cancel]")!;
  const formMessage = document.querySelector<HTMLElement>(
    "[data-form-message]",
  )!;
  let editing: string | null = null;
  let offset = 0;
  let generation = 0;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      location.replace("/signin/?next=/admin/legislation/");
      return;
    }
    const { data: admin, error } = await supabase.rpc("is_admin");
    if (error) throw error;
    document.querySelector("[data-admin-gate]")?.remove();
    if (!admin) {
      document.querySelector<HTMLElement>("[data-admin-denied]")!.hidden =
        false;
      return;
    }
    panel.hidden = false;
    for (const [key, value] of Object.entries(legislativeResources))
      resource.add(new Option(value.label, key));
    resource.value =
      new URLSearchParams(location.search).get("type") ?? "bills";
    if (!legislativeResources[resource.value]) resource.value = "bills";
    const referenceCache = new Map<string, Promise<LegislativeRow[]>>();
    initLegislativeImport(async () => {
      referenceCache.clear();
      await load();
    });
    function references(table: string): Promise<LegislativeRow[]> {
      if (!referenceCache.has(table))
        referenceCache.set(table, fetchReferences(table));
      const request = referenceCache.get(table)!;
      void request.catch(() => {
        if (referenceCache.get(table) === request) referenceCache.delete(table);
      });
      return request;
    }
    async function fetchReferences(table: string): Promise<LegislativeRow[]> {
      const rows: LegislativeRow[] = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order("id")
          .range(start, start + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      if (table === "office_terms") {
        const [people, offices] = await Promise.all([
          references("people"),
          references("offices"),
        ]);
        for (const row of rows)
          row.name = [
            people.find((p) => p.id === row.person_id)?.full_name,
            offices.find((o) => o.id === row.office_id)?.name,
            row.starts_on,
          ]
            .filter(Boolean)
            .join(" · ");
      }
      if (table === "legislative_bodies") {
        const orgs = await references("organizations");
        for (const row of rows)
          row.name = orgs.find((o) => o.id === row.organization_id)?.name;
      }
      return rows;
    }
    async function load(reset = true) {
      const request = ++generation;
      const table = resource.value;
      message.textContent = "Loading…";
      // A search can supersede the first load while reference pickers are still
      // loading. The winning request must finish the form before offering Edit.
      if (reset || fields.childElementCount === 0) {
        list.replaceChildren();
        editing = null;
        formMessage.textContent = "";
        fields.replaceChildren();
        editor.open = false;
        cancel.textContent = "Cancel";
        document.querySelector("[data-form-heading]")!.textContent =
          `Add record — ${legislativeResources[table].label}`;
        const fragment = document.createDocumentFragment();
        const core = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = "Record details";
        core.append(legend);
        const sources = document.createElement("details");
        sources.className = "legislation-source-fields";
        const sourceTitle = document.createElement("summary");
        sourceTitle.textContent = "Source & import details";
        sources.append(sourceTitle);
        const sourceFields = document.createElement("div");
        sources.append(sourceFields);
        fragment.append(core, sources);
        const help: Record<string, string> = {
          coverage:
            "Partial means only some member choices have been imported. Official totals are entered separately.",
          source_choice:
            "Copy the source’s wording, such as Yea or Nay. The choice field above is the normalized value.",
          source_role:
            "Copy the role from the source. Sponsorship does not by itself establish a vote or a position.",
          office_term_id:
            "Select the person’s service in office on the date of this record.",
          reported_yes:
            "Use the official tally, not the number of choices imported here.",
          threshold:
            "Describe what was required for this exact question to pass.",
          occurred_at:
            "Optional exact time, including a UTC offset or Z. The date remains required.",
          visibility:
            "Public: browsable. Unlisted: available by direct link. Private: restricted. Related records also follow their parent’s visibility.",
          numbering_context:
            "Use the scope in which this bill number is unique, such as congress or a special session.",
        };
        for (const field of legislativeResources[table].fields) {
          const label = document.createElement("label");
          label.className = "field";
          const title = document.createElement("span");
          title.textContent =
            humanize(field.label) + (field.required ? " *" : "");
          let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          if (field.reference || field.choices) {
            const select = document.createElement("select");
            select.add(new Option("Select…", ""));
            if (field.choices)
              for (const choice of field.choices)
                select.add(new Option(humanize(choice), choice));
            else
              for (const row of await references(field.reference!))
                select.add(
                  new Option(String(row.full_name ?? recordLabel(row)), row.id),
                );
            input = select;
          } else if (
            [
              "summary",
              "description",
              "question",
              "membership_review_note",
              "source_status",
            ].includes(field.name)
          ) {
            input = document.createElement("textarea");
            input.rows = 3;
            label.classList.add("legislation-field-wide");
          } else {
            input = document.createElement("input");
            input.type =
              field.type === "date"
                ? "date"
                : field.type === "integer"
                  ? "number"
                  : field.name.endsWith("url")
                    ? "url"
                    : "text";
            if (field.type === "timestamptz")
              input.placeholder = "2026-01-15T14:00:00Z";
          }
          input.name = field.name;
          input.required = !!field.required;
          if (field.default) input.value = field.default;
          label.append(title, input);
          if (help[field.name]) {
            const hint = document.createElement("small");
            hint.id = "help-" + field.name;
            hint.textContent = help[field.name];
            input.setAttribute("aria-describedby", hint.id);
            label.append(hint);
          }
          ([
            "source_url",
            "source_system",
            "source_id",
            "retrieved_at",
          ].includes(field.name)
            ? sourceFields
            : core
          ).append(label);
        }
        if (request !== generation) return;
        fields.replaceChildren(fragment);
      }
      const { data, error } = await supabase.rpc("browse_legislation", {
        p_table: table,
        p_limit: 25,
        p_offset: offset,
        p_query: searchInput.value.trim(),
      });
      if (error) throw error;
      if (request !== generation) return;
      list.replaceChildren();
      for (const row of data.rows as LegislativeRow[]) {
        const card = document.createElement("article");
        card.className = "org-row legislation-admin-row";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = legislativeTitle(table, row);
        info.append(title);
        const caption = document.createElement("p");
        caption.textContent = [
          legislativeDate(
            row.occurred_on ?? row.starts_on ?? row.introduced_on,
          ),
          humanize(row.status ?? row.role ?? row.choice),
          humanize(row.visibility),
        ]
          .filter(Boolean)
          .join(" · ");
        info.append(caption);
        const edit = document.createElement("button");
        edit.textContent = "Edit";
        edit.onclick = () => {
          editing = row.id;
          for (const field of legislativeResources[table].fields) {
            const input = form.elements.namedItem(
              field.name,
            ) as HTMLInputElement;
            input.value = String(row[field.name] ?? "");
          }
          document.querySelector("[data-form-heading]")!.textContent =
            "Edit: " + legislativeTitle(table, row);
          cancel.textContent = "Cancel editing";
          editor.open = true;
          editor.scrollIntoView({ block: "start" });
          form
            .querySelector<HTMLInputElement>("input,select,textarea")
            ?.focus({ preventScroll: true });
        };
        const remove = document.createElement("button");
        remove.textContent = "Delete";
        remove.onclick = async () => {
          if (
            !confirm(
              `Delete ${recordLabel(row)}? Referenced records must be removed first.`,
            )
          )
            return;
          const { error } = await supabase
            .from(table)
            .delete()
            .eq("id", row.id);
          if (error) {
            message.textContent = error.message;
            return;
          }
          referenceCache.clear();
          await load(false);
        };
        const actions = document.createElement("div");
        actions.className = "org-form-actions";
        actions.append(edit, remove);
        edit.setAttribute("aria-label", "Edit " + legislativeTitle(table, row));
        remove.setAttribute(
          "aria-label",
          "Delete " + legislativeTitle(table, row),
        );
        card.append(info, actions);
        list.append(card);
      }
      previous.disabled = offset === 0;
      next.disabled = offset + 25 >= data.total;
      document.querySelector("[data-page]")!.textContent =
        `${data.total} ${data.total === 1 ? "record" : "records"} · Page ${Math.floor(offset / 25) + 1}`;
      message.textContent = data.total
        ? ""
        : searchInput.value
          ? "No matching records. Clear the search to see all records."
          : "No records yet.";
    }
    const handle = (task: Promise<unknown>) =>
      void task.catch((error) => {
        message.textContent = error.message ?? "Could not load records.";
      });
    resource.onchange = () => {
      offset = 0;
      searchInput.value = "";
      handle(load());
    };
    search.onsubmit = (event) => {
      event.preventDefault();
      offset = 0;
      handle(load(false));
    };
    search.onreset = (event) => {
      event.preventDefault();
      searchInput.value = "";
      offset = 0;
      handle(load(false));
    };
    previous.onclick = () => {
      offset = Math.max(0, offset - 25);
      handle(load(false));
    };
    next.onclick = () => {
      offset += 25;
      handle(load(false));
    };
    document.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick = () =>
      handle(load());
    form.onsubmit = async (event) => {
      event.preventDefault();
      formMessage.textContent = "Saving…";
      const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
      button.disabled = true;
      resource.disabled = true;
      cancel.disabled = true;
      try {
        const values: Record<string, unknown> = {};
        for (const field of legislativeResources[resource.value].fields) {
          const value = (
            form.elements.namedItem(field.name) as HTMLInputElement
          ).value.trim();
          if (value)
            values[field.name] =
              field.type === "integer" ? Number(value) : value;
          else if (editing || !field.required) values[field.name] = null;
        }
        const query = editing
          ? supabase.from(resource.value).update(values).eq("id", editing)
          : supabase.from(resource.value).insert(values);
        const { error } = await query;
        if (error) throw error;
        referenceCache.clear();
        await load();
        message.textContent = "Record saved.";
      } catch (error) {
        formMessage.textContent = (error as Error).message;
      } finally {
        button.disabled = false;
        resource.disabled = false;
        cancel.disabled = false;
      }
    };
    form.addEventListener(
      "invalid",
      (event) => {
        const input = event.target as HTMLElement;
        const disclosure = input.closest("details");
        if (disclosure) disclosure.open = true;
      },
      true,
    );
    await load();
  } catch (error) {
    (document.querySelector("[data-admin-gate]") ?? message).textContent = (
      error as Error
    ).message;
  }
}
