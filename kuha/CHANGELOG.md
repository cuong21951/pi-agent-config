# Có gì mới (cho Phương)

## 2026-09-04 (tự cập nhật pack)
- Giờ có thể bảo trợ lý "cập nhật pack" trực tiếp trong pi: trợ lý sẽ tự chạy
  update, cài lại và kiểm tra model rẻ, không cần dán prompt nào cả. Khi pi
  hiện banner vàng "Package Updates Available" chỉ cần nói vậy.

## 2026-09-03 (giao diện giống Claude Code)
- Mỗi thao tác của trợ lý hiện rõ ràng như Claude Code: `● Read(tên file)` rồi `⎿ Read 42 lines`,
  `● Search(pattern: "...")` rồi `⎿ Found 5 lines`, `● Update(tên file)` kèm phần diff đổi gì,
  `● Write(tên file)` rồi `⎿ Wrote 10 lines`. Bấm Ctrl+O để mở xem chi tiết một dòng.
- Câu trả lời của trợ lý bắt đầu bằng dấu `●`, dòng "Thinking..." đổi thành `✻ Thinking…`.
- Dòng loading mới: ngôi sao xoay `· ✢ ✶ ✻ ✽` màu cam, chữ động từ sáng chạy như Claude, kèm thời
  gian, số token và nhắc `esc to interrupt`.

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

## 2026-09-03 (an toàn chi phí)
- Extension `cheap-models`: chỉ cho phép model rẻ (GLM 5.3 Flash, DeepSeek V4 Flash). Chọn nhầm model đắt trong `/model` hoặc do cấu hình thiếu, pi tự đổi về model rẻ trước khi gửi request và báo trên màn hình.
- Nguyên nhân sự cố: khi chưa đặt model mặc định, pi tự lấy model đầu tiên trong danh sách OpenRouter, mà model đó là Claude Fable (rất đắt). Installer giờ luôn đặt model mặc định và giới hạn danh sách model.
