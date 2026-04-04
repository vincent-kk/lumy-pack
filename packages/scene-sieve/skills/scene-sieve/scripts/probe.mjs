#!/usr/bin/env node

/**
 * probe.mjs — Probe video file and recommend a scene-sieve preset.
 *
 * Usage: node probe.mjs <input-file> [user-intent]
 *
 * Arguments:
 *   input-file    Path to video or GIF file
 *   user-intent   Optional: quick-glance | detailed | hq-capture | inspection | screen-recording
 *
 * Output: JSON with video info + recommended preset + flags
 *
 * Example:
 *   node probe.mjs demo.mp4
 *   node probe.mjs recording.mp4 screen-recording
 *   node probe.mjs animation.gif
 */

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createRequire } from "node:module";

const [inputRaw, intent] = process.argv.slice(2);

if (!inputRaw) {
  console.error(JSON.stringify({ ok: false, error: "Usage: node probe.mjs <input-file> [user-intent]" }));
  process.exit(1);
}

const input = resolve(inputRaw);

// --- File existence + size ---
let fileSize = 0;
try {
  const s = await stat(input);
  fileSize = s.size;
} catch {
  console.log(JSON.stringify({ ok: false, error: `File not found: ${input}` }));
  process.exit(1);
}

// --- Extension detection ---
const ext = extname(input).slice(1).toLowerCase();

const VIDEO_EXTS = new Set(["mp4", "mov", "avi", "mkv", "webm", "gif"]);

if (!VIDEO_EXTS.has(ext)) {
  console.log(JSON.stringify({ ok: false, error: `Unsupported extension: .${ext}` }));
  process.exit(1);
}

// --- Preset definitions ---
const PRESETS = {
  "short-clip":       { count: 8,  threshold: 0.5,  fps: 5,  maxFrames: 300, scale: 720,  quality: 85 },
  "medium-video":     { count: 12, threshold: 0.5,  fps: 5,  maxFrames: 300, scale: 720,  quality: 80 },
  "long-video":       { count: 15, threshold: 0.5,  fps: 2,  maxFrames: 200, scale: 480,  quality: 80 },
  "very-long":        { count: 20, threshold: 0.5,  fps: 1,  maxFrames: 150, scale: 480,  quality: 80, extra: "--concurrency 1" },
  "gif":              { count: 10, threshold: 0.3,  fps: 5,  maxFrames: 50,  scale: 720,  quality: 80 },
  "quick-glance":     { count: 5,  threshold: 0.5,  fps: 2,  maxFrames: 300, scale: 480,  quality: 80 },
  "detailed":         { count: 30, threshold: 0.2,  fps: 10, maxFrames: 300, scale: 720,  quality: 80 },
  "hq-capture":       { count: 8,  threshold: 0.5,  fps: 5,  maxFrames: 300, scale: 1080, quality: 95 },
  "inspection":       { count: 20, threshold: 0.15, fps: 5,  maxFrames: 300, scale: 720,  quality: 80, extra: "-it 0.7 -at 3" },
  "screen-recording": { count: 12, threshold: 0.3,  fps: 2,  maxFrames: 300, scale: 720,  quality: 80 },
};

// --- Locate ffprobe ---
function findFfprobe() {
  // 1. Try bundled @ffprobe-installer/ffprobe
  try {
    const require = createRequire(import.meta.url);
    const { path: ffprobePath } = require("@ffprobe-installer/ffprobe");
    return ffprobePath;
  } catch { /* not installed */ }

  // 2. System ffprobe (resolve via PATH)
  return "ffprobe";
}

function execAsync(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10_000 }, (error, stdout) => {
      if (error) return resolve(null);
      resolve(stdout);
    });
  });
}

// --- Probe with ffprobe ---
let duration = 0;
let width = 0;
let height = 0;
let format = "";
let hasVideo = false;
let probeAvailable = false;

const ffprobe = findFfprobe();
const probeOut = await execAsync(ffprobe, [
  "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", input,
]);

if (probeOut) {
  try {
    const data = JSON.parse(probeOut);
    probeAvailable = true;

    duration = parseFloat(data.format?.duration ?? "0") || 0;
    format = data.format?.format_name ?? "";

    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    if (videoStream) {
      hasVideo = true;
      width = videoStream.width ?? 0;
      height = videoStream.height ?? 0;
      if (!duration && videoStream.duration) {
        duration = parseFloat(videoStream.duration) || 0;
      }
    }
  } catch { /* parse failure, fall through */ }
}

if (!probeAvailable) {
  // Fallback: estimate duration from file size (~1MB per 10s)
  duration = (fileSize / 1_048_576) * 10;
}

// --- Select preset ---
let presetName;
if (intent && PRESETS[intent]) {
  presetName = intent;
} else if (ext === "gif") {
  presetName = "gif";
} else if (duration <= 30) {
  presetName = "short-clip";
} else if (duration <= 300) {
  presetName = "medium-video";
} else if (duration <= 1800) {
  presetName = "long-video";
} else {
  presetName = "very-long";
}

const flags = PRESETS[presetName];

// --- Build command ---
let command = `npx -y @lumy-pack/scene-sieve "${input}" --json -n ${flags.count} -t ${flags.threshold} --fps ${flags.fps} --max-frames ${flags.maxFrames} -s ${flags.scale} -q ${flags.quality}`;
if (flags.extra) command += ` ${flags.extra}`;

// --- Format duration ---
const durationMin = Math.floor(duration / 60);
const durationSec = Math.floor(duration - durationMin * 60);

// --- Output ---
console.log(JSON.stringify({
  ok: true,
  probe: {
    file: input,
    extension: ext,
    fileSize,
    duration,
    durationDisplay: `${durationMin}m${durationSec}s`,
    resolution: `${width}x${height}`,
    format,
    hasVideo,
    probeAvailable,
  },
  preset: {
    name: presetName,
    flags: {
      count: flags.count,
      threshold: flags.threshold,
      fps: flags.fps,
      maxFrames: flags.maxFrames,
      scale: flags.scale,
      quality: flags.quality,
      extra: flags.extra ?? "",
    },
  },
  command,
}, null, 2));
