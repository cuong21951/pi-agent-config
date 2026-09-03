import { appendFileSync } from "node:fs";
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isKeyRelease, matchesKey } from "@earendil-works/pi-tui";

// ponytail: herdr on native Windows turns the mouse wheel into Up/Down keys (herdr #1528), so wheel and the
// arrow keys are the same bytes. The wheel must only scroll the transcript (never yank an old prompt into the
// editor), while a multi-line draft still needs Up/Down for cursor movement — like Claude Code, where the same
// split exists. Prompt history recall stays deliberate via ctrl+p / ctrl+n in the input box.
//
// This runs as a raw terminal-input listener, not an editor subclass: pi-powerline-footer installs its own
// editor at session_start, so any custom editor here is either shadowed or never installed. Input listeners
// run before the focused component, whoever owns the editor. Keys are matched with pi-tui's matchesKey so
// legacy, kitty and modifyOtherKeys encodings of Up/Down all count. HERDR_WHEEL_LOG=<file> dumps raw input.
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
	if (isKeyRelease(data)) return 0;
	const direction = matchesKey(data, "up") ? -1 : matchesKey(data, "down") ? 1 : 0;
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
			const focused = tui?.getFocusedComponent?.();
			const direction = wheelDirection(data, focused);
			if (process.env.HERDR_WHEEL_LOG) {
				appendFileSync(process.env.HERDR_WHEEL_LOG, `${JSON.stringify({ data, direction, editor: isEditor(focused), tui: !!tui })}\n`);
			}
			if (direction === 0 || typeof tui?.scrollBy !== "function") return undefined;
			tui.scrollBy(direction);
			return { consume: true };
		});
	});
}
