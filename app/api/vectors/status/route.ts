import { NextResponse } from "next/server";
import { getIndexStatus } from "@/lib/vectorstore";

export async function GET() {
  return NextResponse.json(getIndexStatus());
}
