import { expect, test } from "bun:test";
import {
  mappedSosItem,
  mappedSosChoice,
} from "../../apps/web/src/lib/sos-ballot";
import type { SosView } from "../../apps/web/src/lib/sos-results-reader";
const view = {
  scope: {
    jurisdiction: { id: "011", name: "Bibb" },
    items: [
      {
        jurisdiction_index: 1,
        item_index: 0,
        data: {
          id: "local-id",
          name: "Same display name",
          ballotOptions: [
            { id: "source-choice", name: "Same person name", voteCount: 0 },
          ],
        },
      },
    ],
  },
} as SosView;
test("ballot matches require exact jurisdiction, source contest and explicit candidate IDs", () => {
  const mapping = {
    jurisdiction_id: "011",
    source_contest_id: "local-id",
    contest_id: "curated",
    choices: [{ source_choice_id: "source-choice", person_id: "person" }],
  };
  const match = mappedSosItem(view, [mapping], "contest", "curated")!;
  expect(mappedSosChoice(match.item, match.mapping, "person")?.voteCount).toBe(
    0,
  );
  expect(
    mappedSosChoice(match.item, match.mapping, "same-name-different-person"),
  ).toBeUndefined();
  expect(
    mappedSosItem(
      view,
      [{ ...mapping, jurisdiction_id: "state" }],
      "contest",
      "curated",
    ),
  ).toBeNull();
  expect(
    mappedSosItem(
      view,
      [{ ...mapping, source_contest_id: "state-id" }],
      "contest",
      "curated",
    ),
  ).toBeNull();
});
test("question choices use reviewed labels exactly without case or name inference", () => {
  const mapping = {
    jurisdiction_id: "011",
    source_contest_id: "local-id",
    question_id: "question",
    choices: [{ source_choice_id: "source-choice", choice_label: "Yes" }],
  };
  const match = mappedSosItem(view, [mapping], "question", "question")!;
  expect(
    mappedSosChoice(match.item, match.mapping, undefined, "Yes")?.voteCount,
  ).toBe(0);
  expect(
    mappedSosChoice(match.item, match.mapping, undefined, "yes"),
  ).toBeUndefined();
});
