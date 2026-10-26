import { type BangMessage, backgroundNotice, commandRows } from "./bang.ts";
import type { Paint } from "./gutter.ts";

type Row = { render(width: number): string[]; invalidate(): void };
type Queues = { steering: string[]; followUp: string[] };
type Queued = { command: string; excluded: boolean };

export type Mode = {
	session: { isStreaming: boolean; agent: { state: { messages: Array<BangMessage & { role: string }> } }; _runAgentPrompt(messages: unknown[]): Promise<void> };
	editor: { getText(): string; setText(text: string): void };
	ui: { requestRender(): void };
	chatContainer: { children: object[] };
	pendingMessagesContainer: { children: Row[] };
	handleBashCommand(command: string, excluded?: boolean): Promise<void>;
	getAllQueuedMessages(): Queues;
	restoreQueuedMessagesToEditor(options?: { abort?: boolean; currentText?: string }): number;
	updatePendingMessagesDisplay(): void;
	showError(message: string): void;
	claudeBang?: { queue: Queued[]; paint: Paint; drain(): void };
};

const typed = (queued: Queued) => `${queued.excluded ? "!!" : "!"}${queued.command}`;

export function answers(last: (BangMessage & { role: string }) | undefined, excluded: boolean): boolean {
	return !excluded && last?.role === "bashExecution" && !last.cancelled && !backgroundNotice(last.output ?? "");
}

export function queuedRowIndexes(children: number, queued: number): number[] {
	const messages = (children - 1) / 2;
	return Array.from({ length: queued }, (_, i) => 2 * (messages - queued + i) + 1);
}

export function installBangMode(mode: Mode, paint: Paint): void {
	if (mode.claudeBang) {
		mode.claudeBang.paint = paint;
		return;
	}
	const run = mode.handleBashCommand.bind(mode);
	const queues = mode.getAllQueuedMessages.bind(mode);
	const restore = mode.restoreQueuedMessagesToEditor.bind(mode);
	const display = mode.updatePendingMessagesDisplay.bind(mode);
	const state = (mode.claudeBang = {
		queue: [] as Queued[],
		paint,
		drain() {
			const next = mode.session.isStreaming ? undefined : state.queue.shift();
			if (!next) return;
			mode.updatePendingMessagesDisplay();
			void mode.handleBashCommand(next.command, next.excluded);
		},
	});
	mode.handleBashCommand = async (command, excluded = false) => {
		if (mode.session.isStreaming) {
			state.queue.push({ command, excluded });
			mode.updatePendingMessagesDisplay();
			mode.ui.requestRender();
			return;
		}
		await run(command, excluded);
		if (!answers(mode.session.agent.state.messages.at(-1), excluded)) return state.drain();
		void mode.session._runAgentPrompt([]).catch((error: Error) => mode.showError(error.message));
	};
	mode.getAllQueuedMessages = () => {
		const all = queues();
		return { ...all, followUp: [...all.followUp, ...state.queue.map(typed)] };
	};
	mode.restoreQueuedMessagesToEditor = (options) => {
		const bangs = options?.abort ? [] : state.queue.splice(0).map(typed);
		const text = [...bangs, options?.currentText ?? mode.editor.getText()].filter((part) => part.trim()).join("\n");
		const restored = restore({ ...options, currentText: text });
		if (restored === 0 && bangs.length > 0) mode.editor.setText(text);
		return restored + bangs.length;
	};
	mode.updatePendingMessagesDisplay = () => {
		display();
		const rows = mode.pendingMessagesContainer.children;
		queuedRowIndexes(rows.length, state.queue.length).forEach((index, i) => {
			rows[index] = { render: (width) => commandRows(state.queue[i]?.command ?? "", width, state.paint), invalidate() {} };
		});
	};
}

if (process.env.CLAUDE_MESSAGES_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = (_role, text) => text;
	const bash = (fields: Partial<BangMessage> = {}) => ({ role: "bashExecution", command: "x", output: "hi", ...fields });
	check(answers(bash(), false) && !answers(bash(), true), "the model answers a finished ! command (Claude 2.1.289), not a !! one that pi keeps out of the context");
	check(!answers(bash({ cancelled: true }), false) && !answers(bash({ output: "tick\nCommand was manually backgrounded by user with ID: b2un8gk35. Output is being written to: /tmp/b2un8gk35.output." }), false) && !answers({ role: "user", command: "" }, false), "no turn for a cancelled command, or one moved to the background: that one is answered when it completes");
	check(queuedRowIndexes(5, 1).join() === "3" && queuedRowIndexes(7, 2).join() === "3,5", "queued ! commands are the last message rows of the pending block (spacer, row, …, hint)");

	const calls: string[] = [];
	const messages: Array<BangMessage & { role: string }> = [];
	let box = "";
	const row = (text: string): Row => ({ render: () => [text], invalidate() {} });
	const mode: Mode = {
		session: { isStreaming: true, agent: { state: { messages } }, _runAgentPrompt: async () => void calls.push("turn") },
		editor: { getText: () => box, setText: (text) => void (box = text) },
		ui: { requestRender() {} },
		chatContainer: { children: [] },
		pendingMessagesContainer: { children: [] },
		handleBashCommand: async (command) => void (calls.push(`run ${command}`), messages.push(bash({ command }))),
		getAllQueuedMessages: () => ({ steering: [], followUp: ["later"] }),
		restoreQueuedMessagesToEditor: () => 0,
		updatePendingMessagesDisplay() {
			mode.pendingMessagesContainer.children = mode.getAllQueuedMessages().followUp.flatMap((text) => [row(""), row(text)]).concat(row("hint"));
		},
		showError() {},
	};
	installBangMode(mode, plain);
	await mode.handleBashCommand("echo a");
	check(calls.length === 0 && mode.getAllQueuedMessages().followUp.join() === "later,!echo a", "a ! command sent while a turn runs waits in the queue like a prompt, it does not run");
	check(mode.pendingMessagesContainer.children[3].render(12)[0].includes("! echo a") && mode.pendingMessagesContainer.children[1].render(12)[0] === "later", "and its queued row is the ! row, not a prompt row");
	check(mode.restoreQueuedMessagesToEditor({ abort: true }) === 0 && mode.claudeBang!.queue.length === 1, "Esc leaves it queued: Claude interrupts and then runs it");
	check(mode.restoreQueuedMessagesToEditor() === 1 && box === "!echo a" && mode.claudeBang!.queue.length === 0, "Up puts it back in the box with its !");
	await mode.handleBashCommand("echo b");
	mode.session.isStreaming = false;
	mode.claudeBang!.drain();
	await new Promise((resolve) => setTimeout(resolve, 0));
	check(calls.join() === "run echo b,turn", "when the turn ends the queued command runs and the model answers it");
}
