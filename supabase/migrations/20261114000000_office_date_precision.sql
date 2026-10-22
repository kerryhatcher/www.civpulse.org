-- Preserve the precision supplied by official historical sources. Year dates
-- use interval bounds for sorting; the UI must display only the recorded year.
alter table public.office_terms
  add column starts_on_precision text not null default 'day' check (starts_on_precision in ('day', 'year')),
  add column ends_on_precision text not null default 'day' check (ends_on_precision in ('day', 'year')),
  add constraint office_terms_start_precision_bound check (starts_on_precision <> 'year' or to_char(starts_on, 'MM-DD') = '01-01'),
  add constraint office_terms_end_precision_bound check (ends_on_precision <> 'year' or ends_on is null or to_char(ends_on, 'MM-DD') = '12-31');
comment on column public.office_terms.starts_on_precision is 'day: exact first day; year: only year is known, stored at Jan 1 solely as a sorting bound.';
comment on column public.office_terms.ends_on_precision is 'day: exact last day; year: concluded historical service with only end year known, stored at Dec 31 as a sorting bound. Never use year precision to forecast a departure.';
-- Return type gains additive metadata; recreate atomically with the same gate/grants.
drop function public.get_office_terms(uuid, uuid);
create function public.get_office_terms(p_person_id uuid default null, p_organization_id uuid default null)
returns table (
  id uuid, office_id uuid, office_name text, district text, seat text,
  organization_id uuid, organization_name text, organization_slug text,
  person_id uuid, person_name text, person_slug text, person_visibility text,
  selection_method text, starts_on date, ends_on date, source_url text, service_status text,
  starts_on_precision text, ends_on_precision text
)
language sql stable security definer set search_path = '' as $$
  select t.id, o.id, o.name, o.district, o.seat, org.id, org.name, org.slug,
    p.id, p.full_name, p.slug, p.visibility, t.selection_method, t.starts_on, t.ends_on, t.source_url,
    case when t.starts_on > (now() at time zone 'America/New_York')::date then 'upcoming'
      when t.ends_on < (now() at time zone 'America/New_York')::date
        or (t.ends_on_precision = 'year' and extract(year from t.ends_on) <= extract(year from now() at time zone 'America/New_York')) then 'former'
      else 'current' end, t.starts_on_precision, t.ends_on_precision
  from public.office_terms t
  join public.offices o on o.id = t.office_id
  join public.organizations org on org.id = o.organization_id
  join public.people p on p.id = t.person_id
  where (p_person_id is not null or p_organization_id is not null)
    and (p_person_id is null or p.id = p_person_id)
    and (p_organization_id is null or org.id = p_organization_id)
    and (p.visibility = 'public' or (select auth.uid()) is not null
      or (p_person_id is not null and p.visibility = 'unlisted'))
  order by t.starts_on desc, o.name, p.full_name, t.id;
$$;
revoke all on function public.get_office_terms(uuid, uuid) from public;
grant execute on function public.get_office_terms(uuid, uuid) to anon, authenticated;
