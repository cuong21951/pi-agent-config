// Claude Code 2.1.261 look for seven things pi-coding-agent draws itself (measured live 2026-09-05,
// anchors ported to pi 0.85.1 on 2026-09-23):
// 1. a hidden thinking block draws nothing, so tool rows sit one blank line apart (pi drew a spacer
//    plus an empty label line, three blank rows per thinking run);
// 2. an interrupted response ends with grey "  ⎿ \u00a0Interrupted · What should Claude do instead?"
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
// 8. the editor's top/bottom border briefly paints with getEditorTheme()'s own "borderMuted" default
//    before updateEditorBorderColor() sets the real thinking-level colour; the last two of the 132
//    columns kept that stale colour instead of the rest of the rule's (Claude Code 2.1.280 measured,
//    2026-09-23: the rule is one solid colour edge to edge), so the default now matches thinking
//    level "off" too.
// 9. generateDiffString's Update-diff preview used 4 lines of context per side (Claude's jsdiff
//    K8e=3) and always appended a trailing "..." row after the shown context even at the true end
//    of the diff, where Claude prints nothing further; contextLines drops to 3 and that trailing
//    row is dropped for the two duplicated copies of the function (generateDiffString/2) in the
//    bundle.
// 10. a markdown heading never shows its "#" prefix in Claude Code 2.1.280, at any level (measured
//     2026-09-23 on h1/h2/h3); pi only dropped it for h1/h2, so h3+ now drops it too.
// 11. a nested markdown bullet indents 2 columns per depth in Claude Code 2.1.280 (measured 2026-09-23);
//     pi indented 4.
// 12. a markdown blockquote's left border is "▎" (U+258E) in Claude Code 2.1.280 (measured 2026-09-23);
//     pi drew the box-drawing "│".
// 13. a markdown thematic break ("---" alone on a line) renders as its own literal text in Claude Code
//     2.1.280, not a rule (measured 2026-09-23 both stand-alone and right after a blockquote), so pi's
//     "hr" case now pushes the raw token text instead of a drawn rule.
// 14. a markdown table header row is not bold, and a cell honours its column's GFM alignment (":---",
//     ":---:", "---:"), in Claude Code 2.1.280 (measured 2026-09-23: centre pads floor/ceil, right
//     pads all on the left); pi always bolded the header and left-aligned every cell.
// 15. a fenced markdown code block drops its "```lang" / "```" fence lines in Claude Code 2.1.280
//     (measured 2026-09-23: only the indented, highlighted code shows); pi always drew both fences.
//     The code's own 2-space indent on top of the gutter hang is separate — settings.json's
//     markdown.codeBlockIndent, not this bundle.
// 16. a markdown code fence's syntax highlighting in Claude Code 2.1.280 is plain ANSI-16 colour (not
//     the tool-diff palette) produced by the exact algorithm read out of the 2.1.280 bundle's own
//     markdown renderer: highlight.js's per-node _emitter tree walked post-order, each node's OWN
//     scope (only, not inherited) looked up in a 36-entry scope→ANSI-16 map with iterative dot-stripped
//     fallback (e.g. "title.class.inherited" falls back to "title.class"), everything else left at the
//     default foreground. pi's case "code" markdown-renderer now calls
//     globalThis.__claudeFenceHighlight?.(token.text,token.lang) first — implemented in the ordinary
//     source file extensions/claude-tools/markdown-highlight.ts on highlight.js 11.12.0, registered by
//     extensions/claude-markdown-highlight — falling back to pi's own theme.highlightCode only if that
//     hook is absent. An untagged fence (no "```lang") never reaches hljs at all in Claude: each line's
//     trimmed run is coloured with the "permission" role (ANSI blue) and its leading/trailing
//     whitespace is left plain; a tagged-but-unsupported language gets a dim label line above a
//     "plaintext" (unstyled) body.
// 17. the slash-command menu's SelectList.renderItem() only had pi's own "→ name  desc" single-line
//     row, one shared accent colour and a one-line-ellipsis description; Claude Code 2.1.280 draws it
//     "  /name  desc" (2-space indent, no arrow), 99ccff on the selected row (bold on the typed prefix
//     only) vs flat 999999 on the rest, description wrapped onto up to 2 lines with a trailing "…" when
//     cut, and the name column fixed at 32 (SLASH_COMMAND_SELECT_LIST_LAYOUT's own min/max both set to
//     30 so it no longer shrinks to the widest visible item); renderItem now returns one or two lines
//     per row and createAutocompleteList() stashes the typed prefix on the list for the bold match.
// 18. a markdown h1 heading is bold+italic+underline in Claude Code 2.1.280 (measured 2026-09-23, the
//     pyte capture now records italic); pi's h1 was bold+underline only, no italic.
// 19. a markdown blockquote's left border "▎" draws dim (SGR 2) in Claude Code 2.1.280, and the single
//     space right after it does not (measured 2026-09-23 per-character); pi drew neither dim.
// 20. (retired 2026-09-23, folded into 16) rule 16 used to hack around pi's vendored hljs 10.7.3, whose
//     TypeScript grammar wraps a whole function signature in one "function" scope so a return type like
//     "number" inherited the function name's colour instead of hljs 11.12.0's real "built_in" tag on it;
//     switching the fence path to 11.12.0 (see 16) makes the grammar emit that tag correctly on its own,
//     so the regex-based "function"/"params" passthrough hack is gone — extensions/claude-tools/
//     markdown-highlight.ts's own scope map is now the single source of truth.
// 21. a markdown link's text draws in the named ANSI-16 colour brightblue (SGR 94) in Claude Code
//     2.1.280, not a truecolour RGB (measured 2026-09-23 per-character); pi's mdLink theme colour
//     resolves to a 256-colour SGR, so the link formatter now emits the literal SGR 94 escape instead.
// 22. word wrap follows Ink's wrap-ansi with trim:false, which Claude Code 2.1.280 renders every text
//     through: a row after one that is exactly full starts with a space, so it holds one column less
//     (the space itself never shows). Measured 2026-09-23: 26 of 27 captured paragraphs match that rule,
//     24 match plain greedy wrap, and both greedy misses are rows right after a full 130-column row.
// 23. InteractiveMode's widgetContainerAbove (claude-working, claude-bottom-input) always opened with a
//     hardcoded Spacer(1), even while a non-overlay ctx.ui.custom() dialog (the permission prompt,
//     ask_user_question) had swapped the editor slot out from under it, so a live capture of Claude Code
//     2.1.280 showed the dialog's rule sitting directly under the transcript's own trailing blank line
//     while pi's showed three (permission) or five (ask_user_question) extra blank rows above it
//     (measured 2026-09-23). The spacer/leading-gap booleans now read whether the editor slot still holds
//     the real editor (editorContainer.children[0]===this.editor); showExtensionCustom's open and close
//     paths call renderWidgets() again so that check is re-evaluated the moment a dialog swaps the slot,
//     instead of staying pinned to whatever it was at session start.
// The bundle is minified, so this is string surgery on the chunk that holds AssistantMessageComponent.
//   node patches/pi-coding-agent.patch.mjs          apply to every installed pi (idempotent)
//   node patches/pi-coding-agent.patch.mjs --check  exit 1 unless every edit is present everywhere
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { piInstalls } from "../scripts/pi-installs.mjs";

