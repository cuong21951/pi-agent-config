import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type Seen = { assistant: boolean; text: boolean };
type ScrollView = { isFollowingEnd: boolean; scrollTop: number };
type Box = { clip: { y: number }; scrollContentLines?: string[] };
type Theme = { fg(role: never, text: string): string; bg(role: never, text: string): string };

const ZONE = /^(?:\x1b\]133;[ABC](?:\x07|\x1b\\))+/;
const CONTROL = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-z]/g;
const POINTER = "❯";
const GUTTER = 2;
const PROMPT_CHARS = 500;
const BOTTOM_KEY = "ctrl+End";

const zone = (line: string) => ZONE.exec(line)?.[0] ?? "";
const plain = (line: string) => line.replace(CONTROL, "");
const promptStart = (line: string) => zone(line).includes("133;A") && plain(line).startsWith(`${POINTER} `);

export function promptText(lines: readonly string[], row: number): string {
	const rows: string[] = [];
	for (let i = row; i < lines.length; i++) {
		rows.push(plain(lines[i]).slice(GUTTER).trimEnd());
		if (zone(lines[i]).includes("133;B")) break;
	}
	const text = rows.join("\n").trimStart();
	const paragraphEnd = text.search(/\n\s*\n/);
	return (paragraphEnd >= 0 ? text.slice(0, paragraphEnd) : text).slice(0, PROMPT_CHARS).replace(/\s+/g, " ").trim();
}

export function stickyPrompt(lines: readonly string[], scrollTop: number, shown = false): string | undefined {
	for (let row = Math.min(scrollTop - (shown ? 0 : 1), lines.length - 1); row >= 0; row--) {
		if (!promptStart(lines[row])) continue;
		const text = promptText(lines, row);
		if (text && !text.startsWith("/")) return text;
	}
	return undefined;
}

export function newMessageRuns(messages: readonly Seen[], from: number): number {
	let runs = 0;
	let inRun = false;
	for (const message of messages.slice(from)) {
		if (message.assistant && !message.text) continue;
		if (message.assistant && !inRun) runs++;
		inRun = message.assistant;
	}
	return messages.length > from ? Math.max(1, runs) : 0;
}

export function pillLabel(count: number, columns: number): string {
	const label = count > 0 ? `${count} new ${count === 1 ? "message" : "messages"}` : "Jump to bottom";
	return [`${label} (${BOTTOM_KEY}) ↓`, `${label} ↓`].find((text) => visibleWidth(text) <= columns - 2) ?? label;
}

export default function (pi: ExtensionAPI) {
	const seen: Seen[] = [];
	let away: number | undefined;
	let shown = false;
	pi.on("message_start", (event) => {
		if (event.message.role === "user") (globalThis as { __claudeViewport?: { transcript: { scrollToEnd(): void } } }).__claudeViewport?.transcript.scrollToEnd();
	});
	pi.on("message_end", (event) => {
		const content = event.message.content;
		const text = typeof content === "string" ? content.trim() !== "" : content.some((part) => part.type === "text" && part.text.trim() !== "");
		seen.push({ assistant: event.message.role === "assistant", text });
	});
	pi.on("session_start", (_event, ctx) => {
		seen.length = 0;
		away = undefined;
		if (!ctx.hasUI) return;
		const theme = ctx.ui.theme as unknown as Theme;
		const hooks = globalThis as Record<string, unknown>;
		hooks.__claudeStickyPrompt = (screen: string[], scrollView: ScrollView, box: Box | undefined, width: number) => {
			if (scrollView.isFollowingEnd) {
				away = undefined;
				shown = false;
				return screen;
			}
			away ??= seen.length;
			const text = box?.scrollContentLines && stickyPrompt(box.scrollContentLines, scrollView.scrollTop, shown);
			shown = Boolean(box && text);
			if (!box || !text) return screen;
			const row = plain(truncateToWidth(`${POINTER} ${text}`, width - 1, "…"));
			const result = [...screen];
			result[box.clip.y] = theme.bg("userMessageBg" as never, theme.fg("dim" as never, row) + " ".repeat(Math.max(0, width - visibleWidth(row))));
			return result;
		};
		hooks.__claudeScrollPill = (columns: number) =>
			theme.bg("userMessageBg" as never, theme.fg("text" as never, ` ${pillLabel(newMessageRuns(seen, away ?? seen.length), columns)} `));
	});
}

if (process.env.CLAUDE_SCROLL_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const A = "\x1b]133;A\x07";
	const END = "\x1b]133;B\x07\x1b]133;C\x07";
	const bg = (text: string) => `\x1b[48;2;55;55;55m${text}\x1b[49m`;
	const lines = [
		"",
		`${END}${A}${bg("\x1b[38;2;80;80;80m❯\x1b[39m /new                ")}`,
		"",
		`${A}${bg("\x1b[38;2;80;80;80m❯\x1b[39m Show the markdown    ")}`,
		`${END}${bg("  sample.              ")}`,
		"",
		`${A}● Markdown Sample`,
		"",
		`${END}  A paragraph`,
		`${A}${bg("❯ first paragraph      ")}`,
		bg("                       "),
		`${END}${bg("  second paragraph     ")}`,
	];
	check(stickyPrompt(lines, 3) === undefined, "a prompt whose first row is still the top viewport row gets no sticky row; the slash-command row above it never does (Claude skips text starting with '<', which is how it stores /clear)");
	check(stickyPrompt(lines, 4) === "Show the markdown sample.", "one row past the prompt's first row the sticky row shows it, wrapped rows joined by one space (Claude 2.1.283, measured 2026-10-02: prompt on row 8, shown from scroll offset 9)");
	check(stickyPrompt(lines, 3, true) === "Show the markdown sample." && stickyPrompt(lines, 2, true) === undefined, "scrolling back up, a sticky row already shown stays over the prompt's own first row and goes one row later (Claude 2.1.283, measured 2026-10-02: the dim copy sits on the prompt row)");
	check(stickyPrompt(lines, 9) === "Show the markdown sample.", "an assistant block's zone start is not a prompt");
	check(stickyPrompt(lines, 12) === "first paragraph", "only the prompt's first paragraph is shown");
	check(promptText([`${END}${A}❯ ${"x".repeat(600)}`], 0).length === 500, "500 characters at most");
	const user = { assistant: false, text: true };
	const reply = { assistant: true, text: true };
	const toolCall = { assistant: true, text: false };
	check(newMessageRuns([user, reply], 2) === 0, "nothing new since the view left the bottom");
	check(newMessageRuns([user, reply, reply, toolCall, reply], 1) === 1, "consecutive replies are one run; a reply without text is skipped");
	check(newMessageRuns([reply, user, reply, user, reply], 0) === 3, "a message that is not a reply ends the run");
	check(newMessageRuns([user, toolCall, user], 1) === 1, "anything unseen counts as at least one");
	check(pillLabel(0, 132) === "Jump to bottom (ctrl+End) ↓" && pillLabel(2, 132) === "2 new messages (ctrl+End) ↓" && pillLabel(1, 132) === "1 new message (ctrl+End) ↓", "the full label names the key");
	check(pillLabel(0, 28) === "Jump to bottom ↓" && pillLabel(0, 17) === "Jump to bottom", "narrower panes drop the key, then the arrow (first variant no wider than columns - 2)");
	console.log("\nAll claude-scroll checks passed.");
}
