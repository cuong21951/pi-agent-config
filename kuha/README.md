# Kuha — Trợ lý pi cho dự án Kuha

> **Gửi Phương**
>
> Bộ trợ lý này anh làm riêng cho em. Anh yêu em, kể cả những lúc em ngốc nghếch một cách rất
> đáng yêu. Anh bỏ thời gian gom đủ kỹ năng vào đây để em tự đọc được báo cáo tài chính, tra
> được luật, ghi được biên bản họp và làm được slide mà không phải chờ chồng. Mục tiêu của anh:
> em thành **corgi tài chính** của dự án Kuha, chân ngắn nhưng chạy số rất nhanh. Không hiểu gì
> thì hỏi trợ lý trước, hỏi anh sau. Anh yêu em.

Đây là gói kỹ năng (skills) và câu lệnh nhanh (prompts) cho **pi coding agent**
(https://pi.dev), giúp Phương làm nghiên cứu thị trường, viết báo cáo, phân
tích tài chính, tra cứu pháp luật, ghi biên bản họp và làm slide cho dự án
Kuha — không cần biết lập trình.

## Cài đặt
> Muốn để Claude tự cài toàn bộ thay vì làm tay: dùng prompt ngắn trong `SETUP-PROMPT-SHORT.md` (Claude tự đọc README này), hoặc bản chi tiết từng bước trong `SETUP-PROMPT.md`. Cuong điền key trước khi gửi.

Máy của Phương là **macOS** — làm theo track "macOS" bên dưới. Track "Windows 11" giữ lại cho
máy nào chạy Windows.

### macOS (làm theo thứ tự)

Dùng **Terminal** hoặc **iTerm2** — cả hai đều dùng được, không có vấn đề font/dấu tiếng Việt
như PowerShell cũ trên Windows.

#### 1. Cài công cụ nền (mở Terminal, chạy từng lệnh)

Cần [Homebrew](https://brew.sh) trước (bỏ qua nếu đã có):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Sau đó cài công cụ nền:

```bash
brew install git node python@3.12 ffmpeg
brew install --cask libreoffice   # tuỳ chọn
```

Sau khi cài xong, **đóng và mở lại Terminal** để nhận PATH mới (trên Apple Silicon, nếu `brew`
chưa nhận được, chạy thêm `eval "$(/opt/homebrew/bin/brew shellenv)"`).

#### 2. Cài pi coding agent

```bash
npm install -g @earendil-works/pi-coding-agent
```

#### 3. Lấy API key

Khuyến nghị dùng OpenRouter:

1. Đăng ký tài khoản tại https://openrouter.ai
2. Tạo API key trong phần Keys.
3. Đăng nhập trong pi bằng lệnh `/login` sau khi chạy `pi`, **hoặc** đặt biến
   môi trường trước khi chạy pi:
   ```bash
   export OPENROUTER_API_KEY="sk-or-..."
   ```

4. Chọn model: trong pi gõ `/model`, chọn `z-ai/glm-5.3-flash` (rẻ, đủ dùng
   hằng ngày) hoặc `anthropic/claude-sonnet-5` (chất lượng cao hơn, đắt hơn),
   rồi bấm Ctrl+S để lưu làm mặc định.

#### 4. Lấy bộ kỹ năng Kuha

**Cách khuyến nghị** — cài trực tiếp từ repo public `cuong21951/pi-agent-config`:

```bash
pi install git:github.com/cuong21951/pi-agent-config
```

**Cách dự phòng (không cần quyền GitHub)** — nếu Cuong gửi bạn file zip:

1. Giải nén, tìm thư mục `kuha/`.
2. Copy toàn bộ thư mục đó vào `~/.pi/agent/kuha/`.
3. Chạy bước 5 bên dưới để đăng ký kỹ năng vào pi.

#### 5. Chạy install.sh

Nếu cài bằng `pi install git:...` (cách khuyến nghị), script nằm trong thư mục
package của pi:

```bash
bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh
```

Nếu dùng cách zip:

```bash
bash ~/.pi/agent/kuha/install.sh
```

Script sẽ tự kiểm tra công cụ còn thiếu (in lệnh `brew install` cần chạy nếu thiếu), cài các gói
Python cần dùng (đọc/ghi Word, Excel, PowerPoint, PDF, chuyển ghi âm thành văn bản...), đăng ký
các kỹ năng Kuha vào pi, và tạo sẵn thư mục lưu kết quả trong thư mục dự án. Chạy lại bao nhiêu
lần cũng an toàn (không tạo trùng lặp).

Thư mục dự án: mặc định script tự tìm (theo thứ tự) `~/KuHa`, `~/Kuha`, `~/kuha`. Nếu chưa có
thư mục nào, truyền đường dẫn: `bash install.sh ~/KuHa` — nếu không truyền và không tìm thấy,
script sẽ không tạo gì cả, chỉ nhắc mở `pi` ngay trong thư mục dự án lần sau.

#### 6. Chạy thử

```bash
pi
```

Trong pi, thử các lệnh sau (thay phần trong ngoặc bằng nội dung thật):

- `/nghien-cuu công suất phòng khách sạn 4-5 sao khu vực [địa phương] quý này`
- `/bao-cao báo cáo tháng 9/2026`
- `/phan-tich-bctc ~/đường-dẫn/bao-cao-tai-chinh.xlsx`
- `/tra-luat quy định cấp phép kinh doanh công viên giải trí`
- `/bien-ban-hop ~/đường-dẫn/ghi-am-cuoc-hop.mp3`
- `/slide kế hoạch mở rộng công viên năm 2027`

Lần đầu dùng `/bien-ban-hop` để ghi âm trực tiếp (skill `meeting-minutes`, script `record.sh`),
macOS sẽ hỏi quyền truy cập microphone cho Terminal/iTerm2 — cấp quyền trong System Settings >
Privacy & Security > Microphone rồi thử lại.

### Windows 11 (làm theo thứ tự)

#### 1. Cài công cụ nền (mở PowerShell, chạy từng lệnh)

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id Python.Python.3.12 -e --source winget
winget install --id Gyan.FFmpeg -e --source winget
winget install --id TheDocumentFoundation.LibreOffice -e --source winget   # tuỳ chọn
```

Sau khi cài xong, **đóng và mở lại PowerShell** để nhận PATH mới.

#### 2. Cài pi coding agent

```powershell
npm install -g @earendil-works/pi-coding-agent
```

#### 3. Lấy API key

Khuyến nghị dùng OpenRouter:

1. Đăng ký tài khoản tại https://openrouter.ai
2. Tạo API key trong phần Keys.
3. Đăng nhập trong pi bằng lệnh `/login` sau khi chạy `pi`, **hoặc** đặt biến
   môi trường trước khi chạy pi:
   ```powershell
   $env:OPENROUTER_API_KEY = "sk-or-..."
   ```

4. Chọn model: trong pi gõ `/model`, chọn `z-ai/glm-5.3-flash` (rẻ, đủ dùng
   hằng ngày) hoặc `anthropic/claude-sonnet-5` (chất lượng cao hơn, đắt hơn),
   rồi bấm Ctrl+S để lưu làm mặc định.

#### 4. Lấy bộ kỹ năng Kuha

**Cách khuyến nghị** — cài trực tiếp từ repo public `cuong21951/pi-agent-config`:

```powershell
pi install git:github.com/cuong21951/pi-agent-config
```

**Cách dự phòng (không cần quyền GitHub)** — nếu Cuong gửi bạn file zip:

1. Giải nén, tìm thư mục `kuha/`.
2. Copy toàn bộ thư mục đó vào `%USERPROFILE%\.pi\agent\kuha\`.
3. Chạy bước 5 bên dưới để đăng ký kỹ năng vào pi.

#### 5. Chạy install.ps1

Nếu cài bằng `pi install git:...` (cách khuyến nghị), script nằm trong thư mục
package của pi:

```powershell
& "$env:USERPROFILE\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1"
```

Nếu dùng cách zip:

```powershell
& "$env:USERPROFILE\.pi\agent\kuha\install.ps1"
```

Script sẽ tự kiểm tra công cụ còn thiếu, cài các gói Python cần dùng (đọc/ghi
Word, Excel, PowerPoint, PDF, chuyển ghi âm thành văn bản...), đăng ký các kỹ
năng Kuha vào pi, và tạo sẵn thư mục lưu kết quả trong thư mục dự án. Chạy lại
bao nhiêu lần cũng an toàn (không tạo trùng lặp).

Thư mục dự án: mặc định script tự tìm (theo thứ tự) `%USERPROFILE%\KuHa`,
`%USERPROFILE%\Kuha`, `%USERPROFILE%\kuha`, `%USERPROFILE%\Documents\Kuha`.
Nếu chưa có thư mục nào, truyền đường dẫn: `install.ps1 -Dir
"$env:USERPROFILE\KuHa"` — nếu không truyền và không tìm thấy, script sẽ
không tạo gì cả, chỉ nhắc mở `pi` ngay trong thư mục dự án lần sau.

#### 6. Chạy thử

```powershell
pi
```

Trong pi, thử các lệnh sau (thay phần trong ngoặc bằng nội dung thật):

- `/nghien-cuu công suất phòng khách sạn 4-5 sao khu vực [địa phương] quý này`
- `/bao-cao báo cáo tháng 9/2026`
- `/phan-tich-bctc C:\đường-dẫn\bao-cao-tai-chinh.xlsx`
- `/tra-luat quy định cấp phép kinh doanh công viên giải trí`
- `/bien-ban-hop C:\đường-dẫn\ghi-am-cuoc-hop.mp3`
- `/slide kế hoạch mở rộng công viên năm 2027`

## File kết quả được lưu ở đâu

Mọi báo cáo, nghiên cứu, phân tích... được lưu trong **thư mục dự án** — thư
mục nơi mở `pi` (không còn một đường dẫn cố định `Documents/Kuha` như bản
cũ), chia theo loại: `bao-cao`, `nghien-cuu`, `phap-ly`, `tai-chinh`,
`bien-ban`, `slide`, `recordings`. Trình cài (`install.sh`/`install.ps1`) tạo
sẵn các thư mục này trong thư mục dự án và đặt shortcut trên Desktop để mở
`pi` đúng chỗ. Nếu thư mục dự án đã có sẵn cây thư mục riêng (ví dụ tên tiếng
Việt), trợ lý sẽ hỏi một lần thư mục nào tương ứng với từng loại và ghi nhớ
trong `.pi/kuha-folders.json`.

## Cập nhật

Nhanh nhất: dán prompt trong `UPDATE-PROMPT.md` vào Claude Code, hoặc:

Khi Cuong cập nhật gói kỹ năng, chạy lại (macOS và Windows đều giống nhau):

```
pi update
```

Nếu cài qua git package, `pi update` sẽ tự lấy phiên bản mới nhất từ repo.
Nếu dùng cách zip, xin lại zip mới và làm lại bước 4-5.

## Xử lý sự cố

- **"pi" không phải lệnh nhận diện được** — đóng và mở lại terminal (PATH mới
  cần một cửa sổ mới mới nhận được).
- **Chữ tiếng Việt bị lỗi font/dấu trong terminal** — dùng Windows Terminal
  (có sẵn trên Windows 11, tìm trong Start Menu) thay vì PowerShell cũ (màu
  xanh).
- **Báo lỗi liên quan đến model/API** — kiểm tra lại API key: chạy `/login`
  trong pi, hoặc kiểm tra biến môi trường `OPENROUTER_API_KEY` còn đúng không.
- **install.ps1 báo thiếu công cụ** — chạy đúng lệnh `winget install` mà
  script in ra, mở terminal mới, rồi chạy lại `install.ps1`.

Có gì chưa rõ, nhắn Cuong.
