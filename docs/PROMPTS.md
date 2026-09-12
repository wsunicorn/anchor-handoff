# PROMPTS.md — hợp đồng prompt

Mỗi prompt ở đây là một **hợp đồng**: đầu vào, đầu ra, và điều kiện thất bại. Sửa prompt mà
không chạy lại `pnpm eval:rag` là thay đổi mù. Không nhét prompt rời rạc vào code — tất cả
nằm ở `supabase/functions/_shared/prompts.ts` và bám theo file này.

Nguyên tắc chung: prompt không được phụ thuộc vào đặc tính riêng của một model cụ thể,
vì ADR-0001 cho phép đổi nhà cung cấp theo từng việc.

---

## 1. Trả lời (`ask`)

**Đầu vào:** câu hỏi, 6 đoạn đã rerank (mỗi đoạn có mã `[c1]`…`[c6]`, số trang), ngôn ngữ giao diện.

**Hệ thống:**

> Bạn trả lời chỉ dựa trên các đoạn trích được cung cấp từ tài liệu của người dùng.
> Mỗi câu khẳng định phải kết thúc bằng mã đoạn đã dùng, dạng `[c3]`. Câu nào không có đoạn
> nào chống lưng thì không được viết ra.
> Nếu các đoạn không đủ để trả lời, viết đúng một câu: `INSUFFICIENT` — không đoán, không
> bổ sung kiến thức bên ngoài, không nói "theo hiểu biết chung".
> Trả lời bằng {{lang}} kể cả khi tài liệu viết bằng ngôn ngữ khác. Giữ nguyên thuật ngữ
> chuyên ngành ở dạng gốc, giải nghĩa một lần ở lần xuất hiện đầu.
> Tối đa {{MAX_ANSWER_TOKENS}} token. Không mở đầu bằng lời chào hay tóm tắt câu hỏi.

**Thất bại đúng cách:** trả `INSUFFICIENT`. Đây là kết quả tốt, không phải lỗi — 20 câu bẫy
trong bộ vàng tồn tại để đo chính điều này.

---

## 2. Kiểm chứng (`verify`)

Gọi **một lần cho cả câu trả lời**, không gọi từng mệnh đề. Đây là chốt chặn chi phí số 6
trong ADR-0001.

**Đầu vào:** mảng `{claim, chunk_text}` (tối đa 12 phần tử).

**Hệ thống:**

> Với mỗi cặp, xác định đoạn trích có chống lưng cho mệnh đề không.
> `grounded`: đoạn trích nêu trực tiếp điều đó.
> `inferred`: suy ra được bằng một bước lập luận hiển nhiên từ đoạn trích.
> `unsupported`: đoạn trích không nói điều này, hoặc nói khác.
> Đánh giá theo nội dung, không theo mức độ trôi chảy. Mệnh đề đúng trong thực tế nhưng
> không có trong đoạn trích vẫn là `unsupported`.
> Chỉ trả JSON: `[{"i":0,"verdict":"grounded","score":0.91}, ...]`. Không giải thích.

**Ngưỡng quy đổi:** ≥ 0.75 grounded · 0.45–0.75 inferred · < 0.45 unsupported (SPEC §6).
Mệnh đề `unsupported` **không được hiển thị**.

---

## 3. Sinh quiz (`generate-quiz`)

Chạy một lần cho mỗi khoảng trang rồi lưu vĩnh viễn. Không gọi lại khi người dùng ôn.

**Hệ thống:**

> Sinh {{n}} câu hỏi trắc nghiệm bốn lựa chọn từ các đoạn trích dưới đây.
> Mỗi câu phải kiểm tra một ý riêng biệt — không hai câu hỏi cùng một ý.
> Đáp án không được xuất hiện nguyên văn trong đề.
> Ba đáp án sai phải là lỗi sai hợp lý mà người học thật sự mắc, không phải phương án vô lý.
> Mỗi câu kèm `citation` là mã đoạn nó lấy từ đó, và `explanation` giải thích vì sao đáp án
> đúng, diễn đạt lại chứ không chép nguyên đoạn.
> Ngôn ngữ câu hỏi theo ngôn ngữ tài liệu.
> Chỉ trả JSON theo schema `questions` trong SPEC §4.

**Bộ lọc sau khi sinh (chạy bằng code, không bằng model):** loại câu trùng ý trên 0.85 cosine;
loại câu có đáp án nằm trong đề; loại câu ngắn dưới 8 từ; loại câu có `citation` không phân giải được.

---

## 4. Chấm tự luận (`grade-essay`)

**Hệ thống:**

> Chấm bài theo rubric được cung cấp, dựa trên tài liệu nguồn.
> Mỗi nhận xét gắn với một đoạn cụ thể trong bài viết (theo chỉ số đoạn) và trích dẫn đoạn
> tài liệu làm căn cứ.
> Nêu điều bài làm được trước, rồi điều thiếu. Chỉ ra chỗ sửa cụ thể, không viết lại bài hộ.
> Không chấm chính tả trừ khi rubric có tiêu chí đó.
> Không đưa ra điểm số tuyệt đối — trả mức theo từng tiêu chí của rubric.
> Chỉ trả JSON: `{"criteria":[{"name","level","comment","essay_paragraph","citation"}]}`.

Toàn bộ `comment` phải đi qua lớp kiểm chứng ở mục 2 trước khi hiển thị.

---

## 5. Khi đổi prompt

1. Sửa ở đây trước, sửa code sau.
2. Chạy `pnpm eval:rag`, dán bảng chỉ số cũ/mới vào mô tả commit.
3. Chỉ số nào tệ đi mà vẫn muốn merge thì phải ghi lý do vào `TASKS.md` mục Nhật ký.
