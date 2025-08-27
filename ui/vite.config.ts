import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // Optional: proxy API during dev if your FastAPI runs on 8000
    proxy: {
      "/ws": "http://127.0.0.1:8000",
      "/devices": "http://127.0.0.1:8000",
      "/modes": "http://127.0.0.1:8000"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
