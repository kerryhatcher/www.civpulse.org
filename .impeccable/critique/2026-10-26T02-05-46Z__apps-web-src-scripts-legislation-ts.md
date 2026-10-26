---
target: Ossoff import UI
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:apps/web/src/scripts/legislation.ts"
target_fingerprint: "sha256:96cd73e18bb59d66fb2a055c53c2b8df53a4c3c6d70a92172f0c4def759fdde9"
target_path: apps/web/src/scripts/legislation.ts
timestamp: 2026-10-26T02-05-46Z
slug: apps-web-src-scripts-legislation-ts
---
# Legislative record UI review

Target: apps/web/src/scripts/legislation.ts and related bill, vote, session, profile and admin screens.
Mode: Read for public records; Operate for editing. Two independent assessments inspected source and live production pages before implementation.

The incumbent cream, forest-green and serif identity fits a civic record. The original generic field loop presented different entities as interchangeable database cards. Source/history links, exact procedural wording and explicit partial-coverage semantics were strengths to preserve.

Initial heuristic scores (0–4): system status 2; real-world language 2; control/freedom 2; consistency 3; error prevention 2; recognition 2; efficiency 1; aesthetic/minimalism 1; error recovery 1; help/documentation 2. Total 18/40, no inapplicable heuristics. These are baseline judgments, not a new score for the implemented interface.

Priority issues and implemented responses:
- P1: Official result and imported member choices were buried. Added a distinct official-result panel, adjacent partial-coverage explanation, compact vote details and separate member-choice labels. Preserve the exact procedural question; never imply final passage.
- P1: Related records exposed raw action UUIDs and repeated parents. Added contextual headings, readable action/bill metadata and real profile/chamber links behind the existing visibility gate.
- P2: Long bill pages lacked navigation. Added section links, prioritized timeline/votes, reduced empty-state weight and kept sources/history alongside records.
- P2: Admin showed a schema-shaped form first. Added searchable saved records, explicit edit/cancel, grouped fields, optional source/import details and contextual coverage/service guidance.
- P2: Profile filters dominated the page. Collapsed filters behind a labeled disclosure, added clear/reset and separated Meeting votes from the Legislative record.

First-time readers need to distinguish the person's choice from the outcome. Researchers need direct routes to source evidence and related entities. Volunteer editors need help distinguishing official totals from imported coverage. The update targets those three tasks without changing factual imported copy or the visual identity.

Static baseline detector: zero findings. Screenshots and DOM evidence identified the semantic/hierarchy issues that the detector did not catch. No live overlay was injected: browser evaluate is read-only. Questions skipped: the user already requested implementation of improvements.
