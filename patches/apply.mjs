// Re-applies every patch in this folder after `pi update` / `pi install` put the packages back clean.
//   node patches/apply.mjs               apply what is missing, then run the self-checks
//   node patches/apply.mjs --if-changed  do nothing unless a patched package changed since the last clean run
// A diff that neither applies nor is already applied means the package moved under it: the patch has to be
// ported (see README.md), so the script says which one and exits 1 instead of half-patching.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.resolve(here, "..");
const stampFile = path.join(here, ".applied-stamp");

const DIFFS = [
	["pi-mcp-adapter", "pi-mcp-adapter.patch", "pi-mcp-adapter.selftest.ts"],
	["pi-deepseek-search", "pi-deepseek-search.patch", "pi-deepseek-search.selftest.ts"],
	["pi-web-access", "pi-web-access.patch", "pi-web-access.selftest.ts"],
	["@juicesharp/rpiv-ask-user-question", "rpiv-ask-user-question.patch", "rpiv-ask-user-question.selftest.ts"],
	["@tintinweb/pi-subagents", "pi-subagents.patch", "pi-subagents.selftest.ts"],
	["@dietrichgebert/ponytail", "ponytail.patch", "ponytail.selftest.ts"],
];

const PI_INSTALLS = [
	path.join(process.env.APPDATA ?? "", "npm/node_modules/@earendil-works/pi-coding-agent"),
	path.join(process.env.LOCALAPPDATA ?? "", "Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent"),
];

const packageDir = (name) => path.join(agentDir, "npm/node_modules", name);

function fingerprint() {
	const manifests = [...DIFFS.map(([name]) => packageDir(name)), ...PI_INSTALLS].map((dir) => path.join(dir, "package.json"));
	const patches = DIFFS.map(([, patch]) => path.join(here, patch)).concat(path.join(here, "pi-coding-agent.patch.mjs"));
	return [...manifests, ...patches]
		.map((file) => (existsSync(file) ? `${file}:${statSync(file).mtimeMs}` : `${file}:missing`))
		.join("\n");
}

function git(args) {
	return spawnSync("git", ["-c", "core.autocrlf=false", "apply", ...args], { cwd: agentDir, encoding: "utf8" });
}

function applyDiff(name, patch) {
	if (!existsSync(packageDir(name))) return { name, state: "not installed" };
	const where = [`--directory=npm/node_modules/${name}`, path.join("patches", patch)];
	if (git(["--check", "-R", ...where]).status === 0) return { name, state: "already applied" };
	if (git(["--check", ...where]).status !== 0) return { name, state: "NEEDS PORT", failed: true };
	const applied = git(where);
	return applied.status === 0 ? { name, state: "applied", changed: true } : { name, state: `apply failed: ${applied.stderr.trim()}`, failed: true };
}

function node(script) {
	return spawnSync(process.execPath, [script], { cwd: agentDir, encoding: "utf8" });
}

const ifChanged = process.argv.includes("--if-changed");
const print = fingerprint();
if (ifChanged && existsSync(stampFile) && readFileSync(stampFile, "utf8") === print) process.exit(0);

const results = DIFFS.map(([name, patch]) => applyDiff(name, patch));
const core = node(path.join(here, "pi-coding-agent.patch.mjs"));
results.push({ name: "pi-coding-agent", state: core.status === 0 ? "patched" : `NEEDS PORT\n${core.stderr.trim()}`, failed: core.status !== 0 });

const checks = DIFFS.filter(([name, , selftest]) => selftest && existsSync(packageDir(name))).map(([name, , selftest]) => {
	const run = node(path.join(here, selftest));
	return { name: `${name} self-check`, state: run.status === 0 ? "ok" : "FAILED", failed: run.status !== 0 };
});

const all = [...results, ...checks];
const failed = all.some((result) => result.failed);
if (!ifChanged || failed || all.some((result) => result.changed)) {
	for (const result of all) console.log(`${result.failed ? "✗" : "✓"} ${result.name}: ${result.state}`);
}
if (failed) {
	console.log("pi patches need porting: see ~/.pi/agent/patches/README.md");
	process.exit(1);
}
writeFileSync(stampFile, fingerprint());
