import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { callLine, resultLine, unknownSkillMessage, type Style } from "./render.ts";

interface SkillRef {
	name: string;
	description: string;
	filePath: string;
	baseDir: string;
}

// pi's built-in system prompt tells the model to load skills with the read tool.
const READ_INSTRUCTION = "Use the read tool to load a skill's file when the task matches its description.";
const SKILL_INSTRUCTION = "Use the skill tool to load a skill when the task matches its description.";

// ponytail: snapshot taken in before_agent_start; ctx gives execute no skill access.
const byName = new Map<string, SkillRef>();

function indexSkills(skills: readonly SkillRef[] | undefined) {
	byName.clear();
	for (const skill of skills ?? []) {
		byName.set(skill.name.toLowerCase(), skill);
		byName.set(path.basename(skill.baseDir).toLowerCase(), skill);
	}
}

function lookup(name: string): SkillRef | undefined {
	return byName.get(name.trim().toLowerCase());
}

function availableNames(): string[] {
	return [...new Set([...byName.values()].map((skill) => skill.name))];
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		indexSkills(event.systemPromptOptions.skills as SkillRef[] | undefined);
		if (event.systemPrompt.includes(READ_INSTRUCTION)) {
			return { systemPrompt: event.systemPrompt.replace(READ_INSTRUCTION, SKILL_INSTRUCTION) };
		}
	});

	pi.registerTool({
		name: "skill",
		label: "Skill",
		description:
			"Load one of the available skills listed in <available_skills> by name and return its full instructions. " +
			"Prefer this over reading the skill's SKILL.md file with the read tool.",
		renderShell: "self",
		promptSnippet: "Load an available skill by name",
		promptGuidelines: [
			"Use the skill tool instead of the read tool when a task matches one of the available skills listed in <available_skills>.",
		],
		parameters: {
			type: "object",
			properties: {
				name: { type: "string", description: "Name of the skill to load, from <available_skills>." },
			},
			required: ["name"],
		},

		async execute(_toolCallId, params) {
			const name = String((params as { name?: unknown }).name ?? "").trim();
			const skill = lookup(name);
			if (!skill) {
				return {
					content: [{ type: "text", text: unknownSkillMessage(name, availableNames()) }],
					isError: true,
				};
			}
			const content = await fs.readFile(skill.filePath, "utf8");
			return {
				content: [{ type: "text", text: `Skill directory: ${skill.baseDir}\n\n${content}` }],
				details: { skill: skill.name },
			};
		},

		renderCall(args: Record<string, unknown>, theme: Style) {
			return new Text(callLine(args.name, theme), 0, 0);
		},

		renderResult(result: { content: Array<{ type: string; text?: string }>; isError?: boolean }, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: Style) {
			const text = result.content
				.filter((block) => block.type === "text")
				.map((block) => block.text ?? "")
				.join("\n");
			return new Text(resultLine({ text, isError: result.isError === true, expanded, isPartial }, theme), 0, 0);
		},
	});
}
