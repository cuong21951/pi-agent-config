import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

const ANSI = /\x1b\[[0-9;]*m/g;
const FRAME = 6;

type Paint = (text: string) => string;

// ponytail: pi's editor draws a flat rule above and below the text; Claude Code draws a rounded box with
// a "> " prompt. The inner editor is rendered FRAME columns narrower and its rule rows become the box's
// top and bottom (scroll indicators inside a rule survive because the plain text is reused). Rows after
// the bottom rule are the autocomplete list and stay untouched.
export function boxLines(lines: string[], width: number, paint: Paint): string[] {
	const inner = width - FRAME;
	const out: string[] = [];
	let rules = 0;
	for (const line of lines) {
		if (rules === 2) {
			out.push(line);
			continue;
		}
		const plain = line.replace(ANSI, "");
		if (plain.startsWith("─")) {
			out.push(paint(rules === 0 ? `╭──${plain}──╮` : `╰──${plain}──╯`));
			rules++;
			continue;
		}
		const pad = " ".repeat(Math.max(0, inner - visibleWidth(line)));
		const prompt = out.length === 1 ? paint(">") + " " : "  ";
		out.push(`${paint("│")} ${prompt}${line}${pad} ${paint("│")}`);
	}
	return out;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		const previous = ctx.ui.getEditorComponent();
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = previous ? previous(tui, theme, keybindings) : new CustomEditor(tui, theme, keybindings);
			const paint: Paint = (text) => theme.borderColor(text);
			const render = editor.render.bind(editor);
			editor.render = (width: number) => boxLines(render(width - FRAME), width, paint);
			return editor;
		});
	});
}
