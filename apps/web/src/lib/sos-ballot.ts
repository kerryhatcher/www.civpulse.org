import type { SosItem, SosObject, SosView } from "./sos-results-reader";
export interface SosChoiceMapping {
  source_choice_id: string;
  person_id?: string | null;
  choice_label?: string | null;
}
export interface SosContestMapping {
  jurisdiction_id: string;
  source_contest_id: string;
  contest_id?: string | null;
  question_id?: string | null;
  choices: SosChoiceMapping[];
}
export function mappedSosItem(
  view: SosView | null | undefined,
  mappings: SosContestMapping[],
  kind: "contest" | "question",
  id: string,
): { item: SosItem; mapping: SosContestMapping } | null {
  if (!view) return null;
  const mapping = mappings.find(
    (m) =>
      m.jurisdiction_id === view.scope.jurisdiction.id &&
      (kind === "contest" ? m.contest_id : m.question_id) === id,
  );
  const item =
    mapping &&
    view.scope.items.find((item) => item.data.id === mapping.source_contest_id);
  return mapping && item ? { item, mapping } : null;
}
export function mappedSosChoice(
  item: SosItem,
  mapping: SosContestMapping,
  personId?: string,
  choiceLabel?: string,
): SosObject | undefined {
  const choice = mapping.choices.find((c) =>
    personId ? c.person_id === personId : c.choice_label === choiceLabel,
  );
  return choice
    ? (item.data.ballotOptions as SosObject[]).find(
        (c) => c.id === choice.source_choice_id,
      )
    : undefined;
}
