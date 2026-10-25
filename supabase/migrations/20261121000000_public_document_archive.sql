-- Publication is explicit and independent of attachment/meeting visibility.
-- Never mirror all meeting uploads into this archive.
create table public.public_documents (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(trim(title)) between 1 and 300),
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name !~ '[/\\\x00-\x1f]'),
  extension text not null check (extension in ('pdf','txt','csv','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  document_kind text not null check (document_kind in ('agenda','minutes','packet','presentation','spreadsheet','transcript','other')),
  text_origin text not null check (text_origin in ('official','automated_transcript','ocr','other')),
  status text not null default 'pending' check (status in ('pending','published','withdrawn')),
  -- Audit history uses visibility too; pending/withdrawn snapshots stay private.
  visibility text generated always as (case when status = 'published' then 'public' else 'private' end) stored,
  publication_claim uuid,
  claimed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('english',title || ' ' || file_name)) stored
);
create index public_documents_search_idx on public.public_documents using gin(search_document);
create table public.public_document_meetings (
  document_id uuid not null references public.public_documents(id) on delete cascade,
  meeting_id uuid not null references public.events(id) on delete cascade,
  primary key(document_id,meeting_id)
);
create index public_document_meetings_meeting_idx on public.public_document_meetings(meeting_id);
alter table public.public_documents enable row level security;
alter table public.public_document_meetings enable row level security;
revoke all on public.public_documents, public.public_document_meetings from anon, authenticated;

create function public.get_public_document(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',d.id,'title',d.title,'file_name',d.file_name,
    'object_key','documents/' || d.id::text || '/' || d.sha256 || '.' || d.extension,
    'url','https://kb.civpulse.org/documents/' || d.id::text || '/' || d.sha256 || '.' || d.extension,
    'mime_type',d.mime_type,'size_bytes',d.size_bytes,'source_url',d.source_url,
    'document_kind',d.document_kind,'text_origin',d.text_origin,'status',d.status,
    'published_at',d.published_at,'created_at',d.created_at,
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at))
      from public.public_document_meetings dm join public.events e on e.id=dm.meeting_id
      join public.calendars c on c.id=e.calendar_id
      where dm.document_id=d.id and e.visibility='public' and c.visibility='public'
        and e.election_id is null),'[]'::jsonb))
  from public.public_documents d where d.id=p_id and (d.status='published' or public.is_admin());
$$;

create function public.list_public_documents(p_query text default '', p_meeting_id uuid default null,
  p_admin boolean default false, p_limit integer default 20, p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select public.get_public_document(d.id) from public.public_documents d
  where (d.status='published' or (p_admin and public.is_admin()))
    and (coalesce(trim(p_query),'')='' or d.search_document @@ websearch_to_tsquery('english',left(p_query,500)))
    and (p_meeting_id is null or exists(select 1 from public.public_document_meetings dm
      join public.events e on e.id=dm.meeting_id join public.calendars c on c.id=e.calendar_id
      where dm.document_id=d.id and dm.meeting_id=p_meeting_id
        and ((e.visibility='public' and c.visibility='public') or (p_admin and public.is_admin()))))
  order by d.created_at desc,d.id limit greatest(1,least(coalesce(p_limit,20),50))
  offset greatest(0,least(coalesce(p_offset,0),10000));
$$;

create function public.prepare_public_document(p_attachment_id uuid,p_sha256 text,p_title text,
  p_source_url text,p_document_kind text,p_text_origin text,p_confirm_public boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.meeting_attachments; d public.public_documents; claim uuid := gen_random_uuid();
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_confirm_public is distinct from true then raise exception 'Explicit public distribution confirmation is required'; end if;
  select * into a from public.meeting_attachments where id=p_attachment_id;
  if not found then raise exception 'Attachment not found'; end if;
  if not exists(select 1 from public.events e join public.calendars c on c.id=e.calendar_id
    where e.id=a.meeting_id and e.is_meeting and e.visibility='public' and c.visibility='public')
    then raise exception 'Publish only attachments of public, listed meetings'; end if;
  insert into public.public_documents(sha256,title,file_name,extension,mime_type,size_bytes,source_url,
    document_kind,text_origin,publication_claim,claimed_at)
    values(p_sha256,trim(p_title),a.file_name,lower(regexp_replace(a.file_name,'^.*\.','')),a.mime_type,
      a.size_bytes,p_source_url,p_document_kind,p_text_origin,claim,now())
    on conflict(sha256) do nothing;
  select * into d from public.public_documents where sha256=p_sha256 for update;
  if d.status='withdrawn' then raise exception 'This document was withdrawn; it cannot be republished automatically'; end if;
  if d.status='pending' and d.publication_claim<>claim then
    if d.claimed_at>now()-interval '10 minutes' then raise exception 'Publication in progress; check the catalog before retrying'; end if;
    update public.public_documents set publication_claim=claim,claimed_at=now() where id=d.id;
  end if;
  insert into public.public_document_meetings values(d.id,a.meeting_id) on conflict do nothing;
  return public.get_public_document(d.id) || jsonb_build_object('claim',case when d.status='pending' then claim else null end);
end;
$$;

create function public.finish_public_document(p_id uuid,p_claim uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  update public.public_documents set status='published',published_at=now(),publication_claim=null
    where id=p_id and status='pending' and publication_claim=p_claim;
  if not found and not exists(select 1 from public.public_documents where id=p_id and status='published')
    then raise exception 'Publication claim expired; inspect the catalog'; end if;
  return public.get_public_document(p_id);
end;
$$;

create function public.withdraw_public_document(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from public.public_documents where id=p_id for update;
  if not found then raise exception 'Document not found'; end if;
  if exists(select 1 from public.public_documents where id=p_id and status='pending') then
    raise exception 'Resolve the pending publication before withdrawing it'; end if;
  update public.public_documents set status='withdrawn' where id=p_id;
  return public.get_public_document(p_id);
end;
$$;

create function public.link_public_document_meeting(p_document_id uuid,p_meeting_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from public.public_documents where id=p_document_id and status='published' for update;
  if not found then raise exception 'Published document not found'; end if;
  if not exists(select 1 from public.events e join public.calendars c on c.id=e.calendar_id
    where e.id=p_meeting_id and e.is_meeting and e.visibility='public' and c.visibility='public') then
    raise exception 'Link only public, listed meetings'; end if;
  insert into public.public_document_meetings values(p_document_id,p_meeting_id) on conflict do nothing;
  return public.get_public_document(p_document_id);
end;
$$;

revoke all on function public.get_public_document(uuid), public.list_public_documents(text,uuid,boolean,integer,integer),
  public.prepare_public_document(uuid,text,text,text,text,text,boolean), public.finish_public_document(uuid,uuid),
  public.withdraw_public_document(uuid),public.link_public_document_meeting(uuid,uuid) from public;
grant execute on function public.get_public_document(uuid),public.list_public_documents(text,uuid,boolean,integer,integer) to anon,authenticated;
grant execute on function public.prepare_public_document(uuid,text,text,text,text,text,boolean),
  public.finish_public_document(uuid,uuid),public.withdraw_public_document(uuid),
  public.link_public_document_meeting(uuid,uuid) to authenticated;

insert into audit.objects(table_name,key_columns,parents) values
 ('public_documents',array['id'],'{}'),
 ('public_document_meetings',array['document_id','meeting_id'],'{"document_id":"public_documents","meeting_id":"events"}');
create trigger record_history after insert or update or delete on public.public_documents for each row execute function audit.capture();
create trigger record_history after insert or update or delete on public.public_document_meetings for each row execute function audit.capture();
