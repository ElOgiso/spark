import type { VercelRequest, VercelResponse } from '@vercel/node';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productionId, brandId = 'default-brand', videoUrls, audioUrl, onScreenTexts } = req.body || {};

  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ error: 'videoUrls array is required' });
  }

  // Filter valid URLs
  const validUrls = videoUrls.filter((u: any) => typeof u === 'string' && u.trim().startsWith('http'));
  if (validUrls.length === 0) {
    return res.status(400).json({ error: 'No valid HTTP video URLs provided' });
  }

  // Supabase client initialization
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://jaqzjhabmtvqtvinoafq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vMsNKA4Icb2BD9SzgBTz4A_DTmSnwWb';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const SPARK_BUCKET = 'Spark';
  const storagePath = `brands/${brandId}/${productionId || 'default-prod'}/video/master.mp4`;

  // Check if FFmpeg is available
  let ffmpegPath = 'ffmpeg';
  try {
    await execFileAsync(ffmpegPath, ['-version']);
  } catch (err) {
    // FFmpeg not found on host environment - signal client fallback
    return res.status(200).json({
      success: false,
      ffmpegAvailable: false,
      error: 'FFMPEG_UNAVAILABLE',
      fallbackToClient: true,
      message: 'Serverless FFmpeg binary not available on host. Use client Canvas mux fallback.'
    });
  }

  // Working directory in temp
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spark-mux-'));
  const downloadedFiles: string[] = [];

  try {
    // 1. Download input clips
    for (let i = 0; i < validUrls.length; i++) {
      const vidUrl = validUrls[i];
      const resp = await fetch(vidUrl);
      if (!resp.ok) {
        throw new Error(`Failed to fetch scene ${i + 1} video from ${vidUrl}: status ${resp.status}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      const filePath = path.join(tmpDir, `input_${i}.mp4`);
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      downloadedFiles.push(filePath);
    }

    // 2. Download audio if present
    let audioFilePath: string | undefined = undefined;
    if (audioUrl && typeof audioUrl === 'string' && audioUrl.trim().startsWith('http')) {
      try {
        const aResp = await fetch(audioUrl);
        if (aResp.ok) {
          const aBuf = await aResp.arrayBuffer();
          audioFilePath = path.join(tmpDir, 'audio.mp3');
          fs.writeFileSync(audioFilePath, Buffer.from(aBuf));
        }
      } catch (aErr) {
        console.warn('[ServerlessMux] Audio download notice:', aErr);
      }
    }

    // 3. Prepare FFmpeg concat list
    const concatListPath = path.join(tmpDir, 'concat_list.txt');
    const fileListContent = downloadedFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, fileListContent, 'utf-8');

    const outputFilePath = path.join(tmpDir, 'output.mp4');

    // 4. Run FFmpeg concat demuxer / re-encode
    const ffmpegArgs: string[] = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
    ];

    if (audioFilePath && fs.existsSync(audioFilePath)) {
      ffmpegArgs.push(
        '-i', audioFilePath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        '-movflags', '+faststart',
        outputFilePath
      );
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        outputFilePath
      );
    }

    await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 120000 });

    if (!fs.existsSync(outputFilePath)) {
      throw new Error('FFmpeg failed to produce output.mp4');
    }

    const outputBuffer = fs.readFileSync(outputFilePath);

    // 5. Upload merged master to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(SPARK_BUCKET)
      .upload(storagePath, outputBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      // Try fallback bucket 'media'
      const { error: fallbackError } = await supabase.storage
        .from('media')
        .upload(storagePath, outputBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (fallbackError) {
        throw new Error(`Storage upload failed: ${uploadError.message} / ${fallbackError.message}`);
      }
    }

    // Generate public or signed URL
    const { data: publicData } = supabase.storage.from(SPARK_BUCKET).getPublicUrl(storagePath);
    let publicUrl = publicData?.publicUrl;

    if (!publicUrl) {
      const { data: signData } = await supabase.storage
        .from(SPARK_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      publicUrl = signData?.signedUrl;
    }

    return res.status(200).json({
      success: true,
      publicUrl,
      storagePath,
      provider: 'ServerlessFFmpeg',
    });
  } catch (err: any) {
    console.error('[ServerlessMux] Execution error:', err);
    return res.status(200).json({
      success: false,
      fallbackToClient: true,
      error: err?.message || String(err),
    });
  } finally {
    // Cleanup temporary files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}
