---
name: meeting-minutes
description: Record or use an existing Vietnamese meeting audio/video file, transcribe it to Vietnamese text, and produce a "Biên bản họp" (meeting minutes) .docx.
---

# Biên bản họp (ghi âm → transcript → biên bản)

Dùng skill này để biến một cuộc họp của Kuha (khách sạn, công viên giải trí,
show diễn) thành file Biên bản họp hoàn chỉnh, từ file ghi âm hoặc file
audio/video có sẵn (.m4a, .mp3, .wav, .mp4).

## Quy trình

1. **Ghi âm** (bỏ qua nếu đã có file):
   - Xem danh sách microphone: `pwsh -File "{baseDir}/scripts/record.ps1" -ListDevices`
   - Ghi âm tối đa 60 phút: `pwsh -File "{baseDir}/scripts/record.ps1" -Device "<tên thiết bị>" -Minutes 60`
   - Bỏ `-Device` thì dùng microphone đầu tiên; bỏ `-Out` thì file lưu vào
     `Documents\Kuha\recordings\<ngày_giờ>.m4a`. Ghi âm dừng khi hết thời gian
     hoặc khi bấm Ctrl+C.

2. **Chuyển giọng nói thành văn bản**:
   ```
   py -3.12 "{baseDir}/scripts/transcribe.py" "<file audio/video>" --model medium
   ```
   - `--model small` cho bản nháp nhanh, `--model large-v3-turbo` khi cần chính
     xác hơn (lần đầu tải model 1.5 GB, sau đó dùng offline).
   - Kết quả: `<tên-file>.transcript.txt` gồm phần có mốc thời gian `[HH:MM:SS]`
     và phần văn bản thuần.

3. **Đọc lại transcript** trước khi điền biên bản. Chỗ nghe không rõ ghi
   `[không nghe rõ]`, không đoán.

4. **Điền template** `{baseDir}/templates/bien-ban-hop.md`: copy sang file mới
   (ví dụ `hop-2026-09-02.md`) rồi điền theo transcript.

5. **Xuất .docx**:
   ```
   py -3.12 "{baseDir}/scripts/minutes_docx.py" "hop-2026-09-02.md"
   ```
   File .docx nằm cùng thư mục, Times New Roman 13pt, có bảng phân công và
   phần ký tên.

## Quy tắc bắt buộc

- Không tự bịa quyết định, tên người hay số liệu không có trong transcript.
- Chỉ gán tên người nói khi rõ ràng từ ngữ cảnh; nếu không chắc, ghi "ý kiến
  trong cuộc họp".
- Mỗi dòng phân công phải có người phụ trách và hạn hoàn thành; thiếu hạn thì
  ghi `[chưa xác định]`.
- Transcript không nêu đủ thành phần tham dự (chủ trì, thư ký, thành viên) thì
  hỏi người dùng trước khi hoàn tất, không tự điền.
- Lưu file biên bản vào `Documents\Kuha\bien-ban\`.
