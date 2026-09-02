---
name: vietnam-law
description: Research Vietnamese law reliably for the Kuha project (hotel, amusement park, live-show complex) — locates the governing legal documents, verifies they are still in force, quotes the exact article/clause from a fetched primary source, and produces a plain-Vietnamese research memo with a mandatory not-legal-advice caveat.
---

# Tra cứu pháp luật Việt Nam cho dự án Kuha

Skill này giúp agent tra cứu pháp luật Việt Nam một cách đáng tin cậy cho người dùng không phải luật sư, đang vận hành dự án Kuha (khách sạn + công viên giải trí + biểu diễn nghệ thuật). Mục tiêu: **không bao giờ bịa quy định**, luôn trích dẫn từ văn bản đã thực sự fetch được, luôn kiểm tra hiệu lực, và luôn nhắc đây không phải tư vấn pháp lý chính thức.

## Ghi chú Windows / macOS (Kuha)

Trên Windows dùng `py -3.12`; trên macOS/Linux dùng `python3`. Các lệnh trong skill này viết theo dạng `python3 {baseDir}/scripts/<script>.py ...` — trên Windows (kể cả trong Git Bash, nơi `python3` có thể chưa cài), thay bằng `py -3.12 {baseDir}/scripts/<script>.py ...`.

## Tài liệu trong skill này

- `references/sources.md` — danh sách nguồn tra cứu chính thống, cách dùng từng nguồn, hệ thống thứ bậc văn bản, cách đọc "văn bản hợp nhất"/"sửa đổi bổ sung"/"hết hiệu lực một phần", định dạng trích dẫn bắt buộc. **Đọc file này trước khi tra cứu bất kỳ vấn đề nào.**
- `references/domain-map.md` — bản đồ các văn bản pháp luật chính cho ba mảng kinh doanh của Kuha (lưu trú du lịch, công viên giải trí, biểu diễn nghệ thuật) và các vấn đề chung (doanh nghiệp, đầu tư, đất đai, thuế, lao động, an toàn thực phẩm, quảng cáo, dữ liệu cá nhân, hoá đơn điện tử). Dùng làm điểm khởi đầu để biết cần tìm loại văn bản nào, nhưng **luôn kiểm tra lại hiệu lực** — file này có ngày kiểm tra cụ thể và nhiều mục đánh dấu "[cần xác minh]".
- `scripts/fetch_law.py` — công cụ fetch một trang văn bản pháp luật và trích xuất nội dung chính + thông tin hiệu lực thành markdown có header chuẩn.
- `templates/tra-cuu-phap-ly.md` — mẫu memo kết quả tra cứu, dùng cho **mọi** câu trả lời liên quan đến pháp luật gửi cho người dùng.

## Quy trình làm việc (workflow)

1. **Xác định vấn đề**: làm rõ câu hỏi thuộc mảng nào (lưu trú / công viên giải trí / biểu diễn / vấn đề chung như thuế, lao động, đất đai...), và có yếu tố địa phương cụ thể không (tỉnh/thành nơi đặt dự án).
2. **Tra `references/domain-map.md`** để biết văn bản nào có khả năng liên quan. Đây chỉ là gợi ý định hướng, không phải kết luận.
3. **Tìm văn bản gốc trên nguồn chính thống**: dùng công cụ tìm kiếm web (web search) để tìm đúng số hiệu văn bản trên vbpl.vn hoặc thuvienphapluat.vn trước, đối chiếu congbao.chinhphu.vn/luatvietnam.vn khi cần. Có thể dùng `python3 scripts/fetch_law.py --search "<từ khoá>"` (Windows: `py -3.12 scripts/fetch_law.py --search "<từ khoá>"`) để lấy nhanh các URL tìm kiếm, sau đó dùng công cụ fetch/browse của agent để mở kết quả (vbpl.vn và thuvienphapluat.vn thường chặn request tự động của script, xem phần "Giới hạn đã biết" bên dưới).
4. **Fetch toàn văn** bằng công cụ fetch_url của agent, hoặc thử `python3 scripts/fetch_law.py <url> --out <file>.md` (Windows: `py -3.12 scripts/fetch_law.py <url> --out <file>.md`). Đọc kỹ nội dung điều/khoản liên quan trực tiếp đến câu hỏi.
5. **Kiểm tra hiệu lực và văn bản thay thế** theo quy trình ở `references/sources.md` §5 — bắt buộc, không được bỏ qua bước này kể cả khi văn bản trông "hiển nhiên còn hiệu lực".
6. **Trích nguyên văn điều khoản** liên quan, theo đúng định dạng trích dẫn ở `references/sources.md` §4.
7. **Phân tích** cách quy định áp dụng vào tình huống cụ thể của Kuha, bằng tiếng Việt dễ hiểu cho người không có nền tảng luật.
8. **Viết memo theo `templates/tra-cuu-phap-ly.md`**, điền đầy đủ tất cả các mục kể cả khi một số mục phải ghi "không xác định được" hoặc "cần luật sư xác minh".

