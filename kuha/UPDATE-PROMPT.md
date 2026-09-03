# Prompt cập nhật cho Phương

Mở pi trong thư mục dự án Kuha, dán khối dưới đây vào, Enter. Không cần điền gì.

```text
Cập nhật trợ lý pi và bộ Kuha trên máy này lên bản mới nhất. Tự làm hết các bước,
trả lời tiếng Việt, không hỏi lại trừ khi một bước lỗi thật sự.

1. Chạy: pi update --extensions
   (kéo bản mới của gói github.com/cuong21951/pi-agent-config — toàn bộ skill,
   extension và giao diện của Kuha).
2. Chạy lại installer với thư mục dự án hiện tại (thư mục đang mở pi):
   - macOS / Linux:
     bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh "<thư mục hiện tại>"
   - Windows (PowerShell):
     pwsh -File "$env:USERPROFILE\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1" -Dir "<thư mục hiện tại>"
   Nếu installer báo thiếu công cụ (git, node, python3, ffmpeg) thì cài theo gợi ý
   của nó (macOS dùng brew) rồi chạy lại.
3. Kiểm tra khóa model rẻ trong ~/.pi/agent/settings.json (bắt buộc — từng có
   request nhầm sang model đắt):
   - "defaultProvider" là "openrouter", "defaultModel" là "z-ai/glm-5.3-flash"
   - Không có giá trị model nào chứa "fable", "opus", "sonnet", "gpt-5"
   - Thư mục ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/extensions/cheap-models tồn tại
   - "packages" KHÔNG còn "npm:pi-powerline-footer" và không còn key "powerline"
     (gói này đè footer và ô nhập kiểu Claude; installer bước 2 tự gỡ)
   Sai thì sửa settings.json đúng như trên; vẫn sai sau khi sửa thì dừng và báo tôi.
4. Kiểm tra bản mới đã về trọn vẹn: file package.json trong thư mục
   pi-agent-config phải liệt kê "./extensions/claude-footer" và
   "./extensions/api-balance". Thiếu thì chạy lại bước 1 rồi kiểm tra lại;
   vẫn thiếu thì báo tôi.
5. Đọc file CHANGELOG.md trong thư mục kuha/ của pack và tóm tắt trong tối đa
   3 dòng tiếng Việt những gì mới kể từ bản trước.
6. Cuối cùng nhắc tôi: thoát pi (Ctrl+C hai lần) rồi mở lại trong thư mục dự án
   để nhận bản mới. Sau khi mở lại, ô nhập phải là khung bo tròn ╭─╮ với dấu ">",
   footer dưới cùng là MỘT dòng mờ "model · think … · ctx … · openrouter $..."
   (số dư xanh/vàng/đỏ theo mức tiền), và thao tác của trợ lý phải
   hiện dạng Claude: "● Read(tên file)" rồi "⎿ Read N lines".
```

Chạy tay (macOS), ngoài pi:

```bash
pi update --extensions && bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh ~/KuHa
```

Sau khi cập nhật và mở lại pi: footer có số dư key OpenRouter/DeepSeek (xanh trên
$5, vàng dưới $5, đỏ dưới $1); lỡ chọn model đắt trong `/model`, extension
cheap-models tự đổi về model rẻ và báo dòng "cheap-models: blocked ...".