const INSTALLS = piInstalls();
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
		'if(message.stopReason==="aborted"){this.contentContainer.addChild(new Text(theme.fg("muted","  ⎿ \\u00a0Interrupted · What should Claude do instead?"),0,0))}',
	],
	[
		'else if(message.stopReason==="error"){let errorMsg=message.errorMessage||"Unknown error";',
		'else if(message.stopReason==="error"&&message.errorMessage==="This operation was aborted"){this.contentContainer.addChild(new Text(theme.fg("muted","  ⎿ \\u00a0Interrupted · What should Claude do instead?"),0,0))}else if(message.stopReason==="error"){let errorMsg=message.errorMessage||"Unknown error";',
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
		'this.chatContainer.addChild(new UserMessageComponent(this.clearCommandText??"/new"))',
	],
	[
		'function getEditorTheme(){return{borderColor:text=>theme.fg("borderMuted",text),selectList:getSelectListTheme()}}',
		'function getEditorTheme(){return{borderColor:text=>theme.fg("thinkingOff",text),selectList:getSelectListTheme()}}',
	],
	[
		"styledHeading=headingLevel>=3?headingStyleFn(headingPrefix)+headingText:headingText;",
		"styledHeading=headingText;",
	],
	[
		'renderList(token,depth,width,styleContext){let lines=[],indent="    ".repeat(depth)',
		'renderList(token,depth,width,styleContext){let lines=[],indent="  ".repeat(depth)',
	],
	[
		"this.theme.quoteBorder(\"\\u2502 \")",
		"this.theme.quoteBorder(\"\\u258e\")+\" \"",
	],
	[
		"headingLevel===1?headingStyleFn=text=>this.theme.heading(this.theme.bold(this.theme.underline(text))):headingStyleFn=text=>this.theme.heading(this.theme.bold(text));",
		"headingLevel===1?headingStyleFn=text=>this.theme.heading(this.theme.bold(this.theme.italic(this.theme.underline(text)))):headingStyleFn=text=>this.theme.heading(this.theme.bold(text));",
	],
	[
		"quoteBorder:text=>theme.fg(\"mdQuoteBorder\",text),hr:text=>theme.fg(\"mdHr\",text),",
		"quoteBorder:text=>`\x1b[2m${theme.fg(\"mdQuoteBorder\",text)}\x1b[22m`,hr:text=>theme.fg(\"mdHr\",text),",
	],
	[
		"case\"hr\":lines.push(this.theme.hr(\"\\u2500\".repeat(Math.min(width,80)))),nextTokenType&&nextTokenType!==\"space\"&&lines.push(\"\");break;",
		"case\"hr\":lines.push(this.applyDefaultStyle(token.raw.trim())),nextTokenType&&nextTokenType!==\"space\"&&lines.push(\"\");break;",
	],
	[
		"let headerCellLines=token.header.map((cell,i)=>{let text=this.renderInlineTokens(cell.tokens||[],styleContext);return this.wrapCellText(text,columnWidths[i],styleContext?.stylePrefix)}),headerLineCount=Math.max(...headerCellLines.map(c2=>c2.length));for(let lineIdx=0;lineIdx<headerLineCount;lineIdx++){let rowParts=headerCellLines.map((cellLines,colIdx)=>{let text=cellLines[lineIdx]||\"\",padded=text+\" \".repeat(Math.max(0,columnWidths[colIdx]-visibleWidth(text)));return this.theme.bold(padded)});lines.push(`\\u2502 ${rowParts.join(\" \\u2502 \")} \\u2502`)}",
		"let padCell=(text,w,align)=>{let pad=Math.max(0,w-visibleWidth(text));return align===\"right\"?\" \".repeat(pad)+text:align===\"center\"?\" \".repeat(Math.floor(pad/2))+text+\" \".repeat(pad-Math.floor(pad/2)):text+\" \".repeat(pad)},headerCellLines=token.header.map((cell,i)=>{let text=this.renderInlineTokens(cell.tokens||[],styleContext);return this.wrapCellText(text,columnWidths[i],styleContext?.stylePrefix)}),headerLineCount=Math.max(...headerCellLines.map(c2=>c2.length));for(let lineIdx=0;lineIdx<headerLineCount;lineIdx++){let rowParts=headerCellLines.map((cellLines,colIdx)=>{let text=cellLines[lineIdx]||\"\";return padCell(text,columnWidths[colIdx],token.header[colIdx]?.align)});lines.push(`\\u2502 ${rowParts.join(\" \\u2502 \")} \\u2502`)}",
	],
	[
		"for(let rowIndex=0;rowIndex<token.rows.length;rowIndex++){let rowCellLines=token.rows[rowIndex].map((cell,i)=>{let text=this.renderInlineTokens(cell.tokens||[],styleContext);return this.wrapCellText(text,columnWidths[i],styleContext?.stylePrefix)}),rowLineCount=Math.max(...rowCellLines.map(c2=>c2.length));for(let lineIdx=0;lineIdx<rowLineCount;lineIdx++){let rowParts=rowCellLines.map((cellLines,colIdx)=>{let text=cellLines[lineIdx]||\"\";return text+\" \".repeat(Math.max(0,columnWidths[colIdx]-visibleWidth(text)))});lines.push(`\\u2502 ${rowParts.join(\" \\u2502 \")} \\u2502`)}rowIndex<token.rows.length-1&&lines.push(separatorLine)}",
		"for(let rowIndex=0;rowIndex<token.rows.length;rowIndex++){let rowCellLines=token.rows[rowIndex].map((cell,i)=>{let text=this.renderInlineTokens(cell.tokens||[],styleContext);return this.wrapCellText(text,columnWidths[i],styleContext?.stylePrefix)}),rowLineCount=Math.max(...rowCellLines.map(c2=>c2.length));for(let lineIdx=0;lineIdx<rowLineCount;lineIdx++){let rowParts=rowCellLines.map((cellLines,colIdx)=>{let text=cellLines[lineIdx]||\"\";return padCell(text,columnWidths[colIdx],token.header[colIdx]?.align)});lines.push(`\\u2502 ${rowParts.join(\" \\u2502 \")} \\u2502`)}rowIndex<token.rows.length-1&&lines.push(separatorLine)}",
	],
	[
		"case\"code\":{let indent=this.theme.codeBlockIndent??\"  \";if(lines.push(this.theme.codeBlockBorder(`\\`\\`\\`${token.lang||\"\"}`)),this.theme.highlightCode){let highlightedLines=this.theme.highlightCode(token.text,token.lang);for(let hlLine of highlightedLines)lines.push(`${indent}${hlLine}`)}else{let codeLines=token.text.split(`\n`);for(let codeLine of codeLines)lines.push(`${indent}${this.theme.codeBlock(codeLine)}`)}lines.push(this.theme.codeBlockBorder(\"```\")),nextTokenType&&nextTokenType!==\"space\"&&lines.push(\"\");break}",
		"case\"code\":{let indent=this.theme.codeBlockIndent??\"  \";if(this.theme.highlightCode){let highlightedLines=globalThis.__claudeFenceHighlight?.(token.text,token.lang)??this.theme.highlightCode(token.text,token.lang);for(let hlLine of highlightedLines)lines.push(`${indent}${hlLine}`)}else{let codeLines=token.text.split(`\n`);for(let codeLine of codeLines)lines.push(`${indent}${this.theme.codeBlock(codeLine)}`)}nextTokenType&&nextTokenType!==\"space\"&&lines.push(\"\");break}",
	],
	[
		"link:text=>theme.fg(\"mdLink\",text),linkUrl:",
		"link:text=>`\u001b[94m${text}\u001b[39m`,linkUrl:",
	],
	[
		'function generateDiffString(oldContent,newContent,contextLines=4){let parts=diffLines(oldContent,newContent),output=[],oldLines=oldContent.split(`\n`),newLines=newContent.split(`\n`),maxLineNum=Math.max(oldLines.length,newLines.length),lineNumWidth=String(maxLineNum).length,oldLineNum=1,newLineNum=1,lastWasChange=!1,firstChangedLine;for(let i=0;i<parts.length;i++){let part=parts[i],raw=part.value.split(`\n`);if(raw[raw.length-1]===""&&raw.pop(),part.added||part.removed){firstChangedLine===void 0&&(firstChangedLine=newLineNum);for(let line of raw)if(part.added){let lineNum=String(newLineNum).padStart(lineNumWidth," ");output.push(`+${lineNum} ${line}`),newLineNum++}else{let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(`-${lineNum} ${line}`),oldLineNum++}lastWasChange=!0}else{let nextPartIsChange=i<parts.length-1&&(parts[i+1].added||parts[i+1].removed),hasLeadingChange=lastWasChange,hasTrailingChange=nextPartIsChange;if(hasLeadingChange&&hasTrailingChange)if(raw.length<=contextLines*2)for(let line of raw){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}else{let leadingLines=raw.slice(0,contextLines),trailingLines=raw.slice(raw.length-contextLines),skippedLines=raw.length-leadingLines.length-trailingLines.length;for(let line of leadingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}output.push(` ${"".padStart(lineNumWidth," ")} ...`),oldLineNum+=skippedLines,newLineNum+=skippedLines;for(let line of trailingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}}else if(hasLeadingChange){let shownLines=raw.slice(0,contextLines),skippedLines=raw.length-shownLines.length;for(let line of shownLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}skippedLines>0&&(output.push(` ${"".padStart(lineNumWidth," ")} ...`),oldLineNum+=skippedLines,newLineNum+=skippedLines)}',
		'function generateDiffString(oldContent,newContent,contextLines=3){oldContent=oldContent.replace(/^\\t+/gm,m=>"  ".repeat(m.length)),newContent=newContent.replace(/^\\t+/gm,m=>"  ".repeat(m.length));let parts=diffLines(oldContent,newContent),output=[],oldLines=oldContent.split(`\n`),newLines=newContent.split(`\n`),maxLineNum=Math.max(oldLines.length,newLines.length),lineNumWidth=String(maxLineNum).length,oldLineNum=1,newLineNum=1,lastWasChange=!1,firstChangedLine;for(let i=0;i<parts.length;i++){let part=parts[i],raw=part.value.split(`\n`);if(raw[raw.length-1]===""&&raw.pop(),part.added||part.removed){firstChangedLine===void 0&&(firstChangedLine=newLineNum);for(let line of raw)if(part.added){let lineNum=String(newLineNum).padStart(lineNumWidth," ");output.push(`+${lineNum} ${line}`),newLineNum++}else{let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(`-${lineNum} ${line}`),oldLineNum++}lastWasChange=!0}else{let nextPartIsChange=i<parts.length-1&&(parts[i+1].added||parts[i+1].removed),hasLeadingChange=lastWasChange,hasTrailingChange=nextPartIsChange;if(hasLeadingChange&&hasTrailingChange)if(raw.length<=contextLines*2)for(let line of raw){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}else{let leadingLines=raw.slice(0,contextLines),trailingLines=raw.slice(raw.length-contextLines),skippedLines=raw.length-leadingLines.length-trailingLines.length;for(let line of leadingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}output.push(` ${"".padStart(lineNumWidth," ")} ...`),oldLineNum+=skippedLines,newLineNum+=skippedLines;for(let line of trailingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}}else if(hasLeadingChange){let shownLines=raw.slice(0,contextLines);for(let line of shownLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}}',
	],
	[
		'function generateDiffString2(oldContent,newContent,contextLines=4){let parts=diffLines(oldContent,newContent),output=[],oldLines=oldContent.split(`\n`),newLines=newContent.split(`\n`),maxLineNum=Math.max(oldLines.length,newLines.length),lineNumWidth=String(maxLineNum).length,oldLineNum=1,newLineNum=1,lastWasChange=!1,firstChangedLine;for(let i=0;i<parts.length;i++){let part=parts[i],raw=part.value.split(`\n`);if(raw[raw.length-1]===""&&raw.pop(),part.added||part.removed){firstChangedLine===void 0&&(firstChangedLine=newLineNum);for(let line of raw)if(part.added){let lineNum=String(newLineNum).padStart(lineNumWidth," ");output.push(`+${lineNum} ${line}`),newLineNum++}else{let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(`-${lineNum} ${line}`),oldLineNum++}lastWasChange=!0}else{let nextPartIsChange=i<parts.length-1&&(parts[i+1].added||parts[i+1].removed),hasLeadingChange=lastWasChange,hasTrailingChange=nextPartIsChange;if(hasLeadingChange&&hasTrailingChange)if(raw.length<=contextLines*2)for(let line of raw){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}else{let leadingLines=raw.slice(0,contextLines),trailingLines=raw.slice(raw.length-contextLines),skippedLines=raw.length-leadingLines.length-trailingLines.length;for(let line of leadingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}output.push(` ${"".padStart(lineNumWidth," ")} ...`),oldLineNum+=skippedLines,newLineNum+=skippedLines;for(let line of trailingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}}else if(hasLeadingChange){let shownLines=raw.slice(0,contextLines),skippedLines=raw.length-shownLines.length;for(let line of shownLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}skippedLines>0&&(output.push(` ${"".padStart(lineNumWidth," ")} ...`),oldLineNum+=skippedLines,newLineNum+=skippedLines)}',
		'function generateDiffString2(oldContent,newContent,contextLines=3){oldContent=oldContent.replace(/^\\t+/gm,m=>"  ".repeat(m.length)),newContent=newContent.replace(/^\\t+/gm,m=>"  ".repeat(m.length));let parts=diffLines(oldContent,newContent),output=[],oldLines=oldContent.split(`\n`),newLines=newContent.split(`\n`),maxLineNum=Math.max(oldLines.length,newLines.length),lineNumWidth=String(maxLineNum).length,oldLineNum=1,newLineNum=1,lastWasChange=!1,firstChangedLine;for(let i=0;i<parts.length;i++){let part=parts[i],raw=part.value.split(`\n`);if(raw[raw.length-1]===""&&raw.pop(),part.added||part.removed){firstChangedLine===void 0&&(firstChangedLine=newLineNum);for(let line of raw)if(part.added){let lineNum=String(newLineNum).padStart(lineNumWidth," ");output.push(`+${lineNum} ${line}`),newLineNum++}else{let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(`-${lineNum} ${line}`),oldLineNum++}lastWasChange=!0}else{let nextPartIsChange=i<parts.length-1&&(parts[i+1].added||parts[i+1].removed),hasLeadingChange=lastWasChange,hasTrailingChange=nextPartIsChange;if(hasLeadingChange&&hasTrailingChange)if(raw.length<=contextLines*2)for(let line of raw){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}else{let leadingLines=raw.slice(0,contextLines),trailingLines=raw.slice(raw.length-contextLines),skippedLines=raw.length-leadingLines.length-trailingLines.length;for(let line of leadingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}output.push(` ${"".padStart(lineNumWidth," ")} ...`),oldLineNum+=skippedLines,newLineNum+=skippedLines;for(let line of trailingLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}}else if(hasLeadingChange){let shownLines=raw.slice(0,contextLines);for(let line of shownLines){let lineNum=String(oldLineNum).padStart(lineNumWidth," ");output.push(` ${lineNum} ${line}`),oldLineNum++,newLineNum++}}',
	],
	[
		'this.defaultEditor.onEscape=()=>{this.session.abortRetry()},this.showStatusIndicator(new RetryStatusIndicator(this.ui,event.attempt,event.maxAttempts,event.delayMs)),this.ui.requestRender();break}case"auto_retry_end":{this.retryEscapeHandler&&(this.defaultEditor.onEscape=this.retryEscapeHandler,this.retryEscapeHandler=void 0),this.clearStatusIndicator("retry"),event.success||this.showError(`Retry failed after ${event.attempt} attempts: ${event.finalError||"Unknown error"}`),this.ui.requestRender();break}',
		'this.defaultEditor.onEscape=()=>{this.session.abortRetry()},globalThis.__claudeRetry?globalThis.__claudeRetry.start(event):this.showStatusIndicator(new RetryStatusIndicator(this.ui,event.attempt,event.maxAttempts,event.delayMs)),this.ui.requestRender();break}case"auto_retry_end":{this.retryEscapeHandler&&(this.defaultEditor.onEscape=this.retryEscapeHandler,this.retryEscapeHandler=void 0),globalThis.__claudeRetry?.end(),this.clearStatusIndicator("retry"),event.success||globalThis.__claudeRetry||this.showError(`Retry failed after ${event.attempt} attempts: ${event.finalError||"Unknown error"}`),this.ui.requestRender();break}',
	],
	[
		'if(text==="/new"){this.editor.setText(""),await this.handleClearCommand();return}',
		'if(text==="/new"||text==="/clear"){this.editor.setText(""),this.clearCommandText=text,await this.handleClearCommand();return}',
	],
	[
		'{name:"new",description:"Start a new session"},',
		'{name:"new",description:"Start a new session"},{name:"clear",description:"Start a new session with empty context; previous session stays on disk (resumable with /resume)"},',
	],
	[
		'lines.push(this.renderItem(item,isSelected,width,descriptionSingleLine,primaryColumnWidth))',
		'lines.push(...this.renderItem(item,isSelected,width,descriptionSingleLine,primaryColumnWidth))',
	],
	[
		'renderItem(item,isSelected,width,descriptionSingleLine,primaryColumnWidth){let prefix=isSelected?"\\u2192 ":"  ",prefixWidth=visibleWidth(prefix);if(descriptionSingleLine&&width>40){let effectivePrimaryColumnWidth=Math.max(1,Math.min(primaryColumnWidth,width-prefixWidth-4)),maxPrimaryWidth=Math.max(1,effectivePrimaryColumnWidth-PRIMARY_COLUMN_GAP),truncatedValue2=this.truncatePrimary(item,isSelected,maxPrimaryWidth,effectivePrimaryColumnWidth),truncatedValueWidth=visibleWidth(truncatedValue2),spacing=" ".repeat(Math.max(1,effectivePrimaryColumnWidth-truncatedValueWidth)),descriptionStart=prefixWidth+truncatedValueWidth+spacing.length,remainingWidth=width-descriptionStart-2;if(remainingWidth>MIN_DESCRIPTION_WIDTH){let truncatedDesc=truncateToWidth(descriptionSingleLine,remainingWidth,"");if(isSelected)return this.theme.selectedText(`${prefix}${truncatedValue2}${spacing}${truncatedDesc}`);let descText=this.theme.description(spacing+truncatedDesc);return prefix+truncatedValue2+descText}}let maxWidth=width-prefixWidth-2,truncatedValue=this.truncatePrimary(item,isSelected,maxWidth,maxWidth);return isSelected?this.theme.selectedText(`${prefix}${truncatedValue}`):prefix+truncatedValue}',
		'renderItem(item,isSelected,width,descriptionSingleLine,primaryColumnWidth){if(this.layout&&this.layout.claudeMenu){let SEL="\\x1b[38;2;153;204;255m",UNSEL="\\x1b[38;2;153;153;153m",RST="\\x1b[39m",BOLD="\\x1b[1m",NOBOLD="\\x1b[22m",color=isSelected?SEL:UNSEL,prefix="  ",prefixWidth=2;let full=item.value,bare=full.startsWith("/")?full.slice(1):full,slash="/";let effectiveWidth=Math.max(1,Math.min(primaryColumnWidth,width-prefixWidth-4)),maxNameWidth=Math.max(1,effectiveWidth-PRIMARY_COLUMN_GAP);let truncatedBare=truncateToWidth(bare,Math.max(0,maxNameWidth-visibleWidth(slash)),"");let matchPrefix=(this.matchPrefix||"").toLowerCase(),typedBare=matchPrefix.startsWith("/")?matchPrefix.slice(1):matchPrefix;let matchLen=isSelected&&typedBare&&truncatedBare.toLowerCase().startsWith(typedBare)?typedBare.length:0;let nameOut=matchLen>0?BOLD+truncatedBare.slice(0,matchLen)+NOBOLD+truncatedBare.slice(matchLen):truncatedBare;let nameWidth=visibleWidth(slash)+visibleWidth(truncatedBare),spacing=" ".repeat(Math.max(1,effectiveWidth-nameWidth)),descriptionStart=prefixWidth+nameWidth+spacing.length,remainingWidth=width-descriptionStart-2;let firstLine=color+prefix+slash+nameOut;if(descriptionSingleLine&&remainingWidth>MIN_DESCRIPTION_WIDTH){let wrap2=(text,w)=>{if(visibleWidth(text)<=w)return[text];let cut=text.length;for(let k=text.length;k>0;k--){if(visibleWidth(text.slice(0,k))<=w){cut=k;break}}let sp=text.lastIndexOf(" ",cut),l1=sp>0?text.slice(0,sp):text.slice(0,cut),rest=text.slice(l1.length).trimStart();if(rest.length===0)return[l1];return[l1,truncateToWidth(rest,w,"\\u2026")]};let wrapped=wrap2(descriptionSingleLine,remainingWidth);firstLine+=spacing+wrapped[0]+RST;if(wrapped[1]!==void 0)return[firstLine,color+" ".repeat(descriptionStart)+wrapped[1]+RST];return[firstLine]}firstLine+=RST;return[firstLine]}let prefix=isSelected?"\\u2192 ":"  ",prefixWidth=visibleWidth(prefix);if(descriptionSingleLine&&width>40){let effectivePrimaryColumnWidth=Math.max(1,Math.min(primaryColumnWidth,width-prefixWidth-4)),maxPrimaryWidth=Math.max(1,effectivePrimaryColumnWidth-PRIMARY_COLUMN_GAP),truncatedValue2=this.truncatePrimary(item,isSelected,maxPrimaryWidth,effectivePrimaryColumnWidth),truncatedValueWidth=visibleWidth(truncatedValue2),spacing=" ".repeat(Math.max(1,effectivePrimaryColumnWidth-truncatedValueWidth)),descriptionStart=prefixWidth+truncatedValueWidth+spacing.length,remainingWidth=width-descriptionStart-2;if(remainingWidth>MIN_DESCRIPTION_WIDTH){let truncatedDesc=truncateToWidth(descriptionSingleLine,remainingWidth,"");if(isSelected)return[this.theme.selectedText(`${prefix}${truncatedValue2}${spacing}${truncatedDesc}`)];let descText=this.theme.description(spacing+truncatedDesc);return[prefix+truncatedValue2+descText]}}let maxWidth=width-prefixWidth-2,truncatedValue=this.truncatePrimary(item,isSelected,maxWidth,maxWidth);return isSelected?[this.theme.selectedText(`${prefix}${truncatedValue}`)]:[prefix+truncatedValue]}',
	],
	[
		'let layout=prefix.startsWith("/")?SLASH_COMMAND_SELECT_LIST_LAYOUT:void 0,list2=new SelectList(items,this.autocompleteMaxVisible,this.theme.selectList,layout);',
		'let layout=prefix.startsWith("/")?SLASH_COMMAND_SELECT_LIST_LAYOUT:void 0,list2=new SelectList(items,this.autocompleteMaxVisible,this.theme.selectList,layout);list2.matchPrefix=prefix;',
	],
	[
		'SLASH_COMMAND_SELECT_LIST_LAYOUT={minPrimaryColumnWidth:12,maxPrimaryColumnWidth:32}',
		'SLASH_COMMAND_SELECT_LIST_LAYOUT={minPrimaryColumnWidth:30,maxPrimaryColumnWidth:30,claudeMenu:!0}',
	],
	[
		'filtered=fuzzyFilter(commandItems,prefix,item=>item.name).map(item=>({value:item.name,label:item.label,...item.description&&{description:item.description}}));return filtered.length===0?null:{items:filtered,prefix:textBeforeCursor}}',
		'filtered=(globalThis.__claudeSlashMatch?globalThis.__claudeSlashMatch(commandItems,prefix):fuzzyFilter(commandItems,prefix,item=>item.name)).map(item=>({value:item.name,label:item.label,...item.description&&{description:item.description}}));return filtered.length===0?null:{items:filtered,prefix:textBeforeCursor}}',
	],
	[
		"isWhitespace?(currentLine=tracker.getActiveCodes(),currentVisibleLength=0)",
		"isWhitespace?(currentLine=tracker.getActiveCodes(),currentVisibleLength=currentVisibleLength>=width?1:0)",
	],
	[
		"this.renderWidgetContainer(this.widgetContainerAbove,this.extensionWidgetsAbove,!0,!0),this.renderWidgetContainer(this.widgetContainerBelow,this.extensionWidgetsBelow,!1,!1)",
		"this.renderWidgetContainer(this.widgetContainerAbove,this.extensionWidgetsAbove,this.editorContainer.children[0]===this.editor,this.editorContainer.children[0]===this.editor),this.renderWidgetContainer(this.widgetContainerBelow,this.extensionWidgetsBelow,!1,!1)",
	],
	[
		"else this.disposeActiveSelector(),this.editorContainer.clear(),this.editorContainer.addChild(component),this.ui.setFocus(component),this.ui.requestRender()",
		"else this.disposeActiveSelector(),this.editorContainer.clear(),this.editorContainer.addChild(component),this.ui.setFocus(component),this.renderWidgets(),this.ui.requestRender()",
	],
	[
		"restoreEditor2=()=>{this.editorContainer.clear(),this.editorContainer.addChild(this.editor),this.editor.setText(savedText),this.ui.setFocus(this.editor),this.ui.requestRender()}",
		"restoreEditor2=()=>{this.editorContainer.clear(),this.editorContainer.addChild(this.editor),this.editor.setText(savedText),this.ui.setFocus(this.editor),this.renderWidgets(),this.ui.requestRender()}",
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
