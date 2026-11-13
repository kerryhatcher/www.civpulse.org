create or replace function public.validate_legislative_record() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb := to_jsonb(new); b public.bills; s public.legislative_sessions;
 v public.legislative_votes; t public.office_terms; body public.legislative_bodies;
 d date; person uuid; k text; linked_bill uuid;
begin
 if tg_op = 'UPDATE' then
  for k in select jsonb_object_keys(r) loop
   if (k like '%\_id' escape '\' or k in ('starts_on','ends_on','occurred_on','introduced_on','numbering_context'))
     and r->k is distinct from to_jsonb(old)->k then
    raise exception 'Historical context % cannot be reassigned; replace the record explicitly', k using errcode='23514';
   end if;
  end loop;
 end if;
 if r ? 'session_id' then select * into s from public.legislative_sessions where id=(r->>'session_id')::uuid; end if;
 if r ? 'bill_id' then select * into b from public.bills where id=(r->>'bill_id')::uuid; end if;
 if r ? 'vote_id' then select * into v from public.legislative_votes where id=(r->>'vote_id')::uuid; end if;
 if r ? 'body_id' then select * into body from public.legislative_bodies where id=(r->>'body_id')::uuid; end if;
 if s.id is not null then
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
create function legislative_private.details(p_table text,p_row jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare parent record; r jsonb; labels jsonb:='{}'; links jsonb:='{}'; label text;
begin
 for parent in select key,value from jsonb_each_text((select parents from audit.objects where table_name=p_table)) loop
  if p_row->>parent.key is not null then
   execute format('select to_jsonb(t) from public.%I t where id=$1',parent.value) into r using (p_row->>parent.key)::uuid;
   label:=coalesce(r->>'title',r->>'name',r->>'full_name',r->>'question',r->>'identifier');
   if parent.value='office_terms' then
    select concat_ws(' · ',p.full_name,o.name,o.district,o.seat,t.starts_on::text) into label from public.office_terms t
    join public.people p on p.id=t.person_id join public.offices o on o.id=t.office_id where t.id=(p_row->>parent.key)::uuid;
   elsif parent.value='legislative_bodies' then
    select name into label from public.organizations where id=(r->>'organization_id')::uuid;
   end if;
   labels:=labels||jsonb_build_object(parent.key,coalesce(label,p_row->>parent.key));
   if parent.value='articles' then links:=links||jsonb_build_object(parent.key,r->>'url'); end if;
  end if;
 end loop;
 return jsonb_build_object('labels',labels,'links',links);
end $$;
revoke all on function legislative_private.details(text,jsonb) from public;
create or replace function public.browse_legislation(p_table text default 'bills',p_id uuid default null,
 p_filters jsonb default '{}',p_query text default '',p_limit integer default 25,p_offset integer default 0,
 p_bill_id uuid default null,p_person_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if p_table not in ('legislative_terms','legislative_sessions','legislative_bodies','legislative_body_memberships','bills','bill_versions',
 'bill_amendments','bill_actions','bill_relationships','bill_sponsorships','bill_positions','legislative_votes',
 'legislative_vote_bills','legislative_vote_choices','article_bills','legislative_event_links') then
 raise exception 'Unknown legislative resource' using errcode='22023'; end if;
 if jsonb_typeof(p_filters)<>'object' or length(p_filters::text)>4000 or length(p_query)>500 then raise exception 'Invalid filters' using errcode='22023'; end if;
 execute format($q$
 with permitted as (
  select to_jsonb(t) as row from public.%I t
  where ($1 is null or t.id=$1) and to_jsonb(t) @> $2
   and ($3='' or concat_ws(' ',to_jsonb(t)->>'title',to_jsonb(t)->>'name',to_jsonb(t)->>'identifier',to_jsonb(t)->>'question',to_jsonb(t)->>'summary') ilike '%%'||$3||'%%')
   and legislative_private.visible(%L,to_jsonb(t),$1,$6,$7)
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((
 select jsonb_agg(row || legislative_private.details(%L,row)) from (select row from permitted order by coalesce(row->>'occurred_on',row->>'introduced_on',row->>'starts_on',row->>'published_on',row->>'created_at') desc,row->>'sequence',row->>'id' limit $4 offset $5) paged),'[]'::jsonb))
 $q$,p_table,p_table,p_table) into result using p_id,p_filters,p_query,least(greatest(coalesce(p_limit,25),1),100),greatest(coalesce(p_offset,0),0),p_bill_id,p_person_id;
 return result;
end $$;
notify pgrst,'reload schema';
