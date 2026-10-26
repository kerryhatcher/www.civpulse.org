import {
  legislativeResources,
  recordLabel,
  type LegislativeRow,
} from "../lib/legislation";
import { getSupabase } from "../lib/supabase";

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
    async function references(table: string): Promise<LegislativeRow[]> {
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
      if (reset) {
        editing = null;
        fields.replaceChildren();
        document.querySelector("[data-form-heading]")!.textContent =
          `Add ${legislativeResources[table].label.toLowerCase()}`;
        const fragment = document.createDocumentFragment();
        for (const field of legislativeResources[table].fields) {
          const label = document.createElement("label");
          label.className = "field";
          const title = document.createElement("span");
          title.textContent = field.label + (field.required ? " *" : "");
          let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          if (field.reference || field.choices) {
            const select = document.createElement("select");
            select.add(new Option("Select…", ""));
            if (field.choices)
              for (const choice of field.choices)
                select.add(new Option(choice.replaceAll("_", " "), choice));
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
            ].includes(field.name)
          ) {
            input = document.createElement("textarea");
            input.rows = 3;
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
          fragment.append(label);
        }
        if (request !== generation) return;
        fields.replaceChildren(fragment);
      }
      const { data, error } = await supabase.rpc("browse_legislation", {
        p_table: table,
        p_limit: 25,
        p_offset: offset,
      });
      if (error) throw error;
      if (request !== generation) return;
      list.replaceChildren();
      for (const row of data.rows as LegislativeRow[]) {
        const card = document.createElement("article");
        card.className = "org-row";
        const info = document.createElement("div");
        info.textContent = recordLabel(row);
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
            "Edit record";
          form.scrollIntoView();
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
          await load(false);
        };
        card.append(info, edit, remove);
        list.append(card);
      }
      previous.disabled = offset === 0;
      next.disabled = offset + 25 >= data.total;
      document.querySelector("[data-page]")!.textContent =
        `${data.total} records · Page ${Math.floor(offset / 25) + 1}`;
      message.textContent = data.total ? "" : "No records yet.";
    }
    const handle = (task: Promise<unknown>) =>
      void task.catch((error) => {
        message.textContent = error.message ?? "Could not load records.";
      });
    resource.onchange = () => {
      offset = 0;
      handle(load());
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
      const button = form.querySelector<HTMLButtonElement>("[type=submit]")!;
      button.disabled = true;
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
        await load();
        message.textContent = "Record saved.";
      } catch (error) {
        message.textContent = (error as Error).message;
      } finally {
        button.disabled = false;
      }
    };
    await load();
  } catch (error) {
    (document.querySelector("[data-admin-gate]") ?? message).textContent = (
      error as Error
    ).message;
  }
}
