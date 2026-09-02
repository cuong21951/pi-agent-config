#!/usr/bin/env python
"""
Transcribe an audio/video recording (Vietnamese by default) with faster-whisper.

Usage:
    py -3.12 transcribe.py <audio> [--model large-v3-turbo|medium|small] [--lang vi] [--out file.txt]

Models (downloaded on first use to the default faster-whisper/huggingface cache,
usually C:\\Users\\<you>\\.cache\\huggingface):
    small            ~500 MB download, fastest, lowest accuracy. Good for quick tests.
    medium           ~1.5 GB download. On a CPU-only laptop, roughly 1x realtime
                      (a 30-minute recording takes roughly 30 minutes to transcribe).
    large-v3-turbo   ~1.6 GB download. Better accuracy than medium, noticeably slower
                      than medium on CPU. Prefer it when accuracy matters more than time.

Handles .m4a/.mp4/.mp3/.wav: faster-whisper decodes audio internally via PyAV. If
that fails on a given file (e.g. an unusual mp4 container), this script falls back
to converting the file to a 16 kHz mono WAV with ffmpeg first.
"""
import argparse
import os
import subprocess
import sys
import tempfile
from datetime import timedelta


def format_ts(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def has_cuda() -> bool:
    try:
        result = subprocess.run(
            ["nvidia-smi"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def convert_to_wav(src: str) -> str:
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    cmd = ["ffmpeg", "-y", "-i", src, "-ar", "16000", "-ac", "1", wav_path]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        os.unlink(wav_path)
        raise RuntimeError(
            "ffmpeg khong chuyen doi duoc file audio:\n"
            + result.stderr.decode(errors="ignore")
        )
    return wav_path


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe audio/video to text with faster-whisper (Vietnamese by default)."
    )
    parser.add_argument("audio", help="Duong dan file audio/video (.m4a, .mp3, .wav, .mp4, ...)")
    parser.add_argument(
        "--model",
        default="medium",
        help="Model whisper: large-v3-turbo | medium | small (hoac ten model faster-whisper khac). "
        "Mac dinh: medium (can bang toc do/do chinh xac tren CPU).",
    )
    parser.add_argument("--lang", default="vi", help="Ma ngon ngu (mac dinh vi = Tieng Viet)")
    parser.add_argument(
        "--out", default=None, help="File transcript output (.txt). Mac dinh: <audio>.transcript.txt"
    )
    args = parser.parse_args()

    audio_path = os.path.abspath(args.audio)
    if not os.path.isfile(audio_path):
        print(f"Loi: khong tim thay file audio: {audio_path}", file=sys.stderr)
        sys.exit(1)

    out_path = args.out or (os.path.splitext(audio_path)[0] + ".transcript.txt")

    print(f"File audio: {audio_path}")
    print(f"Model: {args.model} | Ngon ngu: {args.lang}")

    device = "cuda" if has_cuda() else "cpu"
    compute_type = "int8"
    print(f"Thiet bi xu ly: {device} (compute_type={compute_type})")
    if args.model == "medium":
        print(
            "Uoc tinh: model ~1.5 GB (tai lan dau), toc do CPU xap xi 1x thoi luong thuc "
            "(audio 30 phut ~ 30 phut xu ly)."
        )
    elif args.model == "large-v3-turbo":
        print(
            "Uoc tinh: model ~1.6 GB (tai lan dau), chinh xac hon medium nhung cham hon "
            "tren CPU. Dung --model medium neu can nhanh hon."
        )
    elif args.model == "small":
        print("Uoc tinh: model ~500 MB (tai lan dau), nhanh nhat, do chinh xac thap hon.")

    from faster_whisper import WhisperModel

    print("Dang tai model (lan dau se tai ve cache mac dinh cua huggingface)...")
    model = WhisperModel(args.model, device=device, compute_type=compute_type)

    transcribe_path = audio_path
    temp_wav = None
    try:
        try:
            print("Dang nhan dien audio...")
            segments_iter, info = model.transcribe(
                transcribe_path, language=args.lang, vad_filter=True
            )
            segments_iter = iter(segments_iter)
            first_segment = next(segments_iter, None)
        except Exception as e:
            print(
                f"[Canh bao] Khong doc truc tiep duoc file ({e}); chuyen doi qua ffmpeg "
                "sang WAV 16kHz..."
            )
            temp_wav = convert_to_wav(audio_path)
            transcribe_path = temp_wav
            segments_iter, info = model.transcribe(
                transcribe_path, language=args.lang, vad_filter=True
            )
            segments_iter = iter(segments_iter)
            first_segment = next(segments_iter, None)

        print(f"Ngon ngu nhan dien: {info.language} (do tin cay {info.language_probability:.2f})")
        print(f"Thoi luong: {format_ts(info.duration)}")
        print("Dang xu ly cac doan...")

        lines_ts = []
        lines_plain = []

        def handle(seg):
            text = seg.text.strip()
            ts = format_ts(seg.start)
            lines_ts.append(f"[{ts}] {text}")
            lines_plain.append(text)
            print(f"  [{ts}] {text}")

        if first_segment is not None:
            handle(first_segment)
        for seg in segments_iter:
            handle(seg)

        if not lines_ts:
            print("Khong nhan dien duoc noi dung nao (file co the im lang hoac qua ngan).")

        with open(out_path, "w", encoding="utf-8") as f:
            f.write("=== TRANSCRIPT CO MOC THOI GIAN ===\n")
            f.write("\n".join(lines_ts))
            f.write("\n\n=== TRANSCRIPT DANG VAN BAN THUAN ===\n")
            f.write(" ".join(lines_plain))
            f.write("\n")

        print(f"\nDa luu transcript tai: {out_path}")
    finally:
        if temp_wav and os.path.exists(temp_wav):
            os.unlink(temp_wav)


if __name__ == "__main__":
    main()
