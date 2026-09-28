import datetime, json, os, sys, uuid

HERE = os.path.dirname(os.path.abspath(__file__))


def session(name, turns):
    entries = [{"type": "session", "version": 3, "id": str(uuid.uuid4()), "timestamp": "2026-09-29T10:00:00.000Z", "cwd": HERE}]
    parent, clock = None, 1790650000000
    for prompt, replies in turns:
        steps = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        for reply in replies:
            content = [{"type": "text", "text": r} if isinstance(r, str) else {"type": "toolCall", "id": "toolu_" + uuid.uuid4().hex[:24], "name": r[0], "arguments": r[1]} for r in reply]
            steps.append({"role": "assistant", "content": content, "stopReason": "toolUse" if any(not isinstance(r, str) for r in reply) else "stop", "usage": {"input": 10, "output": 5}})
        for message in steps:
            clock += 200
            eid = uuid.uuid4().hex[:8]
            message["timestamp"] = clock
            entries.append({"type": "message", "id": eid, "parentId": parent, "timestamp": datetime.datetime.fromtimestamp(clock / 1000, datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"), "message": message})
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
