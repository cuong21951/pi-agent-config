import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PI_DIR } from "./pi-installs.mjs";

const PI = PI_DIR;
const ALIASES = { "@sinclair/typebox": "typebox" };
const HOSTS = [path.join(PI, "package.json"), path.join(PI, "node_modules", ".keep")].map((file) => pathToFileURL(file).href);

registerHooks({
	resolve(specifier, context, nextResolve) {
		try {
			return nextResolve(specifier, context);
		} catch (error) {
			if (error?.code !== "ERR_MODULE_NOT_FOUND" || specifier.startsWith(".") || specifier.startsWith("node:")) throw error;
			for (const parentURL of HOSTS) {
				try {
					return nextResolve(ALIASES[specifier] ?? specifier, { ...context, parentURL });
				} catch {}
			}
			throw error;
		}
	},
});
