/**
 * JSON-based vector store for RAG search.
 * Uses OpenAI text-embedding-3-small via the openai package.
 * No database — stores everything in JSON files under data/vectors/.
 */
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { DocChunk, chunkDocument } from "./chunker";

const VECTORS_DIR = path.join(process.cwd(), "data", "vectors");
const INDEX_PATH = path.join(VECTORS_DIR, "index.json");
const EMBEDDINGS_PATH = path.join(VECTORS_DIR, "embeddings.json");

const DEFAULT_MODEL = "text-embedding-3-small";
const MAX_BATCH_SIZE = 100;

export interface SearchResult {
  chunk: DocChunk;
  score: number;
}

interface IndexData {
  chunks: DocChunk[];
  lastBuilt: string;
  docCount: number;
}

interface EmbeddingsData {
  vectors: number[][];
}

function ensureDir() {
  if (!fs.existsSync(VECTORS_DIR)) {
    fs.mkdirSync(VECTORS_DIR, { recursive: true });
  }
}

function loadIndex(): IndexData | null {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
    }
  } catch { /* corrupt */ }
  return null;
}

function loadEmbeddings(): EmbeddingsData | null {
  try {
    if (fs.existsSync(EMBEDDINGS_PATH)) {
      return JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, "utf-8"));
    }
  } catch { /* corrupt */ }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Get embeddings from OpenAI API in batches.
 */
async function getEmbeddings(
  texts: string[],
  apiKey: string,
  model: string,
  onProgress?: (pct: number) => void
): Promise<number[][]> {
  const client = new OpenAI({ apiKey });
  const allVectors: number[][] = new Array(texts.length);
  const totalBatches = Math.ceil(texts.length / MAX_BATCH_SIZE);

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await client.embeddings.create({
      model,
      input: batch,
    });

    for (let j = 0; j < response.data.length; j++) {
      allVectors[i + j] = response.data[j].embedding;
    }

    if (onProgress) {
      const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1;
      onProgress(Math.round((batchNum / totalBatches) * 100));
    }
  }

  return allVectors;
}

/**
 * Build the vector index from documents.
 */
export async function buildIndex(
  docs: { id: string; name: string; content: string }[],
  apiKey: string,
  model?: string,
  onProgress?: (pct: number) => void
): Promise<{ chunkCount: number; docCount: number }> {
  const embeddingModel = model || DEFAULT_MODEL;

  // Chunk all documents
  const allChunks: DocChunk[] = [];
  for (const doc of docs) {
    const chunks = chunkDocument(doc.id, doc.name, doc.content);
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) {
    throw new Error("No chunks generated from documents");
  }

  // Build text for embedding: heading + content
  const texts = allChunks.map((c) =>
    c.heading ? `${c.heading}\n\n${c.content}` : c.content
  );

  // Get embeddings
  const vectors = await getEmbeddings(texts, apiKey, embeddingModel, onProgress);

  // Save to disk
  ensureDir();

  const indexData: IndexData = {
    chunks: allChunks,
    lastBuilt: new Date().toISOString(),
    docCount: docs.length,
  };

  const embeddingsData: EmbeddingsData = { vectors };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(indexData));
  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(embeddingsData));

  console.log(`[vectorstore] Built index: ${allChunks.length} chunks from ${docs.length} docs`);

  return { chunkCount: allChunks.length, docCount: docs.length };
}

/**
 * Search chunks by cosine similarity.
 */
export async function searchChunks(
  query: string,
  apiKey: string,
  topK?: number,
  filterDocIds?: string[],
  model?: string
): Promise<SearchResult[]> {
  const k = topK ?? 30;
  const embeddingModel = model || DEFAULT_MODEL;

  const index = loadIndex();
  const embeddings = loadEmbeddings();

  if (!index || !embeddings || index.chunks.length === 0) {
    return [];
  }

  // Get query embedding
  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model: embeddingModel,
    input: query,
  });
  const queryVector = response.data[0].embedding;

  // Score all chunks
  const results: SearchResult[] = [];
  for (let i = 0; i < index.chunks.length; i++) {
    const chunk = index.chunks[i];

    // Filter by docIds if specified
    if (filterDocIds && filterDocIds.length > 0 && !filterDocIds.includes(chunk.docId)) {
      continue;
    }

    const score = cosineSimilarity(queryVector, embeddings.vectors[i]);
    results.push({ chunk, score });
  }

  // Sort by score descending, take top K
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

/**
 * Get the current index status.
 */
export function getIndexStatus(): {
  indexed: boolean;
  docCount: number;
  chunkCount: number;
  lastBuilt: string | null;
} {
  const index = loadIndex();
  if (!index) {
    return { indexed: false, docCount: 0, chunkCount: 0, lastBuilt: null };
  }
  return {
    indexed: true,
    docCount: index.docCount,
    chunkCount: index.chunks.length,
    lastBuilt: index.lastBuilt,
  };
}

/**
 * Delete the vector index.
 */
export function deleteIndex(): void {
  try { if (fs.existsSync(INDEX_PATH)) fs.unlinkSync(INDEX_PATH); } catch { /* */ }
  try { if (fs.existsSync(EMBEDDINGS_PATH)) fs.unlinkSync(EMBEDDINGS_PATH); } catch { /* */ }
  console.log("[vectorstore] Index deleted");
}
