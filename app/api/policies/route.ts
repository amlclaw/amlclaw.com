import { NextResponse } from "next/server";
import { loadAllPolicies, createPolicy } from "@/lib/storage";

export async function GET() {
  const policies = loadAllPolicies();
  return NextResponse.json(policies);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, jurisdiction, source_documents } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const policy = createPolicy({
      name,
      jurisdiction: jurisdiction || "Custom",
      source_documents: source_documents || [],
    });
    return NextResponse.json(policy, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
