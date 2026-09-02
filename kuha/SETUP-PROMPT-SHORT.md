# Prompt ngắn cho Phương

Điền key vào chỗ `{{...}}`, gửi cho Phương. Phương mở Claude Code (hoặc Claude Desktop có
quyền chạy lệnh) trên máy của mình, dán vào, Enter. Claude tự đọc hướng dẫn đầy đủ trên
GitHub và làm hết.

```text
Cài giúp tôi trợ lý "pi" và bộ kỹ năng Kuha trên máy này (tôi không biết lập trình, hãy tự làm
mọi bước, hỏi tôi khi cần quyết định, trả lời bằng tiếng Việt).

Hướng dẫn đầy đủ: https://github.com/cuong21951/pi-agent-config/blob/main/kuha/README.md
(làm theo mục cài đặt đúng hệ điều hành của máy này, rồi chạy install.sh hoặc install.ps1).

Khóa API OpenRouter của tôi: {{OPENROUTER_API_KEY}} — ghi vào ~/.pi/agent/auth.json dạng
{"openrouter": {"type": "api_key", "key": "..."}} và đặt model mặc định z-ai/glm-5.3-flash.
Không in khóa ra màn hình.

Xong thì chạy thử `pi -p --no-session "Trả lời đúng một từ: OK"`, tạo shortcut mở pi trong
~/Documents/Kuha, và viết cho tôi file ~/Documents/Kuha/HUONG-DAN.md ngắn gọn: cách mở, 6 lệnh
/nghien-cuu /bao-cao /phan-tich-bctc /tra-luat /bien-ban-hop /slide với ví dụ, file lưu ở đâu.
```
