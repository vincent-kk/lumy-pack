import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
  sessionId?: string;
}

/**
 * Check if Claude Code CLI is available
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", ["claude"], { shell: true });
    child.on("close", (code) => {
      resolve(code === 0);
    });
    child.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Invoke Claude Code in edit mode with a prompt
 */
export async function invokeClaudeCode(
  prompt: string,
  options?: {
    sessionId?: string;
    timeout?: number;
  },
): Promise<ClaudeCodeResult> {
  const timeout = options?.timeout ?? 120000; // 2 minutes default

  // Write prompt to temporary file
  const promptFile = join(tmpdir(), `syncpoint-prompt-${Date.now()}.txt`);
  await writeFile(promptFile, prompt, "utf-8");

  try {
    return await new Promise((resolve, reject) => {
      const args = ["--edit"];
      if (options?.sessionId) {
        args.push("--session", options.sessionId);
      }

      const child = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      // Send prompt via stdin
      child.stdin.write(prompt);
      child.stdin.end();

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Claude Code invocation timeout after ${timeout}ms`));
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timer);

        if (code === 0) {
          resolve({
            success: true,
            output: stdout,
            sessionId: options?.sessionId,
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Process exited with code ${code}`,
          });
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  } finally {
    // Clean up temporary file
    try {
      await unlink(promptFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Resume a Claude Code session with additional context
 */
export async function resumeClaudeCodeSession(
  sessionId: string,
  prompt: string,
  options?: {
    timeout?: number;
  },
): Promise<ClaudeCodeResult> {
  return invokeClaudeCode(prompt, {
    sessionId,
    timeout: options?.timeout,
  });
}
