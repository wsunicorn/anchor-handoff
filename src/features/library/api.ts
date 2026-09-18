import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

import type { Database } from '@/lib/database.types';
import { type Accepted, IngestError, uploadPdf } from '@/lib/ingest';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

import { documentNameFromUri } from './shareIntent';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type DocumentStatus = DocumentRow['status'];

const BUSY: ReadonlySet<string> = new Set(['pending', 'parsing', 'embedding']);

export const documentsKey = ['documents'] as const;

/** Danh sách tài liệu của người dùng (RLS lọc). Tự poll 2s khi còn tài liệu đang xử lý. */
export function useDocuments() {
  return useQuery({
    queryKey: documentsKey,
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => (query.state.data?.some((d) => BUSY.has(d.status)) ? 2000 : false),
  });
}

/** Số trang đã render — để hiện "Đang đọc trang 12/80" thay vì vòng xoay câm. */
export function usePageProgress(documentId: string | null) {
  return useQuery({
    queryKey: ['pages-count', documentId],
    enabled: documentId !== null,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('pages')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId!);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 2000,
  });
}

/** Chọn PDF rồi gửi lên service. Trả về IngestError có `code` để màn hình dịch ra câu nói được. */
export function useImportDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return null;
      const asset = picked.assets[0];
      if (!asset) return null;
      track('document_import_started');
      const accepted = await uploadPdf({ uri: asset.uri, name: asset.name });
      track('document_import_accepted', { reused: accepted.reused, pages: accepted.page_count });
      return accepted;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: documentsKey }),
    onError: (e) => {
      if (e instanceof IngestError) track('document_import_rejected', { code: e.code });
    },
  });
}

/**
 * G7.5 — nhận PDF từ app khác ("Mở bằng Anchor", intent VIEW application/pdf): Android đưa `content://…`;
 * chép vào cache (expo-file-system) rồi nạp như chọn từ picker. Tên lấy từ đuôi URI, mặc định "Tài liệu".
 */
export function useImportFromUri() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uri: string): Promise<Accepted | null> => {
      const name = documentNameFromUri(uri);
      const dest = new File(Paths.cache, `share-${Date.now()}.pdf`);
      await new File(uri).copy(dest);
      track('document_import_started', { source: 'intent' });
      const accepted = await uploadPdf({ uri: dest.uri, name });
      track('document_import_accepted', { reused: accepted.reused, pages: accepted.page_count });
      return accepted;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: documentsKey }),
    onError: (e) => {
      if (e instanceof IngestError) track('document_import_rejected', { code: e.code });
    },
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
}
