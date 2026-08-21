import { NextResponse } from "next/server";
import { runAiReview } from "@/lib/ai";
import type { ReviewInput } from "@/lib/ai-review";

export async function POST(req: Request) {
  let input: ReviewInput;
  try {
    input = (await req.json()) as ReviewInput;
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }
  if (!input || (input.type !== "kya" && input.type !== "kyt")) {
    return NextResponse.json({ detail: "type must be kya or kyt" }, { status: 400 });
  }
  try {
    const review = await runAiReview(input);
    return NextResponse.json({ ok: true, review });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI review failed";
    const status = msg.includes("not configured") ? 400 : 502;
    return NextResponse.json({ ok: false, detail: msg }, { status });
  }
}
