# Prompt cài đặt tự động cho Phương

Cách dùng: Cuong điền chỗ `{{OPENROUTER_API_KEY}}` bên dưới, gửi cả khối cho Phương. Phương mở
**Claude Code** trên máy của mình (macOS hoặc Windows — hiện tại là macOS) (hoặc Claude Desktop
có quyền chạy lệnh), dán nguyên khối này vào và bấm Enter. Claude sẽ tự nhận diện hệ điều hành,
cài mọi thứ, kiểm tra, rồi hướng dẫn Phương dùng. Không cần biết lập trình.

Yêu cầu trước khi dán: máy macOS hoặc Windows 11, có mạng, và đã cài Claude Code
(`npm install -g @anthropic-ai/claude-code` hoặc bản desktop).

---

```text
Bạn là người cài đặt môi trường cho tôi (Phương). Tôi không phải lập trình viên, hãy tự làm
mọi bước, chỉ hỏi tôi khi thật sự cần quyết định. Luôn trả lời bằng tiếng Việt.

MỤC TIÊU
Cài "pi coding agent" cùng bộ kỹ năng Kuha (nghiên cứu thị trường, báo cáo, phân tích tài
chính, tra cứu luật Việt Nam, biên bản họp từ ghi âm, xuất Word/PowerPoint/Excel/PDF) trên
máy này (macOS hoặc Windows — tự nhận diện ở bước 1), cấu hình sẵn API key, chạy thử, rồi
hướng dẫn tôi dùng.

THÔNG TIN BÍ MẬT (chỉ dùng để cấu hình, không in ra màn hình, không ghi vào file nào khác
ngoài chỗ được chỉ định)
- OPENROUTER_API_KEY: {{OPENROUTER_API_KEY}}

CÁC BƯỚC (làm tuần tự, sau mỗi bước kiểm tra rồi mới sang bước sau)

1. Xác định hệ điều hành trước, rồi làm đúng nhánh tương ứng cho mọi bước sau:
   - Chạy `uname` trong bash/zsh — nếu ra `Darwin` thì đây là **macOS**. Nếu lệnh đó không
     có (báo lỗi "not recognized"/"not found") và đang ở PowerShell, đây là **Windows**.
   - **macOS**: kiểm tra `git --version`, `node --version` (cần >= 20), `python3 --version`
     (cần >= 3.10), `ffmpeg -version`. Thiếu cái nào thì cài bằng Homebrew (cài Homebrew
     trước nếu chưa có: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`):
     brew install git node python@3.12 ffmpeg
     brew install --cask libreoffice
   - **Windows**: kiểm tra `git --version`, `node --version` (cần >= 20), `py -3.12 --version`,
     `ffmpeg -version`. Thiếu cái nào thì cài bằng winget:
     winget install --id Git.Git -e --source winget
     winget install --id OpenJS.NodeJS.LTS -e --source winget
     winget install --id Python.Python.3.12 -e --source winget
     winget install --id Gyan.FFmpeg -e --source winget
     winget install --id TheDocumentFoundation.LibreOffice -e --source winget
   Sau khi cài, mở shell mới (hoặc nạp lại PATH) rồi kiểm tra lại.

2. Cài pi: `npm install -g @earendil-works/pi-coding-agent`, kiểm tra `pi --version`. Giống
   nhau trên macOS và Windows.

3. Lấy bộ Kuha từ repo public (không cần đăng nhập GitHub):
   `pi install git:github.com/cuong21951/pi-agent-config`
   Kiểm tra: `pi list` phải liệt kê git:github.com/cuong21951/pi-agent-config và thư mục
   skills có 9 thư mục, ở:
   - macOS: ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/skills
   - Windows: %USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\skills

4. Hỏi tôi thư mục dự án Kuha nằm ở đâu (đoán mặc định là `~/KuHa` trên macOS
   hoặc `%USERPROFILE%\KuHa` trên Windows nếu thư mục đó đã tồn tại; nếu
   không, hỏi tôi đường dẫn thật). Đây là thư mục Phương sẽ mở `pi` để làm
   việc, mọi báo cáo/nghiên cứu/... sẽ lưu vào đây.

