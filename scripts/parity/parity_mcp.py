import json, sys

TOOLS = [
    {"name": "lookup", "description": "Look up the value stored under a key.", "inputSchema": {"type": "object", "properties": {"key": {"type": "string"}}, "required": ["key"]}},
    {"name": "explode", "description": "Always fails.", "inputSchema": {"type": "object", "properties": {}}},
]
VALUES = {"alpha": "1", "beta": "2", "gamma": "3"}


def call(name, args):
    if name == "lookup":
        key = args.get("key", "")
        return {"content": [{"type": "text", "text": f"{key} = {VALUES.get(key, 'missing')}"}]}
    return {"content": [{"type": "text", "text": "explode failed: the parity server refuses this call"}], "isError": True}


def answer(request):
    method, params = request.get("method"), request.get("params") or {}
    if method == "initialize":
        return {"protocolVersion": params.get("protocolVersion", "2025-06-18"), "capabilities": {"tools": {}}, "serverInfo": {"name": "parity", "version": "1.0.0"}}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        return call(params.get("name"), params.get("arguments") or {})
    if method in ("resources/list", "prompts/list"):
        return {method.split("/")[0]: []}
    return None


for line in sys.stdin:
    if not line.strip():
        continue
    request = json.loads(line)
    if "id" not in request:
        continue
    result = answer(request)
    reply = {"jsonrpc": "2.0", "id": request["id"]}
    reply.update({"result": result} if result is not None else {"error": {"code": -32601, "message": f"unknown method {request.get('method')}"}})
    sys.stdout.write(json.dumps(reply) + "\n")
    sys.stdout.flush()
