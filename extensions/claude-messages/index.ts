import { AssistantMessageComponent, type ExtensionAPI, UserMessageComponent } from "@earendil-works/pi-coding-agent";
import { patchGutters, setPaint } from "./gutter.ts";

export default function (pi: ExtensionAPI) {
	patchGutters(UserMessageComponent.prototype, AssistantMessageComponent.prototype);
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		// ponytail: Claude shows nothing where a hidden thinking block was; an empty label drops the line.
		ctx.ui.setHiddenThinkingLabel("");
		const theme = ctx.ui.theme;
		setPaint((role, text) => theme.fg(role as never, text));
	});
}
