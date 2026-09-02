# Nguồn dữ liệu du lịch, khách sạn, giải trí tại Việt Nam

Danh sách được kiểm tra thủ công bằng HTTP request (curl với User-Agent trình
duyệt, và công cụ fetch) vào ngày **2026-09-02**. Trạng thái ghi theo mã HTTP
lúc kiểm tra; cổng thông tin chính phủ Việt Nam đôi khi có sự cố tạm thời —
nếu một URL báo lỗi, hãy thử lại trước khi kết luận là chết.

## Tier 1 — Thống kê chính thức

1. **Cục Thống kê Quốc gia (NSO, trước đây là Tổng cục Thống kê/GSO)**
   https://www.nso.gov.vn/en/homepage/ — [OK, HTTP 200]
   Số liệu GDP, CPI, khách quốc tế đến Việt Nam, lao động, doanh nghiệp theo
   tháng/quý/năm. **Lưu ý quan trọng**: tên miền cũ `gso.gov.vn` đã ngừng hoạt
   động (timeout khi kiểm tra) — cơ quan đã đổi thương hiệu thành NSO tại
   `nso.gov.vn`. Cập nhật lại mọi liên kết cũ trỏ tới gso.gov.vn.
2. **NSO — Số liệu và thống kê**
   https://www.nso.gov.vn/so-lieu-thong-ke/ — [OK, HTTP 200]
   Trang tra cứu số liệu chi tiết theo chủ đề (du lịch, thương mại, dịch vụ).
3. **Cục Du lịch Quốc gia Việt Nam (Vietnam National Authority of Tourism)**
   https://vietnamtourism.gov.vn/ — [OK, HTTP 200]
   Tin tức chính sách, số liệu khách du lịch, quy hoạch ngành du lịch.
4. **Cục Du lịch Quốc gia — Số liệu thống kê du lịch**
   https://vietnamtourism.gov.vn/statistic — [OK, HTTP 200]
   Khách quốc tế/nội địa theo tháng, doanh thu du lịch, thị trường nguồn khách.
5. **Bộ Văn hóa, Thể thao và Du lịch (VHTTDL)** — cơ quan chủ quản Cục Du lịch
   https://bvhttdl.gov.vn/ — [OK, HTTP 200]
   Văn bản pháp luật, chính sách ngành du lịch — giải trí — văn hóa.
6. **Sở Du lịch TP. Hồ Chí Minh**
   https://sodulich.hochiminhcity.gov.vn/ — [OK, HTTP 200 khi thử lại; lần đầu
   timeout — có thể do mạng chậm, thử lại nếu gặp lỗi]
   Số liệu du lịch địa phương, quy hoạch, sự kiện — tham chiếu quan trọng vì
   Kuha nằm trong vùng ảnh hưởng thị trường khách TP.HCM.
7. **Sở Du lịch Hà Nội**
   https://sodulich.hanoi.gov.vn/ — [OK, HTTP 200 — CẢNH BÁO: chứng chỉ SSL của
   trang đã hết hạn tại thời điểm kiểm tra, trình duyệt sẽ cảnh báo "không an
   toàn"; nội dung vẫn truy cập được, cân nhắc rủi ro trước khi nhập thông tin
   cá nhân trên trang này]
   Số liệu du lịch Hà Nội, đề án phát triển.
8. **Cổng thông tin đăng ký doanh nghiệp quốc gia**
   https://dangkykinhdoanh.gov.vn/ — [OK, HTTP 200]
   Tra cứu thông tin đăng ký doanh nghiệp — dùng khi cần kiểm tra đối thủ có
   pháp nhân tại Việt Nam.

## Tier 2 — Báo cáo ngành (bất động sản, khách sạn, công viên giải trí)

9. **Savills Việt Nam — Insight & Opinion**
   https://www.savills.com.vn/insight-and-opinion/ — [OK, HTTP 200]
   Báo cáo thị trường bất động sản nghỉ dưỡng, khách sạn, bán lẻ theo quý.
