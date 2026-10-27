-- Structured public aggregate evidence, separate from photo/PDF reports.
create table public.georgia_turnout_counties (fips text primary key, name text not null unique);
alter table public.georgia_turnout_counties enable row level security;
revoke all on public.georgia_turnout_counties from public,anon,authenticated;
-- Census 2020 county codes: https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt
insert into public.georgia_turnout_counties values
('13001','Appling'),
('13003','Atkinson'),
('13005','Bacon'),
('13007','Baker'),
('13009','Baldwin'),
('13011','Banks'),
('13013','Barrow'),
('13015','Bartow'),
('13017','Ben Hill'),
('13019','Berrien'),
('13021','Bibb'),
('13023','Bleckley'),
('13025','Brantley'),
('13027','Brooks'),
('13029','Bryan'),
('13031','Bulloch'),
('13033','Burke'),
('13035','Butts'),
('13037','Calhoun'),
('13039','Camden'),
('13043','Candler'),
('13045','Carroll'),
('13047','Catoosa'),
('13049','Charlton'),
('13051','Chatham'),
('13053','Chattahoochee'),
('13055','Chattooga'),
('13057','Cherokee'),
('13059','Clarke'),
('13061','Clay'),
('13063','Clayton'),
('13065','Clinch'),
('13067','Cobb'),
('13069','Coffee'),
('13071','Colquitt'),
('13073','Columbia'),
('13075','Cook'),
('13077','Coweta'),
('13079','Crawford'),
('13081','Crisp'),
('13083','Dade'),
('13085','Dawson'),
('13087','Decatur'),
('13089','DeKalb'),
('13091','Dodge'),
('13093','Dooly'),
('13095','Dougherty'),
('13097','Douglas'),
('13099','Early'),
('13101','Echols'),
('13103','Effingham'),
('13105','Elbert'),
('13107','Emanuel'),
('13109','Evans'),
('13111','Fannin'),
('13113','Fayette'),
('13115','Floyd'),
('13117','Forsyth'),
('13119','Franklin'),
('13121','Fulton'),
('13123','Gilmer'),
('13125','Glascock'),
('13127','Glynn'),
('13129','Gordon'),
('13131','Grady'),
('13133','Greene'),
('13135','Gwinnett'),
('13137','Habersham'),
('13139','Hall'),
('13141','Hancock'),
('13143','Haralson'),
('13145','Harris'),
('13147','Hart'),
('13149','Heard'),
('13151','Henry'),
('13153','Houston'),
('13155','Irwin'),
('13157','Jackson'),
('13159','Jasper'),
('13161','Jeff Davis'),
('13163','Jefferson'),
('13165','Jenkins'),
('13167','Johnson'),
('13169','Jones'),
('13171','Lamar'),
('13173','Lanier'),
('13175','Laurens'),
('13177','Lee'),
('13179','Liberty'),
('13181','Lincoln'),
('13183','Long'),
('13185','Lowndes'),
('13187','Lumpkin'),
('13189','McDuffie'),
('13191','McIntosh'),
('13193','Macon'),
('13195','Madison'),
('13197','Marion'),
('13199','Meriwether'),
('13201','Miller'),
('13205','Mitchell'),
('13207','Monroe'),
('13209','Montgomery'),
('13211','Morgan'),
('13213','Murray'),
('13215','Muscogee'),
('13217','Newton'),
('13219','Oconee'),
('13221','Oglethorpe'),
('13223','Paulding'),
('13225','Peach'),
('13227','Pickens'),
('13229','Pierce'),
('13231','Pike'),
('13233','Polk'),
('13235','Pulaski'),
('13237','Putnam'),
('13239','Quitman'),
('13241','Rabun'),
('13243','Randolph'),
('13245','Richmond'),
('13247','Rockdale'),
('13249','Schley'),
('13251','Screven'),
('13253','Seminole'),
('13255','Spalding'),
('13257','Stephens'),
('13259','Stewart'),
('13261','Sumter'),
('13263','Talbot'),
('13265','Taliaferro'),
('13267','Tattnall'),
('13269','Taylor'),
('13271','Telfair'),
('13273','Terrell'),
('13275','Thomas'),
('13277','Tift'),
('13279','Toombs'),
('13281','Towns'),
('13283','Treutlen'),
('13285','Troup'),
('13287','Turner'),
('13289','Twiggs'),
('13291','Union'),
('13293','Upson'),
('13295','Walker'),
('13297','Walton'),
('13299','Ware'),
('13301','Warren'),
('13303','Washington'),
('13305','Wayne'),
('13307','Webster'),
('13309','Wheeler'),
('13311','White'),
('13313','Whitfield'),
('13315','Wilcox'),
('13317','Wilkes'),
('13319','Wilkinson'),
('13321','Worth');
create table public.structured_turnout_reports (
 id uuid primary key default gen_random_uuid(), election_id uuid not null references public.elections(id),
 captured_at timestamptz not null, document text not null, sha256 text not null,
 tables jsonb not null, metadata jsonb not null,
 supersedes uuid unique references public.structured_turnout_reports(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(election_id,sha256)
);
alter table public.structured_turnout_reports enable row level security;
revoke all on public.structured_turnout_reports from public,anon,authenticated;
grant select on public.structured_turnout_reports to authenticated;
create policy "Admins inspect structured evidence" on public.structured_turnout_reports for select to authenticated using(public.is_admin());

-- Exact object keys and types at every level keep arbitrary session data out.
create function public.structured_turnout_keys(value jsonb, keys text[]) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='object' and value ?& keys and value-keys='{}'::jsonb,false)
$$;
revoke all on function public.structured_turnout_keys(jsonb,text[]) from public,anon,authenticated;

