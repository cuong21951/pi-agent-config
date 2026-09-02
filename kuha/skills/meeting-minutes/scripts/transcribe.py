"""Chuyển file ghi âm/video sang văn bản tiếng Việt bằng faster-whisper.

    py -3.12 transcribe.py <audio> [--model medium|small|large-v3-turbo] [--lang vi] [--out file.txt]

Model tải về lần đầu (small ~500 MB, medium ~1.5 GB, large-v3-turbo ~1.6 GB) vào
cache huggingface rồi dùng offline. Trên CPU, medium chạy xấp xỉ 1x thời lượng audio.
"""
import argparse
import os
import subprocess
import sys
import tempfile


def format_ts(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def convert_to_wav(src: str) -> str:
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-ar", "16000", "-ac", "1", wav_path],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, timeout=600,
    )
    if result.returncode != 0:
        os.unlink(wav_path)
        raise RuntimeError("ffmpeg không chuyển đổi được file:\n" + result.stderr.decode(errors="ignore"))
    return wav_path


def transcribe(model, path: str, lang: str):
    segments, info = model.transcribe(path, language=lang, vad_filter=True)
    segments = iter(segments)
    first = next(segments, None)
    return first, segments, info


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", line_buffering=True)
    parser = argparse.ArgumentParser(description="Chuyển audio/video sang văn bản tiếng Việt")
    parser.add_argument("audio", help="Đường dẫn file audio/video (.m4a, .mp3, .wav, .mp4)")
    parser.add_argument("--model", default="medium", help="small | medium | large-v3-turbo (mặc định medium)")
    parser.add_argument("--lang", default="vi", help="Mã ngôn ngữ (mặc định vi)")
    parser.add_argument("--out", help="File transcript đầu ra (mặc định <audio>.transcript.txt)")
    args = parser.parse_args()

    audio = os.path.abspath(args.audio)
    if not os.path.isfile(audio):
        sys.exit(f"Không tìm thấy file: {audio}")
    out = args.out or os.path.splitext(audio)[0] + ".transcript.txt"

    print(f"File: {audio}\nModel: {args.model} | Ngôn ngữ: {args.lang}\nĐang tải model (lần đầu sẽ tải về)...")
    from faster_whisper import WhisperModel

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    temp_wav = None
    try:
        try:
            first, rest, info = transcribe(model, audio, args.lang)
        except Exception as error:
            print(f"Không đọc trực tiếp được file ({error}); chuyển qua ffmpeg sang WAV 16 kHz...")
            temp_wav = convert_to_wav(audio)
            first, rest, info = transcribe(model, temp_wav, args.lang)
        print(f"Thời lượng: {format_ts(info.duration)} | Ngôn ngữ nhận diện: {info.language} ({info.language_probability:.2f})")
        stamped, plain = [], []
        for seg in ([first] if first else []) + list(rest):
            text = seg.text.strip()
            stamped.append(f"[{format_ts(seg.start)}] {text}")
            plain.append(text)
            print(stamped[-1])
        if not stamped:
            print("Không nhận diện được nội dung (file im lặng hoặc quá ngắn).")
        with open(out, "w", encoding="utf-8") as f:
            f.write("=== TRANSCRIPT CÓ MỐC THỜI GIAN ===\n" + "\n".join(stamped))
            f.write("\n\n=== VĂN BẢN THUẦN ===\n" + " ".join(plain) + "\n")
        print(f"\nĐã lưu transcript: {out}")
    finally:
        if temp_wav and os.path.exists(temp_wav):
            os.unlink(temp_wav)


if __name__ == "__main__":
    main()
