drop function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer);
create function public.get_person_legislative_record(p_person_id uuid,p_session_id uuid default null,p_body_id uuid default null,
 p_category text default null,p_limit integer default 25,p_offset integer default 0,p_term_id uuid default null,p_bill_query text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with permitted as (
 select c.id,c.choice,c.source_choice,c.membership_review_note,v.id vote_id,v.question,v.category,v.method,v.outcome,v.coverage,v.occurred_on,v.source_url,
 v.session_id,v.body_id,o.name office_name,o.district,o.seat,t.id office_term_id,
 coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'identifier',b.identifier,'title',b.title))
 from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id where l.vote_id=v.id
 and legislative_private.visible('legislative_vote_bills',to_jsonb(l))), '[]'::jsonb) bills
 from public.legislative_vote_choices c join public.legislative_votes v on v.id=c.vote_id
 join public.office_terms t on t.id=c.office_term_id join public.offices o on o.id=t.office_id
 where t.person_id=p_person_id and (p_session_id is null or v.session_id=p_session_id)
 and (p_body_id is null or v.body_id=p_body_id) and (p_category is null or v.category=p_category)
 and (p_term_id is null or exists(select 1 from public.legislative_sessions s where s.id=v.session_id and s.term_id=p_term_id))
 and (nullif(p_bill_query,'') is null or exists(select 1 from public.legislative_vote_bills l join public.bills b on b.id=l.bill_id where l.vote_id=v.id
  and (b.identifier ilike '%'||left(p_bill_query,500)||'%' or b.title ilike '%'||left(p_bill_query,500)||'%')
  and legislative_private.visible('legislative_vote_bills',to_jsonb(l))))
 and legislative_private.visible('legislative_vote_choices',to_jsonb(c),null,null,p_person_id)
 ) select jsonb_build_object('total',(select count(*) from permitted),'rows',coalesce((select jsonb_agg(to_jsonb(x)) from
 (select * from permitted order by occurred_on desc,id limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)) x),'[]'::jsonb));
$$;

revoke all on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text) from public;
grant execute on function public.get_person_legislative_record(uuid,uuid,uuid,text,integer,integer,uuid,text) to anon,authenticated;
-- Preserve the historical jurisdiction/seat of offices referenced by legislation.
create function public.protect_legislative_office() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.organization_id,new.district,new.seat) is distinct from (old.organization_id,old.district,old.seat)
 and exists(select 1 from public.office_terms t where t.office_id=old.id and
 (exists(select 1 from public.legislative_vote_choices where office_term_id=t.id)
 or exists(select 1 from public.bill_sponsorships where office_term_id=t.id)
 or exists(select 1 from public.legislative_body_memberships where office_term_id=t.id))) then
 raise exception 'Create a new office for a changed district or seat; legislative history retains its original jurisdiction' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.protect_legislative_office() from public;
create trigger protect_legislative_office before update on public.offices for each row execute function public.protect_legislative_office();
notify pgrst,'reload schema';
