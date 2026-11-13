-- Share one anonymous snapshot across static profiles, never one read per person.
create function public.export_public_officeholder_observations(p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Bounded pagination required';end if;
 with visible as(
 select o.id,o.provider,o.source_key,o.revision,o.supersedes_id,o.recorded_at,o.payload,p.slug person_slug,g.slug organization_slug,false superseded
 from public.officeholder_observations o join public.organizations g on g.id=o.organization_id left join public.people p on p.id=o.person_id
 where o.payload->>'visibility'='public' and (o.person_id is null or p.visibility='public')
 and not exists(select 1 from public.officeholder_observations n where n.supersedes_id=o.id)),
 page as(select * from visible order by id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from visible),'offset',p_offset,'limit',p_limit,'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 return result;
end;$$;
revoke all on function public.export_public_officeholder_observations(integer,integer) from public;
grant execute on function public.export_public_officeholder_observations(integer,integer) to anon,authenticated;

-- A known contradiction is reviewable evidence, never a silent interval correction.
create function public.check_officeholder_interval_evidence() returns trigger language plpgsql set search_path='' as $$
declare t public.office_terms; first_day date; last_day date;
begin
 if new.office_term_id is null or new.payload->>'precision'='unknown' then return new;end if;
 select * into t from public.office_terms where id=new.office_term_id;
 first_day:=(new.payload->>'as_of')::date;
 last_day:=case when new.payload->>'precision'='year' then (first_day+interval '1 year - 1 day')::date else first_day end;
 if (last_day<t.starts_on or first_day>t.ends_on) and new.payload->>'review_status'<>'conflicting' then
 raise exception 'Observation outside linked service interval: mark conflicting after review, never change the interval';end if;
 return new;
end;$$;
revoke all on function public.check_officeholder_interval_evidence() from public,anon,authenticated;
create trigger check_interval_evidence before insert on public.officeholder_observations for each row execute function public.check_officeholder_interval_evidence();
