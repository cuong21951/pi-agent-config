const VOWEL = /[aeiou]/i;
const SHORT_CVC = /[^aeiou][aeiou][bcdfghjklmnpqrstvz]$/i;
const PAST: Record<string, string> = {
	begin: "began", bind: "bound", bring: "brought", build: "built", buy: "bought", catch: "caught", choose: "chose", come: "came",
	cut: "cut", debug: "debugged", dig: "dug", do: "did", draw: "drew", feed: "fed", feel: "felt", fight: "fought", find: "found",
	fly: "flew", forget: "forgot", freeze: "froze", get: "got", give: "gave", go: "went", have: "had", hide: "hid", hit: "hit",
	hold: "held", input: "input", keep: "kept", know: "knew", lead: "led", leave: "left", let: "let", lose: "lost", make: "made",
	mean: "meant", meet: "met", override: "overrode", overwrite: "overwrote", pay: "paid", put: "put", quit: "quit", read: "read",
	rebuild: "rebuilt", redo: "redid", rerun: "reran", reset: "reset", rewrite: "rewrote", run: "ran", see: "saw", seek: "sought",
	send: "sent", set: "set", show: "showed", shut: "shut", sit: "sat", sleep: "slept", spend: "spent", spin: "spun", split: "split",
	spread: "spread", stand: "stood", sweep: "swept", sync: "synced", take: "took", teach: "taught", tear: "tore", tell: "told",
	think: "thought", throw: "threw", understand: "understood", undo: "undid", unset: "unset", win: "won", unwrap: "unwrapped",
	unzip: "unzipped", write: "wrote",
};
const RUNNING: Record<string, string> = {
	begin: "beginning", commit: "committing", control: "controlling", debug: "debugging", emit: "emitting", equip: "equipping",
	forget: "forgetting", format: "formatting", input: "inputting", occur: "occurring", omit: "omitting", output: "outputting",
	permit: "permitting", prefer: "preferring", quit: "quitting", refer: "referring", rerun: "rerunning", reset: "resetting",
	screenshot: "screenshotting", snapshot: "snapshotting", submit: "submitting", sync: "syncing", transfer: "transferring",
	unset: "unsetting", unwrap: "unwrapping", unzip: "unzipping",
};
const INFLECTED = new Set([
	...Object.entries(PAST).filter(([base, past]) => base !== past).map(([, past]) => past),
	"been", "broken", "chosen", "done", "drawn", "driven", "eaten", "fallen", "forgotten", "given", "gone", "grown", "hidden",
	"known", "ridden", "risen", "seen", "shown", "spoken", "taken", "thrown", "torn", "worn", "written",
]);
const AMBIGUOUS = new Set([
	"output", "input", "lead", "feed", "spread", "set", "cut", "split", "hit", "let", "put", "quit", "shut", "read", "go", "make",
	"dig", "tear", "win", "fly", "spin", "control", "permit", "have", "hold", "keep", "mean", "feel", "do", "see", "know", "think",
	"understand",
]);
const KNOWN = new Set([
	...Object.keys(PAST).filter((verb) => !AMBIGUOUS.has(verb)),
	...Object.keys(RUNNING).filter((verb) => !AMBIGUOUS.has(verb)),
	"add", "analyze", "append", "apply", "archive", "assert", "attempt", "autofix", "await", "benchmark", "bisect", "call", "capture",
	"check", "clone", "collect", "compare", "compile", "compute", "confirm", "connect", "convert", "copy", "count", "create", "curl",
	"decode", "delete", "deploy", "detect", "discard", "dismiss", "display", "download", "dump", "edit", "emit", "enable", "encode",
	"ensure", "enumerate", "evaluate", "execute", "expand", "expect", "export", "extract", "fetch", "fill", "filter", "fix", "flush",
	"focus", "follow", "generate", "grep", "identify", "ignore", "import", "include", "inject", "insert", "inspect", "install",
	"invoke", "kill", "launch", "lint", "list", "load", "locate", "loop", "measure", "merge", "monitor", "move", "navigate",
	"normalize", "parse", "patch", "pick", "ping", "pipe", "poll", "post", "prepare", "preview", "print", "probe", "profile", "prune",
	"publish", "pull", "push", "queue", "rebase", "recheck", "record", "recover", "redirect", "reduce", "refresh", "regenerate",
	"reinstall", "relaunch", "reload", "remove", "rename", "render", "reopen", "repeat", "replay", "reply", "report", "request",
	"resolve", "restart", "restore", "retry", "revert", "save", "scan", "screenshot", "scroll", "search", "select", "serialize",
	"serve", "settle", "skip", "snapshot", "sort", "spawn", "squash", "stage", "start", "stash", "stop", "strip", "summarize",
	"switch", "sync", "tail", "tally", "test", "toggle", "touch", "trace", "track", "trigger", "trim", "truncate", "try",
	"typecheck", "unblock", "uninstall", "unlink", "unmount", "unpack", "update", "upgrade", "upload", "validate", "verify", "visit",
	"wait", "walk", "warn", "wipe",
]);
const CHAINED = /(?:(?<![\w-])((?:(?:[Aa]nd|[Tt]hen)\s+)+)|(,\s+(?:(?:and|then)\s+)*))([a-z]{2,16})(?=$|[\s,;!?]|\.(?:\s|$))/g;
const PREDICATE_FOLLOWS = /^(?:\s+\w+){0,2}\s+(?:is|are|was|were|has|have|do|does|did|will|would|should|can|could|passes|passed|fails|failed|exists|works|worked|succeeds|succeeded|stays|remains|looks|runs|ran|not|if|when|unless|whether)(?:n['’]t)?\b/;
const PREFIXED = /^(re|un|de|pre|co|sub|over|out|mis|auto|post)-(.+)$/i;

export type Forms = { running: string; done: string; infinitive: string };

function vowelCount(word: string): number {
	return (word.match(/[aeiou]/gi) ?? []).length;
}

function ing(word: string): string {
	const lower = word.toLowerCase();
	if (Object.hasOwn(RUNNING, lower)) return RUNNING[lower];
	if (/ie$/i.test(word)) return `${word.slice(0, -2)}ying`;
	if (/[^eoy]e$/i.test(word)) return `${word.slice(0, -1)}ing`;
	if (SHORT_CVC.test(word) && vowelCount(word) === 1) return `${word}${word.slice(-1)}ing`;
	if (/c$/i.test(word)) return `${word}king`;
	return `${word}ing`;
}

function ed(word: string): string {
	const lower = word.toLowerCase();
	if (Object.hasOwn(PAST, lower)) return PAST[lower];
	if (/e$/i.test(word)) return `${word}d`;
	if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ied`;
	if (SHORT_CVC.test(word) && vowelCount(word) === 1) return `${word}${word.slice(-1)}ed`;
	if (/c$/i.test(word)) return `${word}ked`;
	if (Object.hasOwn(RUNNING, lower)) return `${RUNNING[lower].slice(0, -3)}ed`;
	return `${word}ed`;
}

function caseOf(word: string, form: string): string {
	return /^[A-Z]/.test(word) ? form.charAt(0).toUpperCase() + form.slice(1) : form;
}

function verbLike(word: string): boolean {
	if (word.length < 2 || word.length > 16 || !/^[A-Za-z]+$/.test(word) || word === word.toUpperCase()) return false;
	const lower = word.toLowerCase();
	if (INFLECTED.has(lower)) return false;
	if (Object.hasOwn(PAST, lower)) return true;
	if (/ing$/i.test(word) && word.length > 4) return false;
	if (/ed$/i.test(word) && !/eed$/i.test(word) && word.length > 3) return false;
	if (/s$/i.test(word) && !/(ss|us)$/i.test(word) && word.length > 3) return false;
	return VOWEL.test(word) || /y/i.test(word);
}

function chained(text: string, form: (word: string) => string): string {
	return text.replace(CHAINED, (match: string, joined: string | undefined, comma: string | undefined, verb: string, at: number) =>
		KNOWN.has(verb) && !PREDICATE_FOLLOWS.test(text.slice(at + match.length)) ? (joined ?? comma ?? "") + form(verb) : match,
	);
}

export function conjugate(phrase: string): Forms | undefined {
	const trimmed = phrase.trimStart();
	const lead = phrase.slice(0, phrase.length - trimmed.length);
	const split = /^(\S+)([\s\S]*)$/.exec(trimmed);
	if (!split) return undefined;
	const [, first, rest = ""] = split;
	const prefixed = PREFIXED.exec(first);
	if (prefixed && prefixed[2] !== undefined && verbLike(prefixed[2])) {
		const [, prefix, stem] = prefixed;
		const whole = (prefix + stem).toLowerCase();
		if (INFLECTED.has(whole) || INFLECTED.has(stem.toLowerCase())) return undefined;
		const form = (table: Record<string, string>, rule: (word: string) => string) =>
			`${prefix}-${caseOf(stem, Object.hasOwn(table, whole) ? table[whole].slice(prefix.length) : rule(stem))}`;
		return { running: lead + form(RUNNING, ing) + chained(rest, ing), done: lead + form(PAST, ed) + chained(rest, ed), infinitive: lead + first.toLowerCase() + rest };
	}
	if (!verbLike(first)) return undefined;
	return {
		running: lead + caseOf(first, ing(first)) + chained(rest, ing),
		done: lead + caseOf(first, ed(first)) + chained(rest, ed),
		infinitive: lead + first.charAt(0).toLowerCase() + first.slice(1) + rest,
	};
}

export function runningDescription(description: string): string {
	const first = /^\s*(\S+)/.exec(description)?.[1];
	if (first === undefined) return description;
	const base = (PREFIXED.exec(first)?.[2] ?? first).toLowerCase();
	const known = KNOWN.has(base) || Object.hasOwn(PAST, base) || Object.hasOwn(RUNNING, base);
	return (known ? conjugate(description)?.running : undefined) ?? description;
}

if (process.env.CLAUDE_VERBS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	check(runningDescription("Wait for the timer") === "Waiting for the timer", "a known verb conjugates, as Claude 2.1.280 showed \"Waiting for the timer\"");
	check(runningDescription("Pause a few seconds") === "Pause a few seconds", "a verb outside Claude's table stays as written, as Claude 2.1.280 showed \"Pause a few seconds\"");
	check(runningDescription("Run tests and check the output") === "Running tests and checking the output", "a verb chained with and/then conjugates too");
	check(runningDescription("Check if the build passes") === "Checking if the build passes", "only the leading and chained verbs change");
	check(runningDescription("List files, then count them") === "Listing files, then counting them", "a comma-chained verb conjugates");
	check(runningDescription("Re-run the suite") === "Re-running the suite", "a hyphenated prefix keeps its hyphen");
	check(runningDescription("Sync branches") === "Syncing branches" && runningDescription("Submit the form") === "Submitting the form", "a verb in the irregular tables counts as known and takes its listed form");
	check(runningDescription("Read the log") === "Reading the log" && runningDescription("Pause, then read it") === "Pause, then read it", "an ambiguous verb leads but never chains, like Claude's");
	check(conjugate("Write the summary")?.done === "Wrote the summary" && conjugate("Fix the bug")?.done === "Fixed the bug", "the done form uses the irregular past table");
	check(runningDescription("") === "" && runningDescription("git status") === "git status", "no verb, no change");
}
