#!/usr/bin/env bash
#
# Ghi am cuoc hop bang ffmpeg (avfoundation tren macOS).
#
# --list            liet ke thiet bi microphone (audio) ma ffmpeg thay duoc.
# --device N        chi so thiet bi audio (dung nhu hien thi khi chay --list).
#                    Neu bo trong, dung thiet bi dau tien tim thay.
# --minutes N       so phut ghi am toi da. Bat buoc khi ghi am that.
# --out path        duong dan file .m4a output. Mac dinh:
#                    ./recordings/<yyyy-MM-dd_HHmm>.m4a (duoi thu muc dang chay lenh nay)
#
# Ghi am se ket thuc khi het thoi gian (--minutes) hoac khi nhan Ctrl+C -- ffmpeg
# tu hoan thien (finalize) file khi nhan tin hieu dung, khong can thao tac gi them.
#
# Luu y macOS: lan dau chay, he thong se hoi quyen truy cap microphone cho
# ung dung dang chay script nay (Terminal, iTerm2, ...). Vao System Settings >
# Privacy & Security > Microphone, bat quyen cho ung dung do, roi chay lai lenh.
#
# Vi du:
#   bash record.sh --list
#   bash record.sh --device 0 --minutes 45
#   bash record.sh --minutes 60 --out "$HOME/hop/hop-khai-truong.m4a"

set -uo pipefail

list_devices=0
device=""
minutes=""
out=""

usage() {
    echo "Usage: record.sh [--list] [--device N] [--minutes N] [--out path]"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --list) list_devices=1; shift ;;
        --device) device="${2:-}"; shift 2 ;;
        --minutes) minutes="${2:-}"; shift 2 ;;
        --out) out="${2:-}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Khong nhan dien duoc tham so: $1" >&2; usage; exit 1 ;;
    esac
done

get_avfoundation_audio_devices() {
    # ffmpeg in danh sach thiet bi ra stderr roi thoat voi ma loi khac 0 -- do
    # la hanh vi binh thuong cua "-list_devices true", khong phai loi that.
    ffmpeg -f avfoundation -list_devices true -i "" 2>&1 \
        | awk '/AVFoundation audio devices:/{f=1; next} /AVFoundation video devices:/{f=0} f'
}

if [ "$list_devices" = 1 ]; then
    devices="$(get_avfoundation_audio_devices)"
    if [ -z "$devices" ]; then
        echo "Khong tim thay thiet bi ghi am nao. Kiem tra microphone da cam/bat chua."
    else
        echo "Danh sach thiet bi ghi am (audio) tim thay:"
        echo "$devices" | sed -E 's/^.*(\[[0-9]+\].*)$/  \1/'
        echo
        echo "Dung chi so thiet bi (vi du: 0) voi tham so --device."
        echo
        echo "Luu y: neu day la lan dau chay ffmpeg voi avfoundation, macOS se hoi"
        echo "quyen truy cap microphone cho ung dung dang chay lenh nay (Terminal,"
        echo "iTerm2, ...). Cap quyen trong System Settings > Privacy & Security >"
        echo "Microphone roi chay lai lenh."
    fi
    exit 0
fi

if [ -z "$minutes" ]; then
    echo "Vui long chi dinh --minutes <so phut ghi am toi da>, vi du: --minutes 45." >&2
    echo "Dung --list de xem thiet bi." >&2
    exit 1
fi

if [ -z "$device" ]; then
    first_line="$(get_avfoundation_audio_devices | head -n1)"
    if [ -z "$first_line" ]; then
        echo "Khong tim thay thiet bi ghi am nao tren may. Chay lai voi --list de kiem tra." >&2
        exit 1
    fi
    device="$(echo "$first_line" | sed -E 's/^.*\[([0-9]+)\].*$/\1/')"
    device_name="$(echo "$first_line" | sed -E 's/^.*\[[0-9]+\] (.*)$/\1/')"
    echo "Chua chi dinh --device, dung thiet bi dau tien: [$device] $device_name"
fi

if [ -z "$out" ]; then
    timestamp="$(date +%Y-%m-%d_%H%M)"
    recordings_dir="./recordings"
    mkdir -p "$recordings_dir"
    out="$recordings_dir/$timestamp.m4a"
else
    out_dir="$(dirname "$out")"
    [ -n "$out_dir" ] && mkdir -p "$out_dir"
fi

seconds="$(awk -v m="$minutes" 'BEGIN { printf "%d", (m * 60) + 0.5 }')"

echo "Bat dau ghi am tu thiet bi so: $device"
echo "Thoi luong toi da: $minutes phut ($seconds giay)"
echo "File output: $out"
echo
echo "Nhan Ctrl+C de dung ghi am som hon (ffmpeg se tu hoan thien file khi nhan tin hieu dung)."
echo

ffmpeg -f avfoundation -i ":$device" -t "$seconds" -c:a aac -y "$out"
status=$?

if [ $status -eq 0 ]; then
    echo
    echo "Ghi am hoan tat. File da luu tai:"
    echo "$out"
else
    echo "ffmpeg ket thuc voi ma loi $status. Kiem tra lai file: $out" >&2
fi
