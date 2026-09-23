import argparse, datetime, json, os, re, threading, time, uuid
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

ap = argparse.ArgumentParser(description="Fake Anthropic Messages endpoint that replays a pi session's replies to Claude Code.")
ap.add_argument("--session", required=True, help="pi session jsonl whose assistant replies are served")
ap.add_argument("--workdir", required=True, help="Claude Code's working directory, for absolute file paths")
ap.add_argument("--port", type=int, required=True)
ap.add_argument("--log", default=None)
ap.add_argument("--context-tokens", type=int, default=None, help="input tokens reported on every reply")
ap.add_argument("--no-pace", action="store_true", help="stream at once instead of taking as long as pi's reply took")
ap.add_argument("--dump", default=None, help="write every main-loop request body to <dump>-<n>.json")
a = ap.parse_args()

LOG = open(a.log, "a", encoding="utf-8") if a.log else None
PACE_CAP_MS = 180_000


def log(record):
    if LOG:
        LOG.write(json.dumps(record, ensure_ascii=False) + "\n")
        LOG.flush()


def iso_ms(text):
    return int(datetime.datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp() * 1000)


def leaf_path(entries):
    by_id = {e["id"]: e for e in entries if e.get("id")}
    leaf = next((e for e in reversed(entries) if e.get("type") == "message"), None)
    path = []
    while leaf:
        path.append(leaf)
        leaf = by_id.get(leaf.get("parentId"))
    return list(reversed(path))


def text_of(message):
    content = message.get("content")
    if isinstance(content, str):
        return content
    return "".join(c.get("text", "") for c in content or [] if c.get("type") == "text")


def load_turns(path):
    entries = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    turns = []
    for entry in leaf_path(entries):
        if entry.get("type") != "message":
            continue
        message = dict(entry["message"])
        if message.get("timestamp") and entry.get("timestamp"):
            message["_duration_ms"] = max(0, iso_ms(entry["timestamp"]) - message["timestamp"])
        if message.get("role") == "user":
            turns.append({"prompt": text_of(message).strip(), "replies": [], "pending_errors": []})
        elif message.get("role") == "assistant" and turns:
            turn = turns[-1]
            if message.get("stopReason") == "error":
                turn["pending_errors"].append(message)
            else:
                turn["replies"].append({"message": message, "errors": turn["pending_errors"]})
                turn["pending_errors"] = []
    for turn in turns:
        if turn["pending_errors"]:
            turn["replies"].append({"message": None, "errors": turn["pending_errors"]})
    return turns


def load_searches(path):
    entries = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    calls, searches = {}, []
    for entry in leaf_path(entries):
        message = entry.get("message") or {}
        for block in message.get("content") or [] if isinstance(message.get("content"), list) else []:
            if block.get("type") == "toolCall" and block.get("name") == "web_search":
                calls[block["id"]] = block.get("arguments") or {}
        if message.get("role") == "toolResult" and message.get("toolName") == "web_search":
            details = message.get("details") or {}
            query = calls.get(message.get("toolCallId"), {}).get("query", "")
            searches.append({"query": query, "sources": details.get("sources") or [], "ms": details.get("durationMs", 1000)})
    return searches


def load_subagent_wait(path):
    entries = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    durations = [e["data"]["completedAt"] - e["data"]["startedAt"] for e in entries
                 if e.get("type") == "custom" and e.get("customType") == "subagents:record"
                 and e.get("data", {}).get("startedAt") and e.get("data", {}).get("completedAt")]
    return min(max(durations), PACE_CAP_MS) / 1000 if durations else 0


TURNS = load_turns(a.session)
SEARCHES = load_searches(a.session)
SUBAGENT_WAIT_S = load_subagent_wait(a.session)


def search_for(body):
    asked = json.dumps(body.get("messages", [])[-1:], ensure_ascii=False)
    return next((s for s in SEARCHES if s["query"] and s["query"] in asked), SEARCHES[0] if SEARCHES else {"query": "", "sources": [], "ms": 500})


def absolute(path):
    return path if os.path.isabs(path) else os.path.normpath(os.path.join(a.workdir, path))


def compact(d):
    return {k: v for k, v in d.items() if v is not None}


