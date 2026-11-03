-- Existing applied migrations remain unchanged. Reject unusable source authorities
-- and expose a visible-set fingerprint so builds fail closed on page drift.
create function public.check_officeholder_source_url() returns trigger
language plpgsql set search_path='' as $$
declare authority text; port text;
begin
 authority:=substring(new.payload->>'source_url' from '^https://([^/?#]+)');
 if authority is null or authority !~ '^([a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?|\[[0-9a-fA-F:]+\])(:[0-9]{1,5})?$' then
  raise exception 'Usable HTTPS source URL without credentials required';
 end if;
 port:=substring(authority from ':([0-9]+)$');
 if port is not null and port::integer>65535 then raise exception 'Valid HTTPS port required';end if;
 return new;
end;$$;
revoke all on function public.check_officeholder_source_url() from public,anon,authenticated;
create trigger check_officeholder_source_url before insert on public.officeholder_observations
for each row execute function public.check_officeholder_source_url();

create or replace function public.export_public_officeholder_observations(p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Bounded pagination required';end if;
 with visible as materialized(
 select o.id,o.provider,o.source_key,o.revision,o.supersedes_id,o.recorded_at,o.payload,p.slug person_slug,g.slug organization_slug,false superseded
 from public.officeholder_observations o join public.organizations g on g.id=o.organization_id left join public.people p on p.id=o.person_id
 where o.payload->>'visibility'='public' and (o.person_id is null or p.visibility='public')
 and not exists(select 1 from public.officeholder_observations n where n.supersedes_id=o.id)),
 page as(select * from visible order by id offset p_offset limit p_limit)
 select jsonb_build_object('snapshot',md5(coalesce((select jsonb_agg(to_jsonb(visible) order by id)::text from visible),'[]')),
 'total',(select count(*) from visible),'offset',p_offset,'limit',p_limit,'rows',coalesce((select jsonb_agg(to_jsonb(page) order by id) from page),'[]')) into result;
 return result;
end;$$;
revoke all on function public.export_public_officeholder_observations(integer,integer) from public;
grant execute on function public.export_public_officeholder_observations(integer,integer) to anon,authenticated;
