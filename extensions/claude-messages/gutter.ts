export type Paint = (role: string, text: string) => string;
type Block = { render(width: number): string[]; invalidate(): void };
type Parent = { children: Block[]; invalidate(): void; paddingX?: number; paddingY?: number };
type Methods = Record<string | symbol, unknown>;

const WIDTH = 2;
const INDENT = " ".repeat(WIDTH);

const shared = ((globalThis as any)[Symbol.for("claude-messages:gutter")] ??= {
	patched: false,
	paint: ((_role, text) => text) as Paint,
}) as { patched: boolean; paint: Paint };

export function setPaint(paint: Paint): void {
	shared.paint = paint;
}

export function hang(lines: string[], mark: string): string[] {
	return lines.map((line, i) => (i === 0 ? mark : INDENT) + line);
}

function marked(block: Block, mark: () => string): Block {
	return {
		render: (width) => hang(block.render(Math.max(1, width - WIDTH)), mark()),
		invalidate: () => block.invalidate(),
	};
}

const userMark = () => `${shared.paint("dim", "❯")} `;
const assistantMark = () => `${shared.paint("text", "●")} `;

function isMarkdown(block: Block): block is Block & { paddingX: number } {
	return /^Markdown\d*$/.test(block.constructor?.name ?? "");
}

export function markUser(message: { children: Parent[] }): void {
	const box = message.children[0];
	if (!box) return;
	box.paddingX = 0;
	box.paddingY = 0;
	box.children = box.children.map((block) => marked(block, userMark));
	box.invalidate();
}

export function markAssistant(message: { contentContainer: Parent }): void {
	const container = message.contentContainer;
	container.children = container.children.map((block) => {
		if (!isMarkdown(block)) return block;
		block.paddingX = 0;
		block.invalidate();
		return marked(block, assistantMark);
	});
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
	console.log("ok - claude-messages gutters");
}
