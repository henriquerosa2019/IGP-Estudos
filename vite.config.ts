import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // No Vercel, as variáveis podem estar no process.env diretamente ou no env carregado
  const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (geminiKey) {
    console.log(`[Build] Gemini API Key encontrada (${geminiKey.substring(0, 4)}...)`);
  } else {
    console.warn("[Build] AVISO: VITE_GEMINI_API_KEY não encontrada no ambiente de build.");
  }

  const define: Record<string, any> = {};
  if (geminiKey) {
    define['process.env.GEMINI_API_KEY'] = JSON.stringify(geminiKey);
    define['import.meta.env.VITE_GEMINI_API_KEY'] = JSON.stringify(geminiKey);
  }

  return {
    plugins: [react(), tailwindcss()],
    define,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
