import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

/**
 * Gọi services/ingest: nạp PDF. Service kiểm JWT, hạn mức và đồng ý AI ở phía nó;
 * client chỉ hiển thị mã lỗi trả về, không tự kiểm hạn mức (G1.10).
 *
 * Local: `EXPO_PUBLIC_INGEST_URL=http://127.0.0.1:8000` + `adb reverse tcp:8000 tcp:8000`.
 */
const baseUrl = process.env.EXPO_PUBLIC_INGEST_URL;

export type IngestErrorCode =
  | 'consent_required'
  | 'document_limit'
  | 'page_limit'
  | 'pdf_encrypted'
  | 'pdf_empty'
  | 'unsupported_type'
  | 'file_too_large'
  | 'unauthorized'
  | 'network'
  | 'unknown';

export class IngestError extends Error {
  constructor(
    readonly code: IngestErrorCode,
    message: string,
    readonly limit?: number,
  ) {
    super(message);
  }
}

export type Accepted = {
  document_id: string;
  status: string;
  page_count: number;
  reused: boolean;
};

export async function uploadPdf(file: { uri: string; name: string }): Promise<Accepted> {
  if (!baseUrl) throw new IngestError('unknown', 'Thiếu EXPO_PUBLIC_INGEST_URL');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new IngestError('unauthorized', 'Chưa đăng nhập');

  // Gửi PDF thẳng làm body (không multipart): FormData của RN và fetch của Expo không ghép được
  // phần file với nhau; body dạng Blob thì `File` của expo-file-system stream thẳng từ đĩa.
  const title = file.name.replace(/\.pdf$/i, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/documents?title=${encodeURIComponent(title)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
      body: new File(file.uri),
    });
  } catch (e) {
    if (__DEV__) console.warn('[ingest] fetch thất bại', baseUrl, e instanceof Error ? e.stack : e);
    throw new IngestError('network', e instanceof Error ? e.message : 'network');
  }
  const body = (await res.json().catch(() => ({}))) as Partial<Accepted> & {
    code?: string;
    message?: string;
    limit?: number;
  };
  if (!res.ok) {
    const code = (body.code ?? 'unknown') as IngestErrorCode;
    throw new IngestError(code, body.message ?? code, body.limit);
  }
  return body as Accepted;
}
