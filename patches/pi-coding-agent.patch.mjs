// Claude Code 2.1.261 look for seven things pi-coding-agent draws itself (measured live 2026-09-05,
// anchors ported to pi 0.85.1 on 2026-09-23):
// 1. a hidden thinking block draws nothing, so tool rows sit one blank line apart (pi drew a spacer
//    plus an empty label line, three blank rows per thinking run);
// 2. an interrupted response ends with grey "  ⎿  Interrupted · What should Claude do instead?"
//    instead of red "Operation aborted";
// 3. PI_SKIP_VERSION_CHECK (set by the pi wrapper) also skips the "Package Updates Available" box,
//    which pi only gates on PI_OFFLINE. Claude Code shows no update box at startup;
// 4. a status notice ("MCP: 1 servers connected", "Model: x") is Claude's grey "● notice" at column 0
//    (Claude Code 2.1.280 draws a SessionStart hook message that way, measured 2026-09-23);
// 5. /new leaves the command as a prompt row, "❯ /new", the way Claude's /clear leaves "❯ /clear"
//    (measured 2026-09-23), instead of an accent "✓ New session started";
// 6. a reply that failed and that pi is about to retry by itself leaves the transcript, like Claude's
//    transient retry notice; only a final failure keeps its error row;
// 7. a change that only repaints lines already scrolled above the viewport (a blinking dot, a ticking
//    timer) no longer clears the screen and scrollback for a full redraw — the flicker and the doubled
//    rows in the scrollback. A change that moves lines above the viewport still redraws.
// The bundle is minified, so this is string surgery on the chunk that holds AssistantMessageComponent.
//   node patches/pi-coding-agent.patch.mjs          apply to every installed pi (idempotent)
//   node patches/pi-coding-agent.patch.mjs --check  exit 1 unless every edit is present everywhere
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const INSTALLS = [
	path.join(process.env.APPDATA ?? "", "npm/node_modules/@earendil-works/pi-coding-agent"),
	path.join(process.env.LOCALAPPDATA ?? "", "Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent"),
];
const MARKER = "let thinkingRunIndex=0;";

const EDITS = [
	[
		'c2.type==="thinking"&&c2.thinking.trim())&&this.contentContainer.addChild(new Spacer(1));let thinkingRunIndex=0;',
		'c2.type==="thinking"&&c2.thinking.trim()&&!(this.hideThinkingBlock&&!this.hiddenThinkingLabel))&&this.contentContainer.addChild(new Spacer(1));let thinkingRunIndex=0;',
	],
	[
		"if(i--,thinkingBlocks.length===0)continue;",
		"if(i--,thinkingBlocks.length===0||this.hideThinkingBlock&&!this.hiddenThinkingLabel)continue;",
	],
	[
		'if(message.stopReason==="aborted"){let abortMessage=message.errorMessage&&message.errorMessage!=="Request was aborted"?message.errorMessage:"Operation aborted";this.contentContainer.addChild(new Spacer(1)),this.contentContainer.addChild(new Text(theme.fg("error",abortMessage),this.outputPad,0))}',
		'if(message.stopReason==="aborted"){this.contentContainer.addChild(new Text(theme.fg("muted","  ⎿  Interrupted · What should Claude do instead?"),0,0))}',
	],
	[
		'else if(message.stopReason==="error"){let errorMsg=message.errorMessage||"Unknown error";',
		'else if(message.stopReason==="error"&&message.errorMessage==="This operation was aborted"){this.contentContainer.addChild(new Text(theme.fg("muted","  ⎿  Interrupted · What should Claude do instead?"),0,0))}else if(message.stopReason==="error"){let errorMsg=message.errorMessage||"Unknown error";',
	],
	[
		"async checkForPackageUpdates(){if(process.env.PI_OFFLINE)return[];",
		"async checkForPackageUpdates(){if(process.env.PI_OFFLINE||process.env.PI_SKIP_VERSION_CHECK)return[];",
	],
	[
		'this.lastStatusText.setText(theme.fg("dim",message)),this.ui.requestRender();return}let spacer=new Spacer(1),text=new Text(theme.fg("dim",message),1,0);',
		'this.lastStatusText.setText(theme.fg("muted",`● ${message}`)),this.ui.requestRender();return}let spacer=new Spacer(1),text=new Text(theme.fg("muted",`● ${message}`),0,0);',
	],
	[
		'if(firstChanged<prevViewportTop){logRedraw(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`),fullRender(!0);return}',
		'if(firstChanged<prevViewportTop&&newLines.length===this.previousLines.length){let visibleChange=-1;for(let i=prevViewportTop;i<=lastChanged;i++)if(newLines[i]!==this.previousLines[i]){visibleChange=i;break}if(visibleChange===-1){this.positionHardwareCursor(cursorPos,newLines.length),this.previousLines=newLines,this.previousViewportTop=prevViewportTop,this.previousHeight=height;return}firstChanged=visibleChange}if(firstChanged<prevViewportTop){logRedraw(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`),fullRender(!0);return}',
	],
	[
		'case"auto_retry_start":{this.retryEscapeHandler=this.defaultEditor.onEscape,',
		'case"auto_retry_start":{for(let i=this.chatContainer.children.length-1;i>=0;i--){let child=this.chatContainer.children[i];if(child instanceof AssistantMessageComponent){child.lastMessage?.stopReason==="error"&&this.chatContainer.removeChild(child);break}}this.retryEscapeHandler=this.defaultEditor.onEscape,',
	],
	[
		'this.chatContainer.addChild(new Text(`${theme.fg("accent","\\u2713 New session started")}`,1,1))',
		'this.chatContainer.addChild(new UserMessageComponent("/new"))',
	],
];

const check = process.argv.includes("--check");
let failed = false;
let seen = 0;
for (const install of INSTALLS) {
	const chunks = path.join(install, "dist/bundle/chunks");
	if (!existsSync(chunks)) continue;
	for (const name of readdirSync(chunks)) {
		const file = path.join(chunks, name);
		let src = readFileSync(file, "utf8");
		if (!src.includes(MARKER)) continue;
		seen++;
		let present = 0;
		for (const [from, to] of EDITS) {
			if (src.includes(to)) {
				present++;
				continue;
			}
			const count = src.split(from).length - 1;
			if (count !== 1) {
				console.error(`${file}: expected 1 match, found ${count} for ${from.slice(0, 50)}…`);
				failed = true;
				continue;
			}
			if (!check) {
				src = src.replace(from, to);
				present++;
			}
		}
		if (check) {
			console.log(`${present === EDITS.length ? "ok" : "MISSING"} - ${file}: ${present}/${EDITS.length} edits present`);
			if (present !== EDITS.length) failed = true;
		} else if (!failed) {
			writeFileSync(file, src);
			console.log(`ok - patched ${file}`);
		}
	}
}
if (seen === 0) {
	console.error("no pi-coding-agent chunk with AssistantMessageComponent found");
	failed = true;
}
process.exit(failed ? 1 : 0);
