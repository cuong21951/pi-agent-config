# Prompt cài Outlook cho Phương

Mở pi trong thư mục dự án Kuha, dán khối dưới đây vào, Enter. Không cần điền gì.

```text
Cài kết nối Outlook cho trợ lý trên máy này. Tự làm hết các bước, trả lời tiếng
Việt, giải thích ngắn gọn kiểu nói với người không biết lập trình. Chỉ hỏi lại ở
bước 1 và khi một bước lỗi thật sự.

1. Hỏi tôi một câu duy nhất trước khi bắt đầu: mail Outlook tôi muốn dùng là mail
   công ty (Microsoft 365 của tổ chức) hay mail cá nhân (@outlook.com, @hotmail.com,
   @live.com)? Nhớ câu trả lời:
   - công ty  -> mọi lệnh và cấu hình bên dưới CÓ cờ --org-mode
   - cá nhân  -> BỎ cờ --org-mode ở mọi chỗ
   Tôi trả lời "không biết" thì chọn công ty.

2. Cài phần giúp pi nói chuyện được với dịch vụ ngoài (pi không có sẵn):
   pi install npm:pi-mcp-adapter
   Báo lỗi mạng thì thử lại một lần rồi mới dừng.

3. Tạo hoặc cập nhật file ~/.pi/agent/mcp.json (Windows: %USERPROFILE%\.pi\agent\mcp.json).
   Nếu file đã tồn tại: đọc lên, thêm khoá "outlook" vào trong "mcpServers", GIỮ
   NGUYÊN mọi server và mọi cài đặt đang có, đừng ghi đè cả file. Nếu chưa có thì
   tạo mới đúng như sau:

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

   Tài khoản cá nhân thì bỏ phần tử "--org-mode" khỏi mảng args.
   Giữ nguyên "--read-only": trợ lý chỉ được đọc, không gửi và không xoá mail.
   Sau khi ghi file, đọc lại và xác nhận JSON hợp lệ.

4. Đăng nhập Microsoft. Việc này tôi phải tự làm vì cần mở trình duyệt, nên ĐỪNG
   tự chạy lệnh đăng nhập. Hãy in ra cho tôi đúng lệnh cần chạy trong một cửa sổ
   Terminal khác:
     npx -y @softeria/ms-365-mcp-server --org-mode --login
   (bỏ --org-mode nếu tài khoản cá nhân)
   Giải thích: màn hình sẽ hiện một link và một dãy mã; mở link, nhập mã, đăng nhập
   Outlook, bấm đồng ý. Mã chỉ sống vài phút.
   Rồi dừng lại chờ tôi nhắn "xong".

5. Khi tôi nói xong, kiểm tra đăng nhập:
     npx -y @softeria/ms-365-mcp-server --org-mode --verify-login
   Nếu báo cần admin của công ty duyệt (admin approval / admin consent) thì chạy
     npx -y @softeria/ms-365-mcp-server --org-mode --list-permissions
   in danh sách quyền ra và nói tôi gửi danh sách đó cho bộ phận IT nhờ duyệt, rồi
   dừng ở đây. Đừng tìm cách đi vòng.

6. Nạp lại cấu hình (/reload). Kiểm tra bằng cách liệt kê 5 mail mới nhất và 3 sự
   kiện sắp tới trên lịch của tôi. Lần đầu chậm vài giây vì phải tải server về là
   bình thường.

7. Báo cáo cuối bằng tiếng Việt, tối đa 6 dòng:
   - dùng tài khoản loại nào
   - đang ở chế độ chỉ đọc, muốn trợ lý soạn nháp hoặc gửi mail thì phải bỏ
     "--read-only" trong mcp.json rồi /reload
   - nhắc tôi: mail nào nhờ trợ lý đọc thì nội dung mail đó được gửi lên model
     (OpenRouter) để xử lý, nên đừng nhờ đọc hợp đồng, lương, hay thông tin cá
     nhân của người khác
   - ba câu tôi có thể hỏi ngay, ví dụ "tóm tắt mail tuần này", "tìm mail có báo
     giá thang máy", "mai em có họp gì"
```

Chi tiết từng bước và phần xử lý sự cố: `HUONG-DAN-OUTLOOK.md`.
