/**
 * Claude CLI wrapper — spawns `claude -p` with streaming JSON output.
 * Single-process queue: only one AI operation at a time.
 * Uses file-based lock to share state across Next.js module instances.
 */
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

const LOCK_FILE = path.join(process.cwd(), "data", ".ai-lock.json");

interface LockData {
  id: string;
  type: string;
  startedAt: string;
  pid: number;
}

// Track the process in this module instance only
let localProcess: ChildProcess | null = null;

function readLock(): LockData | null {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
      // Check if the process is still alive
      if (data.pid) {
        try {
          process.kill(data.pid, 0); // signal 0 = check existence
          return data;
        } catch {
          // Process is dead, stale lock — clean up
          removeLock();
          return null;
        }
      }
      return data;
    }
  } catch { /* corrupt file */ }
  return null;
}

function writeLock(data: LockData): void {
  const dir = path.dirname(LOCK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify(data));
}

function removeLock(): void {
  try { fs.unlinkSync(LOCK_FILE); } catch { /* already gone */ }
}

export function isAIBusy(): boolean {
  return readLock() !== null;
}

export function getCurrentJob(): { id: string; type: string; startedAt: string } | null {
  const lock = readLock();
  if (!lock) return null;
  return { id: lock.id, type: lock.type, startedAt: lock.startedAt };
}

export function abortCurrentJob(): boolean {
  const lock = readLock();
  if (!lock) return false;
  // Kill the process if alive
  if (lock.pid) {
    try { process.kill(lock.pid, "SIGTERM"); } catch { /* already dead */ }
  }
  if (localProcess) {
    try { localProcess.kill("SIGTERM"); } catch { /* already dead */ }
    localProcess = null;
  }
  removeLock();
  return true;
}

export interface SpawnClaudeOpts {
  jobId: string;
  jobType: string;
  prompt: string;
  onData: (chunk: string) => void;
  onComplete: (fullOutput: string) => void;
  onError: (error: string) => void;
}

export function spawnClaude(opts: SpawnClaudeOpts): { abort: () => void } {
  if (isAIBusy()) {
    opts.onError("AI is busy with another task");
    return { abort: () => {} };
  }

  const args = ["-p", opts.prompt, "--output-format", "stream-json", "--verbose"];

  // Remove CLAUDECODE env var to avoid "nested session" rejection
  const cleanEnv = { ...process.env };
  delete cleanEnv.CLAUDECODE;

  const proc = spawn("claude", args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: cleanEnv,
  });

  localProcess = proc;

  writeLock({
    id: opts.jobId,
    type: opts.jobType,
    startedAt: new Date().toISOString(),
    pid: proc.pid || 0,
  });

  let streamedText = "";
  let resultText = "";
  let stderrBuf = "";
  let lineBuf = "";

  function processLine(line: string) {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "assistant" && parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "text" && block.text) {
            streamedText += block.text;
            opts.onData(block.text);
          }
        }
      } else if (parsed.type === "result" && parsed.result) {
        resultText = parsed.result;
        if (!streamedText) {
          opts.onData(parsed.result);
        }
      }
    } catch {
      // Incomplete JSON or non-JSON — ignore
    }
  }

  proc.stdout!.on("data", (data: Buffer) => {
    lineBuf += data.toString();
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop() || "";
    for (const line of lines) {
      processLine(line);
    }
  });

  proc.stderr!.on("data", (data: Buffer) => {
    stderrBuf += data.toString();
  });

  proc.on("close", (code) => {
    if (lineBuf.trim()) {
      processLine(lineBuf);
      lineBuf = "";
    }
    localProcess = null;
    removeLock();
    if (code === 0) {
      opts.onComplete(resultText || streamedText);
    } else {
      opts.onError(stderrBuf || `Claude process exited with code ${code}`);
    }
  });

  proc.on("error", (err) => {
    localProcess = null;
    removeLock();
    opts.onError(`Failed to spawn claude: ${err.message}`);
  });

  return {
    abort: () => {
      try { proc.kill("SIGTERM"); } catch { /* */ }
      localProcess = null;
      removeLock();
    },
  };
}
