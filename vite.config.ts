import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { parseIconMap, rewriteLucideImports } from './tools/lucideImports';

// Each icon from its own file, so a build loads the icons the app uses rather
// than all of them. See tools/lucideImports.ts for why: it is what keeps the
// build inside the memory Render gives it.
const lucideDirectImports = (): Plugin => {
  let icons: Map<string, string> | null = null;
  return {
    name: 'lucide-direct-imports',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || !/\.[jt]sx?$/.test(id) || !code.includes('lucide-react')) return null;
      icons ??= parseIconMap(fs.readFileSync(path.resolve(__dirname, 'node_modules/lucide-react/dist/esm/lucide-react.js'), 'utf8'));
      const out = rewriteLucideImports(code, icons);
      return out === null ? null : { code: out, map: null };
    },
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: `http://localhost:${env.PORT || 3001}`,
            changeOrigin: true,
          },
        },
      },
      plugins: [lucideDirectImports(), react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
