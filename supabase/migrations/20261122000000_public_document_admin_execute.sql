-- Supabase default privileges may grant EXECUTE directly to anon.
-- Mutations remain admin-only, including at the function privilege boundary.
revoke execute on function public.prepare_public_document(uuid,text,text,text,text,text,boolean),
  public.finish_public_document(uuid,uuid), public.withdraw_public_document(uuid),
  public.link_public_document_meeting(uuid,uuid) from anon;
