# SPEC.md — nguồn sự thật của sản phẩm

Mọi tranh chấp về hành vi sản phẩm giải quyết bằng file này. Muốn đổi hành vi thì sửa
file này trước, code sau.

## 1. Người dùng mục tiêu

Sinh viên và người ôn thi có **tài liệu riêng** và không tin được câu trả lời chung chung
của chatbot, vì họ phải trả lời đúng theo tài liệu của môn mình học. Hai thị trường v1:
Việt Nam (kiểm chứng nhanh, chi phí thu hút thấp) và các nước nói tiếng Anh (giá trị vòng
đời cao hơn đáng kể).

Công việc chính người dùng thuê app làm: *"cho tôi câu trả lời mà tôi dám chép vào bài thi,
và chỉ cho tôi chỗ nó nằm trong giáo trình."*

## 2. Ba tính năng lõi

| Tính năng | Đầu vào | Đầu ra | Ràng buộc |
|---|---|---|---|
| Hỏi đáp có trích dẫn | Câu hỏi + 1 tài liệu | Câu trả lời, mỗi đoạn có trích dẫn trang + nhãn tin cậy | Không dùng kiến thức ngoài tài liệu |
| Ôn tập chủ động | Khoảng trang/chương | Quiz + flashcard + lịch FSRS | Sinh một lần, ôn offline |
| Chấm tự luận | Bài viết + rubric | Nhận xét theo từng đoạn, có trích dẫn | Là phản hồi tham khảo, không phải điểm |

Ba tính năng dùng chung một hạ tầng truy hồi và một lớp kiểm chứng. Đó là lý do làm cả ba
không đắt gấp ba.

## 3. Nguyên tắc sản phẩm

1. **Không biết thì nói không biết.** Câu từ chối đúng có giá trị hơn câu trả lời trôi chảy.
2. **Mọi khẳng định đều chỉ được về nguồn.** Trích dẫn không phải chú thích cuối trang —
   nó là cấu trúc chính của giao diện.
3. **Ôn tập phải chạy khi mất mạng.** Người học trên xe buýt, trong thư viện tầng hầm.
4. **Tài liệu là của người dùng.** Xoá tài khoản là xoá thật, trong 30 ngày.

## 4. Lược đồ dữ liệu (Postgres)

```sql
profiles(id uuid pk, locale text, tier text, created_at)
documents(id uuid pk, owner uuid fk, title text, lang text, page_count int,
          sha256 text, status text, created_at)
pages(id uuid pk, document_id fk, page_no int, image_path text, width int, height int)
chunks(id uuid pk, document_id fk, page_no int, ord int, text text,
       bboxes jsonb, token_count int, embedding vector(768), tsv tsvector)
conversations(id uuid pk, document_id fk, owner uuid fk, created_at)
messages(id uuid pk, conversation_id fk, role text, content text,
         citations jsonb, verdicts jsonb, cost_usd numeric, created_at)
quizzes(id uuid pk, document_id fk, scope jsonb, generated_at)
questions(id uuid pk, quiz_id fk, stem text, options jsonb, answer_key text,
          explanation text, citation jsonb, quality_score numeric)
cards(id uuid pk, owner uuid fk, question_id fk, fsrs_state jsonb, due_at)
essays(id uuid pk, owner uuid fk, document_id fk, body text, rubric jsonb,
       feedback jsonb, created_at)
verifications(id uuid pk, message_id fk, claim text, chunk_id uuid,
              verdict text, score numeric)
usage_costs(id uuid pk, owner uuid fk, feature text, model text,
            tokens_in int, tokens_out int, cost_usd numeric, created_at)
```

RLS: mọi bảng lọc theo `owner = auth.uid()`, kể cả bảng con (qua join). Bảng `chunks` để
lộ là để lộ toàn bộ nội dung giáo trình của người khác — kiểm tra kỹ ở G0.7.

## 5. Xử lý tài liệu

- Trích text bằng PyMuPDF theo block, **giữ toạ độ**. Toạ độ là thứ cho phép highlight
  đúng chỗ; mất toạ độ thì tính năng lõi mất ý nghĩa.
