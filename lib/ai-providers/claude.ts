/**
 * Claude AI adapter — uses @anthropic-ai/sdk with streaming
 */
import Anthropic from "@anthropic-ai/sdk";
import type { AIProviderConfig, StreamCallbacks } from "../ai";

export async function streamClaude(
  config: AIProviderConfig,
  prompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const client = new Anthropic({ apiKey: config.apiKey });

  let fullText = "";

  try {
    const stream = await client.messages.stream({
      model: config.model || "claude-sonnet-4-6",
      max_tokens: 16384,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
        callbacks.onData(event.delta.text);
      }
    }

    callbacks.onComplete(fullText);
  } catch (e) {
    callbacks.onError(e instanceof Error ? e.message : String(e));
  }
}

export async function testClaude(config: AIProviderConfig): Promise<{ ok: boolean; error?: string; model?: string }> {
  try {
    const client = new Anthropic({ apiKey: config.apiKey });
    const res = await client.messages.create({
      model: config.model || "claude-sonnet-4-6",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say OK" }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    return { ok: true, model: res.model || config.model, error: text ? undefined : "Empty response" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
