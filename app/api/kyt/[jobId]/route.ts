import { NextResponse } from "next/server";
import { kytJobs } from "../route";
import { loadHistoryJob } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Check in-memory first
  if (jobId in kytJobs) {
    return NextResponse.json(kytJobs[jobId]);
  }

  // Fallback to disk
  const job = loadHistoryJob(jobId);
  if (job) return NextResponse.json(job);

  return NextResponse.json({ detail: "Job not found" }, { status: 404 });
}
