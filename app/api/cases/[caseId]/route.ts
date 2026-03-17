import { NextResponse } from "next/server";
import { getCase, updateCase, addNote, closeCase, deleteCase } from "@/lib/case-storage";
import { logAudit } from "@/lib/audit-log";

export async function GET(_req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = getCase(caseId);
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await req.json();
  const { action } = body as { action: string };

  let result;

  switch (action) {
    case "add_note": {
      const { text } = body as { text: string; action: string };
      if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
      result = addNote(caseId, text);
      if (result) logAudit("case.note_added" as Parameters<typeof logAudit>[0], { case_id: caseId });
      break;
    }
    case "update_status": {
      const { status } = body as { status: string; action: string };
      result = updateCase(caseId, { status: status as "open" | "under_review" | "closed" });
      if (result) logAudit("case.status_changed" as Parameters<typeof logAudit>[0], { case_id: caseId, status });
      break;
    }
    case "close": {
      const { disposition, reason } = body as { disposition: string; reason: string; action: string };
      if (!disposition) return NextResponse.json({ error: "disposition is required" }, { status: 400 });
      result = closeCase(caseId, disposition as Parameters<typeof closeCase>[1], reason || "");
      if (result) logAudit("case.closed" as Parameters<typeof logAudit>[0], { case_id: caseId, disposition });
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!result) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const deleted = deleteCase(caseId);
  if (!deleted) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  logAudit("case.deleted" as Parameters<typeof logAudit>[0], { case_id: caseId });
  return NextResponse.json({ ok: true });
}
