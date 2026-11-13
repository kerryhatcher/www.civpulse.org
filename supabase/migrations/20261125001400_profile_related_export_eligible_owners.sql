-- Restrict gated article/candidacy readers to owners with public related rows.
-- Retain the existing readers, ordinality, public filters and bounded pagination.
-- Allow eligible-owner CTEs to inline so ordered first pages can still stop early.
-- Release through main before production application.
create or replace function public.export_public_profile_rows(p_section text, p_offset integer default 0, p_limit integer default 500)
returns table(owner_id uuid, ordinal bigint, data jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_section not in ('offices','person_articles','organization_articles','candidacies','votes','legislative_votes') then
  raise exception 'Unknown public profile section' using errcode='22023';
 end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>500 then
  raise exception 'Expected nonnegative offset and limit between 1 and 500' using errcode='22023';
 end if;
 -- Fail closed even if execute privileges are accidentally widened later.
 if (select auth.uid()) is not null then
  raise exception 'Public profile exports require the anonymous build client' using errcode='42501';
 end if;
 if p_section='offices' then
  return query with office_holders as materialized (
   select p.id from public.people p
   where p.visibility='public' and exists(select 1 from public.office_terms t where t.person_id=p.id)
  )
  select p.id,q.ordinality,to_jsonb(q)-'ordinality'
  from office_holders p cross join lateral public.get_office_terms(p.id) with ordinality q
  order by p.id,q.ordinality limit p_limit offset p_offset;
 elsif p_section='person_articles' then
  return query with article_owners as not materialized (
   select p.id from public.people p where p.visibility='public' and exists (
    select 1 from public.article_people ap join public.articles a on a.id=ap.article_id
    where ap.person_id=p.id and a.visibility='public'
   )
  )
  select p.id,q.ordinality,to_jsonb(q)-'ordinality'
  from article_owners p cross join lateral public.get_person_articles(p.id) with ordinality q
  where q.visibility='public'
  order by p.id,q.ordinality limit p_limit offset p_offset;
 elsif p_section='organization_articles' then
  return query with article_owners as not materialized (
   select o.id from public.organizations o where exists (
    select 1 from public.article_organizations ao join public.articles a on a.id=ao.article_id
    where ao.organization_id=o.id and a.visibility='public'
   )
  )
  select o.id,q.ordinality,to_jsonb(q)-'ordinality'
  from article_owners o cross join lateral public.get_organization_articles(o.id) with ordinality q
  where q.visibility='public' order by o.id,q.ordinality limit p_limit offset p_offset;
 elsif p_section='candidacies' then
  return query with candidate_owners as not materialized (
   select p.id from public.people p where p.visibility='public' and exists (
    select 1 from public.contest_candidates cc
    join public.contests c on c.id=cc.contest_id join public.elections e on e.id=c.election_id
    where cc.person_id=p.id and e.visibility='public'
   )
  )
  select p.id,q.ordinality,to_jsonb(q)-'ordinality'
  from candidate_owners p cross join lateral public.get_person_candidacies(p.id) with ordinality q
  where q.election_visibility='public'
  order by p.id,q.ordinality limit p_limit offset p_offset;
 elsif p_section='votes' then
  return query select x.person_id,x.ordinality,to_jsonb(x)-'person_id'-'ordinality' from (
   select p.id person_id,row_number() over(partition by p.id order by e.starts_at desc,e.id,v.position,v.id) ordinality,
    v.id vote_id,e.id meeting_id,e.title meeting_title,e.starts_at,o.name organization_name,
    v.subject,v.description,v.outcome,ch.choice
   from public.meeting_vote_choices ch join public.people p on p.id=ch.person_id
   join public.meeting_votes v on v.id=ch.vote_id and v.meeting_id=ch.meeting_id
   join public.events e on e.id=ch.meeting_id join public.calendars c on c.id=e.calendar_id
   join public.organizations o on o.id=c.organization_id left join public.elections el on el.id=e.election_id
   where p.visibility='public' and e.is_meeting and e.visibility='public' and c.visibility='public'
    and (e.election_id is null or el.visibility='public')
  ) x order by x.person_id,x.ordinality limit p_limit offset p_offset;
 else
  return query with visible_votes as materialized (select legislative_private.visible_vote_ids() id),
   paged as materialized (
    select p.id person_id,row_number() over(partition by p.id order by v.occurred_on desc,v.occurred_at desc nulls last,v.id) ordinality,
     ch.id,ch.choice,ch.source_choice,ch.membership_review_note,v.id vote_id,v.question,v.category,v.method,v.outcome,v.coverage,
     v.occurred_on,v.occurred_at,v.source_url,v.session_id,v.body_id,s.term_id,
     o.name office_name,o.district,o.seat,t.id office_term_id
    from public.legislative_vote_choices ch join public.legislative_votes v on v.id=ch.vote_id
    join visible_votes vv on vv.id=v.id join public.legislative_sessions s on s.id=v.session_id
    join public.office_terms t on t.id=ch.office_term_id join public.people p on p.id=t.person_id
    join public.offices o on o.id=t.office_id
    where p.visibility='public' and ch.visibility='public'
    order by p.id,ordinality limit p_limit offset p_offset
   ), page_links as materialized (
    select l.* from public.legislative_vote_bills l
    where l.visibility='public' and l.vote_id in (select q.vote_id from paged q)
   ), permitted_bills as materialized (select legislative_private.visible_bill_ids() id),
   permitted_actions as materialized (select legislative_private.visible_action_ids() id),
   permitted_versions as materialized (
    select v.id from public.bill_versions v join permitted_bills b on b.id=v.bill_id
    where v.visibility='public'
   ), permitted_amendments as materialized (
    select a.id from public.bill_amendments a join permitted_bills b on b.id=a.bill_id
    where a.visibility='public' and (a.version_id is null or a.version_id in (select id from permitted_versions))
   ), associations as materialized (
    select l.vote_id,jsonb_agg(jsonb_build_object('id',b.id,'identifier',b.identifier,'title',b.title) order by b.id) bills
    from page_links l join public.bills b on b.id=l.bill_id
    join permitted_bills pb on pb.id=b.id
    where (l.action_id is null or l.action_id in (select id from permitted_actions))
     and (l.version_id is null or l.version_id in (select id from permitted_versions))
     and (l.amendment_id is null or l.amendment_id in (select id from permitted_amendments))
    group by l.vote_id
   )
   select q.person_id,q.ordinality,(to_jsonb(q)-'person_id'-'ordinality') || jsonb_build_object('bills',coalesce(a.bills,'[]'::jsonb))
   from paged q left join associations a on a.vote_id=q.vote_id
   order by q.person_id,q.ordinality;
 end if;
end $$;
revoke all on function public.export_public_profile_rows(text,integer,integer) from public,anon,authenticated;
grant execute on function public.export_public_profile_rows(text,integer,integer) to anon;
comment on function public.export_public_profile_rows(text,integer,integer) is
 'Bounded anonymous-only build export of public profile sections. Never exports unlisted/private related data.';
notify pgrst,'reload schema';
