import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PACKAGE = "@earendil-works/pi-coding-agent";

function knownInstalls() {
	return [
		process.env.PI_CODING_AGENT_DIR,
		process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Volta/tools/image/packages", PACKAGE, "node_modules", PACKAGE),
		process.env.APPDATA && path.join(process.env.APPDATA, "npm/node_modules", PACKAGE),
		path.join("/usr/local/lib/node_modules", PACKAGE),
		path.join("/usr/lib/node_modules", PACKAGE),
	].filter((dir) => dir && existsSync(path.join(dir, "package.json")));
}

function npmGlobalInstall() {
	try {
		const dir = path.join(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), PACKAGE);
		return existsSync(path.join(dir, "package.json")) ? [dir] : [];
	} catch {
		return [];
	}
}

export function piInstalls() {
	const known = knownInstalls();
	return [...new Set(known.length > 0 ? known : npmGlobalInstall())];
}

export const PI_DIR = piInstalls()[0] ?? "";
