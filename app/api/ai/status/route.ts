import { NextResponse } from "next/server";
import { isAIBusy, getCurrentJob, abortCurrentJob } from "@/lib/claude";

export async function GET() {
  return NextResponse.json({
    busy: isAIBusy(),
    job: getCurrentJob(),
  });
}

// POST /api/ai/status — abort current job
export async function POST() {
  const aborted = abortCurrentJob();
  return NextResponse.json({ aborted, busy: isAIBusy() });
}
