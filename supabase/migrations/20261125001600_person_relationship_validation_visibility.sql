-- Follow-up to the already applied relationship migration. Keep ordinary
-- authenticated callers aligned with get_person's admin-only private gate.
alter table public.person_relationships
  drop constraint person_relationships_relationship_check,
  drop constraint person_relationships_reverse_relationship_check,
  drop constraint person_relationships_source_url_check,
  add constraint person_relationships_relationship_check
    check (length(trim(relationship)) between 1 and 160 and relationship ~ '[^[:space:]]'),
  add constraint person_relationships_reverse_relationship_check
    check (length(trim(reverse_relationship)) between 1 and 160 and reverse_relationship ~ '[^[:space:]]'),
  add constraint person_relationships_source_url_check check (
    source_url is null or (
      length(source_url) <= 2000
      -- Require a nonempty host, with an optional numeric port. Schemes are
      -- case insensitive; whitespace, credentials and backslashes are rejected.
      and source_url ~* '^https?://([[:alnum:]]([[:alnum:].-]*[[:alnum:]])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
    )
  );

create or replace function public.get_person_relationships(p_person_id uuid)
returns table(id uuid, person_id uuid, related_person_id uuid, related_person_name text,
  related_person_slug text, related_person_visibility text, relationship text, reverse_relationship text, source_url text)
language sql stable security definer set search_path = '' as $$
  select r.id, p_person_id, o.id, o.full_name, o.slug, o.visibility,
    case when r.person_id = p_person_id then r.relationship else r.reverse_relationship end,
    case when r.person_id = p_person_id then r.reverse_relationship else r.relationship end,
    r.source_url
  from public.person_relationships r
  join public.people owner on owner.id = p_person_id
  join public.people o on o.id = case when r.person_id = p_person_id
    then r.related_person_id else r.person_id end
  where p_person_id in (r.person_id, r.related_person_id)
    and (owner.visibility = 'public' or (owner.visibility = 'unlisted' and (select auth.uid()) is not null) or (select public.is_admin()))
    and (o.visibility = 'public' or (o.visibility = 'unlisted' and (select auth.uid()) is not null) or (select public.is_admin()))
  order by o.full_name, o.id, r.id;
$$;
