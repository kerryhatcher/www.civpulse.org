create or replace function public.validate_legislative_record() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb := to_jsonb(new); b public.bills; s public.legislative_sessions;
 v public.legislative_votes; t public.office_terms; body public.legislative_bodies;
 d date; person uuid; k text; linked_bill uuid;
begin
 if tg_op = 'UPDATE' then
  for k in select jsonb_object_keys(r) loop
   if (k like '%\_id' escape '\' or k in ('starts_on','occurred_on','introduced_on','numbering_context'))
     and r->k is distinct from to_jsonb(old)->k then
    raise exception 'Historical context % cannot be reassigned; replace the record explicitly', k using errcode='23514';
   end if;
  end loop;
 end if;
 for k in select jsonb_object_keys(r) loop
  if k like '%\_on' escape '\' and r->>k is not null and not isfinite((r->>k)::date) then
   raise exception 'Use finite dates' using errcode='23514'; end if;
 end loop;
 if tg_table_name='legislative_sessions' and not exists(select 1 from public.legislative_terms lt
   where lt.id=(r->>'term_id')::uuid and (r->>'starts_on')::date>=lt.starts_on
   and (lt.ends_on is null or coalesce((r->>'ends_on')::date,(r->>'starts_on')::date)<=lt.ends_on)) then
  raise exception 'Session dates outside legislative term' using errcode='23514'; end if;
 if r ? 'session_id' then select * into s from public.legislative_sessions where id=(r->>'session_id')::uuid; end if;
 if r ? 'bill_id' then select * into b from public.bills where id=(r->>'bill_id')::uuid; end if;
 if r ? 'vote_id' then select * into v from public.legislative_votes where id=(r->>'vote_id')::uuid; end if;
 if r ? 'body_id' then select * into body from public.legislative_bodies where id=(r->>'body_id')::uuid; end if;
 if s.id is not null then
  d:=coalesce((r->>'occurred_on')::date,(r->>'introduced_on')::date);
  if d is not null and (d<s.starts_on or (s.ends_on is not null and d>s.ends_on)) then
   raise exception 'Date outside legislative session' using errcode='23514'; end if;
  if r ? 'term_id' and (r->>'term_id')::uuid <> s.term_id then raise exception 'Session and term disagree' using errcode='23514'; end if;
  if b.id is not null and b.term_id <> s.term_id then raise exception 'Action session and bill term disagree' using errcode='23514'; end if;
  if body.id is not null and body.legislature_id <> (select organization_id from public.legislative_terms where id=s.term_id) then
   raise exception 'Body and session belong to different legislatures' using errcode='23514';
  end if;
 end if;
 if tg_table_name='legislative_vote_bills' then
  if b.term_id <> (select term_id from public.legislative_sessions where id=v.session_id) then raise exception 'Vote and bill terms disagree' using errcode='23514'; end if;
 end if;
 if r->>'version_id' is not null then
  select bill_id into linked_bill from public.bill_versions where id=(r->>'version_id')::uuid;
  if linked_bill <> b.id then raise exception 'Version belongs to another bill' using errcode='23514'; end if;
 end if;
 if r->>'amendment_id' is not null then
  select bill_id into linked_bill from public.bill_amendments where id=(r->>'amendment_id')::uuid;
  if linked_bill <> b.id then raise exception 'Amendment belongs to another bill' using errcode='23514'; end if;
 end if;
 if r->>'action_id' is not null then
  select bill_id into linked_bill from public.bill_actions where id=(r->>'action_id')::uuid;
  if linked_bill <> b.id then raise exception 'Action belongs to another bill' using errcode='23514'; end if;
 end if;
 if r ? 'office_term_id' then
  select * into t from public.office_terms where id=(r->>'office_term_id')::uuid for share;
  d := coalesce(v.occurred_on,(r->>'starts_on')::date);
  if tg_table_name in ('bill_sponsorships','legislative_body_memberships') and not exists(
   select 1 from public.offices o where o.id=t.office_id and
   (o.organization_id=coalesce(body.legislature_id,(select organization_id from public.legislative_terms where id=b.term_id))
    or exists(select 1 from public.legislative_bodies lb where lb.organization_id=o.organization_id and
    lb.legislature_id=coalesce(body.legislature_id,(select organization_id from public.legislative_terms where id=b.term_id))))) then
   raise exception 'Office belongs to another legislature' using errcode='23514'; end if;
  if d < t.starts_on or (t.ends_on is not null and d > t.ends_on) then raise exception 'Date outside recorded service' using errcode='23514'; end if;
  if tg_table_name='legislative_vote_choices' then
   perform 1 from public.legislative_votes where id=v.id for update;
   if v.coverage='no_individual_record' then raise exception 'This vote has no individual record' using errcode='23514'; end if;
   if exists(select 1 from public.legislative_vote_choices c join public.office_terms ot on ot.id=c.office_term_id
      where c.vote_id=v.id and ot.person_id=t.person_id and c.id<>new.id) then
    raise exception 'A person may have only one choice per vote' using errcode='23505';
   end if;
   if (t.starts_on_precision='year' or t.ends_on_precision='year' or not exists(
      select 1 from public.legislative_body_memberships m where m.body_id=v.body_id and m.office_term_id=t.id
       and m.starts_on<=d and (m.ends_on is null or m.ends_on>=d)))
      and nullif(btrim(r->>'membership_review_note'),'') is null then
    raise exception 'Uncertain service or missing membership requires a review note' using errcode='23514';
   end if;
  end if;
 end if;
 if tg_table_name='legislative_votes' and r->>'coverage'='no_individual_record'
   and exists(select 1 from public.legislative_vote_choices where vote_id=new.id) then
  raise exception 'Remove individual choices before marking no individual record' using errcode='23514';
 end if;
 return new;
end $$;
-- Ending service remains possible without losing the historic record.
create or replace function public.protect_legislative_service() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.legislative_vote_choices where office_term_id=old.id)
     or exists(select 1 from public.bill_sponsorships where office_term_id=old.id)
     or exists(select 1 from public.legislative_body_memberships where office_term_id=old.id) then
  if (new.person_id,new.office_id,new.starts_on,new.starts_on_precision)
   is distinct from (old.person_id,old.office_id,old.starts_on,old.starts_on_precision) then
   raise exception 'Service referenced by legislative history cannot be reassigned' using errcode='23514';
  end if;
  if new.ends_on is not null and (
   exists(select 1 from public.legislative_vote_choices c join public.legislative_votes v on v.id=c.vote_id where c.office_term_id=old.id and v.occurred_on>new.ends_on)
   or exists(select 1 from public.bill_sponsorships where office_term_id=old.id and starts_on>new.ends_on)
   or exists(select 1 from public.legislative_body_memberships where office_term_id=old.id and starts_on>new.ends_on)) then
   raise exception 'Service end precedes recorded legislative participation' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

