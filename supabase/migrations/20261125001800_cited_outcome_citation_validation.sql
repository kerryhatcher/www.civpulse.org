-- Append citation authority/whitespace checks without changing the already-tested
-- observation migration. Never accept credential-bearing or hostless sources.
alter table public.meeting_vote_outcome_observations
 add constraint meeting_vote_outcome_source_authority check (
  source_url ~ '^https://([[:alnum:]]([[:alnum:].-]*[[:alnum:]])?|\[[0-9a-fA-F:]+\])(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
 ),
 add constraint meeting_vote_outcome_locator_nonblank check (locator ~ '[^[:space:]]'),
 add constraint meeting_vote_outcome_reason_nonblank check (correction_reason is null or correction_reason ~ '[^[:space:]]');
