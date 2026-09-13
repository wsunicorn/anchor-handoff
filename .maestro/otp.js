/* global http, output, EMAIL -- môi trường JS của Maestro (GraalJS), không phải Node */
// Lấy mã OTP 6 số mới nhất gửi tới EMAIL từ Mailpit của Supabase local (cổng 54324).
const list = JSON.parse(http.get('http://127.0.0.1:54324/api/v1/messages?limit=20').body);
const msg = (list.messages || []).find((m) => (m.To || []).some((t) => t.Address === EMAIL));
if (!msg) throw new Error('Mailpit: chưa có email cho ' + EMAIL);
const full = JSON.parse(http.get('http://127.0.0.1:54324/api/v1/message/' + msg.ID).body);
const m = /\b(\d{6})\b/.exec(full.Text || full.HTML || '');
if (!m) throw new Error('Không thấy mã 6 số trong email');
output.otp = m[1];
