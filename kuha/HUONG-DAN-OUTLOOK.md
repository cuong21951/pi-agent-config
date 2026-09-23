# Kết nối Outlook với trợ lý pi

Sau khi làm xong phần này, Phương có thể hỏi trợ lý bằng tiếng Việt kiểu:

- "Tuần này có mail nào từ nhà thầu không, tóm tắt giúp anh"
- "Tìm mail có file báo giá thang máy gửi tháng trước"
- "Lịch họp ngày mai của em có gì"
- "Soạn nháp trả lời mail này, đừng gửi"

Trợ lý đọc mail và lịch Outlook qua Microsoft Graph — cùng đường mà app Outlook
dùng, không phải mật khẩu chép đi đâu cả.

**Đọc trước khi làm:** nội dung mail nào trợ lý đọc thì nội dung đó được gửi lên
model (OpenRouter) để nó hiểu và trả lời. Mail nội bộ bình thường thì không sao,
nhưng **hợp đồng, lương, thông tin cá nhân của người khác thì đừng nhờ trợ lý
đọc**. Đây là giới hạn thật, không phải câu rào đón.

---

## Cần biết trước: tài khoản Outlook loại nào

| Loại | Ví dụ | Ghi chú |
|------|-------|---------|
| Công ty / tổ chức | `phuong@congty.com` (Microsoft 365 của công ty) | Phải thêm `--org-mode`. IT của công ty có thể phải duyệt trước — xem mục Xử lý sự cố |
| Cá nhân | `...@outlook.com`, `@hotmail.com`, `@live.com` | Bỏ `--org-mode` trong mọi lệnh bên dưới |

Không chắc thì cứ làm theo **công ty** trước; nếu đăng nhập báo lỗi tài khoản thì
làm lại theo **cá nhân**.

---

## Bước 1. Cập nhật pack để pi biết nói chuyện với Outlook

pi vốn không hỗ trợ MCP (cách các trợ lý AI cắm vào dịch vụ ngoài). Phần đó do
một gói bổ sung tên `pi-mcp-adapter` lo, và gói này vừa được thêm vào installer.

Mở pi trong thư mục dự án Kuha rồi nói:

```
Cập nhật pack Kuha giúp em
```

Hoặc làm tay trong Terminal:

```bash
pi update --extensions
bash ~/.pi/agent/git/github.com/cuong21951/pi-agent-config/kuha/install.sh ~/KuHa
```

Xong thì **thoát pi (Ctrl+C hai lần) và mở lại**.

Kiểm tra: gõ `/mcp` trong pi. Có bảng hiện ra là được. Báo không biết lệnh thì gói
chưa vào — chạy thêm `pi install npm:pi-mcp-adapter` rồi mở lại pi.

---

## Bước 2. Đăng nhập Microsoft

Trong Terminal (không phải trong pi), chạy:

```bash
npx -y @softeria/ms-365-mcp-server --org-mode --login
```

> Tài khoản cá nhân thì bỏ `--org-mode`:
> `npx -y @softeria/ms-365-mcp-server --login`

Màn hình sẽ hiện một đường link và một dãy mã. Mở link trong trình duyệt, nhập
dãy mã đó, đăng nhập Outlook như bình thường, bấm đồng ý. Quay lại Terminal thấy
báo đăng nhập thành công là xong.

Chỉ phải làm **một lần**. Đăng nhập được lưu trong Keychain của máy, không nằm
trong thư mục Kuha và không bao giờ lên GitHub.

---

## Bước 3. Khai báo Outlook cho pi

Tạo file `~/.pi/agent/mcp.json`. Cách dễ nhất: nhờ chính trợ lý làm — mở pi và dán:

```
Tạo file ~/.pi/agent/mcp.json với nội dung sau, giữ nguyên từng chữ:

{
  "mcpServers": {
    "outlook": {
      "command": "npx",
      "args": ["-y", "@softeria/ms-365-mcp-server", "--org-mode", "--preset", "mail,calendar", "--read-only"],
      "lifecycle": "lazy"
    }
  },
  "settings": {
    "toolResultRendering": "compact",
    "collapsedResultLines": 2,
    "mcpFooterStatus": "compact"
  }
}

Nếu file đã có sẵn nội dung khác thì thêm mục "outlook" vào, đừng xoá cái cũ.
```

Giải thích mấy chữ trong đó, để sau này sửa không sợ:

- `--org-mode` — tài khoản công ty. Tài khoản cá nhân thì **xoá dòng này** khỏi danh sách.
- `--preset mail,calendar` — chỉ bật mail và lịch. Server này có hơn 300 chức năng
  (Teams, OneDrive, Excel...), bật hết thì trợ lý chậm và tốn tiền vô ích. Muốn
  thêm file OneDrive thì đổi thành `mail,calendar,files`.
- `--read-only` — **chỉ đọc**. Trợ lý không gửi, không xoá, không sửa được mail.
  Cứ để vậy vài tuần đầu.
- `lifecycle: lazy` — chỉ chạy khi thật sự cần đến mail, không chạy nền suốt.

Sửa file xong, trong pi gõ `/reload` (hoặc thoát ra mở lại).

---

## Bước 4. Thử

Trong pi, hỏi:

```
Kiểm tra kết nối Outlook giúp em, liệt kê 5 mail mới nhất
```

Lần đầu sẽ hơi lâu vài giây vì `npx` tải server về. Ra được danh sách mail là xong.

---

## Khi nào bỏ chế độ chỉ đọc

Muốn trợ lý **soạn nháp / gửi mail / tạo lịch họp**, xoá `"--read-only"` khỏi
`args` trong `mcp.json` rồi `/reload`.

Trước khi bỏ, nhớ: trợ lý gửi mail là gửi thật, dưới tên Phương, người nhận thấy
y như Phương tự gửi. Nên bảo nó "soạn nháp thôi, đừng gửi, để em xem lại" cho
những mail quan trọng — server có chức năng lưu nháp riêng.

---

## Xử lý sự cố

**"Cần admin duyệt" / "Need admin approval" khi đăng nhập tài khoản công ty**

Tenant của công ty chặn ứng dụng ngoài cho tới khi IT đồng ý. Lấy danh sách quyền
cần xin bằng lệnh:

```bash
npx -y @softeria/ms-365-mcp-server --org-mode --list-permissions
```

Gửi danh sách đó cho IT nhờ duyệt. IT không duyệt thì phần này dừng ở đây — không
có cách vòng nào cả, và cũng không nên tìm.

**Mã đăng nhập hết hạn trước khi kịp nhập**

Chạy lại lệnh `--login`, nhập mã nhanh hơn. Mã chỉ sống vài phút.

**`npx: command not found`**

Chưa có Node. Chạy `brew install node` rồi mở lại Terminal.

**Muốn đăng xuất / đổi tài khoản**

```bash
npx -y @softeria/ms-365-mcp-server --logout
```

Rồi làm lại Bước 2.

**Trợ lý bảo không thấy công cụ Outlook nào**

Theo thứ tự: `/mcp` xem server `outlook` có trong danh sách không → `/reload` →
thoát pi mở lại → kiểm tra `mcp.json` có bị lỗi dấu phẩy không (nhờ trợ lý đọc lại
file đó cho).

---

## Windows

Y hệt, chỉ khác đường dẫn installer ở Bước 1:

```powershell
pi update --extensions
pwsh -File "$env:USERPROFILE\.pi\agent\git\github.com\cuong21951\pi-agent-config\kuha\install.ps1" -Dir "C:\KuHa"
```

File cấu hình nằm ở `%USERPROFILE%\.pi\agent\mcp.json`.
