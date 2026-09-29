import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const baseUrl = process.env.PARITY_MOCK_URL;
  if (!baseUrl) return;
  pi.registerProvider("parity-mock", {
    name: "Parity mock",
    baseUrl,
    apiKey: "parity-mock",
    api: "anthropic-messages",
    models: [
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 64000,
      },
    ],
  });
}
