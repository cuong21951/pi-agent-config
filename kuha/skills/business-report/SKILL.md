---
name: business-report
description: Writing Vietnamese executive-level business deliverables (weekly/monthly reports, proposal memos, one-pagers, board slide outlines) using the pyramid principle, with hand-off to docx/pptx/xlsx for final files.
---

# Business Report (Báo cáo kinh doanh)

Kỹ năng này hướng dẫn soạn các văn bản cấp điều hành bằng tiếng Việt cho dự án
Kuha: báo cáo tuần/tháng cho ban giám đốc, tờ trình (proposal memo), one-pager,
và dàn ý slide trình bày cho hội đồng quản trị.

## Nguyên tắc kim tự tháp (pyramid principle)

Luôn viết theo thứ tự: **kết luận / đề xuất trước, chi tiết sau**.

1. **Dẫn đầu bằng quyết định cần có** — câu đầu tiên của bất kỳ văn bản nào
   phải nói rõ: đây là báo cáo cập nhật tình hình, hay cần ban giám đốc quyết
   định việc gì, trước hạn nào.
2. **Số liệu luôn có đơn vị và kỳ** — không viết "doanh thu tăng", phải viết
   "doanh thu tháng 8/2026 đạt X tỷ VND, tăng Y% so với tháng 7/2026".
3. **Một biểu đồ cho một thông điệp** — mỗi biểu đồ chỉ truyền tải đúng một ý;
   nếu cần hai kết luận, tách hai biểu đồ.
4. **Việc cần làm luôn có người phụ trách và hạn chót** — mọi mục "Đề xuất"
   hoặc "Hành động tiếp theo" viết dạng: [Việc] — Phụ trách: [Tên/bộ phận] —
   Hạn: [ngày].
5. **Nhóm ý theo MECE** — các mục trong một danh sách không chồng chéo, không
   bỏ sót nhánh chính (Lưu trú, Công viên, Show, F&B, Nhân sự, Tài chính, Rủi
   ro là các nhánh chuẩn cho Kuha, thêm/bớt tuỳ báo cáo).

## Bốn loại văn bản

- **Báo cáo tuần/tháng** (`templates/bao-cao-thang.md`) — cập nhật định kỳ cho
  ban giám đốc, theo từng mảng hoạt động.
- **Tờ trình** (`templates/to-trinh.md`) — xin phê duyệt một quyết định cụ thể
  (đầu tư, tuyển dụng, thay đổi giá...), phải nêu rõ phương án và khuyến nghị.
- **One-pager** (`templates/one-pager.md`) — tóm tắt một trang cho người bận,
  dùng khi cần trình bày nhanh một sáng kiến hoặc tình hình.
- **Dàn ý slide hội đồng quản trị** (`templates/slide-outline.md`) — outline
  từng slide (tiêu đề + thông điệp chính + dữ liệu hỗ trợ) trước khi dựng
  file trình chiếu thật.

## Quy tắc chung khi soạn

- Luôn có nguồn cho mọi số liệu (xem kỹ năng `business-research` nếu số liệu
  chưa được nghiên cứu và kiểm chứng).
- Không bịa số liệu; nếu thiếu, ghi "chưa có số liệu — đang thu thập".
- Văn phong: ngắn gọn, chủ động, tránh từ ngữ hoa mỹ; câu đầu đoạn mang thông
  điệp, câu sau giải thích.
- Dùng bảng cho dữ liệu, dùng danh sách gạch đầu dòng cho hành động.

## Bàn giao cho các kỹ năng khác

Kỹ năng này chỉ soạn **nội dung** (bố cục, câu chữ, số liệu). Khi cần xuất ra
file cuối cùng, bàn giao cho:

- Kỹ năng `docx` — báo cáo tuần/tháng, tờ trình, one-pager dạng Word.
- Kỹ năng `pptx` — dàn ý slide dạng PowerPoint.
- Kỹ năng `xlsx` — bảng số liệu chi tiết đi kèm báo cáo.

Soạn nội dung xong trước, sau đó mới gọi kỹ năng xuất file tương ứng — không
xuất file khi nội dung còn thiếu số liệu hoặc chưa có nguồn.
