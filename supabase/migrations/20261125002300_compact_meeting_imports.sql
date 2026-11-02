-- Partial, ordered import: each observation retains the original immutable authority.
-- The envelope is one transaction; rejected rows do not undo accepted rows.
create function public.import_meeting_records_compact(p_meeting_id uuid,p_provider text,
 p_records jsonb,p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; receipt jsonb; result jsonb; errors jsonb:='[]'; made integer:=0; same integer:=0; rejected integer:=0; idx integer:=0;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 2000
 or octet_length(p_records::text)>2097152 then raise exception 'records: 1–2000 expanded observations, maximum 2 MiB'; end if;
 if p_provider is null or length(p_provider) not between 1 and 100 then raise exception 'provider: 1–100 characters required'; end if;
 perform 1 from public.events where id=p_meeting_id and is_meeting for update;
 if not found then raise exception 'Existing meeting required'; end if;
 begin
  for r in select value from jsonb_array_elements(p_records) loop
   receipt:=public.import_meeting_records(p_meeting_id,p_provider,jsonb_build_array(r),false);
   made:=made+coalesce((receipt->>'created')::integer,0);
   same:=same+coalesce((receipt->>'unchanged')::integer,0);
   if receipt->>'status'<>'ok' then
    rejected:=rejected+1;
    errors:=errors||jsonb_build_array(jsonb_build_object('index',idx,'source_key',r->>'source_key','errors',receipt->'errors'));
   end if;
   idx:=idx+1;
  end loop;
  result:=jsonb_build_object('status',case when rejected>0 then 'partial' else 'ok' end,'dry_run',coalesce(p_dry_run,true),
   'semantics','ordered partial observations; one transaction; dry run rolls back all','created',made,'unchanged',same,'updated',0,'rejected',rejected,'errors',errors);
  if coalesce(p_dry_run,true) then raise exception using errcode='P0043',message='dry run'; end if;
 exception when sqlstate 'P0043' then return result;
 end;
 return result;
end; $$;
revoke all on function public.import_meeting_records_compact(uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.import_meeting_records_compact(uuid,text,jsonb,boolean) to authenticated;
