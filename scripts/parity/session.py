import argparse, datetime, json, uuid

ap = argparse.ArgumentParser(description="Write a pi session jsonl from a compact JSON spec, for replay fixtures.")
ap.add_argument("spec", help='JSON file: {"cwd": ..., "turns": [{"prompt": ..., "steps": [{"assistant": [blocks], "results": [{"text": ..., "isError": false, "details": {}}], "stopReason": ..., "errorMessage": ...}], "done": {"verb": ..., "ms": ...}}]}')
ap.add_argument("out")
a = ap.parse_args()

spec = json.load(open(a.spec, encoding="utf-8"))
clock = datetime.datetime.fromisoformat(spec.get("start", "2026-09-23T07:00:00+00:00"))
lines = []
parent = None


def stamp(seconds):
    global clock
    clock += datetime.timedelta(seconds=seconds)
    return clock.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ms():
    return int(clock.timestamp() * 1000)


def entry(kind, gap, **fields):
    global parent
    record = {"type": kind, "id": uuid.uuid4().hex[:8], "parentId": parent, "timestamp": stamp(gap), **fields}
    lines.append(record)
    parent = record["id"]
    return record


lines.append({"type": "session", "version": 3, "id": str(uuid.uuid4()), "timestamp": stamp(0), "cwd": spec.get("cwd", "")})
entry("model_change", 1, provider="github-copilot", modelId="claude-haiku-4.5")
entry("thinking_level_change", 0, thinkingLevel="high")
usage = {"input": 1000, "output": 50, "cacheRead": 0, "cacheWrite": 0, "totalTokens": 1050, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "total": 0}}
for turn in spec["turns"]:
    if turn.get("at"):
        clock = datetime.datetime.fromisoformat(turn["at"])
    started = clock
    entry("message", turn.get("gap", 5), message={"role": "user", "content": [{"type": "text", "text": turn["prompt"]}], "timestamp": ms()})
    for step in turn["steps"]:
        blocks = []
        calls = []
        for block in step["assistant"]:
            if block["type"] == "toolCall":
                block = {"id": "toolu_" + uuid.uuid4().hex[:20], **block}
                calls.append(block)
            blocks.append(block)
        stop = step.get("stopReason", "toolUse" if calls else "stop")
        message = {"role": "assistant", "content": blocks, "api": "anthropic-messages", "provider": "github-copilot", "model": "claude-haiku-4.5", "usage": usage, "stopReason": stop, "timestamp": ms()}
        if step.get("errorMessage"):
            message["errorMessage"] = step["errorMessage"]
        entry("message", step.get("gap", 2), message=message)
        for call, result in zip(calls, step.get("results", [])):
            entry("message", result.get("gap", 0.05), message={"role": "toolResult", "toolCallId": call["id"], "toolName": call["name"], "content": [{"type": "text", "text": result.get("text", "")}], **({"details": result["details"]} if "details" in result else {}), "isError": result.get("isError", False), "timestamp": ms()})
    done = turn.get("done", {"verb": "Churning"})
    entry("custom", 0.01, customType="claude-working-done", data={"verb": done["verb"], "ms": done.get("ms", int((clock - started).total_seconds() * 1000)), "at": ms()})

with open(a.out, "w", encoding="utf-8", newline="\n") as f:
    for record in lines:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
print("wrote", a.out, len(lines), "entries")
