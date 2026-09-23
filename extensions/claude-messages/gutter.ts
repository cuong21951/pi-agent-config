export type Paint = (role: string, text: string) => string;
type Block = { render(width: number): string[]; invalidate(): void };
type Parent = { children: Block[]; invalidate(): void; paddingX?: number; paddingY?: number };
type Methods = Record<string | symbol, unknown>;

const WIDTH = 2;
const INDENT = " ".repeat(WIDTH);
const ERROR_RESERVE = 8;
const PROMPT_RESERVE = 3;

const shared = ((globalThis as any)[Symbol.for("claude-messages:gutter")] ??= {
	patched: false,
	paint: ((_role, text) => text) as Paint,
}) as { patched: boolean; paint: Paint; awaiting?: boolean; latest?: object; seen?: WeakSet<object> };
const seen = (shared.seen ??= new WeakSet<object>());
const FOREGROUND = /\x1b\[(?:3[0-7]|9[0-7]|38;5;\d+|38;2;\d+;\d+;\d+|39)m/g;

export function setPaint(paint: Paint): void {
	shared.paint = paint;
}

export function setAwaiting(awaiting: boolean): void {
	shared.awaiting = awaiting;
}

export function awaitingLine(line: string): string {
	const sample = shared.paint("muted", "\u0000");
	const muted = sample.slice(0, sample.indexOf("\u0000"));
	return muted + line.replace(FOREGROUND, muted);
}

export function hang(lines: string[], mark: string): string[] {
	return lines.map((line, i) => (i === 0 ? mark : INDENT) + line);
}

function marked(block: Block, mark: () => string, reserve = WIDTH): Block {
	return {
		render: (width) => hang(block.render(Math.max(1, width - reserve)), mark()),
		invalidate: () => block.invalidate(),
	};
}

const userMark = () => `${shared.paint("dim", "❯")} `;
const assistantMark = () => `${shared.paint("text", "●")} `;
const errorMark = () => `${shared.paint("warning", "●")} `;
const ABORTED = "This operation was aborted";

function isMarkdown(block: Block): block is Block & { paddingX: number } {
	return /^Markdown\d*$/.test(block.constructor?.name ?? "");
}

function isText(block: Block | undefined): block is Block & { paddingX: number; setText(text: string): void } {
	return /^Text\d*$/.test(block?.constructor?.name ?? "") && typeof (block as { setText?: unknown }).setText === "function";
}

type Reply = { contentContainer: Parent; lastMessage?: { stopReason?: string; errorMessage?: string } };

export function markError(message: Reply): void {
	const reply = message.lastMessage;
	const children = message.contentContainer.children;
	const last = children[children.length - 1];
	if (reply?.stopReason !== "error" || reply.errorMessage === ABORTED || !isText(last)) return;
	last.setText(shared.paint("warning", `API Error: ${reply.errorMessage || "Unknown error"}`));
	last.paddingX = 0;
	children[children.length - 1] = marked(last, errorMark, ERROR_RESERVE);
}

function pending(block: Block, message: object): Block {
	return {
		render: (width) => {
			const lines = block.render(width);
			return shared.awaiting && shared.latest === message ? lines.map(awaitingLine) : lines;
		},
		invalidate: () => block.invalidate(),
	};
}

export function markUser(message: { children: Parent[] }): void {
	const box = message.children[0];
	if (!box) return;
	if (!seen.has(message)) {
		seen.add(message);
		shared.latest = message;
	}
	box.paddingX = 0;
	box.paddingY = 0;
	box.children = box.children.map((block) => marked(pending(block, message), userMark, PROMPT_RESERVE));
	box.invalidate();
}

export function markAssistant(message: Reply): void {
	const container = message.contentContainer;
	container.children = container.children.map((block) => {
		if (!isMarkdown(block)) return block;
		block.paddingX = 0;
		block.invalidate();
		return marked(block, assistantMark);
	});
	markError(message);
}

function after<T>(methods: Methods, name: string, then: (self: T) => void): void {
	const original = methods[name] as (this: T, ...args: unknown[]) => unknown;
	methods[name] = function (this: T, ...args: unknown[]) {
		const result = original.apply(this, args);
		then(this);
		return result;
	};
}

export function patchGutters(user: object, assistant: object): void {
	const userMethods = user as Methods;
	const assistantMethods = assistant as Methods;
	if (shared.patched) return;
	if (typeof userMethods.rebuild !== "function" || typeof assistantMethods.updateContent !== "function") return;
	after(userMethods, "rebuild", markUser);
	after(assistantMethods, "updateContent", markAssistant);
	shared.patched = true;
}

if (process.env.CLAUDE_MESSAGES_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	class Markdown {
		invalidated = 0;
		lines: string[];
		paddingX: number;
		constructor(lines: string[], paddingX = 0) {
			this.lines = lines;
			this.paddingX = paddingX;
		}
		render(width: number) {
			return this.lines.map((line) => " ".repeat(this.paddingX) + line.slice(0, width - this.paddingX));
		}
		invalidate() {
			this.invalidated++;
		}
	}
	class Spacer {
		render() {
			return [""];
		}
		invalidate() {}
	}
	const box = (children: Block[]) => ({ children, paddingX: 1, paddingY: 1, invalidate() {} });

	check(hang(["a", "b", "c"], "● ").join("|") === "● a|  b|  c", "first line gets the mark, the rest hang two columns in");
	check(hang([], "● ").length === 0, "nothing to mark");

	setPaint((role, text) => `<${role}>${text}</${role}>`);
	const user = { children: [box([new Markdown(["hello", "world"])])] };
	markUser(user);
	check(user.children[0].paddingX === 0 && user.children[0].paddingY === 0, "no padding rows above or below the prompt, like Claude's");
	check(user.children[0].children[0].render(40).join("|") === "<dim>❯</dim> hello|  world", "the prompt mark sits in the gutter");
	setPaint((role, text) => (role === "muted" ? `\x1b[38;2;153;153;153m${text}\x1b[39m` : `<${role}>${text}</${role}>`));
	setAwaiting(true);
	const waiting = user.children[0].children[0].render(40);
	check(waiting[0] === "<dim>❯</dim> \x1b[38;2;153;153;153mhello" && waiting[1] === "  \x1b[38;2;153;153;153mworld", "while the prompt awaits the model its text is 999999 and the mark keeps its colour, like Claude 2.1.280's pending prompt (promptsAwaitingModel)");
	check(awaitingLine("\x1b[48;2;55;55;55m\x1b[38;2;255;255;255mhi\x1b[39m\x1b[49m") === "\x1b[38;2;153;153;153m\x1b[48;2;55;55;55m\x1b[38;2;153;153;153mhi\x1b[38;2;153;153;153m\x1b[49m", "every foreground in the row turns 999999 and the background stays");
	const older = user;
	const newer = { children: [box([new Markdown(["next"])])] };
	markUser(newer);
	older.children = [box([new Markdown(["hello"])])];
	markUser(older);
	check(older.children[0].children[0].render(40)[0] === "<dim>❯</dim> hello" && newer.children[0].children[0].render(40)[0] === "<dim>❯</dim> \x1b[38;2;153;153;153mnext", "only the newest prompt waits, even when an older one rebuilds later");
	setAwaiting(false);
	check(newer.children[0].children[0].render(40)[0] === "<dim>❯</dim> next", "once the model answers or the turn ends the prompt is white again");
	const wide = { children: [box([new Markdown(["x".repeat(200)])])] };
	markUser(wide);
	check(wide.children[0].children[0].render(132)[0].length === "<dim>❯</dim> ".length + 129, "the prompt text is 129 columns wide at 132: Claude 2.1.280's wrapped prompt rows reach column 131 (68 of 377 captured rows) and never 132");
	setPaint((role, text) => `<${role}>${text}</${role}>`);

	const text = new Markdown(["Hello", "there"], 1);
	const spacer = new Spacer();
	const reply = { contentContainer: box([spacer, text]) };
	markAssistant(reply);
	check(reply.contentContainer.children[0] === spacer, "spacers are left alone");
	check(text.paddingX === 0 && text.invalidated === 1, "the text block drops its own padding");
	check(reply.contentContainer.children[1].render(40).join("|") === "<text>●</text> Hello|  there", "assistant text gets Claude's dot and a hanging indent");
	check(reply.contentContainer.children[1].render(5).join("|") === "<text>●</text> Hel|  the", "the text block renders two columns narrower");

	const fakeUser = { rebuild(this: { children: Parent[] }) { this.children = [box([new Markdown(["x"])])]; } };
	const fakeAssistant = { updateContent(this: { contentContainer: Parent }) { this.contentContainer = box([new Markdown(["y"])]); } };
	shared.patched = false;
	patchGutters(fakeUser, fakeAssistant);
	patchGutters(fakeUser, fakeAssistant);
	const u = { children: [] as Parent[] };
	(fakeUser.rebuild as (this: typeof u) => void).call(u);
	check(u.children[0].children[0].render(10).join("|") === "<dim>❯</dim> x", "a patched rebuild marks the prompt once");
	const a = { contentContainer: box([]) };
	(fakeAssistant.updateContent as (this: typeof a) => void).call(a);
	check(a.contentContainer.children[0].render(10).join("|") === "<text>●</text> y", "a patched updateContent marks the reply once");
	class Text {
		text: string;
		paddingX = 1;
		constructor(text: string) {
			this.text = text;
		}
		setText(text: string) {
			this.text = text;
		}
		render(width: number) {
			const out: string[] = [];
			for (let i = 0; i < this.text.length; i += width) out.push(this.text.slice(i, i + width));
			return out;
		}
		invalidate() {}
	}
	const failure = { contentContainer: box([new Spacer(), new Text("Error: 400 boom")]), lastMessage: { stopReason: "error", errorMessage: "400 {\"error\":\"too long to fit\"}" } };
	markAssistant(failure);
	const errorRows = failure.contentContainer.children[1].render(40);
	check(failure.contentContainer.children[1].render(132).length === 1 && failure.contentContainer.children[1].render(20).every((row) => row.length <= 12 + "<warning></warning>".length * 2 + 2), "API error text wraps 8 columns short of the width, like Claude 2.1.280");
	check(errorRows[0].startsWith("<warning>●</warning> <warning>API Error: 400") && errorRows.slice(1).every((row) => row.startsWith("  ")), "a final API error is Claude's yellow \"● API Error: …\" with a two-column hang");
	const aborted = { contentContainer: box([new Text("  ⎿  Interrupted")]), lastMessage: { stopReason: "error", errorMessage: "This operation was aborted" } };
	markAssistant(aborted);
	check(aborted.contentContainer.children[0] instanceof Text, "an interrupt keeps its grey elbow row");
	console.log("ok - claude-messages gutters");
}
