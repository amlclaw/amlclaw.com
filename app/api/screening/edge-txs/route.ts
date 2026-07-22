import { NextResponse } from "next/server";

/**
 * Per-edge transaction listing is not available from the width.info V3 API.
 * Return an empty page so the FlowGraph edge panel degrades gracefully.
 */
export async function GET() {
  return NextResponse.json({ items: [], total: 0, page: 1, page_size: 20 });
}
