---
name: meeting-minutes
description: Record or use an existing Vietnamese meeting audio/video file, transcribe it to Vietnamese text, and produce a "Bien ban hop" (meeting minutes) document.
---

# Bien ban hop (Ghi am - Transcribe - Bien ban hop)

Skill nay giup ban lay noi dung mot cuoc hop (Kuha: khach san, cong vien giai tri,
live show) va bien thanh mot file Bien ban hop hoan chinh, bat dau tu file ghi am
hoac tu mot file audio/video co san (.m4a, .mp3, .wav, .mp4).

## Quy trinh (workflow)

1. **Ghi am cuoc hop** (bo qua neu da co san file audio/video):
   - Xem danh sach microphone:
     ```
     pwsh -File "{baseDir}/scripts/record.ps1" -ListDevices
     ```
   - Ghi am (vi du toi da 60 phut):
     ```
     pwsh -File "{baseDir}/scripts/record.ps1" -Device "<ten thiet bi>" -Minutes 60
     ```
     Neu bo qua `-Device`, script dung microphone dau tien tim thay. Neu bo qua
     `-Out`, file duoc luu vao `Documents\Kuha\recordings\<ngay_gio>.m4a`.
     Ghi am tu dung khi het thoi gian, hoac nguoi dung nhan Ctrl+C som hon.

2. **Chuyen giong noi thanh van ban (transcribe)**:
   ```
   py -3.12 "{baseDir}/scripts/transcribe.py" "<duong dan file audio/video>" --model medium --lang vi
   ```
   - Dung `--model large-v3-turbo` neu can do chinh xac cao hon va chap nhan cham
     hon; dung `--model small` cho ban nhap nhanh.
   - Ket qua la file `<ten-file>.transcript.txt` gom 2 phan: transcript co moc
     thoi gian `[HH:MM:SS]` va ban van thuan.

3. **Doc lai transcript truoc khi dien bien ban.** Doi chieu ky, cho nhung doan
   nghe khong ro thay vi doan mo.

4. **Dien vao template** `{baseDir}/templates/bien-ban-hop.md` (copy sang mot
   file moi, vi du `hop-2026-09-02.md`) dua vao noi dung transcript.

5. **Xuat ra file .docx**:
   ```
   py -3.12 "{baseDir}/scripts/minutes_docx.py" "hop-2026-09-02.md"
   ```
   File `.docx` duoc tao cung thu muc, cung ten, font Times New Roman 13pt, co
   bang cho phan phan cong cong viec va ky ten.

## Quy tac bat buoc khi dien bien ban

- **Khong tu bia** quyet dinh, ten nguoi, hay so lieu khong co trong transcript.
  Chi ghi lai nhung gi thuc su duoc noi.
- Doan nghe khong ro thi ghi `[khong nghe ro]` tai vi tri do, khong doan mo.
- Chi gan ten nguoi noi (attribution) khi ro rang tu ngu canh hoac tu file audio
  co nhieu nguoi/nhieu kenh; neu khong chac ai noi, ghi chung la "y kien trong
  cuoc hop" thay vi gan sai ten.
- Phan **Phan cong cong viec**: moi dong phai co **nguoi phu trach** va **han
  hoan thanh** ro rang; neu transcript khong noi ro han, ghi "[chua xac dinh]"
  thay vi tu dat han.
- Neu transcript khong the hien day du **thanh phan tham du** (ten chu tri, thu
  ky, thanh vien), **hoi lai nguoi dung** de bo sung ten truoc khi hoan tat bien
  ban, thay vi tu dien.
