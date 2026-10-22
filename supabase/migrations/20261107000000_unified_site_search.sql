-- Search is a discovery surface. Anonymous users discover public records only.
-- Related names/text are gated before they can influence matches or ranking.
alter table public.organizations add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(name,'') || ' ' || coalesce(slug,'') || ' ' || coalesce(description,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(address_line,'') || ' ' || coalesce(website_url,'') || ' ' || coalesce(social_url,''))) stored;
create index organizations_site_search_idx on public.organizations using gin(site_search_document);
alter table public.people add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(full_name,'') || ' ' || coalesce(slug,'') || ' ' || coalesce(kind,'') || ' ' || coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(fax,'') || ' ' || coalesce(website_url,'') || ' ' || coalesce(social_url,'') || ' ' || coalesce(address_line,'') || ' ' || coalesce(address_line2,'') || ' ' || coalesce(city,'') || ' ' || coalesce(state,'') || ' ' || coalesce(postal_code,''))) stored;
create index people_site_search_idx on public.people using gin(site_search_document);
alter table public.elections add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(name,'') || ' ' || coalesce(slug,'') || ' ' || coalesce(kind,'') || ' ' || coalesce(description,''))) stored;
create index elections_site_search_idx on public.elections using gin(site_search_document);
alter table public.articles add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(title,'') || ' ' || coalesce(url,''))) stored;
create index articles_site_search_idx on public.articles using gin(site_search_document);
alter table public.maps add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(name,'') || ' ' || coalesce(slug,'') || ' ' || coalesce(description,'') || ' ' || coalesce(base_map,''))) stored;
create index maps_site_search_idx on public.maps using gin(site_search_document);
alter table public.layers add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(source_url,'') || ' ' || coalesce(source_type,''))) stored;
create index layers_site_search_idx on public.layers using gin(site_search_document);
alter table public.calendars add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(name,'') || ' ' || coalesce(slug,'') || ' ' || coalesce(description,''))) stored;
create index calendars_site_search_idx on public.calendars using gin(site_search_document);
alter table public.events add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'') || ' ' || coalesce(url,'') || ' ' || coalesce(election_date_kind,''))) stored;
create index events_site_search_idx on public.events using gin(site_search_document);
alter table public.contests add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(office,'') || ' ' || coalesce(district,'') || ' ' || coalesce(seat,'') || ' ' || coalesce(description,''))) stored;
create index contests_site_search_idx on public.contests using gin(site_search_document);
alter table public.ballot_questions add column site_search_document tsvector
  generated always as (to_tsvector('english'::regconfig,coalesce(title,'') || ' ' || coalesce(question_text,'') || ' ' || coalesce(description,'') || ' ' || coalesce(jurisdiction,'') || ' ' || coalesce(source_url,''))) stored;
create index ballot_questions_site_search_idx on public.ballot_questions using gin(site_search_document);
alter table public.layer_features add column site_search_document tsvector
  generated always as (jsonb_to_tsvector('english'::regconfig,properties,'["string", "numeric", "boolean", "key"]'::jsonb)) stored;
create index layer_features_site_search_idx on public.layer_features using gin(site_search_document);

create function public.search_site(p_query text default '',p_type text default null,
  p_limit integer default 20,p_offset integer default 0)
returns table(entity_type text,id uuid,title text,description text,url text,visibility text,rank real)
language plpgsql stable security definer set search_path='' as $$
declare
  signed_in boolean := (select auth.uid()) is not null;
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
  vp as materialized (select p.* from public.people p where p.visibility='public' or signed_in),
  ve as materialized (select e.* from public.elections e where e.visibility='public' or signed_in),
  va as materialized (select a.* from public.articles a where a.visibility='public' or signed_in),
  vm as materialized (select m.* from public.maps m where m.visibility='public' or signed_in),
  vl as materialized (select l.* from public.layers l where l.visibility='public' or signed_in),
  vc as materialized (select c.* from public.calendars c where c.visibility='public' or signed_in),
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
      case when ev.visibility='private' or c.visibility='private' then 'private'
        when ev.visibility='unlisted' or c.visibility='unlisted' then 'unlisted' else 'public' end,
      ev.site_search_document,concat_ws(' ',ev.title,ev.description,ev.location,ev.url,ev.starts_at::text,ev.ends_at::text,ev.election_date_kind),
      concat_ws(' ',c.name,o.name,(select e.name from ve e where e.id=ev.election_id))
    from public.events ev join vc c on c.id=ev.calendar_id join public.organizations o on o.id=c.organization_id
    where ev.visibility='public' or signed_in
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
end $$;
revoke execute on function public.search_site(text,text,integer,integer) from public;
grant execute on function public.search_site(text,text,integer,integer) to anon,authenticated;
comment on function public.search_site(text,text,integer,integer) is
  'Live civic content search, including permitted relationships and stored feature attributes. Discovery excludes hidden records/relationships for anonymous callers. Accounts and admin allowlists are never searched.';

create or replace function public.search_people(p_query text default '',p_limit int default 20)
returns setof public.people language sql stable security definer set search_path='' as $$
  select x.* from public.search_site(p_query,'person',least(greatest(coalesce(p_limit,20),1),50),0) s
  join public.people x on x.id=s.id order by s.rank desc,s.title,s.id;
$$;

create or replace function public.search_organizations(p_query text,p_limit int default 20)
returns setof public.organizations language sql stable security invoker set search_path='' as $$
  select x.* from public.search_site(p_query,'organization',least(greatest(coalesce(p_limit,20),1),50),0) s
  join public.organizations x on x.id=s.id order by s.rank desc,s.title,s.id;
$$;

create or replace function public.search_maps(p_query text,p_limit int default 20)
returns setof public.maps language sql stable security definer set search_path='' as $$
  select x.* from public.search_site(p_query,'map',least(greatest(coalesce(p_limit,20),1),50),0) s
  join public.maps x on x.id=s.id order by s.rank desc,s.title,s.id;
$$;

create or replace function public.search_elections(p_query text default '',p_limit int default 50)
returns setof public.elections language sql stable security definer set search_path='' as $$
  select x.* from public.search_site(p_query,'election',least(greatest(coalesce(p_limit,50),1),100),0) s
  join public.elections x on x.id=s.id order by s.rank desc,s.title,s.id;
$$;

-- Keep hidden candidates out of anonymous election detail payloads too.
create or replace function public.get_election(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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

  if e.visibility = 'private' and (select auth.uid()) is null then
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
              and (p.visibility = 'public' or (select auth.uid()) is not null)
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
      or ((select auth.uid()) is not null and ev.visibility in ('unlisted', 'private'))
    )
    and (
      cal.visibility = 'public'
      or ((select auth.uid()) is not null and cal.visibility in ('unlisted', 'private'))
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
$$;

comment on function public.get_election(uuid) is
  'Returns {status: ok|private|missing, election?, organization?, contests?, ballot_questions?, dates?} for an election id, honoring election and event visibility.';

revoke execute on function public.get_election(uuid) from public;
grant execute on function public.get_election(uuid) to anon, authenticated;