PLAN_FILE = re.compile(r"(?:create your plan at|already exists at|Read-only except plan file \()\s*(\S+?\.md)")


def plan_file_of(body):
    for message in reversed(body.get("messages", [])):
        content = message.get("content")
        texts = [content] if isinstance(content, str) else [c.get("text", "") for c in content or [] if c.get("type") == "text"]
        for text in texts:
            found = PLAN_FILE.search(text)
            if found:
                return found.group(1)
    return None


def is_plan_file(path):
    return os.path.basename(os.path.dirname(path.replace("\\", "/"))) == "plans" and path.endswith(".md")


def plan_or_absolute(path, plan_file):
    return plan_file if plan_file and is_plan_file(path) else absolute(path)


def to_claude(name, args, claude_tools, plan_file=None):
    if name == "exit_plan_mode":
        return [("ExitPlanMode", {})]
    if name == "enter_plan_mode":
        return [("EnterPlanMode", {})]
    if name == "read":
        return [("Read", compact({"file_path": absolute(args["path"]), "offset": args.get("offset"), "limit": args.get("limit")}))]
    if name == "grep":
        return [("Grep", compact({"pattern": args["pattern"], "path": args.get("path"), "glob": args.get("glob"), "-i": args.get("ignoreCase"), "-C": args.get("context"), "head_limit": args.get("limit"), "output_mode": "content", "-n": True}))]
    if name == "find":
        return [("Glob", compact({"pattern": args["pattern"], "path": args.get("path")}))]
    if name == "ls":
        target = args.get("path") or "."
        return [("Bash", {"command": f"ls {target}", "description": f"List {target}"})]
    if name == "bash":
        timeout = args.get("timeout")
        return [("Bash", compact({"command": args["command"], "description": args.get("description"), "timeout": timeout * 1000 if timeout else None}))]
    if name == "edit":
        return [("Edit", {"file_path": plan_or_absolute(args["path"], plan_file), "old_string": e["oldText"], "new_string": e["newText"]}) for e in args.get("edits", [])]
    if name == "write":
        return [("Write", {"file_path": plan_or_absolute(args["path"], plan_file), "content": args["content"]})]
    if name == "skill":
        return [("Skill", {"skill": args["name"]})]
    if name == "Agent":
        return [("Agent", compact({"description": args.get("description"), "prompt": args.get("prompt"), "subagent_type": args.get("subagent_type")}))]
    if name == "ask_user_question":
        return [("AskUserQuestion", {"questions": args.get("questions", [])})]
    if name == "web_search":
        return [("WebSearch", {"query": args.get("query") or (args.get("queries") or [""])[0]})]
    if name == "fetch_content":
        return [("WebFetch", {"url": args.get("url") or (args.get("urls") or [""])[0], "prompt": args.get("prompt") or "Summarize the page."})]
    if name == "mcp" and args.get("tool"):
        name, args = args["tool"], args.get("args") or {}
    for tool in claude_tools:
        if tool.startswith("mcp__"):
            _, server, short = tool.split("__", 2)
            if name in (f"{server}_{short}", f"{server.replace('-', '_')}_{short}", short):
                return [(tool, args if isinstance(args, dict) else {})]
    return [(name, args)]


def blocks_for_claude(reply, claude_tools, plan_file=None):
    blocks = []
    for c in reply.get("content", []):
        if c["type"] == "thinking" and c.get("thinking"):
            blocks.append({"type": "thinking", "thinking": c["thinking"], "signature": "mock-signature"})
        elif c["type"] == "text" and c.get("text"):
            blocks.append({"type": "text", "text": c["text"]})
        elif c["type"] == "toolCall":
            for name, args in to_claude(c["name"], c.get("arguments") or {}, claude_tools, plan_file):
                blocks.append({"type": "tool_use", "id": "toolu_" + uuid.uuid4().hex[:24], "name": name, "input": args})
    return blocks


def user_prompt(message):
    content = message.get("content")
    if isinstance(content, str):
        return content
    if any(c.get("type") == "tool_result" for c in content):
        return None
    return "".join(c.get("text", "") for c in content if c.get("type") == "text")


