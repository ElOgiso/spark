import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, prompt, aspectRatio, model } = req.body;
    const keys = {
      openai: process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || process.env.VITE_OPENAI_API_KEY,
      flux: process.env.FLUX_API_KEY || process.env.FAL_API_KEY || process.env.VITE_FLUX_API_KEY || process.env.VITE_FAL_API_KEY,
      ideogram: process.env.IDEOGRAM_API_KEY || process.env.VITE_IDEOGRAM_API_KEY,
      recraft: process.env.RECRAFT_API_KEY || process.env.VITE_RECRAFT_API_KEY
    };

    // 1. OpenAI Images (GPT-Image-1.5 / DALL-E 3)
    if (provider === 'openai_images' && keys.openai) {
      const isGptImage = !model || model.startsWith("gpt-image") || model === "gpt-image-1" || model === "gpt-image-1.5";
      const imageModel = model || (isGptImage ? "gpt-image-1.5" : "dall-e-3");
      const size = isGptImage
        ? (aspectRatio === "9:16" ? "1024x1536" : aspectRatio === "16:9" ? "1536x1024" : "1024x1024")
        : (aspectRatio === "9:16" ? "1024x1792" : aspectRatio === "16:9" ? "1792x1024" : "1024x1024");

      const reqPayload: any = {
        model: imageModel,
        prompt,
        n: 1,
        size,
      };

      if (!isGptImage) {
        reqPayload.response_format = "b64_json";
      }

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.openai}`
        },
        body: JSON.stringify(reqPayload)
      });
      if (response.ok) {
        const data = await response.json();
        const b64 = data.data?.[0]?.b64_json;
        const imgUrl = b64 ? `data:image/png;base64,${b64}` : (data.data?.[0]?.url || "");
        return res.status(200).json({
          images: [{ url: imgUrl }],
          costUsd: 0.080
        });
      } else {
        const errText = await response.text();
        throw new Error(`OpenAI Image error (${response.status}): ${errText}`);
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

    // No provider key configured — return error instead of fake asset
    return res.status(422).json({
      error: `No API key configured for provider "${provider || 'unknown'}". Add the required key in Vercel environment variables.`,
      images: [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
