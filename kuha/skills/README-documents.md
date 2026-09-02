# Kuha – Bộ kỹ năng tạo tài liệu (PowerPoint, Word, Excel, PDF)

Bốn skill trong thư mục này (`pptx/`, `docx/`, `xlsx/`, `pdf/`) lấy nguyên gốc từ Anthropic
(`github.com/anthropics/skills`), có thêm mục **"Ghi chú Windows / macOS (Kuha)"** ở đầu mỗi
`SKILL.md` ghi rõ lệnh nào chạy được thẳng, lệnh nào cần cài thêm, và cách thay thế trên từng hệ
điều hành.

## Bốn skill làm gì

- **pptx** — Tạo, đọc, sửa bài thuyết trình PowerPoint (`.pptx`, `.potx`): slide, bảng, biểu đồ, ghi chú diễn giả.
- **docx** — Tạo, đọc, sửa văn bản Word (`.docx`, `.dotx`): báo cáo, biên bản họp, hợp đồng, theo dõi thay đổi.
- **xlsx** — Tạo, đọc, sửa bảng tính Excel (`.xlsx`): công thức, định dạng, báo cáo tài chính.
- **pdf** — Đọc, gộp, tách, đóng dấu, tạo mới file PDF; điền form PDF.

## Cài đặt (một dòng)

Trên Windows dùng `py -3.12`; trên macOS/Linux dùng `python3`:

```
python3 -m pip install python-pptx python-docx openpyxl reportlab pypdf pdfplumber
# Windows: py -3.12 -m pip install python-pptx python-docx openpyxl reportlab pypdf pdfplumber
```

Không cần ffmpeg. LibreOffice là tùy chọn — chỉ cần khi xuất PDF xem trước hoặc tính lại công
thức Excel qua dòng lệnh. Trên Windows đã có sẵn tại
`C:\Program Files\LibreOffice\program\soffice.exe` (nếu máy khác chưa có thì cài bằng
`winget install TheDocumentFoundation.LibreOffice`); trên macOS cài bằng
`brew install --cask libreoffice` (mặc định ở `/Applications/LibreOffice.app/Contents/MacOS/soffice`).

Luôn đặt font chữ **Arial**, **Calibri**, hoặc **Times New Roman** cho mọi chữ tiếng Việt — ba
font này có sẵn trên Windows và hiển thị đúng dấu tiếng Việt; trên macOS các tên font này cũng
sẵn có (qua Office hoặc `/Library/Fonts`, `/System/Library/Fonts/Supplemental`).

## Ví dụ câu lệnh cho từng skill

- **pptx**: "Tạo bài thuyết trình 5 slide bằng tiếng Việt về kế hoạch khai trương công viên giải trí Quý 4."
- **docx**: "Viết biên bản họp Ban Giám đốc hôm nay, có mục tiêu và các đầu việc cần làm."
- **xlsx**: "Tạo bảng lãi lỗ Quý 3 cho khách sạn, có công thức tính tổng lợi nhuận."
- **pdf**: "Gộp 3 file PDF hợp đồng thuê mặt bằng thành một file, giữ nguyên thứ tự."
