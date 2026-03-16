import { NextResponse } from "next/server";
import { getSAR, updateSAR, deleteSAR } from "@/lib/sar-storage";
import { logAudit } from "@/lib/audit-log";

export async function GET(_req: Request, { params }: { params: Promise<{ sarId: string }> }) {
  const { sarId } = await params;
  const sar = getSAR(sarId);
  if (!sar) {
    return NextResponse.json({ error: "SAR not found" }, { status: 404 });
  }
  return NextResponse.json(sar);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sarId: string }> }) {
  const { sarId } = await params;
  const body = await req.json();
  const { content, status } = body as { content?: string; status?: string };

  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (status !== undefined) updates.status = status;

  const updated = updateSAR(sarId, updates);
  if (!updated) {
    return NextResponse.json({ error: "SAR not found" }, { status: 404 });
  }

  logAudit("sar.updated" as Parameters<typeof logAudit>[0], {
    sar_id: sarId,
    fields_updated: Object.keys(updates),
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ sarId: string }> }) {
  const { sarId } = await params;
  const deleted = deleteSAR(sarId);
  if (!deleted) {
    return NextResponse.json({ error: "SAR not found" }, { status: 404 });
  }
  logAudit("sar.deleted" as Parameters<typeof logAudit>[0], { sar_id: sarId });
  return NextResponse.json({ ok: true });
}
