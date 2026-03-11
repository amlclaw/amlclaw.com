/**
 * Gemini AI adapter — uses @google/genai SDK with streaming
 */
import { GoogleGenAI } from "@google/genai";
import type { AIProviderConfig, StreamCallbacks } from "../ai";

export async function streamGemini(
  config: AIProviderConfig,
  prompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  let fullText = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: config.model || "gemini-2.0-flash",
      contents: prompt,
    });

    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        fullText += text;
        callbacks.onData(text);
      }
    }

    callbacks.onComplete(fullText);
  } catch (e) {
    callbacks.onError(e instanceof Error ? e.message : String(e));
  }
}

export async function testGemini(config: AIProviderConfig): Promise<{ ok: boolean; error?: string; model?: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const res = await ai.models.generateContent({
      model: config.model || "gemini-2.0-flash",
      contents: "Say OK",
    });
    const text = res.text || "";
    return { ok: true, model: config.model, error: text ? undefined : "Empty response" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
