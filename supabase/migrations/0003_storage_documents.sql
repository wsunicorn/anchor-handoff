-- 0003_storage_documents.sql — bucket riêng tư cho file gốc và ảnh trang (SPEC §9).
-- Đường dẫn: {owner_uuid}/{document_id}/source.pdf và {owner_uuid}/{document_id}/pages/{n}.png
-- Client chỉ đọc file trong thư mục của chính mình; ghi do services/ingest làm bằng service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  104857600,                                   -- 100 MB mỗi object
  array['application/pdf', 'image/png']
)
on conflict (id) do nothing;

create policy documents_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Xoá tài liệu → client được xoá file của mình (dọn Storage khi xoá dòng documents ở G7).
create policy documents_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
