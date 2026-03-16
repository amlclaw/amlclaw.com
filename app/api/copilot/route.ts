import { loadPrompt } from "@/lib/prompts";
import { queryCopilot } from "@/lib/ai-agent";
import { amlclawMcpServer } from "@/lib/mcp-tools";

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, context } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    context?: { page?: string; jobId?: string; screeningData?: unknown };
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build system prompt
  let systemPrompt: string;
  try {
    systemPrompt = loadPrompt("copilot-system");
  } catch {
    systemPrompt = "You are AMLClaw Copilot, an AI compliance assistant. Answer AML/CFT questions professionally.";
  }

  if (context?.screeningData) {
    systemPrompt += `\n\n## Current Screening Context\nThe user is viewing a screening result. Here is the data:\n\`\`\`json\n${JSON.stringify(context.screeningData, null, 2).slice(0, 5000)}\n\`\`\``;
  }
  if (context?.page) {
    systemPrompt += `\n\nThe user is currently on the "${context.page}" page.`;
  }

  // Build prompt from latest user message + conversation history context
  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const conversationContext = messages.length > 1
    ? `\n\nConversation history:\n${messages.slice(0, -1).map((m) => `${m.role}: ${m.content}`).join("\n")}\n\n`
    : "";
  const prompt = conversationContext + (lastUserMsg?.content || "");

  // Create SSE stream — preserve data: + [DONE] format
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of queryCopilot({
          jobId: `copilot_${Date.now()}`,
          prompt,
          systemPrompt,
          mcpServers: { amlclaw: amlclawMcpServer } as never,
          allowedTools: ["mcp__amlclaw__search_regulations", "mcp__amlclaw__get_screening_history", "mcp__amlclaw__get_screening_detail", "mcp__amlclaw__get_monitor_status"],
        })) {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`));
            } catch { closed = true; }
          }
        }
      } catch (e) {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n\n`));
          } catch { /* */ }
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch { /* */ }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
