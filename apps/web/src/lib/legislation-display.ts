import type { LegislativeRow } from "./legislation";

export function humanize(value: unknown): string {
  const text = String(value ?? "").replaceAll("_", " ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** Date-only legislative dates are civil dates, never shifted by the reader's timezone. */
export function legislativeDate(value: unknown, includeTime = false): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...(includeTime
      ? ({ hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const)
      : {}),
  }).format(date);
}

export function relationLabel(row: LegislativeRow, field: string): string {
  const label = row.labels?.[field] ?? "";
  // Older deployments returned IDs for unnamed actions. IDs are never public-facing labels.
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(label)) return "";
  return label
    .split(" · ")
    .filter((part) => part.trim())
    .join(" · ");
}

export const coverageLabel = (value: unknown): string =>
  ({
    partial: "Partial member record",
    complete: "Complete import",
    no_individual_record: "No individual roll call",
  })[String(value)] ?? "Coverage not specified";

export function legislativeTitle(
  table: string,
  row: LegislativeRow,
  omit: string[] = [],
): string {
  if (table === "bills")
    return [row.identifier, row.title].filter(Boolean).join(" — ");
  if (table === "bill_actions")
    return String(row.description ?? humanize(row.kind));
  const primary: Record<string, string> = {
    bill_sponsorships: omit.includes("office_term_id")
      ? "bill_id"
      : "office_term_id",
    bill_positions: "person_id",
    legislative_vote_choices: "office_term_id",
    legislative_vote_bills: omit.includes("vote_id") ? "bill_id" : "vote_id",
    article_bills: "article_id",
    bill_relationships: "related_bill_id",
    legislative_body_memberships: "office_term_id",
    legislative_event_links: "event_id",
  };
  const field = primary[table];
  if (field) {
    const label = relationLabel(row, field);
    return field === "office_term_id"
      ? label.split(" · ")[0] || "Member record"
      : label || "Related record";
  }
  return String(
    row.title ??
      row.name ??
      row.question ??
      row.identifier ??
      (relationLabel(row, "organization_id") || "Legislative record"),
  );
}
