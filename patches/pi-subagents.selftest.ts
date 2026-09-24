import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PI_DIR } from "../scripts/pi-installs.mjs";

const { createJiti } = await import(
  pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href
);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js"),
    "@earendil-works/pi-tui": path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/index.js"),
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const { FleetList, fleetMainLine, fleetRowLine, fleetWindow, formatFleetElapsed, formatFleetTokens } = await jiti.import(
  path.join(here, "../npm/node_modules/@tintinweb/pi-subagents/src/ui/fleet-list.ts"),
);

const plain = { fg: (_role: string, text: string) => text, bold: (text: string) => text };
const tagged = { fg: (role: string, text: string) => `<${role}>${text}</>`, bold: (text: string) => `<b>${text}</b>` };
const DOWN = "\x1b[B";

{
  const row = { selected: false, viewed: false, name: "general-purpose", named: false, description: "Say ok", status: "3s" };
  const line = fleetRowLine(row, 15, 2, 132, plain);
  assert.equal(line, `  ◯ general-purpose  Say ok${" ".repeat(101)}3s`);
  assert.equal(line.length, 130);
  assert.equal(fleetRowLine(row, 15, 2, 132, tagged), `<muted>  </><muted>◯ </><muted>general-purpose</>  <muted>Say ok</>${" ".repeat(101)}<muted>3s</>`);
  assert.equal(fleetMainLine(false, true, 0, 132, tagged), "<b>  ● main</b>");
  console.log("PASS: a running agent row is Claude 2.1.280's measured \"  ◯ general-purpose  Say ok … 3s\": all dim 999999, elapsed right-aligned two columns in, under a bold \"  ● main\"");
}

{
  const selected = fleetRowLine({ selected: true, viewed: false, name: "Explore", named: false, description: "Find it", status: "1m 5s · ↓ 12.3k tokens" }, 7, 22, 80, tagged);
  assert.ok(selected.startsWith("❯ ◯ Explore  Find it") && !selected.includes("<muted>"));
  const failed = fleetRowLine({ selected: false, viewed: false, bulletRole: "error", name: "Explore", named: true, description: "Find it", status: "4s" }, 7, 2, 80, tagged);
  assert.ok(failed.startsWith("<muted>  </><error>◯ </>Explore  <muted>Find it</>"));
  assert.equal(fleetMainLine(true, false, 2, 40, plain), `❯ ◯ main${" ".repeat(22)}↑ 2 more`);
  console.log("PASS: selection is a ❯ pointer with the row undimmed; a failed agent's ◯ is red; a named agent's name is undimmed; hidden rows above read \"↑ N more\" on the main row (Claude's f4/p4 rows)");
}

{
  assert.deepEqual([0, 999, 59999, 60000, 119600, 3599700, 90061000].map(formatFleetElapsed), ["0s", "0s", "59s", "1m 0s", "2m 0s", "1h 0m 0s", "1d 1h 1m"]);
  assert.deepEqual([999, 1000, 67600, 1234567].map((count) => formatFleetTokens(count)), ["↓ 999 tokens", "↓ 1.0k tokens", "↓ 67.6k tokens", "↓ 1.2m tokens"]);
  assert.equal(formatFleetTokens(1200, "↑"), "↑ 1.2k tokens");
  assert.deepEqual([fleetWindow(0, 3), fleetWindow(7, 9), fleetWindow(2, 9)], [{ start: 0, end: 3 }, { start: 3, end: 8 }, { start: 0, end: 5 }]);
  console.log("PASS: elapsed is Claude's Gt (floored seconds under a minute, then rounded m/h/d), tokens are Ts compact lower-case, five rows shown around the focus");
}

{
  const now = Date.now();
  const record = (id: string, extra: Record<string, unknown>) => ({ id, type: "general-purpose", description: `agent ${id}`, toolUses: 0, startedAt: now - 3000, lifetimeUsage: { input: 0, output: 0, cacheWrite: 0 }, isBackground: true, status: "running", ...extra });
  const records = [
    record("run", {}),
    record("done", { status: "completed", completedAt: now - 1000 }),
    record("failed", { status: "error", completedAt: now - 1000 }),
    record("stale", { status: "error", completedAt: now - 31000 }),
    record("fgdone", { status: "error", completedAt: now - 1000, isBackground: false }),
    record("nested", { parentAgentId: "run" }),
  ];
  const aborted: string[] = [];
  const fleet = new FleetList({ listAgents: () => records, abort: (id: string) => aborted.push(id) } as never, new Map());
  let handler: (data: string) => { consume?: boolean } | undefined = () => undefined;
  fleet.setUICtx({ setWidget() {}, onTerminalInput: (h: typeof handler) => { handler = h; return () => {}; }, getEditorText: () => "", notify() {}, custom: async () => undefined } as never);
  const shown = fleet.lines(100, plain);
  assert.equal(shown.length, 4);
  assert.equal(shown[0], "");
  assert.equal(shown[1], "  ● main");
  assert.ok(shown[2].startsWith("  ◯ general-purpose  agent run") && shown[2].endsWith(" 3s"));
  assert.ok(shown[3].startsWith("  ◯ general-purpose  agent failed") && shown[3].endsWith(" 2s"));
  assert.equal(fleet.hint(plain), undefined);
  assert.deepEqual(handler(DOWN), { consume: true });
  assert.equal(fleet.hint(plain), "↑/↓ to select");
  assert.equal(fleet.lines(100, plain)[1], "❯ ● main");
  handler(DOWN);
  assert.equal(fleet.hint(plain), "Enter to view · x to stop");
  assert.ok(fleet.lines(100, plain)[2].startsWith("❯ ◯ general-purpose"));
  handler("x");
  assert.deepEqual(aborted, ["run"]);
  handler(DOWN);
  assert.equal(fleet.hint(plain), "Enter to view · x to clear");
  handler("x");
  assert.equal(fleet.lines(100, plain).length, 3);
  assert.equal(fleet.hint(plain), "Enter to view · x to stop");
  handler("\x1b");
  assert.equal(fleet.hint(plain), undefined);
  fleet.dispose();
  console.log("PASS: the list holds running agents and failed background ones for 30s, never completed or foreground-finished ones; ↓ focuses main with \"↑/↓ to select\" (Claude 2.1.281 dropped Enter to view on main), then \"Enter to view · x to stop|clear\"; x stops or clears; Esc leaves");
}
