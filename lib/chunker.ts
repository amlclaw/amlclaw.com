/**
 * Document chunker — splits markdown documents into chunks for vector search.
 * Target: ~800 tokens (~3200 chars) per chunk with ~200 char overlap.
 */

export interface DocChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  heading: string;
  content: string;
}

const MAX_CHUNK_CHARS = 3200;
const OVERLAP_CHARS = 200;

interface Section {
  heading: string;
  content: string;
}

/**
 * Split markdown content into sections by ## and ### headings.
 */
function splitByHeadings(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
      }
      currentHeading = headingMatch[2].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
  }

  return sections;
}

/**
 * Split a large text by paragraphs into chunks of ~MAX_CHUNK_CHARS with overlap.
 */
function splitByParagraphs(text: string, heading: string): { heading: string; content: string }[] {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [{ heading, content: text }];
  }

  const paragraphs = text.split(/\n\n+/);
  const chunks: { heading: string; content: string }[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push({ heading, content: current.trim() });
      // Overlap: take the last OVERLAP_CHARS of current chunk
      const overlap = current.slice(-OVERLAP_CHARS);
      current = overlap + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) {
    chunks.push({ heading, content: current.trim() });
  }

  return chunks;
}

/**
 * Chunk a document into pieces suitable for embedding.
 */
export function chunkDocument(docId: string, docName: string, content: string): DocChunk[] {
  const sections = splitByHeadings(content);
  const rawChunks: { heading: string; content: string }[] = [];

  for (const section of sections) {
    if (section.content.length <= MAX_CHUNK_CHARS) {
      rawChunks.push(section);
    } else {
      rawChunks.push(...splitByParagraphs(section.content, section.heading));
    }
  }

  return rawChunks.map((chunk, index) => ({
    id: `${docId}_chunk_${index}`,
    docId,
    docName,
    chunkIndex: index,
    heading: chunk.heading,
    content: chunk.content,
  }));
}
