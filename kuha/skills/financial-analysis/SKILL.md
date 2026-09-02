---
name: financial-analysis
description: Analyze Vietnamese business and financial reports (báo cáo kinh doanh, báo cáo tài chính) for the Kuha hotel + amusement park + live-show complex — compute standard financial ratios and hospitality KPIs from an Excel report, build capex feasibility numbers (NPV/IRR/payback), and write a structured Vietnamese analysis report. Use when the user shares a BCTC/BCKD file or asks to phân tích tài chính, tính chỉ số, or đánh giá khả thi dự án.
---

# Phân tích tài chính — Kuha (khách sạn + công viên giải trí + show diễn)

Skill này giúp đọc báo cáo tài chính (BCTC) và báo cáo kinh doanh (BCKD) tiếng Việt, tính các chỉ số tài chính chuẩn và KPI vận hành đặc thù ngành khách sạn/công viên/show diễn, và dựng số liệu khả thi cho dự án đầu tư (capex).

## Ghi chú Windows / macOS (Kuha)

Trên Windows dùng `py -3.12`; trên macOS/Linux dùng `python3`. Các lệnh trong skill này viết theo dạng `python3 {baseDir}/scripts/<script>.py ...` — trên Windows (kể cả trong Git Bash, nơi `python3` có thể chưa cài), thay bằng `py -3.12 {baseDir}/scripts/<script>.py ...`.

## Khi nào dùng skill này

- Người dùng gửi một file Excel BCTC/BCKD và muốn phân tích, tính chỉ số, hoặc đánh giá "tình hình tài chính".
- Người dùng muốn tính khả thi cho một khoản đầu tư mới (mở rộng công viên, xây thêm khối phòng, dàn dựng show mới): NPV, IRR, thời gian hoàn vốn.
- Người dùng muốn hiểu một KPI vận hành (occupancy, RevPAR, per-cap spending, seats sold %...) hoặc một chỉ tiêu kế toán (mã tài khoản, dòng nào trên báo cáo nào).
- Người dùng muốn viết báo cáo phân tích hoàn chỉnh để trình bày (rồi xuất ra .docx/.pptx bằng skill docx/pptx tương ứng).

## Tài liệu tham khảo (`references/`)

- `references/vas-ifrs.md` — cấu trúc 4 báo cáo tài chính theo Thông tư 200/2014/TT-BTC, mã tài khoản thường gặp, khác biệt VAS/IFRS, công thức và khoảng tham khảo (rule of thumb) của các tỷ số tài chính chuẩn. Đọc trước khi diễn giải bất kỳ chỉ số kế toán nào.
- `references/hospitality-kpis.md` — KPI vận hành cho khách sạn, công viên giải trí, show diễn: công thức, động lực đứng sau từng chỉ số, và ví dụ tính toán minh họa.

## Công cụ (`scripts/`)

Tất cả chạy bằng `python3` trên macOS/Linux (Windows: `py -3.12`; không dùng `python` trần) và nhận đường dẫn tuyệt đối, chạy được từ bất kỳ thư mục làm việc nào:

- `scripts/ratios.py <bctc.xlsx> [--sheet TEN] [--out report.md] [--charts thu_muc]` — đọc file Excel BCTC (2 cột Chỉ tiêu|Giá trị hoặc nhiều cột theo kỳ), nhận diện nhãn dòng tiếng Việt theo kiểu mờ (không phân biệt hoa/thường, dấu), tính các tỷ số trong `references/vas-ifrs.md`, xuất báo cáo markdown tiếng Việt kèm nhận xét tự động cho các chỉ số vượt khoảng tham khảo. In ra danh sách chỉ tiêu không tìm thấy.
- `scripts/feasibility.py <input.json|.yaml> [--out report.md]` — tính NPV, IRR (bisection thuần Python, không cần numpy), thời gian hoàn vốn cho một dự án capex, kèm bảng độ nhạy theo doanh thu (±10%/±20%) và lãi suất chiết khấu.
- `scripts/make_template.py [--out duong_dan.xlsx]` — sinh lại file mẫu `templates/bctc-mau.xlsx` (dùng khi cần tạo lại mẫu, không cần chạy khi phân tích số liệu thật).

