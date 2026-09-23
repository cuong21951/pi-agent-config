import hljs from "highlight.js";

interface HljsNode {
	scope?: string;
	kind?: string;
	children?: HljsChild[];
}
type HljsChild = HljsNode | string;
interface HljsResult {
	_emitter?: { rootNode?: HljsNode };
	emitter?: { rootNode?: HljsNode };
}

type Style = readonly [string, string] | null;

const SCOPES = new Map<string, Style>([
	["keyword", ["34", "39"]],
	["built_in", ["36", "39"]],
	["type", ["36;2", "39;22"]],
	["literal", ["34", "39"]],
	["number", ["32", "39"]],
	["regexp", ["31", "39"]],
	["string", ["31", "39"]],
	["subst", null],
	["symbol", null],
	["class", ["34", "39"]],
	["function", ["33", "39"]],
	["title", null],
	["title.function", ["33", "39"]],
	["title.class", ["34", "39"]],
	["params", null],
	["comment", ["32", "39"]],
	["doctag", ["32", "39"]],
	["meta", ["90", "39"]],
	["meta-keyword", null],
	["meta-string", null],
	["meta.keyword", null],
	["meta.string", null],
	["section", null],
	["tag", ["90", "39"]],
	["name", ["34", "39"]],
	["attr", ["36", "39"]],
	["attribute", null],
	["variable", null],
	["bullet", null],
	["code", null],
	["emphasis", ["3", "23"]],
	["strong", ["1", "22"]],
	["link", ["4", "24"]],
	["quote", null],
	["addition", ["32", "39"]],
	["deletion", ["31", "39"]],
]);

const PERMISSION_OPEN = "\x1b[38;2;153;204;255m";
const PERMISSION_CLOSE = "\x1b[39m";
const RESET_OPEN = "\x1b[0m";
const RESET_CLOSE = "\x1b[0m";

function resolveStyle(scope: string): Style | undefined {
	let t = scope.startsWith("hljs-") ? scope.slice(5) : scope;
	for (;;) {
		if (SCOPES.has(t)) return SCOPES.get(t);
		const dot = t.lastIndexOf(".");
		if (dot < 0) return undefined;
		t = t.slice(0, dot);
	}
}

function reopenAfter(text: string, close: string, open: string): string {
	return text.split(close).join(close + open);
}

function wrap(style: Style, text: string): string {
	if (style === null) return `${RESET_OPEN}${reopenAfter(text, RESET_CLOSE, RESET_OPEN)}${RESET_CLOSE}`;
	const open = `\x1b[${style[0]}m`;
	const close = `\x1b[${style[1]}m`;
	return `${open}${reopenAfter(text, close, open)}${close}`;
}

function paint(node: HljsChild): string {
	if (typeof node === "string") return node;
	const scope = node.scope ?? node.kind;
	const inner = (node.children ?? []).map(paint).join("");
	const style = scope !== undefined ? resolveStyle(scope) : undefined;
	return style !== undefined ? wrap(style, inner) : inner;
}

function supportsLanguage(name: string): boolean {
	return name !== "" && !!hljs.getLanguage(name);
}

function hljsHighlightLines(code: string, language: string): string[] {
	try {
		const result = hljs.highlight(code, { language, ignoreIllegals: true }) as HljsResult;
		const root = result._emitter?.rootNode ?? result.emitter?.rootNode;
		if (!root || !Array.isArray(root.children)) return code.split("\n");
		return paint(root).split("\n");
	} catch {
		return code.split("\n");
	}
}

const TRIMMED = /\S(?:.*\S)?/;

function untaggedLines(code: string): string[] {
	return code.split("\n").map((line) => {
		const m = TRIMMED.exec(line);
		if (!m) return line;
		return line.slice(0, m.index) + PERMISSION_OPEN + m[0] + PERMISSION_CLOSE + line.slice(m.index + m[0].length);
	});
}

