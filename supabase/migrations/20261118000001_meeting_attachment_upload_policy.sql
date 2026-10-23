drop policy "Admins upload meeting files" on storage.objects;
create policy "Admins upload meeting files" on storage.objects for insert to authenticated
  with check (bucket_id = 'meeting-attachments' and public.is_admin()
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.][a-z0-9]+$'
    and exists (select 1 from public.events e
      where e.id = split_part(name, '/', 1)::uuid and e.is_meeting));
