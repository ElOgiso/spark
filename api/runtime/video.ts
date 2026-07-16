import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { provider, prompt, imageUrl, aspectRatio, model } = req.body;
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

    // Fallback/Simulated
    const demoUrl = `/assets/generated_${provider || "runway"}.mp4`;
    return res.status(200).json({
      videoUrl: demoUrl,
      costUsd: 0.20
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
