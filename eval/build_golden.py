"""Sinh eval/golden.jsonl từ danh sách dưới đây (G2.9). Tài liệu: docs/samples/*.pdf (xem README ở đó).

Quy tắc (eval/README.md): 100 câu, 50 vi + 50 en, 20 bẫy. Bẫy = khái niệm có thật nhưng ở chỗ khác,
con số gần đúng nhưng sai, hoặc thứ tài liệu chỉ nhắc tên mà không nói. Không sửa để chỉ số đẹp lên.

Chạy: python eval/build_golden.py  (ghi đè golden.jsonl)
"""

from __future__ import annotations

import json
from pathlib import Path

# (doc, question, expected_pages, expected_gist) — answerable
# (doc, question, must_not_say) — trap
CTU = "vi_decuong_ctu.pdf"
HCM = "vi_decuong_hcmute.pdf"
VJOL = "vi_baibao_vjol.pdf"
ATT = "en_attention.pdf"
MIT = "slides_mit.pdf"

VI_OK: list[tuple[str, str, list[int], str]] = [
    (CTU, "Học phần Vật lý đại cương SP095 có bao nhiêu tín chỉ?", [1], "2 tín chỉ"),
    (CTU, "Số tiết lý thuyết và số tiết tự học của học phần SP095 là bao nhiêu?", [1], "30 tiết lý thuyết, 60 tiết tự học"),
    (CTU, "Học phần SP095 do bộ môn và khoa nào phụ trách?", [1], "Bộ môn Sư phạm Vật lý, Khoa Sư phạm"),
    (CTU, "Điều kiện tiên quyết của học phần Vật lý đại cương SP095 là gì?", [1], "không có điều kiện tiên quyết"),
    (CTU, "Chương 1 của học phần SP095 nói về nội dung gì và gồm mấy tiết?", [2], "Trường tĩnh điện, 5 tiết"),
    (CTU, "Định lý Ostrogradski–Gauss được dạy ở chương nào của học phần SP095?", [2, 5], "Chương 1 Trường tĩnh điện, mục 1.4"),
    (CTU, "Chương 2 của học phần SP095 gồm những định luật nào?", [2, 3], "định luật Ohm, định luật Kirchoff, định luật Joule–Lentz"),
    (CTU, "Hiệu ứng Compton thuộc chương nào trong đề cương SP095?", [3, 7], "Chương 6 Các hiệu ứng lượng tử"),
    (CTU, "Chương 7 của học phần SP095 gồm những nội dung gì?", [3], "cấu tạo nguyên tử, hạt nhân, năng lượng liên kết, phóng xạ, phản ứng hạt nhân"),
    (CTU, "Điểm thi kết thúc học phần SP095 chiếm trọng số bao nhiêu?", [4], "50%"),
    (CTU, "Điểm kiểm tra giữa kỳ của SP095 chiếm bao nhiêu phần trăm và đánh giá chuẩn đầu ra nào?", [4], "20%, CO1 CO2 CO4"),
    (CTU, "Sinh viên phải tham dự tối thiểu bao nhiêu phần trăm số tiết lý thuyết của SP095?", [4], "80%"),
    (CTU, "Điểm chuyên cần của học phần SP095 yêu cầu gì và chiếm trọng số bao nhiêu?", [4], "tham dự tối thiểu 90% số tiết, chuẩn bị bài, 10%"),
    (CTU, "Điểm học phần SP095 được làm tròn thế nào và quy đổi ra thang điểm nào?", [4], "làm tròn một chữ số thập phân, quy đổi sang điểm chữ và thang điểm 4"),
    (CTU, "Tài liệu [1] của học phần SP095 là sách nào?", [4], "Vật lý đại cương tập 2, Lương Duyên Bình, NXB Giáo dục 2004"),
    (CTU, "Bài giảng Quang học của Nguyễn Hữu Khanh xuất bản năm nào và ở đâu?", [4], "2000, Trường Đại học Cần Thơ Khoa Sư phạm"),
    (CTU, "Khi tự học chương 1 mục 1.1–1.3, sinh viên cần ôn lại kiến thức gì?", [5], "vi tích phân đã học ở học phần Toán cho hóa, sinh"),
    (CTU, "Để hiểu rõ hiện tượng nhiễu xạ ánh sáng, sinh viên được hướng dẫn đọc tài liệu nào, trang nào?", [7], "tài liệu [3] chương 7 trang 192 đến 221"),
    (CTU, "Chuẩn đầu ra CO3 của học phần SP095 là gì?", [2], "tham gia làm việc nhóm, trình bày, bảo vệ và phản biện ý kiến"),
    (HCM, "Môn Vật lý 1 mã PHYS130902 có bao nhiêu tín chỉ và phân bố thế nào?", [1], "3 tín chỉ, 3 lý thuyết 0 thực hành, 15 tuần"),
    (HCM, "Môn học trước của Vật lý 1 là môn gì?", [1], "Toán 1"),
    (HCM, "Nội dung Vật lý 1 lấy từ các chương nào của sách nào?", [1], "chương 1 đến 22, Physics for Scientists and Engineers, Serway và Jewett, 9th edition"),
    (HCM, "Nếu sinh viên bị phát hiện sao chép bài tập ở nhà thì bị xử lý thế nào?", [3], "0 điểm quá trình và cuối kỳ"),
    (HCM, "Chuẩn đầu ra G1.3 của môn Vật lý 1 là gì?", [2], "hiểu các khái niệm, quá trình biến đổi và nguyên lý nhiệt động học của chất khí"),
    (HCM, "Tuần 1 của môn Vật lý 1 học những chương nào?", [3], "Chương 1 Vật lý và đo lường, Chương 2 Chuyển động một chiều"),
    (HCM, "Chương 5 của Vật lý 1 gồm những nội dung nào về định luật Newton?", [4], "khái niệm lực, ba định luật Newton, lực hấp dẫn và trọng lượng, lực ma sát"),
    (HCM, "Chương 7 Năng lượng của hệ được dạy ở tuần thứ mấy?", [4], "tuần 5"),
    (HCM, "Định lý Công – Động năng nằm ở mục nào của chương 7?", [5], "mục 7.5"),
    (HCM, "Chương 9 của Vật lý 1 nói về gì?", [5], "động lượng và va chạm"),
    (HCM, "Phương trình Bernoulli thuộc chương nào của Vật lý 1?", [7], "Chương 14 Cơ học chất lỏng, mục 14.6"),
    (HCM, "Hiệu ứng Doppler được dạy ở chương nào?", [7], "Chương 17 Sóng âm, mục 17.4"),
    (HCM, "Kiểm tra quá trình lần 1 của Vật lý 1 diễn ra tuần nào và về nội dung gì?", [9], "tuần 6, động học và động lực học chất điểm"),
    (HCM, "Thi cuối kỳ Vật lý 1 kéo dài bao lâu và chiếm tỉ lệ bao nhiêu?", [9], "90 phút, 50%"),
    (HCM, "Kiểm tra online theo từng chương chiếm bao nhiêu phần trăm?", [9], "5%"),
    (HCM, "Sách giáo trình chính của Vật lý 1 có ISBN nào?", [10], "9781285143811"),
    (HCM, "Động cơ Carnot và entropy thuộc chương nào của Vật lý 1?", [8, 9], "Chương 22"),
    (VJOL, "Mỗi nhóm thực hành thí nghiệm ở Trường Đại học An Giang thường tập trung bao nhiêu sinh viên?", [1], "25 đến 30 sinh viên"),
    (VJOL, "Bài báo đề xuất bố trí mỗi nhóm bao nhiêu sinh viên thực hành một bài thí nghiệm?", [1, 3], "2 đến 3 sinh viên"),
    (VJOL, "Phim hướng dẫn thí nghiệm gồm những nội dung chính nào?", [2], "cơ sở lý thuyết, dụng cụ thí nghiệm, tiến trình thí nghiệm"),
    (VJOL, "Khi tiến hành thí nghiệm, bài báo khuyến nghị đo lường ít nhất bao nhiêu lần?", [2], "ít nhất 5 lần"),
]

