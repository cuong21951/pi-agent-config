# Prompt cập nhật cho Phương

Dán vào Claude Code (hoặc chạy tay hai lệnh ở cuối), Enter.

```text
Cập nhật trợ lý pi và bộ Kuha trên máy này lên bản mới nhất, tự làm hết, trả lời tiếng Việt:
1. Chạy `pi update` (cập nhật pi và mọi package, trong đó có gói cuong21951/pi-agent-config).
2. Chạy lại script cài của Kuha để nhận cấu hình mới:
   macOS: bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh
   Windows: pwsh -File "%USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1"
3. Chạy thử `pi -p --no-session "Trả lời đúng một từ: OK"`, phải ra OK.
4. Đọc https://github.com/cuong21951/pi-agent-config/blob/main/kuha/CHANGELOG.md và tóm tắt cho tôi có gì mới trong 3 dòng.
```

Chạy tay (macOS):

```bash
pi update && bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh
```
