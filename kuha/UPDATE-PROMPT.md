# Prompt cập nhật cho Phương (kèm khóa model rẻ)

Dán vào Claude Code trên máy Phương, Enter. Không cần điền gì.

```text
Cập nhật trợ lý pi và bộ Kuha trên máy này lên bản mới nhất, tự làm hết, trả lời tiếng Việt,
không hỏi trừ khi bắt buộc.

1. Chạy `pi update` (cập nhật pi và mọi package, trong đó có gói cuong21951/pi-agent-config).
2. Tìm thư mục dự án Kuha: đọc file shortcut trên Desktop (~/Desktop/Kuha.command trên macOS,
   %USERPROFILE%\Desktop\Kuha.cmd trên Windows) để lấy đường dẫn; nếu chưa có, dùng ~/KuHa nếu
   tồn tại, không thì hỏi tôi.
3. Chạy lại script cài với thư mục đó:
   macOS:   bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh "<thư mục>"
   Windows: pwsh -File "%USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1" -Dir "<thư mục>"
4. Kiểm tra khóa model rẻ (bắt buộc, vì đã từng có request nhầm sang model đắt):
   a. Mở ~/.pi/agent/settings.json, xác nhận có
      "defaultProvider": "openrouter", "defaultModel": "z-ai/glm-5.3-flash" và
      "enabledModels" chỉ gồm "openrouter/z-ai/glm-5.3-flash" và "openrouter/deepseek/deepseek-v4-flash*".
      Thiếu hoặc khác thì sửa đúng như vậy.
   b. Xác nhận thư mục ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/extensions/cheap-models
      tồn tại (extension tự đổi về model rẻ nếu chọn nhầm).
   c. Xóa mọi giá trị model đắt nếu thấy trong settings.json (chứa "fable", "opus", "sonnet", "gpt-5").
5. Chạy thử từ trong thư mục dự án:
   pi -p --no-session "Trả lời đúng một từ: OK"
   Phải in OK. Sau đó mở file .jsonl mới nhất trong ~/.pi/agent/sessions/ và xác nhận trường
   "model" của tin nhắn trợ lý là "z-ai/glm-5.3-flash" với "provider": "openrouter".
   Nếu là model khác, dừng lại và báo tôi ngay.
6. Đọc https://github.com/cuong21951/pi-agent-config/blob/main/kuha/CHANGELOG.md và tóm tắt cho
   tôi có gì mới trong 3 dòng.
```

Chạy tay (macOS):

```bash
pi update && bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh ~/KuHa
```

Sau khi cập nhật, trong pi gõ `/model`: danh sách xoay vòng Ctrl+P chỉ còn GLM 5.3 Flash và DeepSeek
V4 Flash; lỡ chọn model khác, pi tự đổi lại và báo dòng "cheap-models: blocked ...".
