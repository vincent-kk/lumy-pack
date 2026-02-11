import { formatHostname } from "./system.js";

/**
 * Format bytes into a human-readable string.
 * e.g. 4096 -> "4.0 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  if (i === 0) return `${bytes} B`;
  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Format a Date to "YYYY-MM-DD HH:mm".
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

/**
 * Format a Date to "YYYY-MM-DD_HHmmss" for filenames.
 */
export function formatDatetime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}_${h}${min}${s}`;
}

/**
 * Format a relative time string.
 * e.g. "2 hours ago", "37 days ago"
 */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/**
 * Generate a backup filename from the pattern.
 * Supported placeholders: {hostname}, {date}, {time}, {datetime}, {tag}
 */
export function generateFilename(
  pattern: string,
  options?: { tag?: string; date?: Date; hostname?: string },
): string {
  const now = options?.date ?? new Date();
  const host = formatHostname(options?.hostname);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  let result = pattern
    .replace(/\{hostname\}/g, host)
    .replace(/\{date\}/g, `${y}-${m}-${d}`)
    .replace(/\{time\}/g, `${h}${min}${s}`)
    .replace(/\{datetime\}/g, `${y}-${m}-${d}_${h}${min}${s}`);

  if (options?.tag) {
    result = result.replace(/\{tag\}/g, options.tag);
    // If pattern doesn't include {tag}, append it
    if (!pattern.includes("{tag}")) {
      result += `_${options.tag}`;
    }
  } else {
    // Remove {tag} placeholder if no tag provided
    result = result.replace(/\{tag\}/g, "").replace(/_+/g, "_").replace(/_$/, "");
  }

  return result;
}
