import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ponytail: herdr on native Windows turns the mouse wheel into Up/Down keys (herdr #1528). Binding those keys
// globally steals them from selectors, autocomplete and workflow pickers, so the swap happens only here:
// an empty prompt with no autocomplete scrolls the transcript; anything else is the stock editor.
export class WheelEditor extends CustomEditor {
	handleInput(data: string): void {
		const tui = this.tui as { scrollBy?: (lines: number) => void };
		if (typeof tui.scrollBy === "function" && this.isEditorEmpty() && !this.isShowingAutocomplete()) {
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
