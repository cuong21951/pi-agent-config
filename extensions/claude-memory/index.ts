/**
 * Claude Memory Extension
 *
 * Claude Code keeps a per-project memory index at
 * ~/.claude/projects/<slug>/memory/MEMORY.md and injects it every session.
 * This does the same for pi: the index only, never the individual notes.
 * A `remember` tool writes new notes in the same format so both agents
 * share one memory.
 *
 * The slug is the absolute project path with every non-alphanumeric character
 * replaced by "-" (C:\TimeBlock -> C--TimeBlock).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const projectsDir = path.join(os.homedir(), ".claude", "projects");
const sections = new Map<string, string | null>();

function slugify(dir: string): string {
	return dir.replace(/[^a-zA-Z0-9]/g, "-");
}

function findMemoryIndex(cwd: string): string | null {
	let dir = path.resolve(cwd);
	for (;;) {
		const file = path.join(projectsDir, slugify(dir), "memory", "MEMORY.md");
		if (fs.existsSync(file)) {
			return file;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			return null;
		}
		dir = parent;
	}
}

function memorySection(cwd: string): string | null {
	const cached = sections.get(cwd);
	if (cached !== undefined) {
		return cached;
	}
	const file = findMemoryIndex(cwd);
	const section = file
		? `\n\n# Project memory (index)\n${fs.readFileSync(file, "utf-8")}\n\nFull notes live in ${path.dirname(file)}; read the file named in an entry before acting on it. Save a new durable fact with the \`remember\` tool.`
		: null;
	sections.set(cwd, section);
	return section;
}

function memoryDir(cwd: string): string {
	const existing = findMemoryIndex(cwd);
	return existing ? path.dirname(existing) : path.join(projectsDir, slugify(path.resolve(cwd)), "memory");
}

function noteName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function writeNote(dir: string, name: string, description: string, type: string, body: string): string {
	fs.mkdirSync(dir, { recursive: true });
	const slug = noteName(name);
	const file = path.join(dir, `${slug}.md`);
	const isNew = !fs.existsSync(file);
	fs.writeFileSync(
		file,
		`---\nname: ${slug}\ndescription: ${description}\nmetadata:\n  type: ${type}\n---\n\n${body.trim()}\n`,
	);
	const index = path.join(dir, "MEMORY.md");
	const line = `- [${name}](${slug}.md) — ${description}`;
	const current = fs.existsSync(index) ? fs.readFileSync(index, "utf-8") : "# Memory Index\n\n";
	const kept = current
		.split("\n")
		.filter((l) => !l.includes(`](${slug}.md)`))
		.join("\n")
		.replace(/\n+$/, "");
	fs.writeFileSync(index, `${kept}\n${line}\n`);
	return `${isNew ? "Saved" : "Updated"} ${file} and its MEMORY.md line.`;
}

export default function claudeMemoryExtension(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event, ctx) => {
		const section = memorySection(ctx.cwd);
		if (!section) {
			return;
		}
		return { systemPrompt: event.systemPrompt + section };
	});

	pi.registerTool({
		name: "remember",
		label: "remember",
		description:
			"Save one durable fact to the shared Claude/pi project memory (not for anything derivable from the repo or git history). " +
			"One fact per note. Re-using a name updates that note.",
		parameters: Type.Object({
			name: Type.String({ description: "Short kebab-case slug, e.g. tma-wfh-vpn" }),
			description: Type.String({ description: "One-line summary used to decide relevance later" }),
			type: Type.Union([Type.Literal("user"), Type.Literal("feedback"), Type.Literal("project"), Type.Literal("reference")]),
			body: Type.String({ description: "The fact. For feedback/project follow with **Why:** and **How to apply:** lines." }),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const result = writeNote(memoryDir(ctx.cwd), params.name, params.description, params.type, params.body);
			sections.delete(ctx.cwd);
			return { content: [{ type: "text", text: result }] };
		},
	});
}

if (process.env.CLAUDE_MEMORY_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	check(slugify("C:\\TimeBlock") === "C--TimeBlock", "slugify drive path");
	check(
		slugify("C:\\Users\\cuong\\OneDrive\\Documents\\Global Computer") ===
			"C--Users-cuong-OneDrive-Documents-Global-Computer",
		"slugify path with space",
	);
	check(
		slugify("C:\\TimeBlock\\_worktrees\\32592-joost-api") === "C--TimeBlock--worktrees-32592-joost-api",
		"slugify underscore",
	);
	check(findMemoryIndex("C:\\TimeBlock")?.includes("C--TimeBlock") === true, "exact slug match");
	check(
		findMemoryIndex("C:\\TimeBlock\\_worktrees\\31777")?.includes(`C--TimeBlock${path.sep}memory`) === true,
		"unknown worktree falls back to parent project",
	);
	check(findMemoryIndex("C:\\Windows\\Temp") === null, "no memory outside known projects");

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claude-memory-"));
	writeNote(tmp, "Test Note", "first", "project", "body one");
	writeNote(tmp, "Test Note", "second", "project", "body two");
	const index = fs.readFileSync(path.join(tmp, "MEMORY.md"), "utf-8");
	check(index.split("test-note.md").length === 2, "re-saving a note keeps one index line");
	check(index.includes("— second"), "index line carries the latest description");
	check(fs.readFileSync(path.join(tmp, "test-note.md"), "utf-8").includes("type: project"), "note has frontmatter type");
	fs.rmSync(tmp, { recursive: true });
}
