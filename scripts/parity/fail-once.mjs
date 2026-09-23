import { appendFileSync } from "node:fs";

const log = process.env.PARITY_FETCH_LOG;
const target = /githubcopilot\.com\/(?:v1\/)?(?:chat\/completions|messages|responses)/;
let inner = globalThis.fetch;
let failed = false;

async function fetchOnceFailing(input, init) {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (log) appendFileSync(log, `${url}\n`);
	if (!failed && target.test(url)) {
		failed = true;
		return new Response(JSON.stringify({ error: { message: "Service Unavailable", type: "service_unavailable" } }), { status: 503, headers: { "content-type": "application/json" } });
	}
	return inner(input, init);
}

Object.defineProperty(globalThis, "fetch", {
	configurable: true,
	get: () => fetchOnceFailing,
	set: (next) => {
		inner = next;
	},
});
