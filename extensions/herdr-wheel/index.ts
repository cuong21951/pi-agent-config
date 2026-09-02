import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ponytail: herdr on native Windows turns the mouse wheel into Up/Down keys (herdr #1528), so wheel and the
// arrow keys are the same bytes. The wheel must only scroll the transcript (never yank an old prompt into the
// editor), while a multi-line draft still needs Up/Down for cursor movement — like Claude Code, where the same
// split exists. Prompt history recall stays deliberate via ctrl+p / ctrl+n in the input box.
//
// This runs as a raw terminal-input listener, not an editor subclass: pi-powerline-footer installs its own
// editor at session_start, so any custom editor here is either shadowed or never installed. Input listeners
// run before the focused component, whoever owns the editor.
const UP = new Set(["\x1b[A", "\x1bOA"]);
const DOWN = new Set(["\x1b[B", "\x1bOB"]);

type EditorLike = { getLines(): string[]; isShowingAutocomplete(): boolean; lastWidth?: number };
type ScrollTui = { scrollBy?(lines: number): void; getFocusedComponent?(): unknown };

function isEditor(component: unknown): component is EditorLike {
	const c = component as Partial<EditorLike> | null;
	return typeof c?.getLines === "function" && typeof c?.isShowingAutocomplete === "function";
}

function wraps(editor: EditorLike): boolean {
	const [line] = editor.getLines();
	return typeof editor.lastWidth === "number" && line !== undefined && line.length >= editor.lastWidth;
}

export function wheelDirection(data: string, focused: unknown): -1 | 0 | 1 {
	const direction = UP.has(data) ? -1 : DOWN.has(data) ? 1 : 0;
	if (direction === 0 || !isEditor(focused)) return 0;
	if (focused.getLines().length > 1 || wraps(focused) || focused.isShowingAutocomplete()) return 0;
	return direction;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		let tui: ScrollTui | undefined;
		const previous = ctx.ui.getEditorComponent();
		ctx.ui.setEditorComponent((t, theme, keybindings) => {
			tui = t as ScrollTui;
			return previous ? previous(t, theme, keybindings) : new CustomEditor(t, theme, keybindings);
		});
		ctx.ui.onTerminalInput((data) => {
			const direction = wheelDirection(data, tui?.getFocusedComponent?.());
			if (direction === 0 || typeof tui?.scrollBy !== "function") return undefined;
			tui.scrollBy(direction);
			return { consume: true };
		});
	});
}
