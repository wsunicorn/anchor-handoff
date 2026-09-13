import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type PageRow = Database['public']['Tables']['pages']['Row'];
export type ChunkRow = Pick<
  Database['public']['Tables']['chunks']['Row'],
  'id' | 'page_no' | 'ord' | 'text' | 'bboxes' | 'token_count'
>;

export type BBox = [number, number, number, number];

export type PageWithUrl = PageRow & { url: string };

/** URL ký hạn ngắn (SPEC §9): 10 phút, đủ cho một phiên đọc; hết hạn thì query tự lấy lại. */
const SIGNED_URL_TTL_S = 600;

export function usePages(documentId: string) {
  return useQuery({
    queryKey: ['pages', documentId],
    staleTime: (SIGNED_URL_TTL_S - 60) * 1000,
    queryFn: async (): Promise<PageWithUrl[]> => {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('document_id', documentId)
        .order('page_no');
      if (error) throw error;
      if (data.length === 0) return [];
      const { data: signed, error: signErr } = await supabase.storage
        .from('documents')
        .createSignedUrls(
          data.map((p) => p.image_path),
          SIGNED_URL_TTL_S,
        );
      if (signErr) throw signErr;
      return data.map((p, i) => ({ ...p, url: signed[i]?.signedUrl ?? '' }));
    },
  });
}

export function useChunks(documentId: string) {
  return useQuery({
    queryKey: ['chunks', documentId],
    queryFn: async (): Promise<ChunkRow[]> => {
      const { data, error } = await supabase
        .from('chunks')
        .select('id,page_no,ord,text,bboxes,token_count')
        .eq('document_id', documentId)
        .order('ord');
      if (error) throw error;
      return data;
    },
  });
}

/** bboxes là jsonb `[[x0,y0,x1,y1], …]` theo pixel ảnh trang; ép kiểu một chỗ, nơi khác tin vào nó. */
export function bboxesOf(chunk: Pick<ChunkRow, 'bboxes'>): BBox[] {
  const raw = chunk.bboxes;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is BBox => Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number'),
  );
}
