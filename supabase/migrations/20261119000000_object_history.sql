-- Civic content history. Account/Auth data is deliberately outside this registry.
create schema if not exists audit;
revoke all on schema audit from public, anon, authenticated;
create table audit.objects (
  table_name text primary key,
  key_columns text[] not null,
  parents jsonb not null default '{}'::jsonb
);
alter table audit.objects enable row level security;
insert into audit.objects(table_name,key_columns,parents) values
('organizations',array['id'],'{}'),
('people',array['id'],'{}'),
('elections',array['id'],'{"organization_id":"organizations"}'),
('offices',array['id'],'{"organization_id":"organizations"}'),
('office_terms',array['id'],'{"office_id":"offices","person_id":"people"}'),
('contests',array['id'],'{"election_id":"elections","office_id":"offices"}'),
('contest_candidates',array['contest_id','person_id'],'{"contest_id":"contests","person_id":"people"}'),
('ballot_questions',array['id'],'{"election_id":"elections"}'),
('person_organizations',array['person_id','organization_id'],'{"person_id":"people","organization_id":"organizations"}'),
('organization_relationships',array['id'],'{"organization_id":"organizations","related_organization_id":"organizations"}'),
('articles',array['id'],'{}'),
('article_people',array['article_id','person_id'],'{"article_id":"articles","person_id":"people"}'),
('article_organizations',array['article_id','organization_id'],'{"article_id":"articles","organization_id":"organizations"}'),
('maps',array['id'],'{"organization_id":"organizations"}'),
('layers',array['id'],'{}'),
('layer_features',array['id'],'{"layer_id":"layers"}'),
('map_layers',array['map_id','layer_id'],'{"map_id":"maps","layer_id":"layers"}'),
('calendars',array['id'],'{"organization_id":"organizations"}'),
('events',array['id'],'{"calendar_id":"calendars","election_id":"elections"}'),
('meeting_attendance',array['meeting_id','person_id'],'{"meeting_id":"events","person_id":"people"}'),
('meeting_votes',array['id'],'{"meeting_id":"events"}'),
('meeting_vote_choices',array['vote_id','person_id'],'{"vote_id":"meeting_votes","meeting_id":"events","person_id":"people"}'),
('meeting_attachments',array['id'],'{"meeting_id":"events"}');

create table audit.revisions (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default clock_timestamp(),
  transaction_id bigint not null default txid_current(),
  table_name text not null,
  object_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  actor_id uuid, -- no FK: attribution survives account deletion
  actor_name text not null,
  before_data jsonb,
  after_data jsonb,
  public_at_change boolean not null,
  subjects jsonb not null
);
alter table audit.revisions enable row level security;
create index revisions_subjects_idx on audit.revisions using gin(subjects jsonb_path_ops);
create index revisions_order_idx on audit.revisions(id desc);

-- Recursively include the owning objects and all visibility-bearing references.
-- Registry names alone are interpolated; caller input never becomes SQL identifiers.
create function audit.describe_row(p_table text, p_row jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare config audit.objects; ident text; subjects jsonb; is_public boolean;
  parent record; parent_row jsonb; info jsonb;
begin
  select * into config from audit.objects where table_name = p_table;
  if not found or p_row is null then return null; end if;
  if config.key_columns = array['id'] then ident := p_row->>'id';
  else
    select jsonb_object_agg(k,p_row->k)::text into ident from unnest(config.key_columns) k;
  end if;
  subjects := jsonb_build_array(jsonb_build_object('table',p_table,'id',ident));
  is_public := coalesce(p_row->>'visibility','public') = 'public';
  for parent in select key, value from jsonb_each_text(config.parents) loop
    if p_row->>parent.key is not null then
      execute format('select to_jsonb(t) from public.%I t where id = $1::uuid',parent.value)
        into parent_row using p_row->>parent.key;
      info := audit.describe_row(parent.value,parent_row);
      is_public := is_public and coalesce((info->>'public')::boolean,false);
      subjects := subjects || coalesce(info->'subjects','[]'::jsonb);
    end if;
  end loop;
  return jsonb_build_object('id',ident,'public',is_public,'subjects',subjects);
end;
$$;

create function audit.capture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb; bi jsonb; ai jsonb; actor uuid := auth.uid(); name text;
begin
  if tg_op <> 'INSERT' then b := to_jsonb(old) - 'search_vector' - 'updated_at'; end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new) - 'search_vector' - 'updated_at'; end if;
  if b is not distinct from a then return null; end if;
  bi := audit.describe_row(tg_table_name,b);
  ai := audit.describe_row(tg_table_name,a);
  select nullif(trim(display_name),'') into name from public.profiles where id = actor;
  insert into audit.revisions(table_name,object_id,operation,actor_id,actor_name,before_data,after_data,public_at_change,subjects)
  values(tg_table_name,coalesce(ai->>'id',bi->>'id'),tg_op,actor,
    coalesce(name,case when actor is null then 'System / import' else 'Editor' end),b,a,
    coalesce((bi->>'public')::boolean,true) and coalesce((ai->>'public')::boolean,true),
    coalesce(bi->'subjects','[]'::jsonb) || coalesce(ai->'subjects','[]'::jsonb));
  return null;
