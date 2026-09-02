# KPI vận hành cho khách sạn, công viên giải trí và show diễn

Tài liệu tham khảo cho skill `financial-analysis`, dùng khi phân tích số liệu vận hành (không chỉ số liệu kế toán) của tổ hợp Kuha (khách sạn + công viên giải trí + show diễn). Các công thức và động lực (driver) phía sau từng KPI giúp giải thích *tại sao* một chỉ số tăng/giảm, không chỉ *tính ra bao nhiêu*.

## 1. Khách sạn (Hotel)

| KPI | Công thức | Driver đứng sau chỉ số |
|---|---|---|
| **Occupancy** (Công suất phòng) | Số đêm phòng bán được / Số đêm phòng khả dụng | Nhu cầu thị trường, mùa vụ, giá bán so với đối thủ, kênh phân phối (OTA vs trực tiếp) |
| **ADR** (Average Daily Rate — Giá phòng bình quân) | Doanh thu phòng / Số đêm phòng bán được | Chiến lược định giá, revenue management, tỷ trọng khách đoàn (giá thấp hơn) vs khách lẻ |
| **RevPAR** (Revenue per Available Room) | Doanh thu phòng / Số đêm phòng khả dụng = ADR × Occupancy | Chỉ số tổng hợp quan trọng nhất để so sánh hiệu quả giữa các kỳ/đối thủ, tách biệt ảnh hưởng của giá và công suất |
| **TRevPAR** (Total Revenue per Available Room) | Tổng doanh thu khách sạn (phòng + F&B + dịch vụ khác) / Số đêm phòng khả dụng | Đo toàn bộ khả năng khai thác khách lưu trú, không chỉ doanh thu phòng — quan trọng khi khách sạn có nhiều nguồn thu phụ trợ (spa, nhà hàng, hồ bơi) |
| **GOPPAR** (Gross Operating Profit per Available Room) | Lợi nhuận hoạt động gộp (GOP) / Số đêm phòng khả dụng | Kết hợp cả doanh thu và kiểm soát chi phí vận hành — chỉ số sát nhất với hiệu quả tài chính thực của khách sạn |
| **F&B capture rate** | Doanh thu F&B từ khách lưu trú / Doanh thu phòng (hoặc / Tổng số khách lưu trú để ra chi tiêu F&B bình quân mỗi khách) | Chất lượng và sức hấp dẫn của nhà hàng/quầy bar nội bộ, có giữ khách ăn tại chỗ hay khách ra ngoài |
| **Cost per occupied room (CPOR)** | Tổng chi phí vận hành bộ phận buồng phòng / Số đêm phòng bán được | Hiệu quả vận hành: nhân sự dọn phòng, giặt là, tiện nghi — chỉ số càng thấp ở cùng mức chất lượng dịch vụ càng tốt |
| **Staff-to-room ratio** | Tổng số nhân viên (quy đổi toàn thời gian) / Tổng số phòng | Định biên nhân sự — khách sạn 5 sao thường 1.0–1.5 nhân viên/phòng, khách sạn 3 sao/resort tự vận hành đơn giản thường 0.4–0.8 (tham khảo, khác biệt theo phân khúc và mô hình dịch vụ) |

## 2. Công viên giải trí (Amusement Park)

| KPI | Công thức | Driver đứng sau chỉ số |
|---|---|---|
| **Attendance** (Lượt khách) | Tổng số vé/lượt vào cổng trong kỳ | Marketing, mùa vụ, thời tiết, sự kiện đặc biệt, sản phẩm mới (trò chơi mới ra mắt) |
| **Per-cap spending** (Chi tiêu bình quân/khách) | Tổng doanh thu công viên / Tổng lượt khách, tách theo: vé vào cổng (admission) + ăn uống (F&B) + bán lẻ (retail) + trò chơi trả thêm (games/rides) | Cấu trúc giá vé (combo vs vé lẻ), mật độ điểm bán F&B/retail trong khuôn viên, chính sách khuyến khích chi tiêu thêm (voucher, thẻ nạp) |
| **Capacity utilisation** (Tỷ lệ khai thác công suất) | Lượt khách thực tế / Công suất thiết kế tối đa trong cùng thời gian | Cân bằng giữa doanh thu và trải nghiệm khách (quá tải làm giảm chất lượng, giảm tỷ lệ quay lại) |
| **Ride throughput** (Công suất phục vụ trò chơi) | Số lượt khách phục vụ mỗi giờ / Công suất lý thuyết mỗi giờ của trò chơi | Thời gian vận hành mỗi chuyến, thời gian nạp/xả khách, số lượng nhân viên vận hành — nút thắt cổ chai (bottleneck) quyết định trải nghiệm chờ đợi toàn công viên |
| **Seasonality index** (Chỉ số mùa vụ) | Lượt khách bình quân tháng đó / Lượt khách bình quân 12 tháng | Giúp lập kế hoạch nhân sự thời vụ, khuyến mãi mùa thấp điểm, dòng tiền theo mùa |
| **Repeat-visit rate** (Tỷ lệ khách quay lại) | Số khách có từ 2 lượt ghé trở lên trong kỳ (12 tháng) / Tổng số khách duy nhất | Chất lượng trải nghiệm, chương trình thành viên/thẻ năm, sản phẩm mới định kỳ để tạo lý do quay lại |