## Quy tắc bắt buộc (hard rules)

- **Không bao giờ trích dẫn một điều khoản mà agent chưa thực sự fetch được toàn văn.** Nếu chỉ tìm được bài tóm tắt/phân tích của thuvienphapluat.vn hay luatvietnam.vn mà chưa đọc được văn bản gốc, phải nói rõ đây là thông tin thứ cấp chưa đối chiếu, không trích dẫn như trích nguyên văn điều luật.
- **Luôn hiển thị tình trạng hiệu lực và ngày kiểm tra** trong mọi câu trả lời có liên quan đến quy định pháp luật, kể cả câu trả lời ngắn không dùng đầy đủ template.
- **Ưu tiên văn bản hợp nhất mới nhất** để nắm nội dung hiện hành, nhưng khi trích dẫn chính xác vẫn ghi rõ văn bản gốc và văn bản sửa đổi (nếu điều khoản đó đã bị sửa).
- **Nói "không tìm thấy" thay vì đoán.** Nếu tra cứu nhiều nguồn mà không tìm được văn bản/điều khoản trả lời trực tiếp câu hỏi, nói rõ điều đó và đề xuất hướng tra cứu tiếp theo (ví dụ: hỏi trực tiếp cơ quan quản lý, hoặc cần luật sư tra cứu chuyên sâu) — không tự suy diễn nội dung quy định.
- **Đây là thông tin, không phải tư vấn pháp lý.** Mọi memo đều phải có mục "Tuyên bố miễn trừ trách nhiệm" như trong template, và với các việc có tính chất nộp hồ sơ chính thức (xin giấy phép, đăng ký kinh doanh, khai thuế) hoặc tranh chấp, luôn khuyến nghị người dùng tham vấn luật sư/đơn vị tư vấn pháp lý trước khi hành động.

## Giới hạn đã biết (known limits)

- `vbpl.vn` và `thuvienphapluat.vn` thường trả về lỗi HTTP 403 khi `scripts/fetch_law.py` fetch trực tiếp (chặn request tự động). Khi gặp lỗi này, dùng công cụ fetch/browse riêng của agent (web fetch tool) để mở URL đó thay vì script.
- `luatvietnam.vn` (đặc biệt bản tiếng Anh) thường khoá toàn văn sau tường phí ("Please log in to your Advanced Package") — chỉ dùng cho bản tóm tắt/định hướng, không trích nguyên văn từ đây nếu bị khoá.
- `congbao.chinhphu.vn` thường hiển thị đúng ngày ban hành/hiệu lực và thông tin văn bản trong trang, nhưng toàn văn điều khoản chi tiết đôi khi chỉ có trong file .pdf/.doc đính kèm, không nằm trong HTML của trang — cần mở file tải về riêng khi nội dung trích xuất được chủ yếu là menu điều hướng.
- Giai đoạn 2024-2026 có làn sóng sửa đổi luật lớn và sáp nhập bộ máy hành chính (đổi tên bộ, đổi URL cổng thông tin) — nếu một URL trong `domain-map.md` không còn hoạt động, tìm tên cơ quan hiện hành thay vì kết luận "không có quy định".
