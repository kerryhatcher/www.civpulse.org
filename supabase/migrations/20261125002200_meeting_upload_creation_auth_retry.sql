-- Preserve all owner/session/lease gates; only the relay uses this action after
-- the configured Storage endpoint definitively rejects an expired JWT before creation.
create or replace function public.manage_meeting_upload_transfer(p_action text,p_id uuid,p_lease uuid default null,
 p_location text default null,p_offset bigint default null,p_size integer default null,p_sha256 text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.meeting_upload_sessions; r meeting_private.upload_relays; c meeting_private.upload_chunk_receipts;
 result jsonb;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('status','acquire','creating','creation_auth_rejected','location','prepare','commit','release') then raise exception 'Unknown transfer action'; end if;
 select * into s from public.meeting_upload_sessions where id=p_id for update;
 if not found then raise exception 'Upload session not found'; end if;
 select * into r from meeting_private.upload_relays where session_id=p_id for update;
 if r.session_id is null then
  if p_action='status' then return jsonb_build_object('state','not_started','offset',0); end if;
  if p_action<>'acquire' then raise exception 'Acquire transfer first'; end if;
  insert into meeting_private.upload_relays(session_id,owner_id) values(p_id,auth.uid()) returning * into r;
 end if;
 if r.owner_id is distinct from auth.uid() then raise exception 'Transfer belongs to another administrator' using errcode='42501'; end if;
 if p_action='release' then
  if r.lease=p_lease then update meeting_private.upload_relays set lease=null,lease_until=null where session_id=p_id returning * into r; end if;
 elsif p_action='acquire' then
  if s.state<>'pending' or s.expires_at<=now() then raise exception 'Upload complete, cancelled or expired'; end if;
  if r.lease is not null and r.lease_until>clock_timestamp() then raise exception 'Transfer busy; retry after lease expires'; end if;
  update meeting_private.upload_relays set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where session_id=p_id returning * into r;
 elsif p_action<>'status' then
  if s.state<>'pending' or s.expires_at<=now() then raise exception 'Upload complete, cancelled or expired'; end if;
  if r.lease is distinct from p_lease or r.lease is null or r.lease_until<=clock_timestamp() then raise exception 'Transfer lease expired or mismatched'; end if;
  if p_action='creating' then
   if r.creating or r.location is not null then raise exception 'Creation already attempted; reconcile existing transfer'; end if;
   update meeting_private.upload_relays set creating=true where session_id=p_id returning * into r;
  elsif p_action='creation_auth_rejected' then
   if not r.creating or r.location is not null or r.next_offset<>0
    or exists(select 1 from meeting_private.upload_chunk_receipts where session_id=p_id) then
    raise exception 'Only an unlocated, empty creation intent can be reset after confirmed authentication rejection';
   end if;
   update meeting_private.upload_relays set creating=false where session_id=p_id returning * into r;
  elsif p_action='location' then
   if not r.creating or r.location is not null or p_location is null or length(p_location)>4000 then raise exception 'Location cannot be replaced'; end if;
   update meeting_private.upload_relays set location=p_location,creating=false where session_id=p_id returning * into r;
  elsif p_action='prepare' then
   if p_offset is null or p_offset<0 or p_size is null or p_size not between 1 and 262144
    or p_offset+p_size>s.size_bytes or coalesce(p_sha256,'')!~'^[a-f0-9]{64}$' then raise exception 'Invalid bounded chunk'; end if;
   select * into c from meeting_private.upload_chunk_receipts where session_id=p_id and chunk_offset=p_offset;
   if c.session_id is not null then
    if c.size_bytes<>p_size or c.sha256<>p_sha256 then raise exception 'Chunk replay conflicts with original bytes'; end if;
   else
    if p_offset<>r.next_offset or exists(select 1 from meeting_private.upload_chunk_receipts where session_id=p_id and not committed) then raise exception 'Offset conflict; reconcile transfer status and retry the pending chunk'; end if;
    insert into meeting_private.upload_chunk_receipts(session_id,chunk_offset,size_bytes,sha256) values(p_id,p_offset,p_size,p_sha256) returning * into c;
   end if;
  elsif p_action='commit' then
   select * into c from meeting_private.upload_chunk_receipts where session_id=p_id and chunk_offset=p_offset;
   if c.session_id is null then raise exception 'Chunk intent missing'; end if;
   update meeting_private.upload_chunk_receipts set committed=true where session_id=p_id and chunk_offset=p_offset returning * into c;
   update meeting_private.upload_relays set next_offset=greatest(next_offset,c.chunk_offset+c.size_bytes) where session_id=p_id returning * into r;
  end if;
 end if;
 result:=jsonb_build_object('state',s.state,'offset',r.next_offset,'location',r.location,'creating',r.creating,'lease',r.lease,'lease_until',r.lease_until);
 if c.session_id is not null then result:=result||jsonb_build_object('chunk',to_jsonb(c)-'session_id'); end if;
 return result||jsonb_build_object('pending_chunk',(select to_jsonb(x)-'session_id' from meeting_private.upload_chunk_receipts x where x.session_id=p_id and not x.committed order by chunk_offset limit 1));
end $$;
revoke all on function public.manage_meeting_upload_transfer(text,uuid,uuid,text,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.manage_meeting_upload_transfer(text,uuid,uuid,text,bigint,integer,text) to authenticated;
notify pgrst,'reload schema';
