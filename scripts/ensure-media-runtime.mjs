/**
 * Phase 21 — restore the canonical ffmpeg-static binary and execute bits.
 * Does not change the audio mastering pipeline. ffmpeg-static remains the runtime.
 */
import { chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

function executable(file) {
  if (file && existsSync(file)) {
    chmodSync(file, 0o755);
    return true;
  }
  return false;
}

let ffmpegBin = null;
try {
  ffmpegBin = require("ffmpeg-static");
} catch {
  console.warn("[ensure-media-runtime] ffmpeg-static is not installed");
}

if (ffmpegBin && !existsSync(ffmpegBin)) {
  const installer = path.join(root, "node_modules/ffmpeg-static/install.js");
  if (existsSync(installer)) {
    const result = spawnSync(process.execPath, [installer], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) {
      console.warn(`[ensure-media-runtime] ffmpeg-static install exited ${result.status}`);
    }
  }
  try {
    ffmpegBin = require("ffmpeg-static");
  } catch {
    ffmpegBin = null;
  }
}

const ffmpegReady = executable(ffmpegBin);
let ffprobePath = null;
try {
  ffprobePath = require("@ffprobe-installer/ffprobe")?.path || null;
} catch {
  ffprobePath = null;
}
const ffprobeReady = executable(ffprobePath);

if (!ffmpegReady || !ffprobeReady) {
  console.warn(
    `[ensure-media-runtime] media runtime incomplete ffmpeg=${ffmpegReady} ffprobe=${ffprobeReady}`,
  );
}