VI_TRAP: list[tuple[str, str, list[str]]] = [
    (CTU, "Học phần SP095 yêu cầu sinh viên làm bao nhiêu bài thí nghiệm thực hành?", ["bài thí nghiệm", "phòng thí nghiệm"]),
    (CTU, "Định luật Coulomb được phát biểu như thế nào trong đề cương SP095?", ["tỉ lệ thuận", "bình phương khoảng cách", "F ="]),
    (CTU, "Giảng viên phụ trách học phần SP095 tên là gì?", ["TS.", "ThS.", "PGS"]),
    (CTU, "Lệ phí thi lại học phần SP095 là bao nhiêu?", ["đồng", "VND", "lệ phí"]),
    (HCM, "Điểm số tối thiểu để qua môn Vật lý 1 là bao nhiêu?", ["5.0", "4.0", "điểm tối thiểu"]),
    (HCM, "Bài kiểm tra quá trình lần 2 của Vật lý 1 diễn ra ở tuần 8, đúng không?", ["tuần 8"]),
    (HCM, "Vật lý 1 có bao nhiêu tín chỉ thí nghiệm?", ["1 tín chỉ thí nghiệm", "2 tín chỉ thí nghiệm"]),
    (HCM, "Công thức tính động năng được đề cương Vật lý 1 nêu ra là gì?", ["mv²/2", "1/2 mv", "K ="]),
    (VJOL, "Bài báo khảo sát bao nhiêu sinh viên và kết quả điểm trung bình tăng bao nhiêu phần trăm?", ["%", "điểm trung bình", "khảo sát"]),
    (VJOL, "Nhiệt nóng chảy của nước đá đo được trong bài thí nghiệm là bao nhiêu J/kg?", ["J/kg", "334", "3,34"]),
]