5. Chạy trình cài của Kuha, truyền thư mục dự án đã xác định ở bước 4:
   - macOS: `bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh "<thư mục dự án>"`
   - Windows: `pwsh -File "%USERPROFILE%\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1" -Dir "<thư mục dự án>"`
     (không có pwsh thì dùng powershell).
   Script cài gói Python, đăng ký package pi cần thiết, và tạo 7 thư mục con
   (bao-cao, nghien-cuu, phap-ly, tai-chinh, bien-ban, slide, recordings)
   trong thư mục dự án — chỉ khi thư mục đó chưa có thư mục con nào khác (để
   không xáo trộn cây thư mục có sẵn). Đọc kết quả, sửa lỗi nếu có.

6. Cấu hình API key cho pi. Ghi vào auth.json theo dạng
   {"openrouter": {"type": "api_key", "key": "<OPENROUTER_API_KEY>"}}
   (nếu pi phiên bản này dùng dạng khác, chạy `pi` rồi lệnh /login openrouter và dán key).
   Đặt model mặc định trong settings.json:
   "defaultProvider": "openrouter", "defaultModel": "z-ai/glm-5.3-flash",
   "defaultThinkingLevel": "medium", "tuiMode": "fullscreen".
   Đường dẫn hai file này: macOS ~/.pi/agent/auth.json và ~/.pi/agent/settings.json;
   Windows %USERPROFILE%\.pi\agent\auth.json và %USERPROFILE%\.pi\agent\settings.json.

7. Kiểm tra AGENTS.md của Kuha đã nằm ở đúng chỗ (install.sh/install.ps1 tạo nếu chưa có):
   macOS ~/.pi/agent/AGENTS.md; Windows %USERPROFILE%\.pi\agent\AGENTS.md. Nếu thiếu, copy
   từ thư mục kuha trong repo.

8. Chạy thử không tương tác, từ thư mục dự án đã xác định ở bước 4:
   pi -p --no-session "Trả lời đúng một từ: OK"
   Phải in ra OK. Nếu lỗi model/key, kiểm tra lại bước 6. (Lệnh này giống nhau trên macOS và
   Windows — không gọi Python trực tiếp.)
   Sau đó chạy thử một kỹ năng:
   pi -p --no-session "Dùng skill financial-analysis: chạy make_template.py rồi ratios.py trên
   file mẫu và cho tôi 3 dòng nhận xét"
   Phải ra được nhận xét có số liệu. Trợ lý sẽ tự dùng `python3` để chạy hai script đó trên
   macOS (`py -3.12` trên Windows) theo đúng mục "Ghi chú Windows / macOS (Kuha)" của skill
   financial-analysis — không cần bạn chỉ định.

9. Kiểm tra shortcut để bấm đúp là vào làm việc: bước 5 (install.sh/install.ps1) đã tự tạo
   sẵn — macOS: ~/Desktop/Kuha.command (cd vào thư mục dự án rồi chạy pi); Windows:
   %USERPROFILE%\Desktop\Kuha.cmd. Xác nhận file đó tồn tại và trỏ đúng thư mục dự án ở bước
   4; nếu thiếu (ví dụ do máy đã có sẵn shortcut khác tên "Kuha" và bị bỏ qua), tự tạo bù theo
   đúng nội dung install.sh/install.ps1 in ra. Trên macOS, nếu hệ thống cảnh báo "không xác
   định được nhà phát triển" khi bấm đúp lần đầu, vào System Settings > Privacy & Security,
   cuộn xuống và bấm "Open Anyway".

10. Hướng dẫn tôi. Sau khi mọi bước xong, viết cho tôi một hướng dẫn ngắn bằng tiếng Việt,
    dễ hiểu, gồm: cách mở (bấm đúp Kuha.command trên macOS hoặc Kuha.cmd trên Windows), 6 lệnh
    nhanh với ví dụ thật (/nghien-cuu, /bao-cao, /phan-tich-bctc, /tra-luat, /bien-ban-hop,
    /slide), file kết quả nằm ở đâu (thư mục dự án đã xác định ở bước 4, chia theo loại), cách
    gửi file Excel/ghi âm cho trợ lý (kéo file vào cửa sổ hoặc gõ đường dẫn), và 3 lỗi thường
    gặp với cách xử lý. Lưu hướng dẫn đó thành HUONG-DAN.md ngay trong thư mục dự án và đọc lại
    cho tôi.

QUY TẮC
- Không hiển thị giá trị key trong câu trả lời hay trong log.
- Không xoá file của tôi. Không cài gì ngoài danh sách trên trừ khi bắt buộc, và nói rõ.
- Mỗi bước: cho tôi biết đang làm gì bằng một câu ngắn, kết quả kiểm tra là gì.
- Nếu một bước thất bại 2 lần, dừng và hỏi tôi thay vì thử cách lạ.
```
