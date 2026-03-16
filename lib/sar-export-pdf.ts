/**
 * Simple PDF export for SAR documents.
 * Converts markdown content to a basic PDF using raw PDF generation.
 */
import type { SAR } from "./sar-storage";

export function generateSARPdf(sar: SAR): Buffer {
  // Simple PDF with text content
  const lines = sar.content.split("\n");
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginLeft = 50;
  const marginRight = 50;
  const marginTop = 50;
  const marginBottom = 60;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let objects: { id: number; content: string }[] = [];
  let nextId = 1;

  const catalogId = nextId++;
  const pagesId = nextId++;
  const fontId = nextId++;
  const fontBoldId = nextId++;

  objects.push({ id: fontId, content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>` });
  objects.push({ id: fontBoldId, content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>` });

  const escPdf = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");

  // Build pages from lines
  const pageStreams: string[] = [];
  let stream = "";
  let y = pageHeight - marginTop;

  const newPage = () => {
    if (stream) pageStreams.push(stream);
    stream = "";
    y = pageHeight - marginTop;
  };

  const addText = (text: string, bold: boolean, size: number) => {
    if (y - size - 4 < marginBottom) newPage();
    const font = bold ? "/F2" : "/F1";
    // Word wrap
    const maxChars = Math.floor(contentWidth / (size * 0.48));
    const wrapped = [];
    let remaining = text;
    while (remaining.length > maxChars) {
      let breakAt = remaining.lastIndexOf(" ", maxChars);
      if (breakAt <= 0) breakAt = maxChars;
      wrapped.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    wrapped.push(remaining);

    for (const line of wrapped) {
      if (y - size - 4 < marginBottom) newPage();
      stream += `${font} ${size} Tf\nBT\n${marginLeft} ${y} Td\n(${escPdf(line)}) Tj\nET\n`;
      y -= size + 4;
    }
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      y -= 8;
      addText(line.slice(2), true, 16);
      y -= 4;
    } else if (line.startsWith("## ")) {
      y -= 6;
      addText(line.slice(3), true, 13);
      y -= 2;
    } else if (line.startsWith("### ")) {
      y -= 4;
      addText(line.slice(4), true, 11);
    } else if (line.startsWith("**") && line.endsWith("**")) {
      addText(line.slice(2, -2), true, 9);
    } else if (line.trim() === "") {
      y -= 6;
    } else {
      // Strip markdown bold/italic for PDF
      const clean = line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1");
      addText(clean, false, 9);
    }
  }

  // Finalize last page
  if (stream) pageStreams.push(stream);

  // Build page objects
  const pageObjIds: number[] = [];
  for (const ps of pageStreams) {
    const streamId = nextId++;
    const pageId = nextId++;
    pageObjIds.push(pageId);
    const streamBytes = Buffer.from(ps, "latin1");
    objects.push({ id: streamId, content: `<< /Length ${streamBytes.length} >>\nstream\n${ps}\nendstream` });
    objects.push({
      id: pageId,
      content: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
    });
  }

  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects.push({ id: pagesId, content: `<< /Type /Pages /Kids [${kids}] /Count ${pageObjIds.length} >>` });
  objects.push({ id: catalogId, content: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });

  objects.sort((a, b) => a.id - b.id);

  const parts: string[] = [];
  parts.push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const offsets: number[] = [];
  let pos = Buffer.byteLength(parts[0], "latin1");

  for (const obj of objects) {
    const s = `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    offsets.push(pos);
    parts.push(s);
    pos += Buffer.byteLength(s, "latin1");
  }

  const xrefOffset = pos;
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");
  const xrefMap = new Map<number, number>();
  objects.forEach((obj, i) => xrefMap.set(obj.id, offsets[i]));
  for (let id = 1; id <= objects[objects.length - 1].id; id++) {
    const off = xrefMap.get(id);
    if (off !== undefined) {
      parts.push(`${String(off).padStart(10, "0")} 00000 n \n`);
    }
  }

  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`);
  parts.push(`startxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(parts.join(""), "latin1");
}
