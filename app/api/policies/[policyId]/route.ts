import { NextResponse } from "next/server";
import { loadPolicy, updatePolicy, deletePolicy } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  const policy = loadPolicy(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }
  return NextResponse.json(policy);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  try {
    const body = await req.json();
    const updated = updatePolicy(policyId, body);
    if (!updated) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;
  const ok = deletePolicy(policyId);
  if (!ok) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
