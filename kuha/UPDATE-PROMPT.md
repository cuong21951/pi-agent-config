# Prompt cập nhật cho Phương

Dán vào Claude Code (hoặc chạy tay hai lệnh ở cuối), Enter.

```text
Cập nhật trợ lý pi và bộ Kuha trên máy này lên bản mới nhất, tự làm hết, trả lời tiếng Việt:
1. Chạy `pi update` (cập nhật pi và mọi package, trong đó có gói cuong21951/pi-agent-config).
2. Tìm thư mục dự án Kuha hiện tại: đọc nội dung shortcut trên Desktop (macOS
   ~/Desktop/Kuha.command, dòng `cd "<thư mục>"`; Windows %USERPROFILE%\Desktop\Kuha.cmd, dòng
   `cd /d "<thư mục>"`) — đó là thư mục dự án đã dùng lần cài trước. Nếu không tìm thấy
   shortcut, hỏi tôi thư mục dự án nằm ở đâu.
3. Chạy lại script cài của Kuha, truyền đúng thư mục dự án tìm được ở bước 2, để nhận cấu hình
   mới:
   macOS: bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh "<thư mục dự án>"
   Windows: pwsh -File "%USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1" -Dir "<thư mục dự án>"
4. Chạy thử `pi -p --no-session "Trả lời đúng một từ: OK"`, phải ra OK.
5. Đọc https://github.com/cuong21951/pi-agent-config/blob/main/kuha/CHANGELOG.md và tóm tắt cho tôi có gì mới trong 3 dòng.
```

Chạy tay (macOS, thay `<thư mục dự án>` bằng đường dẫn thật):

```bash
pi update && bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh "<thư mục dự án>"
```
