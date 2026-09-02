import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ponytail: herdr on native Windows turns the mouse wheel into Up/Down keys (herdr #1528), so wheel and the
// arrow keys are the same bytes. The wheel must only scroll the transcript (never yank an old prompt into the
// editor), while a multi-line draft still needs Up/Down for cursor movement — like Claude Code, where the same
// split exists. Prompt history recall stays deliberate via ctrl+p / ctrl+n in the input box.
export class WheelEditor extends CustomEditor {
	handleInput(data: string): void {
		const tui = this.tui as { scrollBy?: (lines: number) => void };
		const multiline = this.getLines().length > 1;
		if (typeof tui.scrollBy === "function" && !multiline && !this.isShowingAutocomplete()) {
			if (this.keybindings.matches(data, "tui.editor.cursorUp")) return tui.scrollBy(-1);
			if (this.keybindings.matches(data, "tui.editor.cursorDown")) return tui.scrollBy(1);
		}
		super.handleInput(data);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI || ctx.ui.getEditorComponent()) return;
		ctx.ui.setEditorComponent((tui, theme, keybindings) => new WheelEditor(tui, theme, keybindings));
	});
}
