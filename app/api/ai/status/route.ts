import { NextResponse } from "next/server";
import { isAIBusy, getActiveJobs, abortCurrentJob, abortJob } from "@/lib/ai";

export async function GET() {
  return NextResponse.json({
    busy: isAIBusy(),
    jobs: getActiveJobs(),
    job: getActiveJobs()[0] || null, // backward compat
  });
}

// POST /api/ai/status — abort a job (or first active job)
export async function POST(req: Request) {
  let jobId: string | undefined;
  try {
    const body = await req.json();
    jobId = body.jobId;
  } catch { /* empty body */ }

  const aborted = jobId ? abortJob(jobId) : abortCurrentJob();
  return NextResponse.json({ aborted, busy: isAIBusy() });
}
