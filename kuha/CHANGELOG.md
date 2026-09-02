# Có gì mới (cho Phương)

## 2026-09-03
- File kết quả (báo cáo, nghiên cứu, biên bản...) giờ lưu theo **thư mục dự án** — thư mục nơi
  mở `pi` — thay vì đường dẫn cố định `Documents/Kuha` như trước.
- Trình cài (install.sh/install.ps1) tự nhận diện hoặc nhận tham số thư mục dự án, chỉ tạo các
  thư mục con (bao-cao, nghien-cuu, ...) khi thư mục đó còn trống, không xáo trộn cây thư mục
  có sẵn.
- Shortcut "Kuha" trên Desktop (macOS: Kuha.command; Windows: Kuha.cmd) giờ được trình cài tự
  tạo ngay tại thư mục dự án đã chọn.

## 2026-09-02
- Header mới: mèo cam nháy mắt, vẫy đuôi, không còn khung "Press any key to continue".
- Khối "Thinking" được ẩn mặc định (bấm Ctrl+T để xem lại).
- Dòng loading kiểu Claude: động từ + thời gian + số token, spinner không nháy.
- Hỗ trợ macOS đầy đủ: install.sh, ghi âm bằng record.sh, lệnh `python3`.
- Prompt cài đặt ngắn (SETUP-PROMPT-SHORT.md) và prompt cập nhật (UPDATE-PROMPT.md).
