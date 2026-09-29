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
      ["claude-haiku-4-5", "Claude Haiku 4.5", 64000],
      ["claude-fable-5-1", "Claude Fable 5.1", 64000],
      ["claude-opus-5-5", "Claude Opus 5.5", 128000],
    ].map(([id, name, maxTokens]) => ({
      id: id as string,
      name: name as string,
      reasoning: false,
      input: ["text", "image"] as ("text" | "image")[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: maxTokens as number,
    })),
  });
}
