import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, prompt, aspectRatio, model } = req.body;
    const keys = {
      openai: process.env.OPEN_AI_KEY,
      flux: process.env.FLUX_API_KEY || process.env.FAL_API_KEY,
      ideogram: process.env.IDEOGRAM_API_KEY,
      recraft: process.env.RECRAFT_API_KEY
    };

    // 1. OpenAI Images (DALL-E 3)
    if (provider === 'openai_images' && keys.openai) {
      const size = aspectRatio === "9:16" ? "1024x1792" : aspectRatio === "16:9" ? "1792x1024" : "1024x1024";
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.openai}`
        },
        body: JSON.stringify({
          model: model || "dall-e-3",
          prompt,
          n: 1,
          size
        })
      });
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json({
          images: [{ url: data.data?.[0]?.url || "" }],
          costUsd: 0.080
        });
      } else {
        const errText = await response.text();
        throw new Error(`OpenAI DALL-E error: ${errText}`);
      }
    }

    // 2. Flux Schnell / Pro (Fal.ai API)
    if (provider === 'flux' && keys.flux) {
      const isPro = model?.includes("pro");
      const endpoint = isPro ? "https://queue.fal.run/fal-ai/flux/pro" : "https://queue.fal.run/fal-ai/flux/schnell";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${keys.flux}`
        },
        body: JSON.stringify({
          prompt,
          image_size: aspectRatio === "9:16" ? "portrait_16_9" : "landscape_16_9",
          sync_mode: true
        })
      });
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json({
          images: [{ url: data.images?.[0]?.url || "" }],
          costUsd: isPro ? 0.060 : 0.010
        });
      } else {
        const errText = await response.text();
        throw new Error(`Flux Fal.ai error: ${errText}`);
      }
    }

    // 3. Ideogram
    if (provider === 'ideogram' && keys.ideogram) {
      const response = await fetch("https://api.ideogram.ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": keys.ideogram
        },
        body: JSON.stringify({
          image_request: {
            prompt,
            aspect_ratio: aspectRatio === "9:16" ? "ASPECT_9_16" : aspectRatio === "16:9" ? "ASPECT_16_9" : "ASPECT_1_1",
            model: "V_2"
          }
        })
      });
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json({
          images: [{ url: data.data?.[0]?.url || "" }],
          costUsd: 0.050
        });
      } else {
        const errText = await response.text();
        throw new Error(`Ideogram error: ${errText}`);
      }
    }

    // 4. Recraft
    if (provider === 'recraft' && keys.recraft) {
      const response = await fetch("https://api.recraft.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.recraft}`
        },
        body: JSON.stringify({
          prompt,
          size: aspectRatio === "9:16" ? "1024x1792" : "1024x1024"
        })
      });
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json({
          images: [{ url: data.data?.[0]?.url || "" }],
          costUsd: 0.030
        });
      } else {
        const errText = await response.text();
        throw new Error(`Recraft error: ${errText}`);
      }
    }

    // Fallback/Simulated Response when key does not exist or API fails
    const demoUrl = `/assets/generated_${provider || "flux"}.png`;
    return res.status(200).json({
      images: [{ url: demoUrl }],
      costUsd: 0.040
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
