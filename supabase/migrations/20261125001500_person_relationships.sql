-- One source-backed relationship, with a label for each person's profile.
create table public.person_relationships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  related_person_id uuid not null references public.people(id) on delete cascade,
  relationship text not null check (length(trim(relationship)) between 1 and 160),
  reverse_relationship text not null check (length(trim(reverse_relationship)) between 1 and 160),
  source_url text check (source_url is null or (length(source_url) <= 2000 and source_url ~ '^https?://[^[:space:]]+$')),
  created_at timestamptz not null default now(),
  check (person_id <> related_person_id)
);
create unique index person_relationships_pair on public.person_relationships
  (least(person_id, related_person_id), greatest(person_id, related_person_id));
create index person_relationships_person on public.person_relationships(person_id);
create index person_relationships_related on public.person_relationships(related_person_id);
alter table public.person_relationships enable row level security;
revoke all on public.person_relationships from anon, authenticated;
grant select on public.person_relationships to anon, authenticated;
grant insert, update, delete on public.person_relationships to authenticated;
create policy "Person relationships are public" on public.person_relationships
  for select to anon, authenticated using ((select public.is_admin()) or (exists(select 1 from public.people a where a.id=person_id and a.visibility='public') and exists(select 1 from public.people b where b.id=related_person_id and b.visibility='public')));
create policy "Admins insert person relationships" on public.person_relationships
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update person relationships" on public.person_relationships
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete person relationships" on public.person_relationships
  for delete to authenticated using ((select public.is_admin()));

create function public.get_person_relationships(p_person_id uuid)
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
  and (owner.visibility='public' or (select auth.uid()) is not null)
    and (o.visibility='public' or (select auth.uid()) is not null)
  order by o.full_name, o.id, r.id;
$$;
revoke all on function public.get_person_relationships(uuid) from public;
grant execute on function public.get_person_relationships(uuid) to anon, authenticated;


-- New dependency participates in existing history and publication tracking.
insert into audit.objects(table_name,key_columns,parents) values
('person_relationships',array['id'],'{"person_id":"people","related_person_id":"people"}');
create trigger record_history after insert or update or delete on public.person_relationships
for each row execute function audit.capture();
create trigger frontend_rebuild_required after insert or update or delete or truncate on public.person_relationships
for each statement execute function frontend_private.mark_frontend_rebuild_required();