10. **CBRE Việt Nam — Insights & Research**
    https://cbrevietnam.com/en/Research-Reports — [OK, HTTP 200]
    Báo cáo Vietnam Market Outlook hàng năm, thị trường khách sạn/văn phòng/
    bán lẻ. Lưu ý: tên miền `www.cbre.vn` KHÔNG phải trang CBRE thật (trỏ tới
    dịch vụ khác) — luôn dùng `cbrevietnam.com`.
11. **JLL — Trends & Insights, khu vực châu Á - Thái Bình Dương (có Việt Nam)**
    https://www.jll.com/en/trends-and-insights/regions/asia-pacific/vietnam —
    [OK, HTTP 200]
    Báo cáo thị trường bất động sản thương mại và khách sạn.
12. **Grant Thornton Vietnam**
    https://www.grantthornton.com.vn/ — [OK, HTTP 200]
    Khảo sát ngành khách sạn Việt Nam thường niên (Vietnam Hotel Survey) — tìm
    trong mục "Insights" hoặc "Publications".
13. **STR (STR Global) — dữ liệu benchmarking khách sạn (RevPAR, ADR, công suất
    phòng)**
    https://str.com/ — [HTTP 403 khi truy cập bằng công cụ tự động — trang có
    chặn bot; đây vẫn là nguồn dữ liệu chuẩn ngành khách sạn thế giới, truy
    cập bằng trình duyệt thường hoặc qua báo cáo được trích dẫn lại trên báo
    chí/Savills/CBRE nếu không vào được trực tiếp]
14. **TEA/AECOM Theme Index & Museum Index** — chuẩn benchmark lượng khách công
    viên giải trí toàn cầu, dùng để so sánh khi lập kế hoạch công viên Kuha
    https://aecom.com/theme-index/ — [OK, HTTP 200]

## Tier 3 — Sàn giao dịch chứng khoán (hồ sơ doanh nghiệp niêm yết)

15. **Sở Giao dịch Chứng khoán TP.HCM (HOSE)**
    https://www.hsx.vn/ — [OK, HTTP 200]
16. **Sở Giao dịch Chứng khoán Hà Nội (HNX)**
    https://hnx.vn/ — [OK, HTTP 200]
    Dùng để tra báo cáo tài chính, công bố thông tin của đối thủ niêm yết
    (ví dụ các công ty du lịch, khách sạn, giải trí đã lên sàn).

## Tier 4 — Báo chí kinh tế uy tín

17. **VnExpress — Kinh doanh**
    https://vnexpress.net/kinh-doanh — [OK, HTTP 200]
18. **Tuổi Trẻ — Kinh doanh**
    https://tuoitre.vn/kinh-doanh.htm — [OK, HTTP 200]
19. **CafeF**
    https://cafef.vn/ — [OK, HTTP 200]
    Tin tài chính doanh nghiệp, thường trích số liệu từ báo cáo ngành — luôn
    lần về báo cáo gốc khi có thể.
20. **VnEconomy**
    https://vneconomy.vn/ — [OK, HTTP 200]

## Cách dùng danh sách này

- Bắt đầu từ Tier 1 cho mọi câu hỏi có số liệu vĩ mô hoặc số liệu ngành du
  lịch chính thức.
- Dùng Tier 2 cho dữ liệu thị trường bất động sản nghỉ dưỡng, khách sạn, công
  viên giải trí — đối chiếu ít nhất 2 đơn vị (ví dụ Savills + CBRE) khi số
  liệu quan trọng cho quyết định đầu tư của Kuha.
- Dùng Tier 3 khi nghiên cứu đối thủ cạnh tranh đã niêm yết.
- Dùng Tier 4 để nắm diễn biến gần đây và tìm manh mối tới báo cáo gốc.
- Nếu một URL trong danh sách này báo lỗi khi dùng, thử lại một lần; nếu vẫn
  lỗi, ghi rõ trong nghiên cứu là "nguồn không truy cập được vào [ngày]" và
  tìm nguồn thay thế cùng tier.
