import { AssistantMessageComponent, type ExtensionAPI, UserMessageComponent } from "@earendil-works/pi-coding-agent";
import { HINT } from "../intent-tools/shells.ts";
import { type Bang, type BangMessage, bangBlocks, bangRows } from "./bang.ts";
import { installBangMode, type Mode } from "./bang-mode.ts";
import { patchGutters, setAwaiting, setPaint } from "./gutter.ts";
import { displayPasted, expandForModel, PASTE_RULE, pasteId } from "./paste.ts";

type Hooks = {
	__claudeMode?: Mode;
	__claudeBang?: (bang: Bang, width: number) => string[];
	__claudeBangBlocks?: (message: BangMessage, messages: unknown[]) => { type: "text"; text: string }[];
	__claudePasteId?: string;
	__claudePasteSubmit?: (text: string, pastes: Map<number, string>) => string | undefined;
	__claudePasteShown?: (text: string) => string;
	__claudePasteKept?: (text: string) => string | undefined;
};

const hooks = globalThis as Hooks;
const SHELLS = Symbol.for("pi-shells:manager");
const PASTE_DISPLAY = Symbol.for("claude-messages:paste-display");

function patchPasteDisplay(user: object): void {
	const methods = user as Record<string | symbol, unknown>;
	if (methods[PASTE_DISPLAY] || typeof methods.rebuild !== "function") return;
	methods[PASTE_DISPLAY] = true;
	const rebuild = methods.rebuild as (this: { text: string }) => void;
	methods.rebuild = function (this: { text: string }) {
		const text = this.text;
		this.text = hooks.__claudePasteShown?.(text) ?? text;
		try {
			rebuild.call(this);
		} finally {
			this.text = text;
		}
	};
}

export default function (pi: ExtensionAPI) {
	patchGutters(UserMessageComponent.prototype, AssistantMessageComponent.prototype);
	patchPasteDisplay(UserMessageComponent.prototype);
	hooks.__claudeBangBlocks = (message, messages) => bangBlocks(message, messages[0] === message);
	hooks.__claudePasteSubmit = (text, pastes) => (text.startsWith("/") || text.startsWith("!") ? undefined : expandForModel(text, pastes, hooks.__claudePasteId ?? pasteId("")));
	hooks.__claudePasteShown = (text) => displayPasted(text, hooks.__claudePasteId ?? pasteId(""));
	hooks.__claudePasteKept = (text) => (text.includes(`<pasted_content id="${hooks.__claudePasteId ?? pasteId("")}">`) ? text : undefined);
	pi.on("before_agent_start", (event) => ({ systemPrompt: `${event.systemPrompt}\n${PASTE_RULE}` }));
	let queued = false;
	pi.on("agent_start", () => {
		queued = false;
	});
	pi.on("message_start", (event) => {
		if (event.message.role !== "user") return;
		setAwaiting(queued);
		queued = true;
	});
	pi.on("message_update", () => setAwaiting(false));
	pi.on("agent_settled", () => {
		setAwaiting(false);
		hooks.__claudeMode?.claudeBang?.drain();
	});
	pi.on("session_start", (_event, ctx) => {
		hooks.__claudePasteId = pasteId(ctx.sessionManager?.getSessionId() ?? "");
		if (!ctx.hasUI) return;
		// ponytail: Claude shows nothing where a hidden thinking block was; an empty label drops the line.
		ctx.ui.setHiddenThinkingLabel("");
		const theme = ctx.ui.theme;
		setPaint((role, text) => theme.fg(role as never, text));
		const paint = (role: string, text: string) => theme.fg(role as never, text);
		const started = new WeakMap<Bang, number>();
		hooks.__claudeBang = (bang, width) => {
			const since = started.get(bang) ?? Date.now();
			started.set(bang, since);
			const children = hooks.__claudeMode?.chatContainer.children ?? [];
			const newest = children.findLast((child) => typeof child === "object" && child !== null && "outputLines" in child) === bang;
			const rows = bangRows(bang, width, paint, { elapsedMs: Date.now() - since, hint: SHELLS in globalThis ? HINT : undefined }, newest);
			return children[0] === bang ? rows.slice(1) : rows;
		};
		if (hooks.__claudeMode) installBangMode(hooks.__claudeMode, paint);
	});
}