- PDF scan: OCR `vie+eng`, giữ bbox từng dòng.
- Chunk: mục tiêu 700 token, chồng lấn 15%, ưu tiên cắt ở ranh giới đoạn, không bao giờ
  cắt giữa câu. Mỗi chunk giữ mảng bbox để highlight nhiều dòng.
- Tiếng Việt: chuẩn hoá Unicode NFC trước khi chunk và trước khi so khớp; bỏ qua bước
  stemming, dùng cấu hình `simple` cho `tsvector`.
- Cache theo `sha256` toàn file: cùng file đã có thì tái sử dụng chunk và embedding.

## 6. Lớp kiểm chứng

Luồng bắt buộc cho mọi văn bản do mô hình sinh: `retrieve → generate → verify → render`.

1. Tách câu trả lời thành **mệnh đề kiểm chứng được**.
2. Với mỗi mệnh đề, lấy các chunk nó trích dẫn, chạy kiểm tra kéo theo, ra điểm 0–1.
3. Quy về nhãn:

| Nhãn | Điều kiện | Hiển thị |
|---|---|---|
| Có căn cứ | ≥ 0.75 | Thanh neo xanh mực, trích dẫn mở được |
| Suy luận | 0.45 – 0.75 | Thanh neo hổ phách, kèm dòng "suy ra từ trang X" |
| Không có trong tài liệu | < 0.45 | **Không hiển thị mệnh đề**, thay bằng thông báo và gợi ý phần gần nhất |

4. Toàn bộ kết quả ghi vào `verifications` để theo dõi trôi chất lượng khi đổi model.

Một lời gọi batch cho tất cả mệnh đề của một câu trả lời — không gọi mỗi mệnh đề một lần.

## 7. Ngưỡng chất lượng (cổng chặn phát hành)

Đo trên `eval/golden.jsonl`, 100 cặp, 50 tiếng Việt và 50 tiếng Anh, trong đó 20 câu mà
tài liệu **không** trả lời được.

| Chỉ số | Ngưỡng |
|---|---|
| Recall@6 | ≥ 0.85 |
| Citation precision (trích dẫn thật sự chứa ý đó) | ≥ 0.90 |
| Tỉ lệ mệnh đề không căn cứ lọt ra UI | ≤ 0.03 |
| Từ chối đúng trên 20 câu bẫy | ≥ 0.80 |
| Thời gian tới token đầu tiên (p95) | ≤ 2.5s |

`pnpm eval:gate` phải fail build khi bất kỳ dòng nào không đạt. Ngưỡng chỉ được nới bằng
một commit riêng, có lý do ghi trong `TASKS.md`.

## 8. Song ngữ

- Ngôn ngữ giao diện theo máy, đổi được trong cài đặt.
- Ngôn ngữ tài liệu phát hiện tự động, lưu ở `documents.lang`.
- **Trả lời theo ngôn ngữ giao diện**, kể cả khi tài liệu khác ngôn ngữ; giữ nguyên thuật ngữ
  chuyên ngành ở dạng gốc kèm giải nghĩa lần đầu.
- Flashcard sinh theo ngôn ngữ tài liệu (học thuật ngữ phải đúng dạng sẽ gặp trong đề thi).
- Metadata cửa hàng, ảnh chụp màn hình, chính sách riêng tư: đủ cả hai.

## 9. Riêng tư và tuân thủ

- Màn hình đồng ý AI nêu tên nhà cung cấp mô hình, dữ liệu được gửi, cách tắt — hiển thị
  trước lời gọi đầu tiên, không phải chôn trong cài đặt.
- Tài liệu lưu ở Storage riêng tư, URL ký hạn ngắn.
- Xoá tài khoản trong app, xoá thật trong 30 ngày, có màn hình xác nhận.
- Không huấn luyện gì trên dữ liệu người dùng ở v1. Nếu sau này muốn, phải là opt-in riêng.

## 10. Ngoài phạm vi v1

Cộng tác nhiều người, nhập từ Drive/Notion, chat xuyên nhiều tài liệu, bản web, giọng nói,
sơ đồ tư duy. Ghi ở đây để khỏi tranh luận lại giữa chừng.
