"""Test logic chunking thuần (SPEC §5). Không cần PDF hay mạng."""

from app.chunking import (
    Line,
    chunk_page,
    chunk_sentences,
    count_tokens,
    lines_to_sentences,
    nfc,
)


def _line(text: str, y: float, block: int = 0) -> Line:
    return Line(text, (10.0, y, 500.0, y + 20.0), block)


def test_nfc_chuan_hoa_dau_tieng_viet():
    decomposed = "Tiếng Việt"  # dạng tổ hợp
    assert nfc(decomposed) == "Tiếng Việt"
    assert len(nfc(decomposed)) < len(decomposed)


def test_tach_cau_giu_bbox_cua_moi_dong_cau_cham_toi():
    lines = [
        _line("Định luật thứ nhất nói rằng năng lượng được bảo toàn. Định luật", 100),
        _line("thứ hai nói về entropy. Hết.", 120),
    ]
    sents = lines_to_sentences(lines)
    assert [s.text for s in sents] == [
        "Định luật thứ nhất nói rằng năng lượng được bảo toàn.",
        "Định luật thứ hai nói về entropy.",
        "Hết.",
    ]
    # Câu thứ hai vắt qua hai dòng → hai bbox; câu đầu và câu cuối một bbox.
    assert len(sents[0].bboxes) == 1
    assert len(sents[1].bboxes) == 2
    assert len(sents[2].bboxes) == 1


def test_khong_tach_sau_so_thap_phan():
    sents = lines_to_sentences([_line("Giá trị là 3.14 đơn vị. Xong.", 0)])
    assert [s.text for s in sents] == ["Giá trị là 3.14 đơn vị. Xong."][:0] + [
        "Giá trị là 3.14 đơn vị.",
        "Xong.",
    ]


def test_chunk_khong_vuot_target_va_khong_cat_giua_cau():
    # 60 câu, mỗi câu ~12 token → phải chia thành nhiều chunk, mỗi chunk ≤ 100 token.
    lines = [_line(f"Câu số {i} nói về một ý nhỏ trong bài giảng này.", 20 * i) for i in range(60)]
    chunks = chunk_page(lines, target=100, overlap_ratio=0.15)
    assert len(chunks) > 5
    for c in chunks:
        assert c.token_count <= 100
        assert c.text.endswith(".")  # kết thúc đúng ranh giới câu
        assert c.bboxes  # luôn có toạ độ để highlight


def test_chong_lan_15_phan_tram():
    lines = [_line(f"Câu số {i} nói về một ý nhỏ trong bài giảng này.", 20 * i) for i in range(40)]
    # Mỗi câu ~16 token; target 200 → ngân sách chồng lấn 30 token = 1 câu.
    chunks = chunk_page(lines, target=200, overlap_ratio=0.15)
    assert len(chunks) >= 3
    # Câu mở đầu chunk 2 phải xuất hiện ở cuối chunk 1.
    first_sentence_of_second = chunks[1].text.split(". ")[0] + "."
    assert chunks[0].text.endswith(first_sentence_of_second)
    # Nhưng phần chồng lấn không quá 15% cửa sổ: câu thứ hai của chunk 2 không có trong chunk 1.
    second_sentence_of_second = chunks[1].text.split(". ")[1] + "."
    assert second_sentence_of_second not in chunks[0].text
    assert count_tokens(first_sentence_of_second) <= 30


def test_uu_tien_ranh_gioi_doan():
    # Đoạn 0: ~70 token; đoạn 1: ~70 token. Target 100 → cắt ở ranh giới đoạn thay vì nhét nửa đoạn 1.
    para0 = [_line(f"Ý {i} của đoạn một khá dài để đủ token.", 20 * i, block=0) for i in range(6)]
    para1 = [_line(f"Ý {i} của đoạn hai cũng dài tương tự.", 200 + 20 * i, block=1) for i in range(6)]
    chunks = chunk_page(para0 + para1, target=100, overlap_ratio=0.0)
    assert len(chunks) == 2
    assert "đoạn hai" not in chunks[0].text
    assert "đoạn một" not in chunks[1].text


def test_cau_dai_hon_cua_so_bi_cat_cung_khong_mat_chu():
    long = " ".join(["từ"] * 400)  # một "câu" không có dấu chấm, > 100 token
    chunks = chunk_sentences(lines_to_sentences([_line(long, 0)]), target=100, overlap_ratio=0.0)
    assert len(chunks) >= 2
    assert sum(c.text.count("từ") for c in chunks) == 400


def test_trang_trong_khong_ra_chunk():
    assert chunk_page([_line("   ", 0)]) == []
