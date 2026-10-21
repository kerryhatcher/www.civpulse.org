-- The candidate website fields now hold verified campaign links (or null).
-- Remove only the exact obsolete sentence from the initial candidate import;
-- retain the rest of each biography, including its ballot source citation.
update public.people p
set description = replace(p.description,
  ' The website link below opens the official source document, not a campaign site.', '')
where p.description like '% The website link below opens the official source document, not a campaign site.%'
  and exists (
    select 1 from public.contest_candidates cc
    join public.contests c on c.id = cc.contest_id
    join public.elections e on e.id = c.election_id
    where cc.person_id = p.id and e.slug = '2026-11-03-general-election'
      and e.election_date = date '2026-11-03'
  );