export function highlightMarkdownFence(code: string, lang: string | undefined): string[] {
	const s = lang ?? "";
	if (!s) return untaggedLines(code);
	const prefix = s.match(/^[\w.+#-]+/)?.[0] ?? "";
	const fullSupported = supportsLanguage(s);
	const resolved = fullSupported ? s : supportsLanguage(prefix) ? prefix : "plaintext";
	const label = fullSupported ? [] : [`\x1b[2m${s}\x1b[22m`];
	return [...label, ...hljsHighlightLines(code, resolved)];
}

declare global {
	var __claudeFenceHighlight: ((code: string, lang: string | undefined) => string[]) | undefined;
}
globalThis.__claudeFenceHighlight = highlightMarkdownFence;

if (process.env.MARKDOWN_HIGHLIGHT_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	check(resolveStyle("keyword")?.[0] === "34", "a keyword is ansi blue");
	check(resolveStyle("built_in")?.[0] === "36", "a built-in is ansi cyan");
	check(resolveStyle("type")?.[0] === "36;2", "a type annotation is dim cyan");
	check(resolveStyle("title") === null, "a bare title is explicitly uncoloured, not inherited");
	check(resolveStyle("title.function")?.[0] === "33", "a function's own title is ansi yellow");
	check(resolveStyle("title.class.inherited")?.[0] === "34", "an unlisted dotted scope falls back one dot level to title.class");
	check(resolveStyle("meta.keyword") === null, "meta.keyword is explicitly uncoloured, it does not fall back to meta's grey");
	check(resolveStyle("mystery") === undefined, "a scope with no map entry and no dot resolves to nothing (inherit ancestor)");

	const add = "export function add(a: number, b: number): number {\n  return a + b;\n}\n";
	const lines = highlightMarkdownFence(add, "typescript");
	const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
	check(strip(lines.join("\n")) === add, "the painted lines round-trip to exactly the source, ANSI stripped");
	check(lines.some((l) => l.includes("\x1b[34mexport\x1b[39m")), "export is keyword blue");
	check(lines.some((l) => l.includes("\x1b[33madd\x1b[39m")), "the function's own title is yellow");
	const signature = lines.find((l) => l.includes("): "))!;
	check(signature.includes("): \x1b[36mnumber\x1b[39m {"), "the return type is built-in cyan, not inherited brown from a wrapping function scope");
	check(!signature.includes("\x1b[33m)"), "the punctuation between the params and the return type is never coloured like the title");

	const untagged = untaggedLines("  hello world  \n\nplain");
	check(untagged[0] === `  ${PERMISSION_OPEN}hello world${PERMISSION_CLOSE}  `, "an untagged fence colours only the trimmed run per line, permission 99ccff");
	check(untagged[1] === "", "a blank line in an untagged fence stays blank");

	const unsupported = highlightMarkdownFence("some raw text", "not-a-real-language");
	check(unsupported[0] === "\x1b[2mnot-a-real-language\x1b[22m", "an unsupported language gets a dim label line above the plaintext body");
	check(unsupported[1] === "some raw text", "plaintext highlighting leaves the body unstyled");

	const pySnippet = 'def greet(name):\n    """Say hi."""\n    return f"hi {name}"\n';
	const py = highlightMarkdownFence(pySnippet, "python").join("\n");
	check(py.includes("\x1b[34mdef\x1b[39m"), "python's def keyword is ansi blue");
	check(py.includes("\x1b[33mgreet\x1b[39m"), "python's function title is ansi yellow");
	check(py.includes("\x1b[31m") && strip(py) === pySnippet, "python strings/docstrings paint red and round-trip");

	const fstring = highlightMarkdownFence('x = f"hi {name}! bye"\n', "python").join("\n");
	check(strip(fstring) === 'x = f"hi {name}! bye"\n', "an f-string with a substitution round-trips");
	check(!fstring.slice(fstring.indexOf("name") + 4).startsWith("\x1b[31m! bye"), "text after a subst does not regain the string's red — a subst's own reset (SGR 0) breaks the enclosing colour, same as real nested chalk styles");

	const arithFstring = highlightMarkdownFence('x = f"{1 + 2}"\n', "python").join("\n");
	check(arithFstring.includes("\x1b[32m1\x1b[39m\x1b[31m + \x1b[32m2\x1b[39m"), "between two numbers inside a subst, the plain \" + \" regains the enclosing string's red — a colour close (SGR 39) IS the string's own close, so chalk's nesting fix reopens it, unlike a full reset (SGR 0)");

	console.log("\nAll markdown-highlight checks passed.");
}
