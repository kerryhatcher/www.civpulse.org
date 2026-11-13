-- Preserve JSON null before-images for append-only INSERT history.
create or replace function public.get_object_history(p_table text default null,p_object_id text default null,p_before bigint default null,p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.get_object_history_without_outcome_editor_redaction(p_table,p_object_id,p_before,p_limit);
 if coalesce(public.is_admin(),false) then return result; end if;
 return result||jsonb_build_object('revisions',coalesce((select jsonb_agg(
  case when r->>'table_name'='meeting_vote_outcome_observations' then
   r||jsonb_build_object('before',case when jsonb_typeof(r->'before')='object' then (r->'before')-'created_by' else r->'before' end,'after',case when jsonb_typeof(r->'after')='object' then (r->'after')-'created_by' else r->'after' end)
  else r end order by position)
  from jsonb_array_elements(result->'revisions') with ordinality t(r,position)),'[]'::jsonb));
end $$;
revoke all on function public.get_object_history(text,text,bigint,integer) from public,anon,authenticated;
grant execute on function public.get_object_history(text,text,bigint,integer) to anon,authenticated;
