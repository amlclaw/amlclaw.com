/**
 * DeepSeek AI adapter — OpenAI-compatible API with streaming
 */
import OpenAI from "openai";
import type { AIProviderConfig, StreamCallbacks } from "../ai";

function createClient(config: AIProviderConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || "https://api.deepseek.com",
  });
}

export async function streamDeepSeek(
  config: AIProviderConfig,
  prompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const client = createClient(config);

  let fullText = "";

  try {
    const stream = await client.chat.completions.create({
      model: config.model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_tokens: 8192,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      // deepseek-reasoner: reasoning_content = thinking (skip), content = final answer
      // deepseek-chat: content = response
      const content = delta?.content;
      if (content) {
        fullText += content;
        callbacks.onData(content);
      }
    }

    callbacks.onComplete(fullText);
  } catch (e) {
    callbacks.onError(e instanceof Error ? e.message : String(e));
  }
}

export async function testDeepSeek(config: AIProviderConfig): Promise<{ ok: boolean; error?: string; model?: string }> {
  try {
    const client = createClient(config);
    const res = await client.chat.completions.create({
      model: config.model || "deepseek-chat",
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 10,
    });
    const text = res.choices[0]?.message?.content || "";
    return { ok: true, model: res.model || config.model, error: text ? undefined : "Empty response" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
