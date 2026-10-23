-- Regular accounts have anonymous content permissions; only admins see private content.
-- Explicit function definitions preserve existing signatures and grants.
grant execute on function public.is_admin() to anon;

CREATE OR REPLACE FUNCTION public.browse_calendar_events(p_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_offset integer DEFAULT 0, p_public_only boolean DEFAULT false)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select to_jsonb(e) - 'search_document' - 'site_search_document' || jsonb_build_object(
    'calendar_name', c.name, 'calendar_slug', c.slug, 'calendar_visibility', c.visibility,
    'organization_id', o.id, 'organization_name', o.name, 'organization_slug', o.slug,
    'election_name', el.name, 'election_slug', el.slug, 'election_visibility', el.visibility)
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
  left join public.elections el on el.id = e.election_id
  where (p_end is null or e.starts_at < p_end)
    and (p_start is null or coalesce(e.ends_at, e.starts_at) >= p_start)
    and (e.visibility = 'public' or (not p_public_only and (select public.is_admin())))
    and (c.visibility = 'public' or (not p_public_only and (select public.is_admin())))
    and (e.election_id is null or el.visibility = 'public'
      or (not p_public_only and (select public.is_admin()) and el.id is not null))
  order by e.starts_at, e.id
  limit 500 offset greatest(coalesce(p_offset, 0), 0);
$function$
;

