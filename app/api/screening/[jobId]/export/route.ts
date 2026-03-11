import { NextResponse } from "next/server";
import { screeningJobs } from "../../route";
import { loadHistoryJob } from "@/lib/storage";
import { generateExportMd } from "@/lib/export-md";
import { generateExportPdf } from "@/lib/export-pdf";
import { logAudit } from "@/lib/audit-log";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "pdf";

  let job: Record<string, unknown> | null = null;
  if (jobId in screeningJobs) {
    job = screeningJobs[jobId];
  } else {
    job = loadHistoryJob(jobId);
  }

  if (!job || job.status !== "completed") {
    return NextResponse.json({ detail: "Completed job not found" }, { status: 404 });
  }

  logAudit("screening.exported", { job_id: jobId, format });

  if (format === "md") {
    const md = generateExportMd(job);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename=aml_screening_${jobId}.md`,
      },
    });
  }

  // Default: PDF
  const pdfBuffer = generateExportPdf(job);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=aml_screening_${jobId}.pdf`,
    },
  });
}
