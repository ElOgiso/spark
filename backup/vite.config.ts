import { defineConfig } from 'vite'
import path from 'path'
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

export default defineConfig({
  define: {
    'process.env.GOOGLE_AI_API_KEY': JSON.stringify(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY || ''),
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
    'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || process.env.VITE_OPENAI_API_KEY || ''),
    'process.env.ANTHROPIC_API_KEY': JSON.stringify(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || ''),
    'process.env.XAI_API_KEY': JSON.stringify(process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.VITE_XAI_API_KEY || ''),
    'process.env.elevenlabs_API_Key': JSON.stringify(process.env.elevenlabs_API_Key || process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || ''),
    'process.env.ELEVENLABS_API_KEY': JSON.stringify(process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_API_Key || process.env.VITE_ELEVENLABS_API_KEY || ''),
  },
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
