import { NextResponse } from "next/server";
import { testAgentConnection } from "@/lib/ai-agent";

export async function POST(req: Request) {
  const body = await req.json();
  const { oauthToken } = body as { oauthToken?: string };

  const result = await testAgentConnection(oauthToken);
  return NextResponse.json(result);
}
