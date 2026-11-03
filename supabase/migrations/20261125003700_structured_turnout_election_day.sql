-- Extend only the existing source turnout view; preserve evidence and revision guards.
-- 159 counties × (early + absentee + three turnout styles) = 795 rows.
create or replace function public.import_structured_turnout(p_document text,p_sha256 text,p_expected_report_id uuid default null,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 d jsonb; t jsonb; r jsonb; cell jsonb; k text; names text[]; object_id text; seen text[]:='{}';
 identities text[]; identity text; n int:=0; captured timestamptz; as_of timestamptz;
 e public.elections; prev public.structured_turnout_reports; duplicate public.structured_turnout_reports; result_id uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_dry_run is null or p_document is null or octet_length(p_document) not between 2 and 2097152 then raise exception 'JSON evidence must be at most 2 MiB'; end if;
 if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or encode(sha256(convert_to(p_document,'UTF8')),'hex')<>p_sha256 then raise exception 'Evidence checksum mismatch'; end if;
 d:=p_document::jsonb;
 if not public.structured_turnout_keys(d,array['schema_version','provider','election_id','election_date','status','source_url','app_id','capture_run_id','captured_at','upstream_sha256','tables'])
 or d->'schema_version' is distinct from '1'::jsonb or d->>'provider' is distinct from 'georgia-sos-turnout' or d->>'status' is distinct from 'unofficial'
 or d->>'source_url' is distinct from 'https://sos.ga.gov/page/election-data-hub-unofficial-turnout' or d->>'app_id' is distinct from '137c0a43-928b-427a-a267-eb55aa7fa8a9'
 or coalesce(d->>'upstream_sha256','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(d->'tables') is distinct from 'array' or jsonb_array_length(d->'tables')<>3
 then raise exception 'Unsupported structured source schema or identity'; end if;
 foreach k in array array['provider','election_id','election_date','status','source_url','app_id','capture_run_id','captured_at','upstream_sha256'] loop
  if jsonb_typeof(d->k) is distinct from 'string' then raise exception 'Source metadata must be strings'; end if;
 end loop;
 if (d->>'capture_run_id')::uuid is null then raise exception 'Capture identity required'; end if;
 captured:=(d->>'captured_at')::timestamptz;
 if captured is null or not isfinite(captured) or captured>now()+interval '5 minutes' or d->>'captured_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Invalid capture time'; end if;
 select * into e from public.elections where id=(d->>'election_id')::uuid for update;
 if e.id is null or d->>'election_date' is distinct from e.election_date::text then raise exception 'Election identity/date mismatch'; end if;
 for t in select value from jsonb_array_elements(d->'tables') loop
  if not public.structured_turnout_keys(t,array['table','object_id','source_title','as_of_label','as_of','as_of_timezone','rows'])
  or jsonb_typeof(t->'rows') is distinct from 'array' or jsonb_array_length(t->'rows')>1000
  or jsonb_typeof(t->'source_title') is distinct from 'string' or length(t->>'source_title') not between 1 and 300
  or jsonb_typeof(t->'as_of_label') is distinct from 'string' or length(t->>'as_of_label')>200
  or t->>'as_of_timezone' is distinct from 'America/New_York' then raise exception 'Invalid table schema'; end if;
  if t->>'table'=any(seen) then raise exception 'Duplicate table'; end if;seen:=array_append(seen,t->>'table');
  case t->>'table'
   when 'early' then object_id:='7cc869cd-2124-43be-82f4-1c8d394dc6d8';names:=array['accepted'];
   when 'absentee' then object_id:='CTgPMg';names:=array['requested','issued','returned','accepted','rejected','spoiled_canceled','outstanding','acceptance_ratio'];
   when 'turnout' then object_id:='QDFdpV';names:=array['turnout'];
   else raise exception 'Unknown table';
  end case;
  if t->>'object_id' is distinct from object_id then raise exception 'Object identity mismatch'; end if;
  as_of:=(t->>'as_of')::timestamptz;
  if t->>'as_of_label'='' then
   if t->'as_of'<>'null'::jsonb then raise exception 'Missing source time must stay null'; end if;
  elsif as_of is null or not isfinite(as_of) or as_of>captured or t->>'as_of' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
   or t->>'as_of_label' <> '*Data as of : ' || to_char(as_of at time zone 'America/New_York','FMMM/FMDD/YYYY FMHH12:MI:SS AM')
   then raise exception 'Source as-of label/time mismatch';
  end if;
  identities:='{}';
  for r in select value from jsonb_array_elements(t->'rows') loop
   n:=n+1;
   if not public.structured_turnout_keys(r,array['county_fips','county_label','ballot_style','counting_group','locator','measures'])
   or not exists(select 1 from public.georgia_turnout_counties c where c.fips=r->>'county_fips' and upper(c.name)=upper(r->>'county_label'))
   or jsonb_typeof(r->'locator') is distinct from 'string' or length(r->>'locator') not between 1 and 500
   or not public.structured_turnout_keys(r->'measures',names)
   then raise exception 'Invalid county identity, locator or measure schema'; end if;
   if r->>'ballot_style' is null or r->>'ballot_style' not in ('Early In-Person','Absentee','Election Day In-Person')
   or r->>'counting_group' is distinct from (case when r->>'ballot_style'='Early In-Person' then 'advance' when r->>'ballot_style'='Absentee' then 'absentee_mail' else 'election_day' end)
   or (t->>'table'='early' and r->>'ballot_style'<>'Early In-Person') or (t->>'table'='absentee' and r->>'ballot_style'<>'Absentee')
   then raise exception 'Invalid ballot style/counting group'; end if;
   identity:=(r->>'county_fips')||':'||(r->>'ballot_style');
   if identity=any(identities) then raise exception 'Duplicate county/ballot style'; end if;identities:=array_append(identities,identity);
   foreach k in array names loop
    cell:=r->'measures'->k;
    if not public.structured_turnout_keys(cell,array['value','display']) or jsonb_typeof(cell->'display') is distinct from 'string' or length(cell->>'display')>200 then raise exception 'Invalid measure cell'; end if;
    if cell->'value'<>'null'::jsonb then
     if jsonb_typeof(cell->'value') is distinct from 'number' then raise exception 'Numeric measure required'; end if;
     if (cell->>'value')::numeric<0 or (cell->>'value')::numeric>9007199254740991
     or (k='acceptance_ratio' and (cell->>'value')::numeric>1)
     or (k<>'acceptance_ratio' and trunc((cell->>'value')::numeric)<>(cell->>'value')::numeric) then raise exception 'Invalid count or ratio'; end if;
    end if;
   end loop;
  end loop;
 end loop;
 if n not between 1 and 795 then raise exception 'Import requires 1–795 source rows'; end if;
 select * into duplicate from public.structured_turnout_reports where election_id=e.id and sha256=p_sha256;
 if duplicate.id is not null then return jsonb_build_object('status','duplicate','report_id',duplicate.id,'dry_run',p_dry_run); end if;
 select * into prev from public.structured_turnout_reports a where a.election_id=e.id and not exists(select 1 from public.structured_turnout_reports b where b.supersedes=a.id);
 if prev.tables=d->'tables' then return jsonb_build_object('status','duplicate','report_id',prev.id,'dry_run',p_dry_run); end if;
 if prev.id is distinct from p_expected_report_id then raise exception 'Report changed: reread current report before replacement'; end if;
 if prev.id is not null then
  if captured<=prev.captured_at then raise exception 'Stale capture cannot replace current report'; end if;
  for t in select value from jsonb_array_elements(d->'tables') loop
   select value into r from jsonb_array_elements(prev.tables) where value->>'table'=t->>'table';
   if r->>'as_of' is not null and (t->>'as_of' is null or (t->>'as_of')::timestamptz<(r->>'as_of')::timestamptz
    or ((t->>'as_of')::timestamptz=(r->>'as_of')::timestamptz and t->'rows'<>r->'rows')) then raise exception 'Stale or conflicting source time'; end if;
  end loop;
 end if;
 if p_dry_run then return jsonb_build_object('status','validated','row_count',n,'supersedes',prev.id,'dry_run',true); end if;
 insert into public.structured_turnout_reports(election_id,captured_at,document,sha256,tables,metadata,supersedes,created_by)
 values(e.id,captured,p_document,p_sha256,d->'tables',d-'tables',prev.id,auth.uid()) returning id into result_id;
 return jsonb_build_object('status','saved','report_id',result_id,'row_count',n,'supersedes',prev.id,'dry_run',false);
end $$;
revoke all on function public.import_structured_turnout(text,text,uuid,boolean) from public,anon;
grant execute on function public.import_structured_turnout(text,text,uuid,boolean) to authenticated;

