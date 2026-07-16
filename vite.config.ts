import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function sparkApiMiddleware() {
  return {
    name: 'spark-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/runtime/')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const pathname = urlObj.pathname;

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsedBody = JSON.parse(body);

                const pollUrlLocal = async (url: string, headers: any, maxSeconds = 45): Promise<string> => {
                  const start = Date.now();
                  while (Date.now() - start < maxSeconds * 1000) {
                    const r = await fetch(url, { headers });
                    if (!r.ok) {
                      throw new Error(`Polling failed with status ${r.status}`);
                    }
                    const d = await r.json();
                    const status = (d.status || d.state || "").toLowerCase();
                    if (status === "completed" || status === "succeeded" || status === "success" || status === "done") {
                      return d.videoUrl || d.assets?.video || d.output?.[0] || d.video?.url || "";
                    }
                    if (status === "failed" || status === "error") {
                      throw new Error(`Job execution failed: ${JSON.stringify(d.error || d.reason)}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  }
                  throw new Error("Polling timeout exceeded");
                };

                if (pathname === '/api/runtime/execute') {
                  const { provider, endpoint, payload } = parsedBody;

                  const keys = {
                    openai: process.env.OPEN_AI_KEY,
                    anthropic: process.env.ANTHROPIC_API_KEY,
                    google: process.env.GOOGLE_AI_API_KEY,
                    xai: process.env.XAI_API_KEY
                  };

                  let headers: Record<string, string> = {
                    'Content-Type': 'application/json'
                  };

                  let targetUrl = endpoint;

                  if (provider === 'openai') {
                    headers['Authorization'] = `Bearer ${keys.openai || ''}`;
                  } else if (provider === 'anthropic') {
                    headers['x-api-key'] = keys.anthropic || '';
                    headers['anthropic-version'] = '2023-06-01';
                    headers['anthropic-dangerous-direct-browser-access'] = 'true';
                  } else if (provider === 'google') {
                    const delimiter = targetUrl.includes('?') ? '&' : '?';
                    targetUrl = `${targetUrl}${delimiter}key=${keys.google || ''}`;
                  }

                  const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                  });

                  if (!response.ok) {
                    const errorText = await response.text();
                    res.statusCode = response.status;
                    res.end(JSON.stringify({ error: errorText }));
                    return;
                  }

                  const responseData = await response.json();
                  res.statusCode = 200;
                  res.end(JSON.stringify(responseData));
                } else if (pathname === '/api/runtime/image') {
                  const { provider, prompt, aspectRatio, model } = parsedBody;
                  const keys = {
                    openai: process.env.OPEN_AI_KEY,
                    flux: process.env.FLUX_API_KEY || process.env.FAL_API_KEY,
                    ideogram: process.env.IDEOGRAM_API_KEY,
                    recraft: process.env.RECRAFT_API_KEY
                  };

                  if (provider === 'openai_images' && keys.openai) {
                    const size = aspectRatio === "9:16" ? "1024x1792" : aspectRatio === "16:9" ? "1792x1024" : "1024x1024";
                    const response = await fetch("https://api.openai.com/v1/images/generations", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${keys.openai}`
                      },
                      body: JSON.stringify({ model: model || "dall-e-3", prompt, n: 1, size })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      res.statusCode = 200;
                      res.end(JSON.stringify({
                        images: [{ url: data.data?.[0]?.url || "" }],
                        costUsd: 0.080
                      }));
                      return;
                    }
                  }

                  if (provider === 'flux' && keys.flux) {
                    const isPro = model?.includes("pro");
                    const endpoint = isPro ? "https://queue.fal.run/fal-ai/flux/pro" : "https://queue.fal.run/fal-ai/flux/schnell";
                    const response = await fetch(endpoint, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Key ${keys.flux}`
                      },
                      body: JSON.stringify({ prompt, image_size: aspectRatio === "9:16" ? "portrait_16_9" : "landscape_16_9", sync_mode: true })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      res.statusCode = 200;
                      res.end(JSON.stringify({
                        images: [{ url: data.images?.[0]?.url || "" }],
                        costUsd: isPro ? 0.060 : 0.010
                      }));
                      return;
                    }
                  }

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
                      res.statusCode = 200;
                      res.end(JSON.stringify({
                        images: [{ url: data.data?.[0]?.url || "" }],
                        costUsd: 0.050
                      }));
                      return;
                    }
                  }

                  if (provider === 'recraft' && keys.recraft) {
                    const response = await fetch("https://api.recraft.ai/v1/images/generations", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${keys.recraft}`
                      },
                      body: JSON.stringify({ prompt, size: aspectRatio === "9:16" ? "1024x1792" : "1024x1024" })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      res.statusCode = 200;
                      res.end(JSON.stringify({
                        images: [{ url: data.data?.[0]?.url || "" }],
                        costUsd: 0.030
                      }));
                      return;
                    }
                  }

                  const demoUrl = `/assets/generated_${provider || "flux"}.png`;
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    images: [{ url: demoUrl }],
                    costUsd: 0.040
                  }));
                } else if (pathname === '/api/runtime/video') {
                  const { provider, prompt, imageUrl, aspectRatio, model } = parsedBody;
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

                  if (provider === 'runway' && keys.runway) {
                    const response = await fetch("https://api.runwayml.com/v1/tasks", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${keys.runway}`
                      },
                      body: JSON.stringify({ taskType: "image_to_video", prompt, image: imageUrl })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const taskId = data.id;
                      const videoUrl = await pollUrlLocal(
                        `https://api.runwayml.com/v1/tasks/${taskId}`,
                        { "Authorization": `Bearer ${keys.runway}` }
                      );
                      res.statusCode = 200;
                      res.end(JSON.stringify({ videoUrl, costUsd: 0.25 }));
                      return;
                    }
                  }

                  if (provider === 'luma' && keys.luma) {
                    const response = await fetch("https://api.lumalabs.ai/v1/generations", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${keys.luma}`
                      },
                      body: JSON.stringify({ prompt, aspect_ratio: aspectRatio || "9:16", image_url: imageUrl })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const taskId = data.id;
                      const videoUrl = await pollUrlLocal(
                        `https://api.lumalabs.ai/v1/generations/${taskId}`,
                        { "Authorization": `Bearer ${keys.luma}` }
                      );
                      res.statusCode = 200;
                      res.end(JSON.stringify({ videoUrl, costUsd: 0.22 }));
                      return;
                    }
                  }

                  if (provider === 'kling' && keys.kling) {
                    const response = await fetch("https://api.klingai.com/v1/videos/image-to-video", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${keys.kling}`
                      },
                      body: JSON.stringify({ prompt, image: imageUrl, duration: "5s" })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const taskId = data.id;
                      const videoUrl = await pollUrlLocal(
                        `https://api.klingai.com/v1/videos/image-to-video/${taskId}`,
                        { "Authorization": `Bearer ${keys.kling}` }
                      );
                      res.statusCode = 200;
                      res.end(JSON.stringify({ videoUrl, costUsd: 0.20 }));
                      return;
                    }
                  }

                  if (provider === 'wan' && keys.wan) {
                    const response = await fetch("https://queue.fal.run/fal-ai/wan/vid", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Key ${keys.wan}`
                      },
                      body: JSON.stringify({ prompt, image_url: imageUrl })
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const requestId = data.request_id;
                      const videoUrl = await pollUrlLocal(
                        `https://queue.fal.run/fal-ai/wan/vid/requests/${requestId}`,
                        { "Authorization": `Key ${keys.wan}` }
                      );
                      res.statusCode = 200;
                      res.end(JSON.stringify({ videoUrl, costUsd: 0.12 }));
                      return;
                    }
                  }

                  const demoUrl = `/assets/generated_${provider || "runway"}.mp4`;
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    videoUrl: demoUrl,
                    costUsd: 0.20
                  }));
                } else {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'Endpoint not found' }));
                }
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message || String(err) }));
              }
            });
            return;
          }
        }
        next();
      });

      server.httpServer?.on('upgrade', (request, socket, head) => {
        const urlObj = new URL(request.url || '', 'http://localhost');
        if (urlObj.pathname === '/api/runtime/voice') {
          console.log('[WebSocket Proxy] Intercepted upgrade request for xAI Realtime Agent');
          
          import('ws').then(({ WebSocketServer }) => {
            const wss = new WebSocketServer({ noServer: true });
            wss.handleUpgrade(request, socket, head, (ws) => {
              const xaiApiKey = process.env.XAI_API_KEY || '';
              const xaiWsUrl = `wss://api.x.ai/v1/realtime?model=agent_g32Zbh9KQ7QeZAWf`;

              const xaiSocket = new wss.clients.constructor(xaiWsUrl, {
                headers: {
                  Authorization: `Bearer ${xaiApiKey}`
                }
              });

              xaiSocket.on('open', () => {
                console.log('[WebSocket Proxy] Realtime socket link to xAI established');
              });

              ws.on('message', (message) => {
                if (xaiSocket.readyState === xaiSocket.OPEN) {
                  xaiSocket.send(message);
                }
              });

              xaiSocket.on('message', (message) => {
                if (ws.readyState === ws.OPEN) {
                  ws.send(message);
                }
              });

              xaiSocket.on('close', () => {
                console.log('[WebSocket Proxy] xAI socket link closed');
                ws.close();
              });

              ws.on('close', () => {
                console.log('[WebSocket Proxy] Client voice socket closed');
                xaiSocket.close();
              });
            });
          }).catch(err => {
            console.error('[WebSocket Proxy] Failed to load ws server:', err);
            socket.destroy();
          });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    sparkApiMiddleware(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
