import hljs from "highlight.js";
import { STORAGE } from "./format.ts";

interface HljsNode {
	scope?: string;
	children?: HljsChild[];
}
type HljsChild = HljsNode | string;
interface HljsResult {
	_emitter?: { rootNode?: HljsNode };
}

const FOREGROUND = "f8f8f2";

const SCOPES = new Map<string, string>([
	["keyword", "f92672"],
	["_storage", "66d9ef"],
	["built_in", "a6e22e"],
	["type", "a6e22e"],
	["literal", "be84ff"],
	["number", "be84ff"],
	["string", "e6db74"],
	["title", "a6e22e"],
	["title.function", "a6e22e"],
	["title.class", "a6e22e"],
	["title.class.inherited", "a6e22e"],
	["params", "fd971f"],
	["comment", "75715e"],
	["meta", "75715e"],
	["attr", "a6e22e"],
	["attribute", "a6e22e"],
	["variable", "ffffff"],
	["variable.language", "ffffff"],
	["property", "ffffff"],
	["operator", "f92672"],
	["punctuation", "f8f8f2"],
	["symbol", "be84ff"],
	["regexp", "e6db74"],
	["subst", "f8f8f2"],
]);

function beforeLastDot(scope: string): string {
	const at = scope.lastIndexOf(".");
	return at === -1 ? scope : scope.slice(0, at);
}

function resolveColor(scope: string | undefined, text: string): string {
	if (!scope) return FOREGROUND;
	if (scope === "keyword" && STORAGE.has(text.trim())) return SCOPES.get("_storage") ?? FOREGROUND;
	return SCOPES.get(scope) ?? SCOPES.get(beforeLastDot(scope)) ?? FOREGROUND;
}

type ColorRun = [string, string];

function walk(node: HljsChild, parentScope: string | undefined, out: ColorRun[]): void {
	if (typeof node === "string") {
		out.push([resolveColor(parentScope, node), node]);
		return;
	}
	const scope = node.scope ?? parentScope;
	for (const child of node.children ?? []) walk(child, scope, out);
}

function ansiFg(hex: string): string {
	return `\x1b[38;2;${parseInt(hex.slice(0, 2), 16)};${parseInt(hex.slice(2, 4), 16)};${parseInt(hex.slice(4, 6), 16)}m`;
}

function toAnsi(runs: ColorRun[]): string {
	let out = "";
	for (const [color, text] of runs) out += color === FOREGROUND ? text : `${ansiFg(color)}${text}\x1b[39m`;
	return out;
}

export function highlightClaudeStyle(code: string, lang: string): string | undefined {
	if (!hljs.getLanguage(lang)) return undefined;
	let result: HljsResult;
	try {
		result = hljs.highlight(code, { language: lang, ignoreIllegals: true }) as HljsResult;
	} catch {
		return undefined;
	}
	const root = result._emitter?.rootNode;
	if (!root || !Array.isArray(root.children)) return undefined;
	const runs: ColorRun[] = [];
	walk(root, undefined, runs);
	return toAnsi(runs);
}

if (process.env.CLAUDE_TOOLS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	check(resolveColor("keyword", "for") === "f92672", "a plain keyword stays keyword pink");
	check(resolveColor("keyword", "const") === "66d9ef", "a storage keyword takes the cyan _storage colour");
	check(resolveColor("keyword", " const ") === "66d9ef", "the storage check trims the token before matching");
	check(resolveColor("title.class.inherited", "Base") === "a6e22e", "an exact dotted scope hits the map directly");
	check(resolveColor("title.class.mystery", "x") === "a6e22e", "an unlisted dotted scope falls back one dot level");
	check(resolveColor("mystery", "x") === FOREGROUND, "a scope with no map entry and no dot falls to the plain foreground");
	check(resolveColor(undefined, "x") === FOREGROUND, "no scope at all is the plain foreground");

	const add = "export function add(a: number, b: number): number {\n  return a + b;\n}\n";
	const highlighted = highlightClaudeStyle(add, "typescript")!;
	check(highlighted.replace(/\x1b\[[0-9;]*m/g, "") === add, "the painted text round-trips to exactly the source, ANSI stripped");
	check(highlighted.includes(`${ansiFg("f92672")}export\x1b[39m`), "export is keyword pink");
	check(highlighted.includes(`${ansiFg("66d9ef")}function\x1b[39m`), "function is storage cyan, not keyword pink");
	check(highlighted.includes(`${ansiFg("a6e22e")}add\x1b[39m`), "the function's own title is green");
	check(highlighted.includes(`${ansiFg("a6e22e")}a\x1b[39m${ansiFg("fd971f")}: \x1b[39m`), "a typed parameter name is its own node: name green, colon params-orange");
	check(highlighted.includes(`${ansiFg("a6e22e")}number\x1b[39m`), "a built-in type name is green");
	check(highlighted.includes(`${ansiFg("fd971f")}, \x1b[39m${ansiFg("a6e22e")}b\x1b[39m${ansiFg("fd971f")}: \x1b[39m`), "the second parameter's comma and colon stay params-orange, its name is green");
	check(!highlighted.includes(`${ansiFg("a6e22e")})`), "the punctuation between the params and the return type is never coloured like a param name");

	check(highlightClaudeStyle("hello", "not-a-real-language") === undefined, "an unregistered language returns undefined, like Claude's null-lang branch");
	console.log("\nAll claude-tools highlight checks passed.");
}
