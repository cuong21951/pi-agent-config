---
name: business-research
description: Rigorous market, competitor, and industry research workflow for Vietnam (tourism, hospitality, real estate, entertainment) with source tiering, triangulation, and confidence ratings.
---

# Business Research (Nghiên cứu kinh doanh)

Kỹ năng này hướng dẫn quy trình nghiên cứu thị trường, đối thủ cạnh tranh và ngành
nghề tại Việt Nam một cách có kỷ luật, dùng cho dự án Kuha (khách sạn + công viên
giải trí + sân khấu biểu diễn). Mục tiêu: mọi con số đưa vào báo cáo đều có nguồn,
có ngày truy cập, và được kiểm chứng chéo.

## Quy trình 6 bước

1. **Xác định câu hỏi nghiên cứu** — Viết câu hỏi cụ thể, có phạm vi (thị trường
   nào, giai đoạn nào, đơn vị nào). Câu hỏi mơ hồ → dừng lại, hỏi lại người yêu
   cầu một câu làm rõ trước khi tra cứu.
2. **Tra theo thứ tự ưu tiên nguồn (source tiers)** — luôn bắt đầu từ tier cao nhất
   còn phù hợp, chỉ xuống tier thấp hơn khi tier cao không có dữ liệu:
   - **Tier 1 — Thống kê chính thức**: Tổng cục Thống kê (GSO, gso.gov.vn), Cục Du
     lịch Quốc gia Việt Nam (vietnamtourism.gov.vn), Sở Du lịch / Sở Kế hoạch Đầu tư
     địa phương.
   - **Tier 2 — Báo cáo ngành**: Savills Việt Nam, CBRE Việt Nam, JLL Việt Nam,
     Grant Thornton Vietnam Hotel Survey, STR (STR Global) cho ngành khách sạn;
     TEA/AECOM Theme Index cho công viên giải trí.
   - **Tier 3 — Hồ sơ doanh nghiệp**: báo cáo thường niên, bản cáo bạch, công bố
     thông tin trên HNX/HOSE/cổng thông tin doanh nghiệp.
   - **Tier 4 — Báo chí uy tín**: VnExpress, Tuổi Trẻ, CafeF, VnEconomy, Nhịp Cầu
     Đầu Tư — dùng để lấy diễn biến gần đây, phỏng vấn, hoặc số liệu tier 1–3 được
     trích dẫn lại (luôn lần về nguồn gốc nếu có thể).
   - **Tier 5 — Mạng xã hội / diễn đàn**: chỉ dùng để nắm cảm nhận thị trường,
     review khách hàng, không dùng làm số liệu định lượng chính.
3. **Đối chiếu chéo (triangulate)** — mỗi con số quan trọng phải có ít nhất 2 nguồn
   độc lập. Nếu hai nguồn lệch nhau, ghi cả hai và giải thích khả năng khác biệt
   (thời điểm, định nghĩa, phạm vi).
4. **Ghi nguồn đầy đủ** — với mỗi số liệu: URL, tên nguồn, ngày công bố, ngày truy
   cập (dùng ngày hôm nay theo hệ thống). Không có URL → không đưa vào phần "Phát
   hiện chính", chỉ có thể ghi ở mục ghi chú với nhãn "chưa kiểm chứng".
5. **Phân biệt fact / estimate / opinion** — dán nhãn rõ từng câu: [Số liệu thực tế],
   [Ước tính], [Nhận định]. Không được viết ước tính hoặc nhận định như thể là số
   liệu thực tế.
6. **Ghi đơn vị tiền tệ và kỳ báo cáo** — luôn ghi rõ VND hay USD, và kỳ (quý/năm/
   tháng nào). Số liệu thiếu đơn vị hoặc kỳ coi như chưa hoàn chỉnh.

## Đánh giá độ tin cậy (confidence rating)

Kết thúc mỗi nghiên cứu bằng một mức độ tin cậy tổng thể:
- **Cao** — từ 2+ nguồn Tier 1–2 độc lập, số liệu khớp nhau.
- **Trung bình** — từ 1 nguồn Tier 1–2 hoặc 2+ nguồn Tier 3–4 khớp nhau.
- **Thấp** — chỉ có 1 nguồn Tier 3–5, hoặc các nguồn mâu thuẫn nhau.

## Nguyên tắc verify-before-claim

- Không bịa số liệu. Nếu không tìm được, ghi "Thiếu dữ liệu" và đề xuất cách tìm
  tiếp (liên hệ đơn vị nào, báo cáo nào sắp phát hành).
- Khi trích dẫn báo chí lấy lại số liệu từ nguồn khác, cố gắng tìm nguồn gốc
  (thường là GSO, hãng nghiên cứu, hoặc công ty).
- Khi dùng công cụ tìm kiếm web, luôn mở và đọc kỹ trang nguồn trước khi trích
  dẫn — không chỉ dựa vào đoạn tóm tắt trong kết quả tìm kiếm.

## Tài nguyên đi kèm

- `references/vietnam-tourism-sources.md` — danh sách nguồn cụ thể cho du lịch,
  khách sạn, công viên giải trí tại Việt Nam, đã kiểm tra URL còn hoạt động.
- `templates/nghien-cuu.md` — mẫu biên bản nghiên cứu (research memo) tiếng Việt.

## Bàn giao

Sau khi hoàn thành nghiên cứu, nếu người dùng cần văn bản trình bày cho ban giám
đốc, chuyển sang kỹ năng `business-report` để soạn báo cáo/tờ trình theo đúng
cấu trúc kim tự tháp (pyramid principle).
