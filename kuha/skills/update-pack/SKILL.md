---
name: update-pack
description: Cập nhật pack Kuha (pi-agent-config) trên máy lên bản mới nhất — chạy khi người dùng nói "cập nhật pack", "update pack", "nâng cấp trợ lý", "cập nhật lên bản mới", hoặc khi pi hiện banner "Package Updates Available" và người dùng yêu cầu xử lý.
---

# Cập nhật pack Kuha

Người dùng không rành kỹ thuật: tự chạy hết các bước, trả lời tiếng Việt,
không hỏi lại trừ khi một bước lỗi thật sự. Sau khi xong, nhắc người dùng
khởi động lại pi (thoát rồi mở lại) để nhận bản mới.

## Bước 1 — Cập nhật package

```bash
pi update --extensions
```

Lệnh này kéo bản mới của gói `github.com/cuong21951/pi-agent-config` (chứa
toàn bộ skill, prompt, extension của Kuha) từ GitHub về máy.

## Bước 2 — Chạy lại installer với thư mục dự án

Installer chạy được lặp lại (idempotent), dùng để cài thêm gói Python mới,
merge settings.json và tạo lại shortcut nếu thiếu. Thư mục dự án = thư mục
hiện tại đang mở pi (cwd).

- macOS / Linux:
  ```bash
  bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh "<thư mục dự án>"
  ```
- Windows (PowerShell):
  ```powershell
  pwsh -File "$env:USERPROFILE\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1" -Dir "<thư mục dự án>"
  ```

Nếu báo thiếu công cụ (git, node, python3, ffmpeg), cài qua Homebrew
(`brew install ...`) theo gợi ý của installer, rồi chạy lại.

## Bước 3 — Kiểm tra khóa model rẻ

Bắt buộc: đã từng có request nhầm sang model đắt. Mở
`~/.pi/agent/settings.json` và xác nhận:

- `"defaultProvider": "openrouter"`, `"defaultModel": "z-ai/glm-5.3-flash"`
- `"enabledModels"` chỉ gồm `"openrouter/z-ai/glm-5.3-flash"` và
  `"openrouter/deepseek/deepseek-v4-flash*"`
- Không có giá trị model nào chứa "fable", "opus", "sonnet", "gpt-5"
- Thư mục `~/.pi/agent/git/github.com/cuong21951/pi-agent-config/extensions/cheap-models`
  tồn tại

Sai thì sửa settings.json đúng như trên. Vẫn sai sau khi sửa → dừng và báo
người dùng.

## Bước 4 — Tóm tắt bản mới

Đọc `CHANGELOG.md` trong thư mục `kuha/` của pack (cùng chỗ với install.sh)
và tóm tắt các mục mới kể từ bản trước trong tối đa 3 dòng tiếng Việt.

## Lỗi thường gặp

- `pi update` báo lỗi xác thực GitHub: repo là private, token hết hạn → báo
  người dùng, không tự sửa token.
- Banner "Package Updates Available" vẫn hiện sau khi update: bình thường,
  vì phiên pi đang chạy vẫn là bản cũ — nhắc khởi động lại pi, không chạy
  update lần thứ ba.
