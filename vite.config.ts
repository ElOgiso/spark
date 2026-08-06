import { defineConfig, Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next()
        }

        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
          const pathname = url.pathname

          const relPath = pathname.replace(/^\/api\//, '')
          const possibleFiles = [
            path.resolve(__dirname, 'api', `${relPath}.ts`),
            path.resolve(__dirname, 'api', relPath, 'index.ts'),
          ]

          let filePath = ''
          for (const file of possibleFiles) {
            if (fs.existsSync(file)) {
              filePath = file;
              break;
            }
          }

          if (!filePath) {
            return next()
          }

          let body: any = {}
          if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
            const buffers: Buffer[] = []
            for await (const chunk of req) {
              buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
            }
            const bodyStr = Buffer.concat(buffers).toString('utf-8')
            if (bodyStr) {
              try {
                body = JSON.parse(bodyStr)
              } catch {
                body = bodyStr
              }
            }
          }

          const mod = await server.ssrLoadModule(filePath)
          const handler = mod.default || mod.handler

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: `No handler function exported in ${pathname}` }))
          }

          const vercelReq = Object.assign(req, {
            query: Object.fromEntries(url.searchParams.entries()),
            cookies: {},
            body,
          })

          const vercelRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code
              return vercelRes
            },
            json(data: any) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
              return vercelRes
            },
            send(data: any) {
              if (typeof data === 'object') {
                return vercelRes.json(data)
              }
              res.end(data)
              return vercelRes;
            },
            redirect(statusOrUrl: any, url?: string) {
              if (typeof statusOrUrl === 'number') {
                res.statusCode = statusOrUrl
                res.setHeader('Location', url!)
              } else {
                res.statusCode = 302
                res.setHeader('Location', statusOrUrl)
              }
              res.end()
              return vercelRes
            },
          })

          await handler(vercelReq, vercelRes)
        } catch (err: any) {
          console.error('[API Plugin Error]', err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message || 'Internal API Error' }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  define: {
    'process.env.GOOGLE_AI_API_KEY': JSON.stringify(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY || ''),
    'process.env.VITE_GOOGLE_AI_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ''),
    'process.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''),

    'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || process.env.VITE_OPENAI_API_KEY || ''),
    'process.env.OPEN_AI_KEY': JSON.stringify(process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || ''),
    'process.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || ''),

    'process.env.ANTHROPIC_API_KEY': JSON.stringify(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || ''),
    'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || ''),
    'process.env.VITE_ANTHROPIC_API_KEY': JSON.stringify(process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || ''),

    'process.env.XAI_API_KEY': JSON.stringify(process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.VITE_XAI_API_KEY || ''),
    'process.env.GROK_API_KEY': JSON.stringify(process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_XAI_API_KEY || ''),
    'process.env.VITE_XAI_API_KEY': JSON.stringify(process.env.VITE_XAI_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY || ''),

    'process.env.elevenlabs_API_Key': JSON.stringify(process.env.elevenlabs_API_Key || process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || ''),
    'process.env.ELEVENLABS_API_KEY': JSON.stringify(process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_API_Key || process.env.VITE_ELEVENLABS_API_KEY || ''),
    'process.env.VITE_ELEVENLABS_API_KEY': JSON.stringify(process.env.VITE_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_API_Key || ''),

    'process.env.YOUTUBE_API_KEY': JSON.stringify(process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || ''),
    'process.env.VITE_YOUTUBE_API_KEY': JSON.stringify(process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || ''),
    'process.env.GOOGLE_API_KEY': JSON.stringify(process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || ''),
    'process.env.VITE_GOOGLE_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || ''),
  },
  plugins: [
    apiServerPlugin(),
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