create function public.import_structured_turnout(p_document text,p_sha256 text,p_expected_report_id uuid default null,p_dry_run boolean default true)
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
   if r->>'ballot_style' is null or r->>'ballot_style' not in ('Early In-Person','Absentee')
   or r->>'counting_group' is distinct from (case when r->>'ballot_style'='Early In-Person' then 'advance' else 'absentee_mail' end)
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
 if n not between 1 and 636 then raise exception 'Import requires 1–636 source rows'; end if;
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

create function public.get_structured_turnout(p_election_id uuid,p_report_id uuid default null,p_offset int default 0,p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.elections; report public.structured_turnout_reports; rows jsonb; history jsonb;
begin
 select * into e from public.elections where id=p_election_id;
 if e.id is null or (e.visibility='private' and not public.is_admin()) then return jsonb_build_object('status','missing','rows','[]'::jsonb); end if;
 select * into report from public.structured_turnout_reports a where election_id=e.id and
 (case when p_report_id is not null then a.id=p_report_id else not exists(select 1 from public.structured_turnout_reports b where b.supersedes=a.id) end);
 if report.id is null then return jsonb_build_object('status','empty','rows','[]'::jsonb); end if;
 select coalesce(jsonb_agg(item order by tab,county,style),'[]'::jsonb) into rows from (
  select t->>'table' tab,r->>'county_fips' county,r->>'ballot_style' style,
   r||jsonb_build_object('table',t->>'table','object_id',t->>'object_id','as_of',t->'as_of','as_of_label',t->>'as_of_label','source_title',t->>'source_title') item
  from jsonb_array_elements(report.tables) t cross join lateral jsonb_array_elements(t->'rows') r
  order by tab,county,style limit least(greatest(coalesce(p_limit,100),1),100) offset greatest(coalesce(p_offset,0),0)
 ) page;
 select coalesce(jsonb_agg(item order by captured_at desc),'[]'::jsonb) into history from (
  select captured_at,jsonb_build_object('id',id,'captured_at',captured_at,'supersedes',supersedes) item
  from public.structured_turnout_reports where election_id=e.id order by captured_at desc limit 100
 ) h;
 return jsonb_build_object('status','ok','report',report.metadata||jsonb_build_object('id',report.id,'sha256',report.sha256,'supersedes',report.supersedes),
  'rows',rows,'total',(select sum(jsonb_array_length(t->'rows')) from jsonb_array_elements(report.tables) t),'history',history);
end $$;
revoke all on function public.get_structured_turnout(uuid,uuid,int,int) from public;
grant execute on function public.get_structured_turnout(uuid,uuid,int,int) to anon,authenticated;
