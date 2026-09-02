import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PI_DIR = "C:/Users/cuong/AppData/Local/Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent";

const { createJiti } = await import(
	pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href
);
const jiti = createJiti(import.meta.url, {
	alias: { "@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js") },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const { default: install, wheelDirection } = await jiti.import(path.join(here, "index.ts"));
const { KeybindingsManager } = await jiti.import(path.join(PI_DIR, "dist/core/keybindings.js"));
const { setKeybindings } = await jiti.import(
	path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/keybindings.js")
);

const keybindings = KeybindingsManager.create(path.join(process.env.USERPROFILE ?? "", ".pi/agent"));
setKeybindings(keybindings);

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const CTRL_P = "\x10";

type Listener = (data: string) => { consume?: boolean } | undefined;

function boot(withPowerlineFirst: boolean) {
	const scrolls: number[] = [];
	let focused: unknown;
	const tui = {
		requestRender() {},
		terminal: { rows: 40, columns: 120 },
		scrollBy(n: number) { scrolls.push(n); },
		getFocusedComponent: () => focused,
	};
	let factory: ((t: unknown, theme: unknown, kb: unknown) => unknown) | undefined;
	let powerlineEditorCreated = false;
	if (withPowerlineFirst) {
		factory = (t, theme, kb) => {
			powerlineEditorCreated = true;
			return makeEditor(t, theme, kb);
		};
	}
	let listener: Listener | undefined;
	let handler: ((event: unknown, ctx: unknown) => void) | undefined;
	install({ on: (name: string, fn: typeof handler) => { if (name === "session_start") handler = fn; } });
	handler!({}, {
		hasUI: true,
		ui: {
			getEditorComponent: () => factory,
			setEditorComponent: (f: typeof factory) => { factory = f; },
			onTerminalInput: (fn: Listener) => { listener = fn; return () => {}; },
		},
	});
	const editor = factory!(tui, { borderColor: (s: string) => s }, keybindings) as any;
	focused = editor;
	return { editor, scrolls, listener: listener!, setFocused: (c: unknown) => { focused = c; }, powerlineEditorCreated };
}

let CustomEditorClass: any;
function makeEditor(t: unknown, theme: unknown, kb: unknown) {
	return new CustomEditorClass(t, theme, kb);
}
({ CustomEditor: CustomEditorClass } = await jiti.import(path.join(PI_DIR, "dist/index.js")));

{
	const { editor, scrolls, listener } = boot(false);
	editor.setText("hello");
	editor.addToHistory("old prompt");
	assert.deepEqual(listener(UP), { consume: true }, "single-line draft: Up is consumed");
	assert.deepEqual(scrolls, [-1], "single-line draft: Up scrolls");
	assert.equal(editor.getText(), "hello", "single-line draft: Up must not replace the draft");
	assert.deepEqual(listener(DOWN), { consume: true });
	assert.deepEqual(scrolls, [-1, 1], "single-line draft: Down scrolls");
}

{
	const { scrolls, listener } = boot(false);
	listener(UP);
	listener(DOWN);
	assert.deepEqual(scrolls, [-1, 1], "empty prompt: wheel scrolls both ways");
}

{
	const { editor, scrolls, listener } = boot(false);
	editor.setText("line1\nline2");
	assert.equal(listener(UP), undefined, "multiline draft: Up passes through to the editor");
	assert.deepEqual(scrolls, [], "multiline draft: no scroll");
}

{
	const { scrolls, listener, setFocused } = boot(false);
	setFocused({ handleInput() {} });
	assert.equal(listener(UP), undefined, "selector focused: Up passes through");
	assert.deepEqual(scrolls, []);
}

{
	const { editor, scrolls, listener } = boot(false);
	editor.render(30);
	editor.setText("x".repeat(60));
	assert.equal(listener(UP), undefined, "single logical line that wraps: Up passes through to move between rows");
	assert.deepEqual(scrolls, []);
}

{
	assert.equal(wheelDirection(UP, { getLines: () => [""], isShowingAutocomplete: () => true }), 0, "autocomplete open: Up passes through");
	assert.equal(wheelDirection(CTRL_P, { getLines: () => [""], isShowingAutocomplete: () => false }), 0, "ctrl+p is not a wheel key");
	assert.equal(wheelDirection("\x1bOB", { getLines: () => [""], isShowingAutocomplete: () => false }), 1, "application-mode Down counts");
}

{
	const { scrolls, listener, powerlineEditorCreated } = boot(true);
	assert.ok(powerlineEditorCreated, "an earlier editor factory (powerline) is still used");
	listener(UP);
	assert.deepEqual(scrolls, [-1], "wheel works even when another extension owns the editor");
}

console.log("herdr-wheel selftest: all assertions passed");
