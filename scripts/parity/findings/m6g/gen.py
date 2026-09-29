import datetime, json, os, sys, uuid

HERE = os.path.dirname(os.path.abspath(__file__))


SELECTED = sys.argv[1:]


def session(name, turns):
    if SELECTED and name not in SELECTED:
        return
    entries = [{"type": "session", "version": 3, "id": str(uuid.uuid4()), "timestamp": "2026-09-29T10:00:00.000Z", "cwd": HERE}]
    parent, clock = None, 1790650000000
    for prompt, replies in turns:
        steps = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        for reply in replies:
            pace = sum(r for r in reply if isinstance(r, int))
            reply = [r for r in reply if not isinstance(r, int)]
            content = [{"type": "text", "text": r} if isinstance(r, str) else {"type": "toolCall", "id": "toolu_" + uuid.uuid4().hex[:24], "name": r[0], "arguments": r[1]} for r in reply]
            steps.append({"role": "assistant", "content": content, "stopReason": "toolUse" if any(not isinstance(r, str) for r in reply) else "stop", "usage": {"input": 10, "output": 5}, "_pace": pace})
        for message in steps:
            clock += 200
            eid = uuid.uuid4().hex[:8]
            message["timestamp"] = clock
            done = clock + message.pop("_pace", 0)
            entries.append({"type": "message", "id": eid, "parentId": parent, "timestamp": datetime.datetime.fromtimestamp(done / 1000, datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"), "message": message})
            parent = eid
    with open(os.path.join(HERE, f"{name}.jsonl"), "w", encoding="utf-8", newline="\n") as f:
        for e in entries:
            f.write(json.dumps(e) + "\n")


session("fg", [
    ("M6G foreground run.", [[("Agent", {"description": "List files", "subagent_type": "general-purpose", "prompt": "M6G-SUB-FG: run ls, then reply with the word fgreport.", "run_in_background": False})], ["fgdone"]]),
    ("M6G-SUB-FG: run ls, then reply with the word fgreport.", [[("bash", {"command": "ls", "description": "List files"})], ["fgreport"]]),
])
session("bg", [
    ("M6G background run.", [[("Agent", {"description": "Sleep briefly", "subagent_type": "general-purpose", "name": "sleeper", "prompt": "M6G-SUB-BG: run sleep 4, then reply with the word bgreport.", "run_in_background": True})], ["started"], [("SendMessage", {"to": "@FIRST", "message": "M6G-SUB-SM: reply with the word smreport.", "summary": "ask again"})], ["asked"], ["smdone"]]),
    ("M6G-SUB-BG: run sleep 4, then reply with the word bgreport.", [[("bash", {"command": "sleep 4", "description": "Sleep"})], ["bgreport"], ["smreport"]]),
])
session("types", [
    ("M6G types run.", [[("Agent", {"description": "Explore", "subagent_type": "Explore", "prompt": "M6G-SUB-EX: reply with the word exreport."}), ("Agent", {"description": "Plan", "subagent_type": "Plan", "prompt": "M6G-SUB-PL: reply with the word plreport."}), ("Agent", {"description": "Custom", "subagent_type": "m6g-custom", "prompt": "M6G-SUB-CU: reply with the word cureport."})], ["typesdone"]]),
    ("M6G-SUB-EX: reply with the word exreport.", [["exreport"]]),
    ("M6G-SUB-PL: reply with the word plreport.", [["plreport"]]),
    ("M6G-SUB-CU: reply with the word cureport.", [["cureport"]]),
])
session("stop", [
    ("M6G stop run.", [[("Agent", {"description": "Long sleeper", "subagent_type": "general-purpose", "prompt": "M6G-SUB-ST: run the long timer, then reply with the word streport."})], [("ListAgents", {})], [("TaskStop", {"task_id": "@FIRST"})], ["stopped"], ["afterstop"]]),
    ("M6G-SUB-ST: run the long timer, then reply with the word streport.", [[("bash", {"command": "python -c 'import time; time.sleep(40)'", "description": "Long timer"})], ["streport"]]),
])
session("clear", [
    ("M6G clear run.", [[("Agent", {"description": "Clear sleeper", "subagent_type": "general-purpose", "prompt": "M6G-SUB-CL: run the long timer, then reply with the word clreport."})], ["started"], ["late"]]),
    ("M6G-SUB-CL: run the long timer, then reply with the word clreport.", [[("bash", {"command": "python -c 'import time; time.sleep(25)'", "description": "Long timer"})], ["clreport"]]),
])
session("notify", [
    ("M6G notify run.", [[("Agent", {"description": "Sleep briefly", "subagent_type": "general-purpose", "prompt": "M6G-SUB-NO: run sleep 2, then reply with the word noreport."})], ["started"], ["notified"]]),
    ("M6G-SUB-NO: run sleep 2, then reply with the word noreport.", [[("bash", {"command": "sleep 2", "description": "Sleep"})], ["noreport"]]),
])
session("types2", [
    ("M6G types2 run.", [[("Agent", {"description": "Explore", "subagent_type": "Explore", "prompt": "M6G-SUB-EX2: reply with the word exreport."})], [("Agent", {"description": "Plan", "subagent_type": "Plan", "prompt": "M6G-SUB-PL2: reply with the word plreport."})], [("Agent", {"description": "Custom", "subagent_type": "m6g-custom", "prompt": "M6G-SUB-CU2: reply with the word cureport."})], ["typesdone"], ["exseen"], ["plseen"], ["cuseen"]]),
    ("M6G-SUB-EX2: reply with the word exreport.", [["exreport", 2000]]),
    ("M6G-SUB-PL2: reply with the word plreport.", [["plreport", 5000]]),
    ("M6G-SUB-CU2: reply with the word cureport.", [["cureport", 8000]]),
])
session("sendrun", [
    ("M6G sendrun run.", [[("Agent", {"description": "Long sleeper", "subagent_type": "general-purpose", "prompt": "M6G-SUB-SR: run the long timer, then reply with the word srreport."})], [("ListAgents", {})], [("SendMessage", {"to": "@FIRST", "message": "M6G-SUB-SM2: also reply with the word smreport.", "summary": "ask more"})], ["asked"], ["srdone"]]),
    ("M6G-SUB-SR: run the long timer, then reply with the word srreport.", [[("bash", {"command": "python -c 'import time; time.sleep(12)'", "description": "Long timer"})], ["srreport"]]),
])
session("cap", [
    ("M6G cap run.", [[("Agent", {"description": "First sleeper", "subagent_type": "general-purpose", "prompt": "M6G-SUB-CA: run the timer, then reply with the word careport."}), ("Agent", {"description": "Second sleeper", "subagent_type": "general-purpose", "prompt": "M6G-SUB-CB: reply with the word cbreport."})], ["capped"], ["capdone"]]),
    ("M6G-SUB-CA: run the timer, then reply with the word careport.", [[("bash", {"command": "python -c 'import time; time.sleep(4)'", "description": "Timer"})], ["careport"]]),
])
session("fork", [
    ("M6G fork run.", [[("Agent", {"description": "Fork check", "subagent_type": "fork", "prompt": "M6G-SUB-FK: reply with the word fkreport."})], ["started"], ["forkdone"]]),
    ("M6G-SUB-FK: reply with the word fkreport.", [["fkreport", 1500]]),
])
session("nest", [
    ("M6G nest run.", [[("Agent", {"description": "Nest parent", "subagent_type": "general-purpose", "prompt": "M6G-SUB-NE: launch one agent, then reply with the word nereport."})], ["started", 3000], ["nested"]]),
    ("M6G-SUB-NE: launch one agent, then reply with the word nereport.", [[("Agent", {"description": "Nest child", "subagent_type": "general-purpose", "prompt": "M6G-SUB-NF: reply with the word nfreport."})], ["newait"], ["nereport"]]),
    ("M6G-SUB-NF: reply with the word nfreport.", [["nfreport", 6000]]),
])
session("fable", [
    ("M6G fable run.", [[("Agent", {"description": "Explore", "subagent_type": "Explore", "prompt": "M6G-SUB-FE: reply with the word fereport."})], [("Agent", {"description": "Plan", "subagent_type": "Plan", "prompt": "M6G-SUB-FP: reply with the word fpreport."})], [("Agent", {"description": "General", "subagent_type": "general-purpose", "prompt": "M6G-SUB-FG: reply with the word fgreport."})], ["fabledone"], ["feseen"], ["fpseen"], ["fgseen"]]),
    ("M6G-SUB-FE: reply with the word fereport.", [["fereport", 2000]]),
    ("M6G-SUB-FP: reply with the word fpreport.", [["fpreport", 5000]]),
    ("M6G-SUB-FG: reply with the word fgreport.", [["fgreport", 8000]]),
])
