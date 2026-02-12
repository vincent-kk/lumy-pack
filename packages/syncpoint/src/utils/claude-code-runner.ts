import { spawn } from 'node:child_process';

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
    const child = spawn('which', ['claude'], { shell: true });
    child.on('close', (code) => {
      resolve(code === 0);
    });
    child.on('error', () => {
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

  return await new Promise((resolve, reject) => {
      const args = ['--permission-mode', 'acceptEdits', '--model', 'sonnet'];
      if (options?.sessionId) {
        args.push('--session', options.sessionId);
      }

      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send prompt via stdin
      child.stdin.write(prompt);
      child.stdin.end();

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Claude Code invocation timeout after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
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

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
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

/**
 * Invoke Claude Code in interactive mode
 * User can directly interact with Claude Code UI
 * @param prompt - Context prompt with file structure
 */
export async function invokeClaudeCodeInteractive(
  prompt: string,
): Promise<ClaudeCodeResult> {
  return await new Promise((resolve, reject) => {
    // Comprehensive initial message with key instructions
    const initialMessage = `${prompt}

IMPORTANT INSTRUCTIONS:
1. After gathering the user's backup preferences through conversation
2. Use the Write tool to create the file at: ~/.syncpoint/config.yml
3. The file must be valid YAML following the Syncpoint schema
4. Include backup.targets array with recommended files based on user responses
5. Include backup.exclude array with common exclusions

Start by asking the user about their backup priorities for the home directory structure provided above.`;

    const args = [
      '--permission-mode',
      'acceptEdits',
      '--model',
      'sonnet',
      initialMessage, // Include full context and instructions in initial message
    ];

    // ⭐ Key: stdio: 'inherit' allows user to directly interact
    const child = spawn('claude', args, {
      stdio: 'inherit', // Share stdin/stdout/stderr with parent process
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: '', // No captured output in interactive mode
      });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
