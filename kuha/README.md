# Kuha — Trợ lý pi cho dự án Kuha

> **Lời tựa của Cuong**
>
> Bộ này làm cho vợ tôi, Phương, người mà tôi yêu và thỉnh thoảng thấy hơi ngốc nghếch một
> cách rất đáng yêu. Tôi bỏ thời gian gom đủ kỹ năng cần thiết vào đây để em đọc được báo cáo
> tài chính, tra được luật, ghi được biên bản họp và làm được slide mà không cần hỏi chồng.
> Mục tiêu cuối cùng: vợ tôi trở thành **corgi tài chính** của dự án Kuha, chân ngắn nhưng chạy
> số rất nhanh. Nếu có gì không hiểu, cứ hỏi trợ lý trước, hỏi chồng sau.

Đây là gói kỹ năng (skills) và câu lệnh nhanh (prompts) cho **pi coding agent**
(https://pi.dev), giúp Phương làm nghiên cứu thị trường, viết báo cáo, phân
tích tài chính, tra cứu pháp luật, ghi biên bản họp và làm slide cho dự án
Kuha — không cần biết lập trình.

## Cài đặt trên Windows 11 (làm theo thứ tự)
> Muốn để Claude tự cài toàn bộ thay vì làm tay: dùng khối prompt trong `SETUP-PROMPT.md` (Cuong điền key trước khi gửi).


### 1. Cài công cụ nền (mở PowerShell, chạy từng lệnh)

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id Python.Python.3.12 -e --source winget
winget install --id Gyan.FFmpeg -e --source winget
winget install --id TheDocumentFoundation.LibreOffice -e --source winget   # tuỳ chọn
```

Sau khi cài xong, **đóng và mở lại PowerShell** để nhận PATH mới.

### 2. Cài pi coding agent

```powershell
npm install -g @earendil-works/pi-coding-agent
```

### 3. Lấy API key

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

### 4. Lấy bộ kỹ năng Kuha

**Cách khuyến nghị** — cài trực tiếp từ repo public `cuong21951/pi-agent-config`:

```powershell
pi install git:github.com/cuong21951/pi-agent-config
```

**Cách dự phòng (không cần quyền GitHub)** — nếu Cuong gửi bạn file zip:

1. Giải nén, tìm thư mục `kuha/`.
2. Copy toàn bộ thư mục đó vào `%USERPROFILE%\.pi\agent\kuha\`.
3. Chạy bước 5 bên dưới để đăng ký kỹ năng vào pi.

### 5. Chạy install.ps1

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
năng Kuha vào pi, và tạo sẵn thư mục lưu kết quả. Chạy lại bao nhiêu lần cũng
an toàn (không tạo trùng lặp).

### 6. Chạy thử

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

Mọi báo cáo, nghiên cứu, phân tích... được lưu trong
`%USERPROFILE%\Documents\Kuha\`, chia theo loại: `bao-cao`, `nghien-cuu`,
`phap-ly`, `tai-chinh`, `bien-ban`, `slide`, `recordings`.

## Cập nhật

Khi Cuong cập nhật gói kỹ năng, chạy lại:

```powershell
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
