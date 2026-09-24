# Restore Cuong's pi on another machine

Paste the block below into an agent (Claude Code or pi) on the new machine.

````text
Install my pi setup from https://github.com/cuong21951/pi-agent-config as an exact copy of my main PC. Fix errors yourself and back up anything you overwrite.
Install for my user only: no admin/sudo, nothing system-wide or for other users (winget `--scope user`, npm global prefix inside my profile, user PATH only).

1. Needs git, Node 24 (install it first so the setup script never calls `n`), Python 3.12, rtk 0.40.0 (github.com/rtk-ai/rtk releases, on my user PATH). Move any existing ~/.pi/agent aside.
2. `git clone https://github.com/cuong21951/pi-agent-config ~/.pi/agent`, then in bash `bash ~/.pi/agent/scripts/cloud-setup.sh` and `pi install git:github.com/badlogic/pi-skills`. Keep the pinned versions.
3. In settings.json replace `C:/Users/cuong/` with this home and drop paths that don't exist here.
4. Ask me for API keys and put them in auth.json; create mcp.json from mcp.example.json.
5. Add the `pi` wrapper from README.md "Running pi inside herdr" to the PowerShell $PROFILE and ~/.bashrc.
6. Check `pi --version` = 0.85.1 and that pi starts, then tell me what's left for me to do.
````