EN_OK: list[tuple[str, str, list[int], str]] = [
    (ATT, "What BLEU score does the Transformer achieve on WMT 2014 English-to-German?", [1, 8], "28.4 BLEU"),
    (ATT, "How long did the big Transformer model take to train and on what hardware?", [1, 7, 8], "3.5 days on eight P100 GPUs"),
    (ATT, "How many identical layers are in the encoder stack?", [3], "N = 6"),
    (ATT, "What are the two sub-layers in each encoder layer?", [3], "multi-head self-attention and position-wise feed-forward network"),
    (ATT, "What is the output dimension dmodel of the embedding layers and all sub-layers?", [3], "512"),
    (ATT, "How does the decoder prevent positions from attending to subsequent positions?", [3], "masking in self-attention combined with offsetting output embeddings by one position"),
    (ATT, "In scaled dot-product attention, what are the dot products divided by?", [4], "square root of dk"),
    (ATT, "Why is dot-product attention scaled by 1/sqrt(dk)?", [4], "for large dk dot products grow large pushing softmax into regions with small gradients"),
    (ATT, "How many parallel attention heads does the model use, and what are dk and dv?", [5], "h = 8, dk = dv = dmodel/h = 64"),
    (ATT, "What is the inner-layer dimensionality dff of the feed-forward network?", [5], "2048"),
    (ATT, "What is the maximum path length for self-attention versus a recurrent layer according to Table 1?", [6], "O(1) for self-attention, O(n) for recurrent"),
    (ATT, "What functions are used for positional encoding?", [6], "sine and cosine functions of different frequencies"),
    (ATT, "How did learned positional embeddings compare to sinusoidal ones?", [6, 9], "nearly identical results"),
    (ATT, "How many sentence pairs does the WMT 2014 English-German training set contain?", [7], "about 4.5 million sentence pairs"),
    (ATT, "What vocabulary size was used for the English-German byte-pair encoding?", [7], "about 37000 tokens"),
    (ATT, "Which optimizer and hyperparameters were used for training?", [7], "Adam with beta1 0.9, beta2 0.98, epsilon 1e-9"),
    (ATT, "How many warmup steps were used in the learning rate schedule?", [7], "4000"),
    (ATT, "How many training steps did the base model and the big model use?", [7], "100,000 steps (12 hours) and 300,000 steps (3.5 days)"),
    (ATT, "What dropout rate Pdrop was used for the base model?", [8], "0.1"),
    (ATT, "What label smoothing value was used and how did it affect perplexity?", [8], "0.1, hurts perplexity but improves accuracy and BLEU"),
    (ATT, "What beam size and length penalty were used for inference?", [8], "beam size 4, length penalty alpha 0.6"),
    (ATT, "How were the base model checkpoints averaged?", [8], "average of the last 5 checkpoints written at 10-minute intervals"),
    (ATT, "What BLEU did the big model reach on English-to-French?", [1, 8], "41.8"),
    (ATT, "What F1 did the 4-layer Transformer reach on WSJ constituency parsing with WSJ-only training?", [10], "91.3"),
    (ATT, "In Table 3, what happened when the number of attention heads was reduced to a single head?", [9], "0.9 BLEU worse than the best setting"),
    (ATT, "Which is the first sequence transduction model based entirely on attention according to the paper?", [10], "the Transformer"),
    (ATT, "What does the encoder self-attention example in Figure 3 illustrate?", [13], "attention heads following long-distance dependencies, completing the phrase making more difficult"),
    (ATT, "What is the complexity per layer of self-attention in Table 1?", [6], "O(n^2 * d)"),
    (ATT, "How does the paper suggest restricting self-attention for very long sequences?", [6, 7], "neighborhood of size r around each output position, path length O(n/r)"),
    (ATT, "What machine translation models are cited as state-of-the-art recurrent approaches in the introduction?", [2], "recurrent neural networks, LSTM and gated recurrent networks"),
    (MIT, "What is the net charge associated with a cation vacancy in an ionic crystal unit cell?", [2], "-1"),
    (MIT, "In Kroger-Vink notation, what do X, Y and Z denote?", [3], "X what is at the site, Y which site is defective, Z effective charge"),
    (MIT, "What is Schottky disorder and what crystal is given as the example?", [4], "charge-compensating anion vacancies plus cation vacancies, MgO"),
    (MIT, "What is a Frenkel pair and what example crystal is given?", [5], "charge-compensating vacancy-interstitial pair, cation Frenkel pair in LiF"),
    (MIT, "What is the charge-neutrality condition for Schottky disorder in MgO?", [4], "magnesium vacancy concentration equals oxygen vacancy concentration"),
    (MIT, "Does an isovalent impurity like CaO in MgO influence point defect concentration?", [7], "no, it does not influence point defect concentration"),
    (MIT, "Does an aliovalent impurity like CaO in ZrO2 influence point defect concentration?", [8], "yes, impurities influence point defect concentration"),
    (MIT, "What are the intrinsic and extrinsic regimes for cation diffusion in KCl with Ca?", [10], "intrinsic at small impurity or high T where vacancies equal pure value; extrinsic at high impurity or low T where vacancies equal impurity concentration"),
    (MIT, "Which lecture number and date is this slide set from?", [1], "3.205 lecture 5, 11/9/06"),
    (MIT, "What crystal is used as the example for self-diffusion analogous to metals?", [6], "KCl"),
]

