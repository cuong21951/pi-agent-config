# Prompt cài đặt tự động cho Phương

Cách dùng: Cuong điền hai chỗ `{{...}}` bên dưới, gửi cả khối cho Phương. Phương mở
**Claude Code** trên máy Windows (hoặc Claude Desktop có quyền chạy lệnh), dán nguyên
khối này vào và bấm Enter. Claude sẽ tự cài mọi thứ, kiểm tra, rồi hướng dẫn Phương
dùng. Không cần biết lập trình.

Yêu cầu trước khi dán: máy Windows 11, có mạng, và đã cài Claude Code
(`npm install -g @anthropic-ai/claude-code` hoặc bản desktop).

---

```text
Bạn là người cài đặt môi trường cho tôi (Phương). Tôi không phải lập trình viên, hãy tự làm
mọi bước, chỉ hỏi tôi khi thật sự cần quyết định. Luôn trả lời bằng tiếng Việt.

MỤC TIÊU
Cài "pi coding agent" cùng bộ kỹ năng Kuha (nghiên cứu thị trường, báo cáo, phân tích tài
chính, tra cứu luật Việt Nam, biên bản họp từ ghi âm, xuất Word/PowerPoint/Excel/PDF) trên
máy Windows này, cấu hình sẵn API key, chạy thử, rồi hướng dẫn tôi dùng.

THÔNG TIN BÍ MẬT (chỉ dùng để cấu hình, không in ra màn hình, không ghi vào file nào khác
ngoài chỗ được chỉ định)
- OPENROUTER_API_KEY: {{OPENROUTER_API_KEY}}
- GITHUB_TOKEN (quyền đọc repo riêng cuong21951/pi-agent-config): {{GITHUB_TOKEN}}

CÁC BƯỚC (làm tuần tự, sau mỗi bước kiểm tra rồi mới sang bước sau)

1. Công cụ nền. Kiểm tra bằng `git --version`, `node --version` (cần >= 20),
   `py -3.12 --version`, `ffmpeg -version`. Thiếu cái nào thì cài bằng winget:
   winget install --id Git.Git -e --source winget
   winget install --id OpenJS.NodeJS.LTS -e --source winget
   winget install --id Python.Python.3.12 -e --source winget
   winget install --id Gyan.FFmpeg -e --source winget
   winget install --id TheDocumentFoundation.LibreOffice -e --source winget
   Sau khi cài, mở shell mới (hoặc nạp lại PATH) rồi kiểm tra lại.

2. Cài pi: `npm install -g @earendil-works/pi-coding-agent`, kiểm tra `pi --version`.

3. Lấy bộ Kuha từ repo riêng. Dùng token để git truy cập mà không lộ token trong lịch sử
   lệnh: thiết lập biến môi trường tạm `GIT_ASKPASS` hoặc dùng
   `git config --global credential.helper manager` rồi đăng nhập bằng token khi git hỏi.
   Sau đó chạy: `pi install git:github.com/cuong21951/pi-agent-config`
   Kiểm tra: `pi list` phải liệt kê git:github.com/cuong21951/pi-agent-config và thư mục
   %USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\skills có 9 thư mục.

4. Chạy trình cài của Kuha:
   pwsh -File "%USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1"
   (không có pwsh thì dùng powershell). Script cài gói Python, đăng ký package pi cần thiết,
   tạo thư mục %USERPROFILE%\Documents\Kuha. Đọc kết quả, sửa lỗi nếu có.

5. Cấu hình API key cho pi. Ghi vào %USERPROFILE%\.pi\agent\auth.json theo dạng
   {"openrouter": {"type": "api_key", "key": "<OPENROUTER_API_KEY>"}}
   (nếu pi phiên bản này dùng dạng khác, chạy `pi` rồi lệnh /login openrouter và dán key).
   Đặt model mặc định trong %USERPROFILE%\.pi\agent\settings.json:
   "defaultProvider": "openrouter", "defaultModel": "z-ai/glm-5.3-flash",
   "defaultThinkingLevel": "medium", "tuiMode": "fullscreen".

6. Kiểm tra AGENTS.md của Kuha đã nằm ở %USERPROFILE%\.pi\agent\AGENTS.md (install.ps1
   tạo nếu chưa có). Nếu thiếu, copy từ thư mục kuha trong repo.

7. Chạy thử không tương tác, từ thư mục %USERPROFILE%\Documents\Kuha:
   pi -p --no-session "Trả lời đúng một từ: OK"
   Phải in ra OK. Nếu lỗi model/key, kiểm tra lại bước 5.
   Sau đó chạy thử một kỹ năng:
   pi -p --no-session "Dùng skill financial-analysis: chạy make_template.py rồi ratios.py trên
   file mẫu và cho tôi 3 dòng nhận xét"
   Phải ra được nhận xét có số liệu.

8. Tạo shortcut: file %USERPROFILE%\Desktop\Kuha.cmd với nội dung
   @echo off
   cd /d %USERPROFILE%\Documents\Kuha
   pi
   để tôi bấm đúp là vào làm việc.

9. Hướng dẫn tôi. Sau khi mọi bước xong, viết cho tôi một hướng dẫn ngắn bằng tiếng Việt,
   dễ hiểu, gồm: cách mở (bấm đúp Kuha.cmd), 6 lệnh nhanh với ví dụ thật
   (/nghien-cuu, /bao-cao, /phan-tich-bctc, /tra-luat, /bien-ban-hop, /slide), file kết quả
   nằm ở đâu, cách gửi file Excel/ghi âm cho trợ lý (kéo file vào cửa sổ hoặc gõ đường dẫn),
   và 3 lỗi thường gặp với cách xử lý. Lưu hướng dẫn đó thành
   %USERPROFILE%\Documents\Kuha\HUONG-DAN.md và đọc lại cho tôi.

QUY TẮC
- Không hiển thị giá trị key/token trong câu trả lời hay trong log.
- Không xoá file của tôi. Không cài gì ngoài danh sách trên trừ khi bắt buộc, và nói rõ.
- Mỗi bước: cho tôi biết đang làm gì bằng một câu ngắn, kết quả kiểm tra là gì.
- Nếu một bước thất bại 2 lần, dừng và hỏi tôi thay vì thử cách lạ.
```