def locate(messages):
    for i in range(len(messages) - 1, -1, -1):
        m = messages[i]
        if m.get("role") != "user":
            continue
        prompt = user_prompt(m)
        if prompt is None:
            continue
        for turn in TURNS:
            if turn["prompt"] and turn["prompt"] in prompt:
                step = sum(1 for x in messages[i + 1:] if x.get("role") == "assistant")
                return turn, step
    return None, 0


def chunks(text, size=24):
    return [text[i:i + size] for i in range(0, len(text), size)] or [""]


def event_count(blocks):
    return 2 + sum(3 + len(chunks(b.get("text") or b.get("thinking") or "")) for b in blocks)


failures = {}
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    gap = 0.01

    def log_message(self, *args):
        pass

    def send_json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.send_json(404, {"type": "error", "error": {"type": "not_found_error", "message": "not found"}})

    def do_POST(self):
        try:
            self.answer()
        except (ConnectionError, BrokenPipeError):
            pass

    def answer(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if "count_tokens" in self.path:
            return self.send_json(200, {"input_tokens": a.context_tokens or 1000})
        tools = [t.get("name") for t in body.get("tools", [])]
        if "web_search" in tools and "Read" not in tools:
            found = search_for(body)
            log({"kind": "search", "query": found["query"], "sources": len(found["sources"])})
            time.sleep(min(found["ms"], PACE_CAP_MS) / 1000)
            tool_id = "srvtoolu_" + uuid.uuid4().hex[:20]
            results = [{"type": "web_search_result", "url": r.get("url", ""), "title": r.get("title", ""), "encrypted_content": "parity", "page_age": r.get("pageAge")} for r in found["sources"]]
            return self.stream(body, [{"type": "server_tool_use", "id": tool_id, "name": "web_search", "input": {"query": found["query"]}},
                                      {"type": "web_search_tool_result", "tool_use_id": tool_id, "content": results},
                                      {"type": "text", "text": "Search results above."}], "end_turn")
        if "Read" not in tools:
            log({"kind": "side", "tools": tools[:8]})
            return self.stream(body, [{"type": "text", "text": "OK"}], "end_turn")
        if a.dump:
            with lock:
                failures["dumped"] = failures.get("dumped", 0) + 1
                json.dump(body, open(f"{a.dump}-{failures['dumped']}.json", "w", encoding="utf-8"), indent=1)
        if "[SUGGESTION MODE:" in json.dumps((body.get("messages") or [{}])[-1].get("content"), ensure_ascii=False):
            log({"kind": "suggestion"})
            return self.stream(body, [{"type": "text", "text": ""}], "end_turn")
        turn, step = locate(body.get("messages", []))
        if not turn or step >= len(turn["replies"]):
            last = (body.get("messages") or [{}])[-1]
            log({"kind": "unscripted", "step": step, "prompt": turn and turn["prompt"][:60], "last": json.dumps(last.get("content"), ensure_ascii=False)[:300]})
            if not turn:
                time.sleep(SUBAGENT_WAIT_S)
            return self.stream(body, [{"type": "text", "text": "" if turn else "ok"}], "end_turn")
        entry = turn["replies"][step]
        key = (turn["prompt"], step)
        with lock:
            served = failures.get(key, 0)
            failures[key] = served + 1
        if entry["message"] is None:
            error = entry["errors"][-1]
            log({"kind": "final-error", "step": step, "message": error.get("errorMessage")})
            self.pace_error(error)
            status, _, text = (error.get("errorMessage") or "Bad request").partition(" ")
            status, text = (int(status), text) if status.isdigit() else (400, error.get("errorMessage") or "Bad request")
            return self.send_json(status, {"type": "error", "error": {"type": "invalid_request_error", "message": text}})
        if served < len(entry["errors"]):
            error = entry["errors"][served]
            log({"kind": "error", "step": step, "message": error.get("errorMessage")})
            self.pace_error(error)
            return self.send_json(529, {"type": "error", "error": {"type": "overloaded_error", "message": error.get("errorMessage") or "Overloaded"}})
        reply = entry["message"]
        blocks = blocks_for_claude(reply, tools, plan_file_of(body)) or [{"type": "text", "text": ""}]
        log({"kind": "reply", "step": step, "blocks": [b["type"] + (":" + b["name"] if b["type"] == "tool_use" else "") for b in blocks]})
        pace = 0 if a.no_pace else min(reply.get("_duration_ms", 0), PACE_CAP_MS) / 1000
        time.sleep(pace * 0.3)
        self.gap = max(0.01, pace * 0.7 / event_count(blocks))
        stop = "tool_use" if any(b["type"] == "tool_use" for b in blocks) else "end_turn"
        self.stream(body, blocks, stop, reply.get("usage"), hang=reply.get("stopReason") == "aborted")

    def pace_error(self, error):
        time.sleep(0 if a.no_pace else min(error.get("_duration_ms", 0), PACE_CAP_MS) / 1000)

    def stream(self, body, blocks, stop, usage=None, hang=False):
        usage = usage or {}
        input_tokens = a.context_tokens if a.context_tokens is not None else usage.get("input", 10)
        output_tokens = usage.get("output", 5)
        message = {"id": "msg_" + uuid.uuid4().hex[:24], "type": "message", "role": "assistant", "model": body.get("model"), "content": [],
                   "stop_reason": None, "stop_sequence": None,
                   "usage": {"input_tokens": input_tokens, "output_tokens": 1, "cache_read_input_tokens": usage.get("cacheRead", 0), "cache_creation_input_tokens": usage.get("cacheWrite", 0)}}
        if not body.get("stream"):
            final = dict(message, content=blocks, stop_reason=stop)
            final["usage"]["output_tokens"] = output_tokens
            return self.send_json(200, final)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.event("message_start", {"type": "message_start", "message": message})
        for index, block in enumerate(blocks):
            if block["type"] == "text":
                self.event("content_block_start", {"type": "content_block_start", "index": index, "content_block": {"type": "text", "text": ""}})
                for chunk in chunks(block["text"]):
                    self.event("content_block_delta", {"type": "content_block_delta", "index": index, "delta": {"type": "text_delta", "text": chunk}})
            elif block["type"] == "thinking":
                self.event("content_block_start", {"type": "content_block_start", "index": index, "content_block": {"type": "thinking", "thinking": "", "signature": ""}})
                for chunk in chunks(block["thinking"]):
                    self.event("content_block_delta", {"type": "content_block_delta", "index": index, "delta": {"type": "thinking_delta", "thinking": chunk}})
                self.event("content_block_delta", {"type": "content_block_delta", "index": index, "delta": {"type": "signature_delta", "signature": block["signature"]}})
            elif block["type"] == "server_tool_use":
                self.event("content_block_start", {"type": "content_block_start", "index": index, "content_block": {"type": "server_tool_use", "id": block["id"], "name": block["name"], "input": {}}})
                self.event("content_block_delta", {"type": "content_block_delta", "index": index, "delta": {"type": "input_json_delta", "partial_json": json.dumps(block["input"])}})
            elif block["type"] == "web_search_tool_result":
                self.event("content_block_start", {"type": "content_block_start", "index": index, "content_block": block})
            elif block["type"] == "tool_use":
                self.event("content_block_start", {"type": "content_block_start", "index": index, "content_block": {"type": "tool_use", "id": block["id"], "name": block["name"], "input": {}}})
                self.event("content_block_delta", {"type": "content_block_delta", "index": index, "delta": {"type": "input_json_delta", "partial_json": json.dumps(block["input"])}})
            if hang and index == len(blocks) - 1:
                while True:
                    time.sleep(1)
                    self.event("ping", {"type": "ping"})
            self.event("content_block_stop", {"type": "content_block_stop", "index": index})
        self.event("message_delta", {"type": "message_delta", "delta": {"stop_reason": stop, "stop_sequence": None}, "usage": {"output_tokens": output_tokens}})
        self.event("message_stop", {"type": "message_stop"})
        self.close_connection = True

    def event(self, name, payload):
        self.wfile.write(f"event: {name}\ndata: {json.dumps(payload)}\n\n".encode())
        self.wfile.flush()
        time.sleep(self.gap)


log({"kind": "start", "turns": [{"prompt": t["prompt"][:60], "replies": len(t["replies"])} for t in TURNS]})
ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()