## 3. Show diễn (Live Show)

| KPI | Công thức | Driver đứng sau chỉ số |
|---|---|---|
| **Seats sold %** (Tỷ lệ lấp đầy ghế) | Số vé bán được / Tổng số ghế của suất diễn | Sức hút nội dung show, thời điểm diễn (cuối tuần/lễ tết), giá vé, kênh bán |
| **Average ticket price (ATP)** | Tổng doanh thu vé / Số vé bán được | Cơ cấu hạng ghế (VIP/thường), chính sách giảm giá combo với vé công viên/khách sạn |
| **Yield per seat** | Tổng doanh thu vé / Tổng số ghế của suất diễn (kể cả ghế trống) | Kết hợp cả tỷ lệ lấp đầy và giá vé — chỉ số tổng hợp tương tự RevPAR của khách sạn |
| **Cost per show** | Tổng chi phí trực tiếp một suất diễn (diễn viên, kỹ thuật, hao mòn đạo cụ/sân khấu, điện) / Số suất diễn | Quy mô dàn dựng, số lượng diễn viên/ê-kíp, tần suất diễn (chi phí cố định phân bổ theo số suất) |
| **Break-even occupancy per show** | Chi phí cố định mỗi suất / (Giá vé bình quân × Tổng số ghế) | Điểm hòa vốn về tỷ lệ lấp đầy ghế cần đạt để show không lỗ — dưới mức này mỗi suất diễn đều lỗ |
| **Sponsor share** (Tỷ trọng tài trợ) | Doanh thu tài trợ/quảng cáo trong show / Tổng doanh thu show | Mức độ phụ thuộc vào nguồn thu ngoài vé — tỷ trọng cao giúp giảm rủi ro nếu bán vé kém, nhưng phụ thuộc quan hệ đối tác |

## 4. Ví dụ minh họa (số liệu giả định, KHÔNG phải số thực tế)

*Toàn bộ số liệu trong mục này là số minh họa cho mục đích hướng dẫn cách tính, không phải số liệu thực của bất kỳ dự án nào.*

**Khách sạn minh họa** — 150 phòng, tháng có 30 ngày (4,500 đêm phòng khả dụng):
- Đêm phòng bán được: 3,150 → Occupancy = 3,150 / 4,500 = **70%**
- Doanh thu phòng: 4.73 tỷ đồng → ADR = 4,730,000,000 / 3,150 ≈ **1,501,000 đồng/đêm**
- RevPAR = ADR × Occupancy ≈ 1,501,000 × 70% ≈ **1,051,000 đồng/đêm khả dụng**
- Doanh thu F&B từ khách lưu trú: 0.95 tỷ đồng → F&B capture = 0.95 / 4.73 ≈ **20%** doanh thu phòng
- Tổng doanh thu khách sạn (phòng + F&B + dịch vụ khác): 6.2 tỷ đồng → TRevPAR = 6,200,000,000 / 4,500 ≈ **1,378,000 đồng/đêm**

**Công viên giải trí minh họa** — tháng cao điểm:
- Lượt khách: 60,000; công suất thiết kế 90,000 lượt/tháng → Capacity utilisation = 60,000/90,000 = **67%**
- Doanh thu vé vào cổng: 9 tỷ; F&B: 3 tỷ; retail: 1.2 tỷ; trò chơi trả thêm: 1.8 tỷ → Tổng 15 tỷ
- Per-cap spending = 15,000,000,000 / 60,000 = **250,000 đồng/khách**, trong đó admission 150,000 / F&B 50,000 / retail 20,000 / games 30,000 đồng/khách
- So với tháng thấp điểm (30,000 lượt), trung bình 12 tháng là 45,000 lượt/tháng → Seasonality index tháng cao điểm = 60,000/45,000 = **1.33**

**Show diễn minh họa** — sân khấu 500 ghế, giá vé bình quân 450,000 đồng, chi phí cố định mỗi suất 90 triệu đồng:
- Suất diễn bán được 400 vé → Seats sold % = 400/500 = **80%**
- Yield per seat = (400 × 450,000) / 500 = **360,000 đồng/ghế**
- Break-even occupancy = 90,000,000 / (450,000 × 500) = 90,000,000 / 225,000,000 = **40%** → suất diễn 80% lấp đầy đang vận hành có lãi, cách xa điểm hòa vốn 40%

## 5. Nguyên tắc khi dùng các KPI này trong phân tích

- Luôn nêu rõ kỳ báo cáo (ngày/tháng/năm) và đơn vị tính khi trình bày bất kỳ KPI nào.
- Không suy diễn KPI vận hành (occupancy, attendance...) nếu nguồn dữ liệu chỉ có số liệu kế toán tổng hợp — cần dữ liệu vận hành riêng (hệ thống PMS khách sạn, hệ thống soát vé công viên/show). Nếu thiếu, ghi "thiếu dữ liệu vận hành, chỉ ước tính được từ doanh thu kế toán".
- Khi so sánh giữa các kỳ, luôn kiểm tra mẫu số có nhất quán không (ví dụ số phòng khả dụng thay đổi do cải tạo, số suất diễn thay đổi theo mùa).
