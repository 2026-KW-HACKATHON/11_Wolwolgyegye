-- 공개 가게/게시글 사진 전용. 신분증, 사업자 증빙 등 비공개 파일은 넣지 않는다.
begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 경로: <store_id>/<random-file-id>.webp
-- 공개 URL 다운로드는 public bucket 규칙을 사용하고, 객체 목록/쓰기에는 소유권을 적용한다.
create policy store_media_owner_select on storage.objects for select to authenticated using (
  bucket_id = 'store-media' and exists (
    select 1 from public.stores s
    where s.id::text = (storage.foldername(storage.objects.name))[1] and s.owner_id = (select auth.uid())
  )
);
create policy store_media_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'store-media' and exists (
    select 1 from public.stores s
    where s.id::text = (storage.foldername(storage.objects.name))[1] and s.owner_id = (select auth.uid())
  )
);
create policy store_media_owner_update on storage.objects for update to authenticated using (
  bucket_id = 'store-media' and exists (
    select 1 from public.stores s
    where s.id::text = (storage.foldername(storage.objects.name))[1] and s.owner_id = (select auth.uid())
  )
) with check (
  bucket_id = 'store-media' and exists (
    select 1 from public.stores s
    where s.id::text = (storage.foldername(storage.objects.name))[1] and s.owner_id = (select auth.uid())
  )
);
create policy store_media_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'store-media' and exists (
    select 1 from public.stores s
    where s.id::text = (storage.foldername(storage.objects.name))[1] and s.owner_id = (select auth.uid())
  )
);
commit;
