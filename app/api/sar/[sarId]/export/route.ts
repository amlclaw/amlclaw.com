import { NextResponse } from "next/server";
import { getSAR } from "@/lib/sar-storage";
import { logAudit } from "@/lib/audit-log";

export async function GET(req: Request, { params }: { params: Promise<{ sarId: string }> }) {
  const { sarId } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "md";

  const sar = getSAR(sarId);
  if (!sar) {
    return NextResponse.json({ error: "SAR not found" }, { status: 404 });
  }

  logAudit("sar.exported" as Parameters<typeof logAudit>[0], {
    sar_id: sarId,
    reference: sar.reference,
    format,
  });

  if (format === "pdf") {
    // Simple PDF export reusing the same low-level approach
    // For SAR we export the markdown content as-is in a basic PDF wrapper
    const { generateSARPdf } = await import("@/lib/sar-export-pdf");
    const pdfBuffer = generateSARPdf(sar);
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sar.reference}.pdf"`,
      },
    });
  }

  // Default: Markdown
  return new Response(sar.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sar.reference}.md"`,
    },
  });
}
