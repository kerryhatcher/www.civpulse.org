-- Append-only performance improvements; preserve RPC signatures and visibility.
-- Tables are small; short lock/statement timeouts fail rather than block edits.
set local lock_timeout='5s';
set local statement_timeout='60s';

create index if not exists map_layers_layer_id_idx on public.map_layers(layer_id);
create index if not exists meeting_attendance_person_id_idx on public.meeting_attendance(person_id);
create index if not exists meeting_vote_choices_meeting_person_idx on public.meeting_vote_choices(meeting_id,person_id);
create index if not exists meeting_vote_choices_vote_meeting_idx on public.meeting_vote_choices(vote_id,meeting_id);
create index if not exists records_request_transfers_actor_idx on public.records_request_transfers(actor_id);
create index if not exists records_request_transfers_from_user_idx on public.records_request_transfers(from_user_id);
create index if not exists records_request_transfers_to_user_idx on public.records_request_transfers(to_user_id);

-- Avoid fetching and sorting every visible layer just to authorize one page.
CREATE OR REPLACE FUNCTION public.get_layer_geojson_page(p_layer_id uuid, p_map_id uuid DEFAULT NULL::uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; total integer;
begin
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Expected a nonnegative offset and limit between 1 and 100' using errcode = '22023';
  end if;
  if not public.is_admin() and not exists (
    select 1 from public.map_layers ml
    join public.maps m on m.id=ml.map_id
    join public.layers l on l.id=ml.layer_id
    where ml.map_id=p_map_id and ml.layer_id=p_layer_id
      and m.visibility in ('public','unlisted') and l.visibility in ('public','unlisted')
  ) then raise exception 'Layer not accessible' using errcode = '42501'; end if;
  select count(*) into total from public.layer_features where layer_id = p_layer_id;
  select coalesce(jsonb_agg(jsonb_build_object('type', 'Feature',
    'geometry', extensions.st_asgeojson(f.geometry, 15)::jsonb, 'properties', f.properties) ||
    case when f.feature_id is null then '{}'::jsonb else jsonb_build_object('id', f.feature_id) end
    order by f.position), '[]'::jsonb) into result
  from (select * from public.layer_features where layer_id = p_layer_id
    order by position limit p_limit offset p_offset) f;
  return jsonb_build_object('type', 'FeatureCollection', 'features', result, 'numberMatched', total);
end $function$;

-- Materialize visibility-filtered text once before matching and ranking.
CREATE OR REPLACE FUNCTION public.search_site(p_query text DEFAULT ''::text, p_type text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(entity_type text, id uuid, title text, description text, url text, visibility text, rank real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  admin_access boolean := (select public.is_admin());
  admin_user boolean := (select public.is_admin());
  needle text := lower(btrim(coalesce(p_query,'')));
  q tsquery := websearch_to_tsquery('english'::regconfig,coalesce(p_query,''));
begin
  if char_length(coalesce(p_query,''))>500 then
    raise exception 'Search query must be 500 characters or fewer' using errcode='22023';
  end if;
  if p_type is not null and p_type not in ('organization','person','election','contest','ballot_question','article','map','layer','calendar','event') then
    raise exception 'Unknown search type' using errcode='22023';
  end if;
  return query
  with
  vp as materialized (select p.* from public.people p where p.visibility='public' or admin_access),
  ve as materialized (select e.* from public.elections e where e.visibility='public' or admin_access),
  va as materialized (select a.* from public.articles a where a.visibility='public' or admin_access),
  vm as materialized (select m.* from public.maps m where m.visibility='public' or admin_access),
  vl as materialized (select l.* from public.layers l where l.visibility='public' or admin_access),
  vc as materialized (select c.* from public.calendars c where c.visibility='public' or admin_access),
  races as materialized (
    select c.*,e.name as election_name,e.election_date,e.visibility,
      '/elections/view/?id='||e.id::text||'#contest-'||c.id::text as href,
      concat_ws(' ',e.name,e.election_date::text,
        (select string_agg(concat_ws(' ',p.full_name,cc.party,cc.status,
          case when cc.is_write_in then 'write-in certified write in' else 'ballot candidate' end),' ')
         from public.contest_candidates cc join vp p on p.id=cc.person_id where cc.contest_id=c.id)) as related
    from public.contests c join ve e on e.id=c.election_id
  ),
  questions as materialized (
    select b.*,e.visibility,e.name as election_name,
      '/elections/view/?id='||e.id::text||'#question-'||b.id::text as href,
      concat_ws(' ',e.name,e.election_date::text,array_to_string(b.choices,' ')) as related
    from public.ballot_questions b join ve e on e.id=b.election_id
  ),
  docs as (
    select 'organization'::text as kind,o.id,o.name as heading,o.description as summary,
      '/orgs/'||o.slug||'/' as href,'public'::text as access,o.site_search_document as own_doc,
      concat_ws(' ',o.name,o.slug,o.description,o.email,o.phone,o.address_line,o.website_url,o.social_url) as own_text,
      coalesce((select string_agg(concat_ws(' ',p.full_name,po.role),' ')
        from public.person_organizations po join vp p on p.id=po.person_id where po.organization_id=o.id),'') as related
    from public.organizations o
    union all
    select 'person',p.id,p.full_name,p.description,
      case when p.visibility='public' then '/people/'||p.slug||'/' else '/people/view/?id='||p.id::text end,
      p.visibility,p.site_search_document,
      concat_ws(' ',p.full_name,p.slug,p.kind,p.title,p.description,p.email,p.phone,p.fax,p.website_url,p.social_url,p.address_line,p.address_line2,p.city,p.state,p.postal_code),
      concat_ws(' ',
        (select string_agg(concat_ws(' ',o.name,po.role),' ') from public.person_organizations po join public.organizations o on o.id=po.organization_id where po.person_id=p.id),
        (select string_agg(concat_ws(' ',r.office,r.district,r.seat,r.election_name,r.election_date::text,cc.party,cc.status,
          case when cc.is_write_in then 'write-in certified write in' else 'ballot candidate' end),' ')
         from public.contest_candidates cc join races r on r.id=cc.contest_id where cc.person_id=p.id))
    from vp p
    union all
    select 'election',e.id,e.name,e.description,
      case when e.visibility='public' then '/elections/'||e.slug||'/' else '/elections/view/?id='||e.id::text end,
      e.visibility,e.site_search_document,concat_ws(' ',e.name,e.slug,e.kind,e.description,e.election_date::text),
      concat_ws(' ',(select o.name from public.organizations o where o.id=e.organization_id),
        (select string_agg(concat_ws(' ',r.office,r.district,r.seat,r.description,r.related),' ') from races r where r.election_id=e.id),
        (select string_agg(concat_ws(' ',b.title,b.question_text,b.description,b.jurisdiction,b.related),' ') from questions b where b.election_id=e.id))
    from ve e
    union all
    select 'contest',r.id,concat_ws(', ',r.office,nullif(r.district,'')),
      concat_ws(' · ',r.election_name,r.election_date::text,nullif(r.description,'')),r.href,r.visibility,r.site_search_document,
      concat_ws(' ',r.office,r.district,r.seat,r.description),r.related from races r
    union all
    select 'ballot_question',b.id,b.title,concat_ws(' · ',b.election_name,b.question_text),b.href,b.visibility,b.site_search_document,
      concat_ws(' ',b.title,b.question_text,b.description,b.jurisdiction,b.source_url),b.related from questions b
    union all
    select 'article',a.id,a.title,
      concat_ws(' · ',case when a.published_on is not null then 'Published '||a.published_on::text end,
        case when a.fetched_on is not null then 'Fetched on '||a.fetched_on::text end),a.url,a.visibility,a.site_search_document,
      concat_ws(' ',a.title,a.url,a.published_on::text,a.fetched_on::text),
      concat_ws(' ',(select string_agg(concat_ws(' ',p.full_name,ap.role),' ') from public.article_people ap join vp p on p.id=ap.person_id where ap.article_id=a.id),
        (select string_agg(concat_ws(' ',o.name,ao.role),' ') from public.article_organizations ao join public.organizations o on o.id=ao.organization_id where ao.article_id=a.id))
    from va a
    union all
    select 'map',m.id,m.name,m.description,
      case when m.visibility='public' then '/maps/'||m.slug||'/' else '/maps/view/?id='||m.id::text end,
      m.visibility,m.site_search_document,concat_ws(' ',m.name,m.slug,m.description,m.base_map),
      concat_ws(' ',(select o.name from public.organizations o where o.id=m.organization_id),
        (select string_agg(concat_ws(' ',l.name,l.description),' ') from public.map_layers ml join vl l on l.id=ml.layer_id where ml.map_id=m.id))
    from vm m
    union all
    select 'layer',l.id,l.name,l.description,
      coalesce(map_link.href,case when admin_user then '/admin/layers/?edit='||l.id::text end),
      l.visibility,l.site_search_document,concat_ws(' ',l.name,l.description,l.source_url,l.source_type),
      concat_ws(' ',map_link.map_name,
        case when admin_user or map_link.href is not null then
          (select string_agg(f.properties::text,' ') from public.layer_features f where f.layer_id=l.id)
        end)
    from vl l
    left join lateral (
      select '/maps/view/?id='||m.id::text as href,m.name as map_name from public.map_layers ml
      join vm m on m.id=ml.map_id where ml.layer_id=l.id order by m.name,m.id limit 1
    ) map_link on true
    union all
    select 'calendar',c.id,c.name,c.description,'/calendar/?calendar='||c.id::text||'&past=1',c.visibility,c.site_search_document,
      concat_ws(' ',c.name,c.slug,c.description),o.name from vc c join public.organizations o on o.id=c.organization_id
    union all
    select 'event',ev.id,ev.title,concat_ws(' · ',ev.starts_at::text,ev.location,ev.description),
      '/calendar/view/?id='||ev.id::text,
      case when ev.visibility='private' or c.visibility='private' or el.visibility='private' then 'private'
        when ev.visibility='unlisted' or c.visibility='unlisted' or el.visibility='unlisted' then 'unlisted' else 'public' end,
      ev.site_search_document,concat_ws(' ',ev.title,ev.description,ev.location,ev.url,ev.starts_at::text,ev.ends_at::text,ev.election_date_kind),
      concat_ws(' ',c.name,o.name,(select e.name from ve e where e.id=ev.election_id),
        case when ev.is_meeting then concat_ws(' ',ev.meeting_notes,ev.meeting_transcript,
          (select string_agg(concat_ws(' ',v.subject,v.description,v.outcome),' ' order by v.position,v.id)
           from public.meeting_votes v where v.meeting_id=ev.id)) end)
    from public.events ev join vc c on c.id=ev.calendar_id join public.organizations o on o.id=c.organization_id
    left join public.elections el on el.id=ev.election_id
    where (ev.visibility='public' or admin_access)
      and (ev.election_id is null or el.visibility='public' or admin_access)
  ), typed_docs as materialized (
    -- Evaluate related text once, after selecting the requested entity type.
    select d.kind,d.id,d.heading,d.summary,d.href,d.access,d.own_doc,
      case when needle='' then '' else d.own_text end as own_text,
      case when needle='' then '' else d.related end as related
    from docs d where p_type is null or d.kind=p_type
  ), matched as materialized (
    select d.*,case when needle='' then ''::tsvector
      else d.own_doc||to_tsvector('english'::regconfig,coalesce(d.related,'')) end as full_doc
    from typed_docs d
  )
  select d.kind,d.id,d.heading,left(d.summary,800),d.href,d.access,
    case when needle='' then 0::real else ts_rank(d.full_doc,q) end as score
  from matched d
  where needle='' or d.full_doc@@q or strpos(lower(concat_ws(' ',d.own_text,d.related)),needle)>0
  order by score desc,d.heading,d.kind,d.id
  limit least(greatest(coalesce(p_limit,20),1),100) offset greatest(coalesce(p_offset,0),0);
end $function$;

notify pgrst,'reload schema';

