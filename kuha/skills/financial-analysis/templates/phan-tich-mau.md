# Báo cáo phân tích tài chính — [Tên dự án/công ty]

> Kỳ báo cáo: [ví dụ: Năm 2025 / Quý 2 2026] — Đơn vị tiền tệ: [ví dụ: tỷ đồng VND]
> Nguồn số liệu: [tên file BCTC nguồn, ngày nhận]
> Người lập: [tên] — Ngày lập: [ngày]

---

## 1. Tóm tắt điều hành (Executive Summary)

- Kết quả kinh doanh chính trong kỳ: [doanh thu, lợi nhuận, so với kỳ trước — số liệu cụ thể]
- Tình hình tài chính tổng quát: [thanh khoản, đòn bẩy — 2-3 câu]
- Kết luận nhanh: [dự án/doanh nghiệp đang ở trạng thái nào — tăng trưởng, ổn định, rủi ro]
- Khuyến nghị ưu tiên: [1-2 hành động quan trọng nhất]

*(Phần này viết sau cùng, sau khi hoàn thành các phần bên dưới — tóm tắt lại, không thêm số liệu mới.)*

---

## 2. Kết quả kinh doanh

- Doanh thu thuần theo kỳ: [số liệu, tăng/giảm % so với kỳ trước]
- Cơ cấu doanh thu theo mảng (nếu có tách): khách sạn / công viên giải trí / show diễn — [%]
- Giá vốn hàng bán và biên lợi nhuận gộp: [số liệu + xu hướng]
- Chi phí bán hàng, chi phí quản lý doanh nghiệp: [số liệu + tỷ trọng trên doanh thu]
- Lợi nhuận trước thuế, lợi nhuận sau thuế: [số liệu + biên lợi nhuận]
- EBITDA và biên EBITDA: [số liệu]

**Nhận xét:** [diễn giải nguyên nhân tăng/giảm — tách rõ sự kiện một lần (non-recurring) khỏi xu hướng hoạt động cốt lõi]

---

## 3. Cơ cấu tài sản – nguồn vốn

- Tổng tài sản và tốc độ tăng trưởng: [số liệu]
- Tỷ trọng tài sản ngắn hạn / dài hạn: [%]
- Các khoản mục lớn: hàng tồn kho, phải thu khách hàng, tài sản cố định: [số liệu + nhận xét chất lượng]
- Nợ phải trả: tỷ trọng nợ ngắn hạn / dài hạn, cơ cấu vay: [số liệu]
- Vốn chủ sở hữu: [số liệu + biến động do lợi nhuận giữ lại/góp thêm vốn]
- Hệ số Nợ/Vốn chủ sở hữu (D/E): [số liệu, so với khoảng tham khảo trong references/vas-ifrs.md]

**Nhận xét:** [đánh giá mức độ an toàn cấu trúc vốn, có phù hợp với giai đoạn dự án (đầu tư/vận hành) không]

---

## 4. Dòng tiền

- Lưu chuyển tiền từ hoạt động kinh doanh: [số liệu — có dương và đủ lớn để tự tài trợ hoạt động không]
- Lưu chuyển tiền từ hoạt động đầu tư: [số liệu — capex chính trong kỳ]
- Lưu chuyển tiền từ hoạt động tài chính: [số liệu — vay mới, trả nợ gốc, cổ tức]
- Tiền và tương đương tiền cuối kỳ: [số liệu, đối chiếu khớp với Bảng cân đối kế toán]

**Nhận xét:** [dòng tiền kinh doanh có đủ trang trải chi phí lãi vay và nợ gốc đến hạn không]

---

## 5. Chỉ số chính

*(Dán bảng từ báo cáo do `scripts/ratios.py` sinh ra, hoặc điền tay theo mẫu dưới)*

| Chỉ số | Kỳ trước | Kỳ này | Khoảng tham khảo | Đánh giá |
|---|---|---|---|---|
| Hệ số thanh toán hiện hành | | | 1.5–3.0 lần | |
| Hệ số thanh toán nhanh | | | 0.8–1.2 lần | |
| Nợ/Vốn chủ sở hữu | | | < 2.0 lần | |
| Khả năng trả lãi vay | | | > 3.0 lần | |
| Biên lợi nhuận gộp | | | tùy ngành | |
| Biên EBITDA | | | 25–40% (khách sạn vận hành ổn định) | |
| ROE | | | 12–20% | |
| ROA | | | 5–10% | |
| DSO / DIO / DPO (ngày) | | | tùy ngành | |

Các KPI vận hành liên quan (nếu có dữ liệu — xem `references/hospitality-kpis.md`):

| KPI | Kỳ trước | Kỳ này |
|---|---|---|
| Occupancy (khách sạn) | | |
| ADR / RevPAR | | |
| Attendance (công viên) | | |
| Per-cap spending | | |
| Seats sold % (show) | | |

---

## 6. Rủi ro

- Rủi ro tài chính: [thanh khoản, đòn bẩy, lãi suất thả nổi...]
- Rủi ro vận hành: [mùa vụ, phụ thuộc thời tiết, công suất khai thác...]
- Rủi ro thị trường: [cạnh tranh, thay đổi hành vi khách du lịch...]
- Rủi ro số liệu: [chất lượng dữ liệu nguồn — chỉ tiêu nào thiếu, chỉ tiêu nào không khớp tổng]

---

## 7. Khuyến nghị

- [Khuyến nghị 1 — cụ thể, gắn với số liệu đã phân tích ở trên]
- [Khuyến nghị 2]
- [Khuyến nghị 3]

---

**Lưu ý khi điền báo cáo này:**
- Luôn ghi rõ kỳ báo cáo và đơn vị tiền tệ ở đầu báo cáo.
- Không tự suy diễn số liệu không có trong nguồn — ghi "thiếu dữ liệu" thay vì bỏ trống hoặc đoán.
- Tách rõ phần "số liệu thực tế" khỏi phần "nhận định/diễn giải" trong từng mục.
- Nếu Tổng tài sản ≠ Nợ phải trả + Vốn chủ sở hữu, hoặc tiền cuối kỳ trên Báo cáo LCTT không khớp Bảng CĐKT, phải nêu rõ trong mục Rủi ro trước khi dùng số liệu để kết luận.
