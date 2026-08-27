import type { VercelRequest, VercelResponse } from '@vercel/node';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);

async function pollUrl(url: string, headers: any, maxSeconds = 45): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Polling request failed with status ${res.status}`);
    }
    const data = await res.json();
    const status = (data.status || data.state || "").toLowerCase();
    if (status === "completed" || status === "succeeded" || status === "success" || status === "done") {
      return data.videoUrl || data.assets?.video || data.output?.[0] || data.video?.url || "";
    }
    if (status === "failed" || status === "error") {
      throw new Error(`Job execution failed: ${JSON.stringify(data.error || data.reason)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error("Polling timeout exceeded");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, prompt, imageUrl, aspectRatio, model, action, productionId, brandId = 'default-brand', videoUrls, audioUrl } = req.body || {};

    // 0. Serverless FFmpeg Video Muxing (Concat scene clips into master)
    if (provider === 'mux' || action === 'mux' || Array.isArray(videoUrls)) {
      const validUrls = (videoUrls || []).filter((u: any) => typeof u === 'string' && u.trim().startsWith('http'));
      if (validUrls.length === 0) {
        return res.status(400).json({ error: 'No valid HTTP video URLs provided for muxing' });
      }

      // Check if FFmpeg is available on host
      let ffmpegPath = 'ffmpeg';
      try {
        await execFileAsync(ffmpegPath, ['-version']);
      } catch (err) {
        return res.status(200).json({
          success: false,
          ffmpegAvailable: false,
          fallbackToClient: true,
          error: 'FFMPEG_UNAVAILABLE',
          message: 'Serverless FFmpeg binary not available on host. Use client Canvas mux fallback.'
        });
      }

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spark-mux-'));
      const downloadedFiles: string[] = [];

      try {
        for (let i = 0; i < validUrls.length; i++) {
          const vidUrl = validUrls[i];
          const vResp = await fetch(vidUrl);
          if (!vResp.ok) throw new Error(`Failed to fetch scene ${i + 1} video from ${vidUrl}: status ${vResp.status}`);
          const arrayBuffer = await vResp.arrayBuffer();
          const filePath = path.join(tmpDir, `input_${i}.mp4`);
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
          downloadedFiles.push(filePath);
        }

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

        const concatListPath = path.join(tmpDir, 'concat_list.txt');
        const fileListContent = downloadedFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(concatListPath, fileListContent, 'utf-8');

        const outputFilePath = path.join(tmpDir, 'output.mp4');
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

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://jaqzjhabmtvqtvinoafq.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vMsNKA4Icb2BD9SzgBTz4A_DTmSnwWb';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const SPARK_BUCKET = 'Spark';
        const storagePath = `brands/${brandId}/${productionId || 'default-prod'}/video/master.mp4`;

        const { error: uploadError } = await supabase.storage
          .from(SPARK_BUCKET)
          .upload(storagePath, outputBuffer, {
            contentType: 'video/mp4',
            upsert: true,
          });

        if (uploadError) {
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

        const { data: signData } = await supabase.storage
          .from(SPARK_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

        let publicUrl = signData?.signedUrl;
        if (!publicUrl) {
          const { data: publicData } = supabase.storage.from(SPARK_BUCKET).getPublicUrl(storagePath);
          publicUrl = publicData?.publicUrl || '';
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
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }

    const keys = {
      runway: process.env.RUNWAY_API_KEY,
      luma: process.env.LUMA_API_KEY,
      kling: process.env.KLING_API_KEY,
      pika: process.env.PIKA_API_KEY,
      seedance: process.env.SEEDANCE_API_KEY,
      higgsfield: process.env.HIGGSFIELD_API_KEY,
      wan: process.env.WAN_API_KEY,
      veo: process.env.VEO_API_KEY || process.env.GOOGLE_AI_API_KEY
    };

    // 1. Runway Gen-3 Alpha
    if (provider === 'runway' && keys.runway) {
      const response = await fetch("https://api.runwayml.com/v1/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.runway}`
        },
        body: JSON.stringify({
          taskType: "image_to_video",
          prompt,
          image: imageUrl
        })
      });
      if (response.ok) {
        const data = await response.json();
        const taskId = data.id;
        const videoUrl = await pollUrl(
          `https://api.runwayml.com/v1/tasks/${taskId}`,
          { "Authorization": `Bearer ${keys.runway}` }
        );
        return res.status(200).json({ videoUrl, costUsd: 0.25 });
      } else {
        const errText = await response.text();
        throw new Error(`Runway error: ${errText}`);
      }
    }

    // 2. Luma Dream Machine
    if (provider === 'luma' && keys.luma) {
      const response = await fetch("https://api.lumalabs.ai/v1/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.luma}`
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio || "9:16",
          image_url: imageUrl
        })
      });
      if (response.ok) {
        const data = await response.json();
        const taskId = data.id;
        const videoUrl = await pollUrl(
          `https://api.lumalabs.ai/v1/generations/${taskId}`,
          { "Authorization": `Bearer ${keys.luma}` }
        );
        return res.status(200).json({ videoUrl, costUsd: 0.22 });
      } else {
        const errText = await response.text();
        throw new Error(`Luma error: ${errText}`);
      }
    }

    // 3. Kling AI
    if (provider === 'kling' && keys.kling) {
      const response = await fetch("https://api.klingai.com/v1/videos/image-to-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.kling}`
        },
        body: JSON.stringify({
          prompt,
          image: imageUrl,
          duration: "5s"
        })
      });
      if (response.ok) {
        const data = await response.json();
        const taskId = data.id;
        const videoUrl = await pollUrl(
          `https://api.klingai.com/v1/videos/image-to-video/${taskId}`,
          { "Authorization": `Bearer ${keys.kling}` }
        );
        return res.status(200).json({ videoUrl, costUsd: 0.20 });
      } else {
        const errText = await response.text();
        throw new Error(`Kling error: ${errText}`);
      }
    }

    // 4. Wan2.1 (via Fal.ai or direct)
    if (provider === 'wan' && keys.wan) {
      const response = await fetch("https://queue.fal.run/fal-ai/wan/vid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${keys.wan}`
        },
        body: JSON.stringify({
          prompt,
          image_url: imageUrl
        })
      });
      if (response.ok) {
        const data = await response.json();
        const requestId = data.request_id;
        const videoUrl = await pollUrl(
          `https://queue.fal.run/fal-ai/wan/vid/requests/${requestId}`,
          { "Authorization": `Key ${keys.wan}` }
        );
        return res.status(200).json({ videoUrl, costUsd: 0.12 });
      } else {
        const errText = await response.text();
        throw new Error(`Wan Fal.ai error: ${errText}`);
      }
    }

    // No provider key configured — return error instead of fake asset
    return res.status(422).json({
      error: `No API key configured for provider "${provider || 'unknown'}". Add the required key in Vercel environment variables.`,
      videoUrl: null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