end;
$$;
revoke all on function audit.capture() from public;
revoke all on function audit.describe_row(text,jsonb) from public;
do $$ declare t record; begin
  for t in select table_name from audit.objects loop
    execute format('create trigger record_history after insert or update or delete on public.%I for each row execute function audit.capture()',t.table_name);
  end loop;
end $$;

-- Public revisions must be public at the time AND have all referenced objects
-- still public today. Removed objects and cascading deletes remain admin-only.
create function audit.subjects_public(p_subjects jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare s jsonb; config audit.objects; row_data jsonb; info jsonb; key_data jsonb; tombstone audit.revisions;
begin
  for s in select value from jsonb_array_elements(p_subjects) loop
    select * into config from audit.objects where table_name = s->>'table';
    if not found then return false; end if;
    if config.key_columns = array['id'] then
      execute format('select to_jsonb(t) from public.%I t where id::text = $1',config.table_name)
        into row_data using s->>'id';
    else
      key_data := (s->>'id')::jsonb;
      execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1',config.table_name)
        into row_data using key_data;
    end if;
    if row_data is null then
      select * into tombstone from audit.revisions
        where table_name = s->>'table' and object_id = s->>'id' order by id desc limit 1;
      if not found or tombstone.operation <> 'DELETE' or not tombstone.public_at_change then return false; end if;
      row_data := tombstone.before_data;
    end if;
    info := audit.describe_row(config.table_name,row_data);
    if not coalesce((info->>'public')::boolean,false) then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function audit.subjects_public(jsonb) from public;

create function public.get_object_history(
  p_table text default null, p_object_id text default null,
  p_before bigint default null, p_limit integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare admin boolean := public.is_admin(); result jsonb;
begin
  -- Only admins can browse the global feed. Public requests require an object.
  if not admin and (p_table is null or p_object_id is null) then
    return jsonb_build_object('admin',false,'revisions','[]'::jsonb);
  end if;
  if p_table is not null and not exists(select 1 from audit.objects where table_name=p_table) then
    return jsonb_build_object('admin',admin,'revisions','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(item order by id desc),'[]'::jsonb) into result from (
    select r.id, jsonb_build_object('id',r.id::text,'changed_at',r.changed_at,
      'transaction_id',r.transaction_id::text,'table_name',r.table_name,'object_id',r.object_id,
      'operation',r.operation,'actor_name',r.actor_name,
      'actor_id',case when admin then r.actor_id else null end,
      'before',r.before_data,'after',r.after_data) as item
    from audit.revisions r
    where (p_before is null or r.id < p_before)
      and (p_table is null or (p_object_id is null and r.table_name=p_table)
        or r.subjects @> jsonb_build_array(jsonb_build_object('table',p_table,'id',p_object_id)))
      and (admin or (r.public_at_change and audit.subjects_public(r.subjects)))
    order by r.id desc limit greatest(1,least(coalesce(p_limit,25),100))
  ) revisions;
  return jsonb_build_object('admin',admin,'revisions',result);
end;
$$;
revoke all on function public.get_object_history(text,text,bigint,integer) from public;
grant execute on function public.get_object_history(text,text,bigint,integer) to anon, authenticated;
comment on function public.get_object_history(text,text,bigint,integer) is
  'Live civic history; admins see all revisions, visitors only public-at-change and currently public records. No account email addresses are exposed.';
