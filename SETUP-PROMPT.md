# Restore Cuong's pi on another machine

Paste the block below into an agent (Claude Code or pi) on the new machine.

````text
Install my pi setup as an exact copy of my main PC from the public repo https://github.com/cuong21951/pi-agent-config (= the whole ~/.pi/agent minus secrets). Verify each step; on error fix it or note it and continue. Never push from this machine, never print secrets, back up anything you overwrite.

1. Prereqs: git, Node 24, Python 3.12, ffmpeg, rtk 0.40.0 (github.com/rtk-ai/rtk releases, on PATH). Close any running pi; move an existing ~/.pi/agent aside.
2. `git clone https://github.com/cuong21951/pi-agent-config ~/.pi/agent`, then in bash `bash ~/.pi/agent/scripts/cloud-setup.sh` (pinned pi 0.85.1 + packages + patches; never take newer versions) and `pi install git:github.com/badlogic/pi-skills`. `node ~/.pi/agent/patches/apply.mjs` must exit 0.
3. settings.json (local only): replace `C:/Users/cuong/` with this home, point extensions[0] at examples/extensions/todo.ts under the pi dir printed by `cd ~/.pi/agent && node --input-type=module -e "import {PI_DIR} from './scripts/pi-installs.mjs'; console.log(PI_DIR)"`, drop skill paths that don't exist. Change nothing else.
4. Ask me for keys, then create (gitignored): auth.json (deepseek, openrouter, opencode), mcp.json from mcp.example.json, ~/.pi/web-search.json = {"summaryModel":"commandcode/z-ai/glm-5.3-flash"}.
5. Extras: `npm i -g @azure-devops/mcp commandcode-api-proxy` (proxy on --port 18766), `pip install faster-whisper==1.2.1`, plus whatever each skill's SKILL.md needs.
6. Add the `pi` wrapper from README.md "Running pi inside herdr" to every PowerShell $PROFILE and ~/.bashrc.
7. Tell me to run /login → GitHub Copilot in pi. Then in a new terminal: `pi --version` = 0.85.1, `py -3.12 ~/.pi/agent/scripts/selfchecks.py` passes, `pi -p "say ok"` answers, TUI shows the cat header, `❯` prompt and `[PONYTAIL]` footer.
8. Report: step · status · evidence, and what I still must do by hand.
````