## Mẫu (`templates/`)

- `templates/bctc-mau.xlsx` — BCTC minh họa cho công ty khách sạn + công viên, 3 kỳ (2024, 2025, 2026E), đơn vị tỷ đồng. Đưa cho người dùng để họ sao chép cấu trúc rồi thay bằng số liệu thật — giữ nguyên tên chỉ tiêu ở cột A để `ratios.py` nhận diện đúng.
- `templates/phan-tich-mau.md` — khung báo cáo phân tích: Tóm tắt điều hành, Kết quả kinh doanh, Cơ cấu tài sản – nguồn vốn, Dòng tiền, Chỉ số chính, Rủi ro, Khuyến nghị.

## Quy trình làm việc (workflow)

1. **Nhận file** BCTC/BCKD từ người dùng (Excel). Nếu chưa có file, đề nghị họ dùng `templates/bctc-mau.xlsx` làm khung để điền số liệu thật.
2. **Chạy `scripts/ratios.py`** trên file đó (chỉ định `--sheet` nếu file có nhiều sheet, dùng `--charts` nếu cần biểu đồ trực quan).
3. **Đọc báo cáo** markdown được sinh ra — đặc biệt phần "Dữ liệu không tìm thấy" và "Nhận xét tự động".
4. **Viết phân tích** theo khung `templates/phan-tich-mau.md`, điền số liệu thực tế + diễn giải; nếu là dự án đầu tư mới, chạy thêm `scripts/feasibility.py` và đưa NPV/IRR/hoàn vốn + độ nhạy vào phần liên quan.
5. **Xuất bản** báo cáo hoàn chỉnh ra `.docx` hoặc `.pptx` bằng skill `docx`/`pptx` tương ứng nếu người dùng cần trình bày.

## Quy tắc bắt buộc

- **Luôn nêu rõ kỳ báo cáo và đơn vị tiền tệ** (ví dụ: "Năm 2025, đơn vị tỷ đồng") ở đầu mọi bảng số liệu hoặc nhận định.
- **Không bịa số liệu thiếu trong nguồn.** Nếu một chỉ tiêu cần thiết không có trong file (và `ratios.py` báo "thiếu dữ liệu"), ghi rõ "thiếu dữ liệu" trong báo cáo — không suy diễn, không lấy số liệu ngành ngoài để thay thế trừ khi người dùng cung cấp và đồng ý.
- **Tách bạch sự thật khỏi diễn giải.** Số liệu lấy trực tiếp từ nguồn ghi ở phần "Kết quả/Số liệu"; nhận định, đánh giá, khuyến nghị ghi riêng ở phần "Nhận xét"/"Rủi ro"/"Khuyến nghị" — không trộn lẫn để người đọc phân biệt được đâu là dữ kiện, đâu là ý kiến.
- **Hiển thị công thức khi được hỏi.** Nếu người dùng hỏi một chỉ số được tính như thế nào, trích công thức từ `references/vas-ifrs.md` hoặc `references/hospitality-kpis.md` thay vì diễn giải lại bằng lời.
- **Cảnh báo vấn đề chất lượng dữ liệu.** Nếu Tổng tài sản ≠ Nợ phải trả + Vốn chủ sở hữu, hoặc số dư tiền cuối kỳ trên Báo cáo lưu chuyển tiền tệ không khớp Bảng cân đối kế toán, hoặc số liệu giữa các kỳ không nhất quán về đơn vị/mẫu số, phải nêu rõ vấn đề này trước khi đưa ra kết luận dựa trên số liệu đó.
- **Khoảng "tham khảo" (rule of thumb) không phải chuẩn cứng.** Khi so sánh một tỷ số với khoảng tham khảo, luôn nói rõ đây là thông lệ phổ biến, mức phù hợp thực tế phụ thuộc ngành và giai đoạn dự án.
