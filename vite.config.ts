import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: { manualChunks: { charts: ["recharts"], validation: ["zod"] } },
    },
  },
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