CREATE OR REPLACE FUNCTION public.get_election(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.elections;
  o public.organizations;
  contests jsonb;
  dates jsonb;
  questions jsonb;
begin
  select * into e from public.elections where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if e.visibility = 'private' and not (select public.is_admin()) then
    return jsonb_build_object('status', 'private');
  end if;

  if e.organization_id is not null then
    select * into o from public.organizations where id = e.organization_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'election_id', c.election_id,
        'office', c.office,
        'district', c.district,
        'seat', c.seat,
        'description', c.description,
        'partisan', c.partisan,
        'position', c.position,
        'candidates', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'person', jsonb_build_object(
                  'id', p.id,
                  'slug', p.slug,
                  'full_name', p.full_name,
                  'kind', p.kind,
                  'title', p.title,
                  'image_path', p.image_path,
                  'visibility', p.visibility
                ),
                'party', cc.party,
                'is_write_in', cc.is_write_in,
                'status', cc.status,
                'position', cc.position
              )
              order by cc.position, p.full_name
            )
            from public.contest_candidates cc
            join public.people p on p.id = cc.person_id
            where cc.contest_id = c.id
              and (p.visibility = 'public' or (select public.is_admin()))
          ),
          '[]'::jsonb
        )
      )
      order by c.position, c.office, c.district
    ),
    '[]'::jsonb
  )
  into contests
  from public.contests c
  where c.election_id = e.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ev.id,
        'title', ev.title,
        'description', ev.description,
        'starts_at', ev.starts_at,
        'ends_at', ev.ends_at,
        'all_day', ev.all_day,
        'location', ev.location,
        'url', ev.url,
        'visibility', ev.visibility,
        'election_date_kind', ev.election_date_kind,
        'calendar_id', cal.id,
        'calendar_name', cal.name,
        'calendar_slug', cal.slug
      )
      order by ev.starts_at, ev.title
    ),
    '[]'::jsonb
  )
  into dates
  from public.events ev
  join public.calendars cal on cal.id = ev.calendar_id
  where ev.election_id = e.id
    and (
      ev.visibility = 'public'
      or ((select public.is_admin()) and ev.visibility in ('unlisted', 'private'))
    )
    and (
      cal.visibility = 'public'
      or ((select public.is_admin()) and cal.visibility in ('unlisted', 'private'))
    );

  select coalesce(jsonb_agg(to_jsonb(q) - 'created_at' - 'updated_at' order by q.position, q.title, q.id), '[]'::jsonb)
  into questions from public.ballot_questions q where q.election_id = e.id;

  return jsonb_build_object(
    'status', 'ok',
    'election', to_jsonb(e),
    'organization', case
      when o.id is null then null
      else jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name)
    end,
    'contests', contests,
    'ballot_questions', questions,
    'dates', dates
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_event(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.events;
  c public.calendars;
  o public.organizations;
  el public.elections;
begin
  select * into e from public.events where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  select * into c from public.calendars where id = e.calendar_id;
  select * into o from public.organizations where id = c.organization_id;
  if e.election_id is not null then
    select * into el from public.elections where id = e.election_id;
  end if;

  if (e.visibility = 'private' or c.visibility = 'private')
     and not (select public.is_admin()) then
    return jsonb_build_object('status', 'private');
  end if;

  if el.id is not null and el.visibility = 'private' and not (select public.is_admin()) then
    return jsonb_build_object('status', 'private');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'event', to_jsonb(e),
    'calendar', to_jsonb(c),
    'organization', to_jsonb(o),
    'election', case
      when el.id is null then null
      else jsonb_build_object(
        'id', el.id,
        'slug', el.slug,
        'name', el.name,
        'visibility', el.visibility
      )
    end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_map(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m public.maps;
begin
  select * into m from public.maps where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if m.visibility = 'private' and not (select public.is_admin()) then
    return jsonb_build_object('status', 'private');
  end if;

  return jsonb_build_object('status', 'ok', 'map', to_jsonb(m));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_map_layers(p_map_id uuid)
 RETURNS TABLE(id uuid, name text, description text, source_url text, visibility text, style jsonb, source_type text, presentation jsonb, visible_by_default boolean, "position" integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.id, l.name, l.description, l.source_url, l.visibility,
    l.style || coalesce(ml.style, '{}'::jsonb), l.source_type, l.presentation,
    ml.visible_by_default, ml.position
  from public.layers l join public.map_layers ml on ml.layer_id = l.id
  where ml.map_id = p_map_id
    and exists (select 1 from public.maps m where m.id = p_map_id
      and (m.visibility in ('public', 'unlisted') or (select public.is_admin())))
    and (l.visibility in ('public', 'unlisted') or (select public.is_admin()))
  order by ml.position, l.name;
$function$
;

CREATE OR REPLACE FUNCTION public.get_office_terms(p_person_id uuid DEFAULT NULL::uuid, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, office_id uuid, office_name text, district text, seat text, organization_id uuid, organization_name text, organization_slug text, person_id uuid, person_name text, person_slug text, person_visibility text, selection_method text, starts_on date, ends_on date, source_url text, service_status text, starts_on_precision text, ends_on_precision text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.id, o.id, o.name, o.district, o.seat, org.id, org.name, org.slug,
    p.id, p.full_name, p.slug, p.visibility, t.selection_method, t.starts_on, t.ends_on, t.source_url,
    case when t.starts_on > (now() at time zone 'America/New_York')::date then 'upcoming'
      when t.ends_on < (now() at time zone 'America/New_York')::date
        or (t.ends_on_precision = 'year' and extract(year from t.ends_on) <= extract(year from now() at time zone 'America/New_York')) then 'former'
      else 'current' end, t.starts_on_precision, t.ends_on_precision
  from public.office_terms t
  join public.offices o on o.id = t.office_id
  join public.organizations org on org.id = o.organization_id
  join public.people p on p.id = t.person_id
  where (p_person_id is not null or p_organization_id is not null)
    and (p_person_id is null or p.id = p_person_id)
    and (p_organization_id is null or org.id = p_organization_id)
    and (p.visibility = 'public' or (select public.is_admin())
      or (p_person_id is not null and p.visibility = 'unlisted'))
  order by t.starts_on desc, o.name, p.full_name, t.id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_organization_articles(p_organization_id uuid)
 RETURNS TABLE(id uuid, title text, url text, visibility text, role text, fetched_on date, published_on date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id,a.title,a.url,a.visibility,ao.role,a.fetched_on,a.published_on
  from public.articles a
  join public.article_organizations ao on ao.article_id=a.id
  join public.organizations o on o.id=ao.organization_id
  where o.id=p_organization_id
    and (a.visibility='public' or (select public.is_admin()))
  order by a.published_on desc nulls last,a.title,a.id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_person(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.people;
  orgs jsonb;
begin
  select * into p from public.people where id = p_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if p.visibility = 'private' and not (select public.is_admin()) then
    return jsonb_build_object('status', 'private');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'slug', o.slug,
        'name', o.name,
        'role', po.role
      )
      order by o.name
    ),
    '[]'::jsonb
  )
  into orgs
  from public.person_organizations po
  join public.organizations o on o.id = po.organization_id
  where po.person_id = p.id;

  return jsonb_build_object(
    'status', 'ok',
    'person', to_jsonb(p),
    'organizations', orgs
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_person_articles(p_person_id uuid)
 RETURNS TABLE(id uuid, title text, url text, visibility text, role text, fetched_on date, published_on date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id,a.title,a.url,a.visibility,ap.role,a.fetched_on,a.published_on
  from public.articles a
  join public.article_people ap on ap.article_id=a.id
  join public.people p on p.id=ap.person_id
  where p.id=p_person_id
    and (p.visibility in ('public','unlisted') or (select public.is_admin()))
    and (a.visibility='public' or (select public.is_admin()))
  order by a.published_on desc nulls last,a.title,a.id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_person_candidacies(p_person_id uuid)
 RETURNS TABLE(contest_id uuid, office text, district text, seat text, party text, status text, is_write_in boolean, election_id uuid, election_name text, election_slug text, election_date date, election_visibility text, is_current boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visible as (
    select c.id as contest_id, c.office, c.district, c.seat,
      cc.party, cc.status, cc.is_write_in,
      e.id as election_id, e.name as election_name, e.slug as election_slug,
      e.election_date, e.visibility as election_visibility,
      (e.election_date >= (now() at time zone 'America/New_York')::date
        and cc.status in ('running', 'runoff', 'pending')) as is_current
    from public.contest_candidates cc
    join public.contests c on c.id = cc.contest_id
    join public.elections e on e.id = c.election_id
    join public.people p on p.id = cc.person_id
    where cc.person_id = p_person_id
      and (p.visibility in ('public', 'unlisted') or (select public.is_admin()))
      and (e.visibility = 'public' or (select public.is_admin()))
  )
  select * from visible
  order by is_current desc,
    case when is_current then election_date end asc,
    case when not is_current then election_date end desc,
    election_name, office, district, seat, contest_id;
$function$
;

CREATE OR REPLACE FUNCTION public.list_calendars(p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, slug text, name text, description text, visibility text, organization_id uuid, organization_name text, organization_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    c.id,
    c.slug,
    c.name,
    c.description,
    c.visibility,
    o.id,
    o.name,
    o.slug
  from public.calendars c
  join public.organizations o on o.id = c.organization_id
  where (p_organization_id is null or c.organization_id = p_organization_id)
    and (
      c.visibility = 'public'
      or ((select public.is_admin()) and c.visibility in ('unlisted', 'private'))
    )
  order by o.name, c.name;
$function$
;

CREATE OR REPLACE FUNCTION public.mcp_get_record(p_type text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  record_json jsonb;
  election_id uuid;
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  case p_type
    when 'organization' then
      select to_jsonb(o) into record_json from public.organizations o where o.id = p_id;
    when 'calendar' then
      select to_jsonb(c) into record_json from public.calendars c where c.id = p_id
        and (c.visibility = 'public' or (select public.is_admin()));
    when 'layer' then
      select to_jsonb(l) into record_json from public.layers l where l.id = p_id
        and (l.visibility = 'public' or (select public.is_admin()));
    when 'article' then
      select to_jsonb(a) into record_json from public.articles a where a.id = p_id
        and (a.visibility = 'public' or (select public.is_admin()));
    when 'contest' then
      select c.election_id into election_id from public.contests c where c.id = p_id;
      select x.value into record_json
        from jsonb_array_elements(public.get_election(election_id)->'contests') x
        where x.value->>'id' = p_id::text;
    when 'ballot_question' then
      select b.election_id into election_id from public.ballot_questions b where b.id = p_id;
      select x.value into record_json
        from jsonb_array_elements(public.get_election(election_id)->'ballot_questions') x
        where x.value->>'id' = p_id::text;
    else raise exception 'Unknown record type' using errcode = '22023';
  end case;
  if record_json is null then return jsonb_build_object('status', 'missing'); end if;
  result := jsonb_build_object('status', 'ok', p_type, record_json - 'search_document' - 'site_search_document');
  if p_type = 'article' and (select public.is_admin()) then
    result := result || jsonb_build_object(
      'people', (select coalesce(jsonb_agg(jsonb_build_object('person_id', ap.person_id, 'role', ap.role) order by ap.person_id), '[]'::jsonb)
        from public.article_people ap where ap.article_id = p_id),
      'organizations', (select coalesce(jsonb_agg(jsonb_build_object('organization_id', ao.organization_id, 'role', ao.role) order by ao.organization_id), '[]'::jsonb)
        from public.article_organizations ao where ao.article_id = p_id));
  end if;
  return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.search_elections(p_query text DEFAULT ''::text, p_limit integer DEFAULT 50)
 RETURNS SETOF elections
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if btrim(coalesce(p_query,''))='' then
    return query select e.* from public.elections e
      where e.visibility='public' or (select public.is_admin())
      order by (e.election_date>=current_date) desc,
        case when e.election_date>=current_date then e.election_date end asc nulls last,
        case when e.election_date<current_date then e.election_date end desc nulls last,e.name,e.id
      limit least(greatest(coalesce(p_limit,50),1),100);
  else
    return query select e.* from public.search_site(p_query,'election',least(greatest(coalesce(p_limit,50),1),100),0) s
      join public.elections e on e.id=s.id order by s.rank desc,s.title,s.id;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.search_events(p_query text DEFAULT ''::text, p_organization_id uuid DEFAULT NULL::uuid, p_calendar_id uuid DEFAULT NULL::uuid, p_include_past boolean DEFAULT false, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, title text, description text, starts_at timestamp with time zone, ends_at timestamp with time zone, all_day boolean, location text, url text, visibility text, calendar_id uuid, calendar_name text, calendar_slug text, calendar_visibility text, organization_id uuid, organization_name text, organization_slug text, election_id uuid, election_date_kind text, election_name text, election_slug text, election_visibility text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q tsquery;
  lim int;
begin
  q := websearch_to_tsquery('english'::regconfig, coalesce(p_query, ''));
  lim := least(greatest(coalesce(p_limit, 50), 1), 100);

  return query
  select
    e.id,
    e.title,
    e.description,
    e.starts_at,
    e.ends_at,
    e.all_day,
    e.location,
    e.url,
    e.visibility,
    c.id,
    c.name,
    c.slug,
    c.visibility,
    o.id,
    o.name,
    o.slug,
    el.id,
    e.election_date_kind,
    el.name,
    el.slug,
    el.visibility
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  join public.organizations o on o.id = c.organization_id
  left join public.elections el on el.id = e.election_id
  where (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_calendar_id is null or e.calendar_id = p_calendar_id)
    and (p_include_past or e.starts_at >= date_trunc('day', now()))
    and (
      e.visibility = 'public'
      or ((select public.is_admin()) and e.visibility in ('unlisted', 'private'))
    )
    and (
      c.visibility = 'public'
      or ((select public.is_admin()) and c.visibility in ('unlisted', 'private'))
    )
    and (
      e.election_id is null
      or el.visibility = 'public'
      or ((select public.is_admin()) and el.visibility in ('unlisted', 'private'))
    )
    and (numnode(q) = 0 or e.search_document @@ q)
  order by
    case when numnode(q) = 0 then null else ts_rank(e.search_document, q) end desc nulls last,
    e.starts_at asc
  limit lim;
end;
$function$
;

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
      concat_ws(' ',c.name,o.name,(select e.name from ve e where e.id=ev.election_id))
    from public.events ev join vc c on c.id=ev.calendar_id join public.organizations o on o.id=c.organization_id
    left join public.elections el on el.id=ev.election_id
    where (ev.visibility='public' or admin_access)
      and (ev.election_id is null or el.visibility='public' or admin_access)
  ), matched as (
    select d.*,d.own_doc||to_tsvector('english'::regconfig,coalesce(d.related,'')) as full_doc from docs d
    where p_type is null or d.kind=p_type
  )
  select d.kind,d.id,d.heading,left(d.summary,800),d.href,d.access,
    case when needle='' then 0::real else ts_rank(d.full_doc,q) end as score
  from matched d
  where needle='' or d.full_doc@@q or strpos(lower(concat_ws(' ',d.own_text,d.related)),needle)>0
  order by score desc,d.heading,d.kind,d.id
  limit least(greatest(coalesce(p_limit,20),1),100) offset greatest(coalesce(p_offset,0),0);
end $function$
;

drop policy "Private maps are readable when signed in" on public.maps;
drop policy "Private layers are readable when signed in" on public.layers;
drop policy "Private calendars are readable when signed in" on public.calendars;
drop policy "Private people are readable when signed in" on public.people;
drop policy "Affiliations of private people are readable when signed in" on public.person_organizations;
drop policy "Private elections are readable when signed in" on public.elections;
drop policy "Private articles are readable when signed in" on public.articles;

-- Account profiles are personal data, not civic directory records.
drop policy "Profiles are publicly readable" on public.profiles;
create policy "Users and admins can read account profiles" on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));

create function public.admin_list_users(p_query text default '', p_offset integer default 0)
returns table(id uuid, email text, display_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return query select u.id, u.email::text, p.display_name,
    case when a.user_id is null then 'user'::text else 'admin'::text end, u.created_at
  from auth.users u left join public.profiles p on p.id = u.id
  left join public.admins a on a.user_id = u.id
  where strpos(lower(coalesce(u.email, '')), lower(coalesce(p_query, ''))) > 0
    or strpos(lower(coalesce(p.display_name, '')), lower(coalesce(p_query, ''))) > 0
  order by u.created_at desc, u.id limit 50 offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.admin_list_users(text, integer) from public, anon;
grant execute on function public.admin_list_users(text, integer) to authenticated;

create function public.promote_user_to_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Choose another user' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found' using errcode = '22023';
  end if;
  insert into public.admins(user_id) values (p_user_id) on conflict do nothing;
end;
$$;
revoke all on function public.promote_user_to_admin(uuid) from public, anon;
grant execute on function public.promote_user_to_admin(uuid) to authenticated;
