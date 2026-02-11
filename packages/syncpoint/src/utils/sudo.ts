import { execSync } from "node:child_process";
import pc from "picocolors";

/**
 * Check whether sudo credentials are already cached.
 * Returns true if `sudo -n true` succeeds (no password needed).
 */
export function isSudoCached(): boolean {
  try {
    execSync("sudo -n true", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure sudo credentials are available before Ink captures stdin.
 *
 * 1. If already cached, returns silently.
 * 2. Otherwise, warns the user and runs `sudo -v` which prompts
 *    for their password using the real terminal.
 *
 * Must be called BEFORE Ink render().
 * Calls process.exit(1) if authentication fails.
 */
export function ensureSudo(templateName: string): void {
  if (isSudoCached()) return;

  console.log(
    `\n${pc.yellow("⚠")} Template ${pc.bold(templateName)} requires ${pc.bold("sudo")} privileges.`,
  );
  console.log(
    pc.gray("  Some provisioning steps need elevated permissions to execute."),
  );
  console.log(pc.gray("  You will be prompted for your password.\n"));

  try {
    execSync("sudo -v", { stdio: "inherit", timeout: 60_000 });
  } catch {
    console.error(
      `\n${pc.red("✗")} Sudo authentication failed or was cancelled. Aborting.`,
    );
    process.exit(1);
  }
}
