import { NextResponse } from "next/server";
import { listSARs } from "@/lib/sar-storage";

export async function GET() {
  const sars = listSARs();
  return NextResponse.json(sars);
}
