import { AssistantMessageComponent, type ExtensionAPI, UserMessageComponent } from "@earendil-works/pi-coding-agent";
import { patchGutters, setAwaiting, setPaint } from "./gutter.ts";

export default function (pi: ExtensionAPI) {
	patchGutters(UserMessageComponent.prototype, AssistantMessageComponent.prototype);
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
	pi.on("agent_settled", () => setAwaiting(false));
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		// ponytail: Claude shows nothing where a hidden thinking block was; an empty label drops the line.
		ctx.ui.setHiddenThinkingLabel("");
		const theme = ctx.ui.theme;
		setPaint((role, text) => theme.fg(role as never, text));
	});
}
