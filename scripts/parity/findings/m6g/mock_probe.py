import os, re, sys

PARITY = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
source = open(os.path.join(PARITY, "mock.py"), encoding="utf-8").read()
hook = '        blocks = [dict(b, input=with_claude_task_id(b["input"], body)) if b.get("name") == "TaskStop" else b for b in blocks]\n'
assert hook in source
source = source.replace(hook, hook + '        blocks = [dict(b, input=first_agent_id(b["input"], body)) if b.get("name") in ("SendMessage", "TaskStop") else b for b in blocks]\n')
helper = r'''
AGENT_ID = re.compile(r"agentId: (\w+)")


def first_agent_id(args, body):
    found = AGENT_ID.findall(json.dumps(body.get("messages", []), ensure_ascii=False))
    return {k: (found[0] if found and v == "@FIRST" else v) for k, v in args.items()}

'''
source = source.replace("failures = {}\n", helper + "failures = {}\n", 1)
__file__ = os.path.join(PARITY, "mock.py")
exec(compile(source, __file__, "exec"))
