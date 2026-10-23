-- ORR/FOIA records. Identities are separated from publishable request content.
create table public.records_requests (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 300),
 description text not null default '' check (length(description) <= 50000),
 request_type text not null default 'orr' check (request_type in ('orr','foia','other')),
 target_organization_id uuid references public.organizations(id),
 source_organization_id uuid references public.organizations(id),
 visibility text not null default 'private' check (visibility in ('public','unlisted','private')),
 stage text not null default 'draft' check (stage in ('draft','submitted','initial_response','in_progress','appeal','closed')),
 outcome text check (outcome in ('satisfactory','partial','unsatisfactory')),
 submitted_on date, next_follow_up_on date,
 reference_number text check (length(reference_number) <= 200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 search_document tsvector generated always as (setweight(to_tsvector('english',title),'A') || setweight(to_tsvector('english',description),'B')) stored,
 check (target_organization_id is not null or source_organization_id is not null)
);
create index records_requests_search_idx on public.records_requests using gin(search_document);
create index records_requests_target_idx on public.records_requests(target_organization_id);
create index records_requests_source_idx on public.records_requests(source_organization_id);
create table public.records_request_owners (
 request_id uuid primary key references public.records_requests(id) on delete cascade,
 user_id uuid not null references auth.users(id)
);
create index records_request_owners_user_idx on public.records_request_owners(user_id);
create table public.records_request_transfers (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.records_requests(id) on delete cascade,
 from_user_id uuid references auth.users(id), to_user_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id), reason text not null check (length(trim(reason)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index records_request_transfers_request_idx on public.records_request_transfers(request_id);
create table public.records_request_updates (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.records_requests(id) on delete cascade,
 occurred_on date not null default current_date,
 kind text not null check (kind in ('note','submission','response','clarification','fee','delay','production','denial','appeal','closure','stage')),
 body text not null check (length(trim(body)) between 1 and 20000),
 created_at timestamptz not null default now()
);
create index records_request_updates_request_idx on public.records_request_updates(request_id,occurred_on);
create table public.records_request_links (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.records_requests(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 300),
 url text not null check (url ~ '^https?://[^[:space:]]+$' and length(url) <= 4000),
 created_at timestamptz not null default now()
);
create index records_request_links_request_idx on public.records_request_links(request_id);
create table public.records_request_files (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.records_requests(id) on delete cascade,
 file_name text not null check (length(file_name) between 1 and 255),
 storage_path text not null unique, mime_type text not null,
 size_bytes bigint not null check (size_bytes between 1 and 26214400),
 is_private boolean not null default true, created_at timestamptz not null default now(),
 check (split_part(storage_path,'/',1) = request_id::text),
 check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]+$')
);
create index records_request_files_request_idx on public.records_request_files(request_id);

create table public.records_request_fees (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.records_requests(id) on delete cascade,
 kind text not null check (kind in ('estimated','billed','paid')),
 amount numeric(12,2) not null check (amount >= 0),
 occurred_on date not null default current_date,
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now()
);
create index records_request_fees_request_idx on public.records_request_fees(request_id);
alter table public.records_request_fees enable row level security;
revoke all on public.records_request_fees from anon,authenticated;

create function public.can_manage_records_request(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (public.is_admin() or exists(
 select 1 from public.records_request_owners where request_id=p_id and user_id=auth.uid()));
$$;
revoke all on function public.can_manage_records_request(uuid) from public;
grant execute on function public.can_manage_records_request(uuid) to anon,authenticated;

alter table public.records_requests enable row level security;
alter table public.records_request_owners enable row level security;
alter table public.records_request_transfers enable row level security;
alter table public.records_request_updates enable row level security;
alter table public.records_request_links enable row level security;
alter table public.records_request_files enable row level security;
-- All reads, including public reads, go through explicit projections in RPCs.
-- Mutation RPCs serialize on the parent row, including ownership transfers.
revoke all on public.records_requests,public.records_request_owners,public.records_request_transfers,
 public.records_request_updates,public.records_request_links,public.records_request_files from anon,authenticated;
create policy request_manager_read on public.records_requests for select to authenticated using(public.can_manage_records_request(id));
create policy request_owner_read on public.records_request_owners for select to authenticated using(public.can_manage_records_request(request_id));
create policy request_transfer_read on public.records_request_transfers for select to authenticated using(public.can_manage_records_request(request_id));
create policy request_update_read on public.records_request_updates for select to authenticated using(public.can_manage_records_request(request_id));
create policy request_link_read on public.records_request_links for select to authenticated using(public.can_manage_records_request(request_id));
create policy request_file_read on public.records_request_files for select to authenticated using(public.can_manage_records_request(request_id));

create function public.save_records_request(p_id uuid, p_values jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare rid uuid := p_id; old_stage text; old_outcome text;
begin
 if rid is null then
   if not public.is_admin() or auth.uid() is null then raise insufficient_privilege using message='Only admins can create requests'; end if;
   insert into public.records_requests(title,target_organization_id,source_organization_id)
   values(p_values->>'title',nullif(p_values->>'target_organization_id','')::uuid,nullif(p_values->>'source_organization_id','')::uuid) returning id into rid;
   insert into public.records_request_owners values(rid,auth.uid());
   insert into public.records_request_transfers(request_id,to_user_id,actor_id,reason) values(rid,auth.uid(),auth.uid(),'Request created');
 else
   select stage,outcome into old_stage,old_outcome from public.records_requests where id=rid for update;
   if not found or not public.can_manage_records_request(rid) then raise insufficient_privilege using message='Request unavailable or access denied'; end if;
 end if;
 update public.records_requests set title=p_values->>'title', description=coalesce(p_values->>'description',''),
 request_type=coalesce(p_values->>'request_type','orr'),
 target_organization_id=nullif(p_values->>'target_organization_id','')::uuid,
 source_organization_id=nullif(p_values->>'source_organization_id','')::uuid,
 visibility=coalesce(p_values->>'visibility','private'),stage=coalesce(p_values->>'stage','draft'),
 outcome=nullif(p_values->>'outcome',''),submitted_on=nullif(p_values->>'submitted_on','')::date,
 next_follow_up_on=nullif(p_values->>'next_follow_up_on','')::date,
 reference_number=nullif(p_values->>'reference_number',''),updated_at=now() where id=rid;
 if old_stage is not null and (old_stage is distinct from (p_values->>'stage') or old_outcome is distinct from nullif(p_values->>'outcome','')) then
 insert into public.records_request_updates(request_id,kind,body) values(rid,'stage',
 'Stage: ' || replace(coalesce(p_values->>'stage','draft'),'_',' ') || '. Outcome: ' || coalesce(nullif(p_values->>'outcome',''),'not assessed') || '.');
 end if;
 return rid;
end; $$;

create function public.transfer_records_request(p_id uuid,p_to_user_id uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare previous uuid;
begin
 perform 1 from public.records_requests where id=p_id for update;
 if not found or not public.can_manage_records_request(p_id) then raise insufficient_privilege using message='Request unavailable or access denied'; end if;
 select user_id into previous from public.records_request_owners where request_id=p_id;
 if p_to_user_id=previous then raise exception 'This user already owns the request'; end if;
 if not exists(select 1 from auth.users where id=p_to_user_id) then raise exception 'Recipient must be an existing Civic Pulse user'; end if;
 insert into public.records_request_transfers(request_id,from_user_id,to_user_id,actor_id,reason) values(p_id,previous,p_to_user_id,auth.uid(),p_reason);
 update public.records_request_owners set user_id=p_to_user_id where request_id=p_id;
 update public.records_requests set updated_at=now() where id=p_id;
end; $$;

create function public.add_records_request_item(p_id uuid,p_kind text,p_values jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare item_id uuid;
begin
 perform 1 from public.records_requests where id=p_id for update;
 if not found or not public.can_manage_records_request(p_id) then raise insufficient_privilege using message='Request unavailable or access denied'; end if;
 if p_kind='update' then
 insert into public.records_request_updates(request_id,occurred_on,kind,body)
 values(p_id,(p_values->>'occurred_on')::date,p_values->>'kind',p_values->>'body') returning id into item_id;
 elsif p_kind='link' then
 insert into public.records_request_links(request_id,title,url) values(p_id,p_values->>'title',p_values->>'url') returning id into item_id;
 elsif p_kind='fee' then
 insert into public.records_request_fees(request_id,kind,amount,occurred_on,note)
 values(p_id,p_values->>'kind',(p_values->>'amount')::numeric,(p_values->>'occurred_on')::date,coalesce(p_values->>'note','')) returning id into item_id;
 elsif p_kind='file' then
 if not exists(select 1 from storage.objects where bucket_id='records-request-files' and name=p_values->>'storage_path') then raise exception 'Upload the file first'; end if;
 insert into public.records_request_files(request_id,file_name,storage_path,mime_type,size_bytes,is_private)
 values(p_id,p_values->>'file_name',p_values->>'storage_path',p_values->>'mime_type',(p_values->>'size_bytes')::bigint,coalesce((p_values->>'is_private')::boolean,true)) returning id into item_id;
 else raise exception 'Unknown item type'; end if;
 update public.records_requests set updated_at=now() where id=p_id;
 return item_id;
end; $$;

create function public.remove_records_request_item(p_id uuid,p_kind text,p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.records_requests where id=p_id for update;
 if not found or not public.can_manage_records_request(p_id) then raise insufficient_privilege using message='Request unavailable or access denied'; end if;
 if p_kind='update' then delete from public.records_request_updates where request_id=p_id and id=p_item_id and kind <> 'stage';
 elsif p_kind='link' then delete from public.records_request_links where request_id=p_id and id=p_item_id;
 elsif p_kind='fee' then delete from public.records_request_fees where request_id=p_id and id=p_item_id;
 elsif p_kind='file' then delete from public.records_request_files where request_id=p_id and id=p_item_id;
 else raise exception 'Unknown item type'; end if;
 update public.records_requests set updated_at=now() where id=p_id;
end; $$;

create function public.get_records_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.records_requests; manager boolean; result jsonb;
begin
 select * into r from public.records_requests where id=p_id;
 manager := public.can_manage_records_request(p_id);
 if r.id is null or (r.visibility='private' and not manager) then return jsonb_build_object('status','unavailable'); end if;
 result := jsonb_build_object('status','ok','can_manage',manager,'request',to_jsonb(r)-'search_document',
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug)),'[]'::jsonb) from public.organizations where id in (r.target_organization_id,r.source_organization_id)),
 'updates',(select coalesce(jsonb_agg(to_jsonb(u) order by occurred_on desc,created_at desc,id),'[]'::jsonb) from public.records_request_updates u where request_id=p_id),
 'fees',(select coalesce(jsonb_agg(to_jsonb(fee) order by occurred_on desc,created_at desc,id),'[]'::jsonb) from public.records_request_fees fee where request_id=p_id),
 'links',(select coalesce(jsonb_agg(to_jsonb(l) order by created_at,id),'[]'::jsonb) from public.records_request_links l where request_id=p_id),
 'files',(select coalesce(jsonb_agg(to_jsonb(f) order by created_at,id),'[]'::jsonb) from public.records_request_files f where request_id=p_id and (not is_private or manager)));
 if manager then
 result := result || jsonb_build_object('owner_id',(select user_id from public.records_request_owners where request_id=p_id),
 'transfers',(select coalesce(jsonb_agg(to_jsonb(t) order by created_at desc,id),'[]'::jsonb) from public.records_request_transfers t where request_id=p_id));
 end if;
 return result;
end; $$;

create function public.search_records_requests(p_query text default '',p_stage text default null,p_organization_id uuid default null,p_managed boolean default false,p_offset integer default 0)
returns table(id uuid,title text,stage text,outcome text,visibility text,updated_at timestamptz,target_name text,source_name text)
language sql stable security definer set search_path = '' as $$
 select r.id,r.title,r.stage,r.outcome,r.visibility,r.updated_at,t.name,s.name
 from public.records_requests r left join public.organizations t on t.id=r.target_organization_id left join public.organizations s on s.id=r.source_organization_id
 where (case when p_managed then public.can_manage_records_request(r.id) else r.visibility='public' end)
 and (p_stage is null or r.stage=p_stage)
 and (p_organization_id is null or p_organization_id in (r.target_organization_id,r.source_organization_id))
 and (trim(coalesce(p_query,''))='' or r.search_document @@ websearch_to_tsquery('english',p_query))
 order by r.updated_at desc,r.id limit 25 offset greatest(0,least(coalesce(p_offset,0),100000));
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('records-request-files','records-request-files',false,26214400,array[
 'application/pdf','text/plain','text/csv','image/png','image/jpeg','image/webp','image/gif',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet','application/vnd.oasis.opendocument.presentation']);
create function public.can_manage_records_file(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.records_requests where id::text=split_part(p_path,'/',1) and public.can_manage_records_request(id));
$$;
create function public.can_read_records_file(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.records_request_files f join public.records_requests r on r.id=f.request_id
 where f.storage_path=p_path and (public.can_manage_records_request(r.id) or (not f.is_private and r.visibility<>'private')));
$$;
create policy records_file_upload on storage.objects for insert to authenticated with check(bucket_id='records-request-files' and public.can_manage_records_file(name) and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]+$');
create policy records_file_delete on storage.objects for delete to authenticated using(bucket_id='records-request-files' and public.can_manage_records_file(name));
create policy records_file_read on storage.objects for select to anon,authenticated using(bucket_id='records-request-files' and (public.can_manage_records_file(name) or (storage.allow_only_operation('object.sign') and public.can_read_records_file(name))));

revoke all on function public.save_records_request(uuid,jsonb),public.transfer_records_request(uuid,uuid,text),public.add_records_request_item(uuid,text,jsonb),public.remove_records_request_item(uuid,text,uuid),public.get_records_request(uuid),public.search_records_requests(text,text,uuid,boolean,integer),public.can_manage_records_file(text),public.can_read_records_file(text) from public;
grant execute on function public.save_records_request(uuid,jsonb),public.transfer_records_request(uuid,uuid,text),public.add_records_request_item(uuid,text,jsonb),public.remove_records_request_item(uuid,text,uuid),public.can_manage_records_file(text) to authenticated;
grant execute on function public.can_manage_records_file(text) to anon;
grant execute on function public.get_records_request(uuid),public.search_records_requests(text,text,uuid,boolean,integer),public.can_read_records_file(text) to anon,authenticated;
