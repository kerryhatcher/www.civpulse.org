-- November 3, 2026 Bibb County ballot questions, verified 2026-10-21.
-- Official composite sample ballot (revised 2026-10-15):
-- https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf
-- Statewide amendment wording cross-checked against the Secretary of State:
-- https://sos.ga.gov/sites/default/files/2026-09/2026%20Constitutional%20Summaries%20booklet%20FINAL.pdf
-- County sample ballot SHA-256: f5ee6556ab32445ded86f5230394ef3bca58f2b9779d50450affa7869a972346
-- Only PDF layout wrapping and enclosing quotation marks are removed. Preserve
-- local question paragraphs and amounts. All five questions offer Yes / No.
-- Use the existing November election; never create a duplicate election.
-- Stable ids make reapplication safe without overwriting later admin edits.
insert into public.ballot_questions
  (id, election_id, title, question_text, description, jurisdiction, source_url, position, choices)
select q.id, e.id, q.title, q.question_text, q.description, q.jurisdiction,
  q.source_url, q.position, array['Yes', 'No']
from public.elections e
cross join (values
  ('d6f9b481-1c55-57c8-9701-ae1bb99faa5f'::uuid, 'Constitutional Amendment 1 — Conservation-use acreage', 'Shall the Constitution of Georgia, for the purpose of protecting family farmland, be amended so as to increase the maximum acreage to qualify for assessment and taxation as a bona fide conservation use property from 2,000 acres to 4,000 acres?', 'Increases the maximum qualifying acreage for assessment and taxation as bona fide conservation use property. House Resolution 32; Ga. L. 2025, p. 1081.', 'Georgia (statewide)', 'https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf', 1),
  ('3a1a0e6f-7aab-57c0-99e8-30114a7833ba'::uuid, 'Constitutional Amendment 2 — Nonpartisan probate judge elections', 'Shall the Constitution of Georgia be amended so as to require that all probate court judges be elected in nonpartisan elections?', 'Provides for the nonpartisan election of all probate court judges. House Resolution 251; Ga. L. 2026, p. 1110.', 'Georgia (statewide)', 'https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf', 2),
  ('2d1d8161-8ddb-5e95-8f48-dfbf3ce384cd'::uuid, 'Constitutional Amendment 3 — Georgia Next Generation 9-1-1 Fund', 'Shall the Constitution of Georgia be amended so as to authorize the General Assembly to dedicate certain existing revenues, including revenues reallocated by law, to a nonlapsing fund to be used exclusively for the expansion, maintenance, and operation of emergency 9-1-1 systems in this state?', 'Authorizes creation of Georgia Next Generation 9-1-1 Fund for 9-1-1 systems expansion, maintenance, and operation. House Resolution 1243; Ga. L. 2026, p. 1109.', 'Georgia (statewide)', 'https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf', 3),
  ('993f9b2f-2d52-515a-a060-69fdaa7482b8'::uuid, 'House Bill 1537 — School district homestead exemptions', 'Shall the Act be approved which provides a homestead exemption from Bibb County school district ad valorem taxes for educational purposes:
(1) In the amount of $17,000.00 of the assessed value of the homestead for residents of that county who are between the ages of 65 and 74;
(2) In the amount of $32,000.00 of the assessed value of the homestead for residents of that county who are between the ages of 75 and 84; and
(3) In the amount of the full assessed value of the homestead for residents who are 85 years of age and older?', 'House Bill 1537. Local referendum on age-based homestead exemptions from Bibb County school district ad valorem taxes for educational purposes.', 'Bibb County school district', 'https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf', 4),
  ('04e92d8d-5cdf-5977-8eb3-3762d6dc7610'::uuid, 'House Bill 1538 — County homestead exemptions', 'Shall the Act be approved which provides a homestead exemption from Macon-Bibb County ad valorem taxes for county purposes:
(1) In the amount of $17,000.00 of the assessed value of the homestead for residents of that county who are between the ages of 65 and 74;
(2) In the amount of $32,000.00 of the assessed value of the homestead for residents of that county who are between the ages of 75 and 84; and
(3) In the amount of the full assessed value of the homestead for residents who are 85 years of age and older?', 'House Bill 1538. Local referendum on age-based homestead exemptions from Macon-Bibb County ad valorem taxes for county purposes.', 'Macon-Bibb County', 'https://www.maconbibb.us/wp-content/uploads/2026/10/Sample-Ballot-for-November-3-2026-General-and-Special-Election-rev-9-17_10-15.pdf', 5)
) as q(id, title, question_text, description, jurisdiction, source_url, position)
where e.slug = '2026-11-03-general-election' and e.election_date = date '2026-11-03'
on conflict (id) do nothing;