EN_TRAP: list[tuple[str, str, list[str]]] = [
    (ATT, "What BLEU score did the Transformer achieve on English-to-Chinese translation?", ["Chinese", "BLEU"]),
    (ATT, "How many TPUs were used to train the Transformer?", ["TPU"]),
    (ATT, "What learning rate did the authors use for fine-tuning on the parsing task in Table 4?", ["learning rate", "0.0"]),
    (ATT, "What is the exact number of parameters of the big model in millions, as stated in the abstract?", ["213", "million"]),
    (ATT, "Which GPU memory size was required to train the base model?", ["GB", "memory"]),
    (MIT, "What is the numerical value of the Schottky formation energy for MgO given in the slides?", ["eV", "kJ"]),
    (MIT, "What diffusion coefficient value is reported for KCl at 700 K?", ["cm2/s", "m2/s", "700"]),
    (MIT, "Which textbook chapter do these slides ask students to read?", ["chapter", "Balluffi", "read"]),
    (MIT, "How does grain boundary diffusion compare to lattice diffusion according to the slides?", ["grain boundary"]),
    (MIT, "What activation energy for oxygen vacancy migration in ZrO2 is given?", ["activation energy", "eV"]),
]


def main() -> None:
    rows = []
    for i, (doc, q, pages, gist) in enumerate(VI_OK, 1):
        rows.append({"id": f"vi-{i:03d}", "lang": "vi", "doc": doc, "question": q, "answerable": True, "expected_pages": pages, "expected_gist": gist, "must_not_say": []})
    for i, (doc, q, mns) in enumerate(VI_TRAP, len(VI_OK) + 1):
        rows.append({"id": f"vi-{i:03d}", "lang": "vi", "doc": doc, "question": q, "answerable": False, "expected_pages": [], "expected_gist": "", "must_not_say": mns})
    for i, (doc, q, pages, gist) in enumerate(EN_OK, 1):
        rows.append({"id": f"en-{i:03d}", "lang": "en", "doc": doc, "question": q, "answerable": True, "expected_pages": pages, "expected_gist": gist, "must_not_say": []})
    for i, (doc, q, mns) in enumerate(EN_TRAP, len(EN_OK) + 1):
        rows.append({"id": f"en-{i:03d}", "lang": "en", "doc": doc, "question": q, "answerable": False, "expected_pages": [], "expected_gist": "", "must_not_say": mns})
    out = Path(__file__).with_name("golden.jsonl")
    out.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    vi = sum(r["lang"] == "vi" for r in rows)
    traps = sum(not r["answerable"] for r in rows)
    print(f"{len(rows)} câu → {out.name}: vi={vi} en={len(rows)-vi} bẫy={traps}")
    assert len(rows) == 100 and vi == 50 and traps == 20


if __name__ == "__main__":
    main()
