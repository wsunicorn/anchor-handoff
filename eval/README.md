# eval/ — cổng chất lượng

Bộ test vàng là tài sản dài hạn của dự án. Model đổi, prompt đổi, truy hồi đổi — bộ này
là thứ duy nhất cho biết đổi xong tốt lên hay tệ đi.

## Cách dựng bộ vàng (task G2.9)

100 dòng trong `golden.jsonl`, lấy từ **tài liệu thật** bạn sẽ dùng khi thử app:

- 50 tiếng Việt, 50 tiếng Anh.
- 80 câu **trả lời được** từ tài liệu.
- 20 câu **bẫy**: nghe rất liên quan tới môn học nhưng tài liệu không hề nói. Đây là phần
  quan trọng nhất — nó đo đúng thứ làm nên sản phẩm này. Cách làm bẫy tốt: lấy một khái
  niệm có thật ở chương khác, hoặc một con số gần đúng nhưng sai, hoặc một câu hỏi mà
  giáo trình chỉ nhắc tên chứ không định nghĩa.

Mỗi dòng là một JSON:

```json
{
  "id": "vi-014",
  "lang": "vi",
  "doc": "ktvm-chuong3.pdf",
  "question": "Độ co giãn của cầu theo giá được tính bằng công thức nào?",
  "answerable": true,
  "expected_pages": [84, 85],
  "expected_gist": "phần trăm thay đổi lượng cầu chia phần trăm thay đổi giá",
  "must_not_say": []
}
```

Với câu bẫy: `"answerable": false`, `expected_pages: []`, và `must_not_say` liệt kê những
thứ mô hình hay bịa ra ở câu đó.

## Chỉ số

| Chỉ số | Cách tính | Ngưỡng |
|---|---|---|
| `recall@6` | Trong 6 đoạn truy hồi, có ít nhất một đoạn thuộc `expected_pages` | ≥ 0.85 |
| `citation_precision` | Trích dẫn app đưa ra thật sự chứa ý được khẳng định | ≥ 0.90 |
| `unsupported_leak` | Tỉ lệ mệnh đề bị chấm `unsupported` mà vẫn lọt ra UI | ≤ 0.03 |
| `refusal_accuracy` | Trong 20 câu bẫy, số câu app trả `INSUFFICIENT` | ≥ 0.80 |
| `ttft_p95` | Thời gian tới token đầu tiên, phân vị 95 | ≤ 2.5s |

`citation_precision` chấm bán tự động: script so khớp, những ca mập mờ in ra để bạn chấm tay.
Chấm tay 100 câu mất khoảng 40 phút và chỉ phải làm lại khi đổi prompt lớn.

## Lệnh

```bash
pnpm eval:rag     # chạy toàn bộ, in bảng chỉ số, ghi eval/out/<ngày>.json
pnpm eval:gate    # như trên nhưng exit 1 nếu vi phạm ngưỡng — dùng trong CI
pnpm eval:diff    # so hai lần chạy gần nhất, in câu nào tệ đi
```

## Quy tắc

Không bao giờ sửa bộ vàng để làm cho chỉ số đẹp lên. Bộ vàng chỉ được thêm câu mới, hoặc
sửa khi phát hiện đáp án kỳ vọng bị sai. Mỗi lần sửa ghi một dòng vào `TASKS.md` mục Nhật ký.
