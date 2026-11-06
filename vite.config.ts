import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { sfPwa } from './src/pwa/vite';

export default defineConfig({
  plugins: [
    vue(),
    sfPwa({
      name: 'Studio Framework',
      description: 'VSCode-like IDE shell for Vue 3',
      themeColor: '#000000',
      backgroundColor: '#1e1e1e',
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 7493,
    allowedHosts: ['mbp', 'localhost', '.local'],
  },
});
