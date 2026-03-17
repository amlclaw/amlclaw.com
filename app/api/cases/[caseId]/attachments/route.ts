import { NextResponse } from "next/server";
import { saveAttachment, addNote, getCase, getAttachmentPath, type CaseAttachment } from "@/lib/case-storage";
import { logAudit } from "@/lib/audit-log";
import fs from "fs";

export async function POST(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = getCase(caseId);
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const formData = await req.formData();
  const noteText = formData.get("note") as string || "";
  const files = formData.getAll("files") as File[];

  if (!noteText && files.length === 0) {
    return NextResponse.json({ error: "Note text or files required" }, { status: 400 });
  }

  // Save attachments
  const attachments: CaseAttachment[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const att = saveAttachment(caseId, file.name, buffer);
    attachments.push(att);
  }

  // Add note with attachments
  const text = noteText || `Uploaded ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`;
  const result = addNote(caseId, text, attachments.length > 0 ? attachments : undefined);

  if (result) {
    logAudit("case.note_added" as Parameters<typeof logAudit>[0], {
      case_id: caseId,
      attachments: attachments.map((a) => a.filename),
    });
  }

  return NextResponse.json({ ok: true, attachments });
}

export async function GET(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get("id");

  if (!attachmentId) {
    return NextResponse.json({ error: "?id= parameter required" }, { status: 400 });
  }

  const filePath = getAttachmentPath(caseId, attachmentId);
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const filename = filePath.split("/").pop() || "file";
  // Remove the att_xxx_ prefix for download name
  const downloadName = filename.replace(/^att_\d+_\w+_/, "");

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