-- Transactional normalized imports: each record supplies its stable provider key.
-- Explicit IDs can connect records in the same bundle. Defaults apply to omitted
-- fields and updates patch only supplied fields. Failed bundles roll back entirely.
create function public.import_legislation(p_records jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; tbl text; data jsonb; col text; columns_sql text; values_sql text; updates_sql text;
 saved uuid; result jsonb:='[]';
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>100 or octet_length(p_records::text)>2000000 then
  raise exception 'Provide at most 100 normalized records (2 MB)' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_records) loop
  tbl:=item->>'table';data:=item->'data';
  if tbl is null or tbl not in ('legislative_terms','legislative_sessions','legislative_bodies','legislative_body_memberships','bills','bill_versions',
   'bill_amendments','bill_actions','bill_relationships','bill_sponsorships','bill_positions','legislative_votes',
   'legislative_vote_bills','legislative_vote_choices','article_bills','legislative_event_links') then
   raise exception 'Unknown legislative resource' using errcode='22023'; end if;
  if jsonb_typeof(data) is distinct from 'object' or nullif(btrim(data->>'source_system'),'') is null or nullif(btrim(data->>'source_id'),'') is null then
   raise exception 'Every import needs source_system and source_id' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tbl||':'||(data->>'source_system')||':'||(data->>'source_id'),0));
  execute format('select id from public.%I where source_system=$1 and source_id=$2',tbl) into saved using data->>'source_system',data->>'source_id';
  if saved is not null then
   if data->>'id' is not null and saved<>(data->>'id')::uuid then raise exception 'Provider key already maps to another UUID' using errcode='23505'; end if;
   data:=data||jsonb_build_object('id',saved);
  end if;
  columns_sql:='';values_sql:='';updates_sql:='';
  for col in select jsonb_object_keys(data) loop
   if col in ('created_at','updated_at') or not exists(select 1 from information_schema.columns where table_schema='public' and table_name=tbl and column_name=col) then
    raise exception 'Unknown or managed import field %',col using errcode='22023'; end if;
   columns_sql:=columns_sql||format('%I,',col);values_sql:=values_sql||format('r.%I,',col);
   if col<>'id' then updates_sql:=updates_sql||format('%I=excluded.%I,',col,col); end if;
  end loop;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r on conflict(source_system,source_id) do update set %s returning id',
   tbl,rtrim(columns_sql,','),rtrim(values_sql,','),tbl,rtrim(updates_sql,',')) into saved using data;
  if data->>'id' is not null and saved<>(data->>'id')::uuid then raise exception 'Provider key already maps to another UUID' using errcode='23505'; end if;
  result:=result||jsonb_build_array(jsonb_build_object('table',tbl,'id',saved));
 end loop;
 return result;
end $$;
revoke all on function public.import_legislation(jsonb) from public;
grant execute on function public.import_legislation(jsonb) to authenticated;
notify pgrst,'reload schema';
