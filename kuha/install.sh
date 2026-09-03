#!/usr/bin/env bash
#
# Cai dat goi ky nang Kuha cho pi coding agent (macOS + Linux).
#
# Idempotent installer: kiem tra cong cu he thong, cai goi Python, dang ky
# skills/prompts cua Kuha vao settings.json cua pi, tao thu muc luu file
# trong thu muc du an. Honour bien moi truong PI_CODING_AGENT_DIR de tro thu
# muc agent (dung khi test trong sandbox, khong dung ~/.pi/agent that). Day
# la ban mirror cua install.ps1 (Windows) cho macOS/Linux.
#
# Usage: install.sh [DIR]
#   DIR  thu muc du an (noi luu bao-cao/nghien-cuu/... va noi mo pi lam viec).
#        Bo qua thi tu tim thu muc dau tien co san trong: ~/KuHa, ~/Kuha,
#        ~/kuha, ~/Documents/Kuha, ~/Documents/KuHa. Khong tim thay thi
#        khong tao gi ca (xem phan 6 ben duoi).

set -uo pipefail

section() {
    echo
    echo "== $1 =="
}

# ---------------------------------------------------------------------------
# 0. Duong dan co ban
# ---------------------------------------------------------------------------

KUHA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_ROOT="$KUHA_DIR/skills"
PROMPTS_DIR="$KUHA_DIR/prompts"
KUHA_AGENTS_MD="$KUHA_DIR/AGENTS.md"

AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

PROJECT_DIR_ARG="${1:-}"

