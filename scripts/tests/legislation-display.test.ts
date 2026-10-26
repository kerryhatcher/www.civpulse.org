import { expect, test } from "bun:test";
import {
  legislativeDate,
  legislativeTitle,
  relationLabel,
  coverageLabel,
} from "../../apps/web/src/lib/legislation-display";

test("civil dates do not drift across timezones; exact instants name the timezone", () => {
  expect(legislativeDate("2026-09-30")).toBe("Sep 30, 2026");
  expect(legislativeDate("2026-09-30T16:51:00+00:00", true)).toContain("UTC");
  expect(legislativeDate(null)).toBe("");
});
test("relationship headings identify the entity in context without raw IDs or duplicate parents", () => {
  const row = {
    id: "record",
    labels: {
      office_term_id: "Jon Ossoff · U.S. Senator · Georgia ·  · 2021-01-20",
      bill_id: "H.R. 9340 — Ratepayer Protection Act",
      vote_id: "Motion to invoke cloture",
      action_id: "af9d0ca3-ec3a-42ad-85a6-7c4e9ab1838d",
    },
  };
  expect(legislativeTitle("legislative_vote_choices", row)).toBe("Jon Ossoff");
  expect(legislativeTitle("bill_sponsorships", row, ["office_term_id"])).toBe(
    "H.R. 9340 — Ratepayer Protection Act",
  );
  expect(legislativeTitle("legislative_vote_bills", row, ["bill_id"])).toBe(
    "Motion to invoke cloture",
  );
  expect(
    legislativeTitle("legislative_vote_bills", row, ["vote_id"]),
  ).toContain("H.R. 9340");
  expect(relationLabel(row, "action_id")).toBe("");
  expect(relationLabel(row, "office_term_id")).not.toContain(" ·  · ");
});
test("bill numbers and coverage remain explicit", () => {
  expect(
    legislativeTitle("bills", {
      id: "b",
      identifier: "H.R. 9340",
      title: "Ratepayer Protection Act",
    }),
  ).toBe("H.R. 9340 — Ratepayer Protection Act");
  expect(coverageLabel("partial")).toBe("Partial member record");
  expect(coverageLabel("no_individual_record")).toBe("No individual roll call");
  expect(coverageLabel("complete")).toBe("Complete import");
});
