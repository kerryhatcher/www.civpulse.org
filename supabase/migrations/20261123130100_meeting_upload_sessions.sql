alter table public.meeting_attachments add column source_provider text,
  add column source_key text, add column sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),
  add column source_url text check(source_url ~ '^https://[^[:space:]]+$');
create unique index meeting_attachment_source_key on public.meeting_attachments(meeting_id,source_provider,source_key)
  where source_key is not null;
create table public.meeting_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.events(id) on delete cascade,
  provider text not null check(length(provider) between 1 and 100),
  source_key text not null check(length(source_key) between 1 and 500),
  file_name text not null check(length(file_name) between 1 and 255 and file_name !~ '[/\\\x00-\x1f]'),
  mime_type text not null,
  size_bytes bigint not null check(size_bytes between 1 and 26214400),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  source_url text not null check(source_url ~ '^https://[^[:space:]]+$'),
  storage_path text not null unique,
  state text not null default 'pending' check(state in ('pending','complete','cancelled')),
  expires_at timestamptz not null default now()+interval '24 hours',
  unique(meeting_id,provider,source_key)
);
alter table public.meeting_upload_sessions enable row level security;
create policy "Admins read upload sessions" on public.meeting_upload_sessions for select to authenticated using(public.is_admin());
grant select on public.meeting_upload_sessions to authenticated;
create policy "Admins inspect staged meeting files" on storage.objects for select to authenticated
  using(bucket_id='meeting-attachments' and public.is_admin());
update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/json') where id='meeting-attachments';

create function public.begin_meeting_upload(p_meeting_id uuid,p_provider text,p_source_key text,
  p_file_name text,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_source_url text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.meeting_upload_sessions; ext text; expected_type text;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
  perform 1 from public.events where id=p_meeting_id and is_meeting for update;
  if not found then raise exception 'Existing meeting required'; end if;
  ext:=lower(substring(p_file_name from '\.([^.]+)$'));
  expected_type:=case ext when 'pdf' then 'application/pdf' when 'txt' then 'text/plain' when 'csv' then 'text/csv' when 'json' then 'application/json'
    when 'doc' then 'application/msword' when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'xls' then 'application/vnd.ms-excel' when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    when 'ppt' then 'application/vnd.ms-powerpoint' when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    when 'odt' then 'application/vnd.oasis.opendocument.text' when 'ods' then 'application/vnd.oasis.opendocument.spreadsheet'
    when 'odp' then 'application/vnd.oasis.opendocument.presentation' end;
  if expected_type is null or p_mime_type is distinct from expected_type then raise exception 'Unsupported extension or MIME type mismatch'; end if;
  select * into s from public.meeting_upload_sessions where meeting_id=p_meeting_id and provider=p_provider and source_key=p_source_key;
  if found then
    if s.file_name is distinct from p_file_name or s.mime_type is distinct from p_mime_type
      or s.size_bytes is distinct from p_size_bytes or s.sha256 is distinct from p_sha256 or s.source_url is distinct from p_source_url then
      raise exception 'Source identity conflict: session metadata is immutable'; end if;
    return to_jsonb(s);
  end if;
  s.id:=gen_random_uuid();
  insert into public.meeting_upload_sessions(id,meeting_id,provider,source_key,file_name,mime_type,size_bytes,sha256,source_url,storage_path)
    values(s.id,p_meeting_id,p_provider,p_source_key,p_file_name,p_mime_type,p_size_bytes,p_sha256,p_source_url,p_meeting_id::text||'/'||s.id::text||'.'||ext)
    returning * into s;
  return to_jsonb(s);
end; $$;

-- Size and MIME are checked against Storage; MCP additionally verifies the actual bytes
-- and sends their SHA-256. As with other admin writes, an admin is a trusted editor.
create function public.finish_meeting_upload(p_id uuid,p_verified_sha256 text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.meeting_upload_sessions; a public.meeting_attachments;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into s from public.meeting_upload_sessions where id=p_id for update;
  if not found then raise exception 'Upload session not found'; end if;
  if s.state='complete' then select * into a from public.meeting_attachments where id=s.id; return to_jsonb(a); end if;
  if s.state<>'pending' or s.expires_at<=now() then raise exception 'Upload cancelled or expired'; end if;
  if p_verified_sha256 is distinct from s.sha256 then raise exception 'SHA-256 mismatch'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='meeting-attachments' and o.name=s.storage_path
    and (o.metadata->>'size')::bigint=s.size_bytes and o.metadata->>'mimetype'=s.mime_type) then
    raise exception 'Stored original missing or size/MIME mismatch'; end if;
  insert into public.meeting_attachments(id,meeting_id,file_name,storage_path,mime_type,size_bytes,source_provider,source_key,sha256,source_url)
    values(s.id,s.meeting_id,s.file_name,s.storage_path,s.mime_type,s.size_bytes,s.provider,s.source_key,s.sha256,s.source_url) returning * into a;
  update public.meeting_upload_sessions set state='complete' where id=s.id;
  return to_jsonb(a);
end; $$;
create function public.cancel_meeting_upload(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.meeting_upload_sessions;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into s from public.meeting_upload_sessions where id=p_id for update;
  if not found then raise exception 'Upload session not found'; end if;
  if s.state='complete' then raise exception 'Completed attachments require explicit attachment deletion'; end if;
  update public.meeting_upload_sessions set state='cancelled' where id=p_id returning * into s;
  return to_jsonb(s);
end; $$;
revoke all on function public.begin_meeting_upload(uuid,text,text,text,text,bigint,text,text),
  public.finish_meeting_upload(uuid,text),public.cancel_meeting_upload(uuid) from public;
grant execute on function public.begin_meeting_upload(uuid,text,text,text,text,bigint,text,text),
  public.finish_meeting_upload(uuid,text),public.cancel_meeting_upload(uuid) to authenticated;

-- Existing get_meeting visibility already governs the attachment list.
create or replace function public.get_meeting(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare base jsonb;
begin
  base:=public.get_meeting_without_sources(p_id);
  if base->>'status'<>'ok' then return base; end if;
  return base || jsonb_build_object('sources',coalesce((select jsonb_agg(s.payload || jsonb_build_object('provider',s.provider,'vote_id',s.vote_id,'person_id',s.person_id))
    from public.meeting_record_sources s where s.meeting_id=p_id and (s.person_id is null or exists(
      select 1 from public.people p where p.id=s.person_id and (p.visibility='public' or public.is_admin())))), '[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at,a.id) from public.meeting_attachments a where a.meeting_id=p_id),'[]'::jsonb));
end; $$;
