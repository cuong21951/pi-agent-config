# Kuha – Bộ kỹ năng tạo tài liệu (PowerPoint, Word, Excel, PDF)

Bốn skill trong thư mục này (`pptx/`, `docx/`, `xlsx/`, `pdf/`) lấy nguyên gốc từ Anthropic
(`github.com/anthropics/skills`), có thêm mục **"Windows notes (Kuha)"** ở đầu mỗi `SKILL.md`
ghi rõ lệnh nào chạy được thẳng trên máy Windows này, lệnh nào cần cài thêm, và cách thay thế.

## Bốn skill làm gì

- **pptx** — Tạo, đọc, sửa bài thuyết trình PowerPoint (`.pptx`, `.potx`): slide, bảng, biểu đồ, ghi chú diễn giả.
- **docx** — Tạo, đọc, sửa văn bản Word (`.docx`, `.dotx`): báo cáo, biên bản họp, hợp đồng, theo dõi thay đổi.
- **xlsx** — Tạo, đọc, sửa bảng tính Excel (`.xlsx`): công thức, định dạng, báo cáo tài chính.
- **pdf** — Đọc, gộp, tách, đóng dấu, tạo mới file PDF; điền form PDF.

## Cài đặt trên Windows (một dòng)

```
py -3.12 -m pip install python-pptx python-docx openpyxl reportlab pypdf pdfplumber
```

Không cần ffmpeg. LibreOffice là tùy chọn (đã có sẵn trên máy này tại
`C:\Program Files\LibreOffice\program\soffice.exe`; nếu máy khác chưa có thì cài bằng
`winget install TheDocumentFoundation.LibreOffice`) — chỉ cần khi xuất PDF xem trước hoặc tính
lại công thức Excel qua dòng lệnh.

Luôn đặt font chữ **Arial**, **Calibri**, hoặc **Times New Roman** cho mọi chữ tiếng Việt —
ba font này có sẵn trên Windows và hiển thị đúng dấu tiếng Việt.

## Ví dụ câu lệnh cho từng skill

- **pptx**: "Tạo bài thuyết trình 5 slide bằng tiếng Việt về kế hoạch khai trương công viên giải trí Quý 4."
- **docx**: "Viết biên bản họp Ban Giám đốc hôm nay, có mục tiêu và các đầu việc cần làm."
- **xlsx**: "Tạo bảng lãi lỗ Quý 3 cho khách sạn, có công thức tính tổng lợi nhuận."
- **pdf**: "Gộp 3 file PDF hợp đồng thuê mặt bằng thành một file, giữ nguyên thứ tự."
