import { NextResponse } from "next/server";
import { screeningJobs } from "../../route";
import { loadHistoryJob } from "@/lib/storage";
import { generateExportMd } from "@/lib/export-md";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  let job: Record<string, unknown> | null = null;
  if (jobId in screeningJobs) {
    job = screeningJobs[jobId];
  } else {
    job = loadHistoryJob(jobId);
  }

  if (!job || job.status !== "completed") {
    return NextResponse.json({ detail: "Completed job not found" }, { status: 404 });
  }

  const md = generateExportMd(job);
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename=aml_screening_${jobId}.md`,
    },
  });
}