detect_project_dir() {
    local candidate
    for candidate in "$HOME/KuHa" "$HOME/Kuha" "$HOME/kuha" "$HOME/Documents/Kuha" "$HOME/Documents/KuHa"; do
        if [ -d "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

if [ -n "$PROJECT_DIR_ARG" ]; then
    PROJECT_DIR="$PROJECT_DIR_ARG"
elif detected="$(detect_project_dir)"; then
    PROJECT_DIR="$detected"
else
    PROJECT_DIR=""
fi

echo "Kuha installer cho pi coding agent (macOS/Linux)"
echo "Thu muc agent dich: $AGENT_DIR"
if [ -n "$PROJECT_DIR" ]; then
    echo "Thu muc du an: $PROJECT_DIR"
else
    echo "Thu muc du an: chua xac dinh (xem phan 'Thu muc du an' ben duoi)"
fi

# ---------------------------------------------------------------------------
# 1. Kiem tra cong cu he thong
# ---------------------------------------------------------------------------

section "Kiem tra cong cu he thong"

missing=()

if command -v git >/dev/null 2>&1; then
    echo "[OK] git: $(git --version)"
else
    echo "[THIEU] git"
    missing+=("brew install git")
fi

if command -v node >/dev/null 2>&1; then
    node_ver="$(node --version 2>&1)"
    node_major="$(echo "$node_ver" | sed -E 's/^v([0-9]+).*/\1/')"
    if [ "${node_major:-0}" -ge 20 ] 2>/dev/null; then
        echo "[OK] node: $node_ver"
    else
        echo "[THIEU] Node.js >= 20 (hien co: $node_ver)"
        missing+=("brew install node")
    fi
else
    echo "[THIEU] Node.js"
    missing+=("brew install node")
fi

# Chon python3 dung duoc (>= 3.10). May co the co lenh "python3" nhung khong
# chay duoc (vi du: Windows Store stub qua Git Bash) — luon kiem tra bang
# cach chay --version/sys.version_info that, khong chi command -v.
PY=""
pick_python() {
    if command -v python3 >/dev/null 2>&1; then
        local ver major minor
        ver="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
        if [ -n "$ver" ]; then
            major="${ver%%.*}"
            minor="${ver##*.}"
            if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; }; then
                PY="python3"
                return 0
            fi
        fi
    fi
    # Du phong cho Windows/Git Bash: launcher "py" co san nhung "python3" thi
    # khong (hoac la stub khong chay duoc).
    if command -v py >/dev/null 2>&1 && py -3.12 --version >/dev/null 2>&1; then
        PY="py -3.12"
        return 0
    fi
    return 1
}

if pick_python; then
    echo "[OK] python: $($PY --version 2>&1)"
else
    echo "[THIEU] Python 3.10+ (python3)"
    missing+=("brew install python@3.12")
fi

if command -v ffmpeg >/dev/null 2>&1; then
    echo "[OK] ffmpeg: $(ffmpeg -version 2>&1 | head -n1)"
else
    echo "[THIEU] ffmpeg"
    missing+=("brew install ffmpeg")
fi

if command -v soffice >/dev/null 2>&1 || [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
    echo "[OK] LibreOffice: co san"
else
    echo "[TUY CHON] LibreOffice chua co (khong bat buoc)"
    missing+=("brew install --cask libreoffice  (tuy chon)")
fi

if [ "${#missing[@]}" -gt 0 ]; then
    echo
    echo "Chay cac lenh sau (Homebrew) de cai cong cu con thieu:"
    for cmd in "${missing[@]}"; do
        echo "  $cmd"
    done
fi

# ---------------------------------------------------------------------------
# 2. Cai goi Python
# ---------------------------------------------------------------------------

section "Cai goi Python (--user)"

PACKAGES=(
    python-pptx python-docx openpyxl reportlab pypdf
    pdfplumber pandas matplotlib faster-whisper requests
    beautifulsoup4 edge-tts
)

if [ -n "$PY" ]; then
    echo "$PY -m pip install --user ${PACKAGES[*]}"
    if ! $PY -m pip install --user "${PACKAGES[@]}"; then
        echo "[CANH BAO] pip install loi (co the do PEP 668 tren Homebrew python) — thu lai voi --break-system-packages..."
        if ! $PY -m pip install --user --break-system-packages "${PACKAGES[@]}"; then
            echo "[CANH BAO] pip install van loi (xem log o tren)"
        fi
    fi
else
    echo "[BO QUA] Python 3.10+ chua co, khong the cai goi."
fi

# ---------------------------------------------------------------------------
# 3. Dam bao thu muc agent ton tai
# ---------------------------------------------------------------------------

section "Thu muc agent"

mkdir -p "$AGENT_DIR"
echo "[OK] $AGENT_DIR"

# ---------------------------------------------------------------------------
# 4. Merge settings.json (dung python3, khong can jq)
# ---------------------------------------------------------------------------

section "Cap nhat settings.json"

SETTINGS_PATH="$AGENT_DIR/settings.json"

case "$KUHA_DIR" in
    */git/github.com/*) managed_by_package=1 ;;
    *) managed_by_package=0 ;;
esac

if [ -n "$PY" ]; then
    MERGE_SCRIPT="$(mktemp)"
    trap 'rm -f "$MERGE_SCRIPT"' EXIT

    cat > "$MERGE_SCRIPT" <<'PYEOF'
import json
import os
import sys

settings_path, skills_root, prompts_dir, managed_by_package = sys.argv[1:5]
managed_by_package = managed_by_package == "1"

if os.path.exists(settings_path):
    with open(settings_path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    settings = json.loads(raw) if raw else {}
else:
    settings = {}


def add_unique(key, value):
    arr = settings.get(key, [])
    if value not in arr:
        arr = arr + [value]
    settings[key] = arr


required_packages = [
    "npm:pi-web-access",
    "npm:@juicesharp/rpiv-ask-user-question",
    "npm:pi-notify",
]
for pkg in required_packages:
    add_unique("packages", pkg)

# powerline used to own the footer and the editor; it overrode claude-footer/claude-input
settings["packages"] = [p for p in settings.get("packages", []) if p != "npm:pi-powerline-footer"]
settings.pop("powerline", None)

if managed_by_package:
    print(
        "Kuha duoc cai qua 'pi install git:...': skills/prompts da duoc "
        "package.json dang ky, bo qua buoc dang ky thu cong."
    )
else:
    if os.path.isdir(skills_root):
        for name in sorted(os.listdir(skills_root)):
            full = os.path.join(skills_root, name)
            if os.path.isdir(full):
                add_unique("skills", full)
    if os.path.isdir(prompts_dir):
        add_unique("prompts", prompts_dir)

settings.setdefault("tuiMode", "fullscreen")
settings.setdefault("quietStartup", True)
settings.setdefault("hideThinkingBlock", True)
settings.setdefault("enabledModels", ["openrouter/z-ai/glm-5.3-flash", "openrouter/deepseek/deepseek-v4-flash*"])
settings.setdefault("defaultProvider", "openrouter")
settings.setdefault("defaultModel", "z-ai/glm-5.3-flash")
settings.setdefault("defaultThinkingLevel", "medium")

with open(settings_path, "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"[OK] Da cap nhat {settings_path}")
PYEOF

    $PY "$MERGE_SCRIPT" "$SETTINGS_PATH" "$SKILLS_ROOT" "$PROMPTS_DIR" "$managed_by_package"
    rm -f "$MERGE_SCRIPT"
    trap - EXIT
else
    echo "[BO QUA] Python 3.10+ chua co, khong the cap nhat settings.json (can python3 de merge JSON)."
fi

# ---------------------------------------------------------------------------
# 5. AGENTS.md
# ---------------------------------------------------------------------------

section "AGENTS.md"

TARGET_AGENTS_MD="$AGENT_DIR/AGENTS.md"
MARKER="# Kuha"

if [ ! -f "$TARGET_AGENTS_MD" ]; then
    cp "$KUHA_AGENTS_MD" "$TARGET_AGENTS_MD"
    echo "[OK] Da tao $TARGET_AGENTS_MD tu kuha/AGENTS.md"
else
    if ! grep -qF "$MARKER" "$TARGET_AGENTS_MD"; then
        { printf '\n\n'; cat "$KUHA_AGENTS_MD"; } >> "$TARGET_AGENTS_MD"
        echo "[OK] Da them phan '$MARKER' vao $TARGET_AGENTS_MD"
    else
        echo "[BO QUA] $TARGET_AGENTS_MD da co phan '$MARKER'"
    fi
fi

# ---------------------------------------------------------------------------
# 6. Thu muc du an (noi luu file ket qua) va shortcut
# ---------------------------------------------------------------------------

section "Thu muc du an"

SUB_DIRS=(bao-cao nghien-cuu phap-ly tai-chinh bien-ban slide recordings)

has_subdirs() {
    find "$1" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | grep -q .
}

if [ -z "$PROJECT_DIR" ]; then
    echo "[BO QUA] Khong tim thay thu muc du an co san (~/KuHa, ~/Kuha, ~/kuha,"
    echo "~/Documents/Kuha, ~/Documents/KuHa) va khong co tham so DIR."
    echo "Hay tao thu muc du an truoc (vi du ~/KuHa), roi chay lai:"
    echo "  bash install.sh ~/KuHa"
    echo "Hoac chi can mo 'pi' ngay ben trong thu muc du an do — khong bat buoc"
    echo "phai chay lai installer."
else
    mkdir -p "$PROJECT_DIR"
    if has_subdirs "$PROJECT_DIR"; then
        echo "[BO QUA] $PROJECT_DIR da co san thu muc con, khong tao them 7 thu muc"
        echo "loai chuan de tranh xao tron cay thu muc co san. Tro ly se hoi anh/chi"
        echo "thu muc nao dung cho loai nao khi lam viec (xem AGENTS.md)."
    else
        for d in "${SUB_DIRS[@]}"; do
            mkdir -p "$PROJECT_DIR/$d"
        done
        IFS=,
        echo "[OK] $PROJECT_DIR/{${SUB_DIRS[*]}}"
        unset IFS
    fi

    LAUNCHER="$HOME/Desktop/Kuha.command"
    write_launcher=1
    if [ -f "$LAUNCHER" ] && ! grep -qF "# kuha-launcher" "$LAUNCHER"; then
        write_launcher=0
        echo "[BO QUA] $LAUNCHER da ton tai va khong phai do Kuha tao, khong ghi de."
    fi
    if [ "$write_launcher" = 1 ]; then
        mkdir -p "$(dirname "$LAUNCHER")"
        cat > "$LAUNCHER" <<EOF
#!/bin/bash
# kuha-launcher
cd "$PROJECT_DIR" && pi
EOF
        chmod +x "$LAUNCHER"
        echo "[OK] Da tao $LAUNCHER"
    fi
fi

# ---------------------------------------------------------------------------
# 7. Tom tat
# ---------------------------------------------------------------------------

section "Hoan tat"

echo "Thu muc agent   : $AGENT_DIR"
echo "settings.json   : $SETTINGS_PATH"
echo "AGENTS.md       : $TARGET_AGENTS_MD"
echo "Thu muc du an   : ${PROJECT_DIR:-chua xac dinh}"
echo
echo "Buoc tiep theo:"
echo "  1. Neu chua co API key: chay 'pi' roi go /login, hoac dat bien moi truong OPENROUTER_API_KEY."
echo "  2. Mo terminal moi (de nhan PATH cap nhat neu vua cai cong cu qua brew)."
echo "  3. Chay 'pi' trong thu muc du an va thu lenh: /nghien-cuu, /bao-cao, /phan-tich-bctc, /tra-luat, /bien-ban-hop, /slide"
